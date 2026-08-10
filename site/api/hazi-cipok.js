/**
 * Bread Board Capital - Hazi cipok kezelese API vegpont
 *
 * Ugyanaz a mintazat, mint a cikkek.js: a data/hazi_cipok.json fajlt
 * modositja a GitHub Contents API-n keresztul, jelszo-vedetten.
 * A kepeket (borito + karusel-kepek) mar KULON, a kep-feltoltes.js
 * vegponton keresztul kell feltolteni, MIELOTT ide kuldjuk a mentest -
 * ez a fuggveny csak a mar feltoltott kepek URL-jeit es a szoveges
 * adatokat menti el, egyetlen JSON-bejegyzeskent.
 */

const CIPOK_UTVONAL = "data/hazi_cipok.json";

async function fajlLekerese(owner, repo, token) {
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${CIPOK_UTVONAL}?ref=main`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!valasz.ok) {
    const szoveg = await valasz.text().catch(() => "");
    throw new Error(`Nem sikerült beolvasni a hazi_cipok.json fájlt (HTTP ${valasz.status}): ${szoveg}`);
  }
  const nyers = await valasz.json();
  const tartalom = Buffer.from(nyers.content, "base64").toString("utf-8");
  return { adat: JSON.parse(tartalom), sha: nyers.sha };
}

async function fajlIrasa(owner, repo, token, ujTartalomObjektum, sha, uzenet) {
  const ujTartalomSzoveg = JSON.stringify(ujTartalomObjektum, null, 2);
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${CIPOK_UTVONAL}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: uzenet,
        content: Buffer.from(ujTartalomSzoveg, "utf-8").toString("base64"),
        sha,
        branch: "main",
      }),
    }
  );
  if (!valasz.ok) {
    const szoveg = await valasz.text().catch(() => "");
    throw new Error(`Nem sikerült menteni a hazi_cipok.json fájlt (HTTP ${valasz.status}): ${szoveg}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ hiba: "Csak POST (hozzáadás) vagy DELETE (törlés) kérés engedélyezett." });
    return;
  }

  const body = req.body || {};

  if (!process.env.REFRESH_PASSWORD || body.jelszo !== process.env.REFRESH_PASSWORD) {
    res.status(401).json({ hiba: "Hibás jelszó." });
    return;
  }

  const token = process.env.GH_ACTIONS_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) {
    res.status(500).json({ hiba: "Hiányzó szerver-beállítás." });
    return;
  }

  try {
    const { adat, sha } = await fajlLekerese(owner, repo, token);
    if (!Array.isArray(adat.cipok)) adat.cipok = [];

    if (req.method === "POST") {
      const { szerzo, leiras, borito_kep, kepek } = body;
      if (!szerzo || !leiras || !borito_kep || !Array.isArray(kepek) || kepek.length === 0) {
        res.status(400).json({
          hiba: "Hiányzik a szerző, a leírás, a borítókép, vagy nincs egyetlen kép sem a listában.",
        });
        return;
      }

      const ujCipo = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        szerzo: String(szerzo).trim(),
        leiras: String(leiras).trim(),
        borito_kep,
        kepek: kepek.map((k) => ({
          url: k.url,
          szoveg: String(k.szoveg || "").trim(),
        })),
        hozzaadva: new Date().toISOString(),
      };
      adat.cipok.unshift(ujCipo);
      await fajlIrasa(owner, repo, token, adat, sha, `Új házi cipó hozzáadva (${ujCipo.szerzo})`);
      res.status(200).json({ ok: true, cipo: ujCipo });
      return;
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) {
        res.status(400).json({ hiba: "Hiányzik az id mező." });
        return;
      }
      const elozoHossz = adat.cipok.length;
      adat.cipok = adat.cipok.filter((c) => c.id !== id);
      if (adat.cipok.length === elozoHossz) {
        res.status(404).json({ hiba: "Nem található ilyen azonosítójú cipó." });
        return;
      }
      await fajlIrasa(owner, repo, token, adat, sha, `Házi cipó törölve: ${id}`);
      res.status(200).json({ ok: true });
      return;
    }
  } catch (hiba) {
    res.status(500).json({ hiba: hiba.message });
  }
}
