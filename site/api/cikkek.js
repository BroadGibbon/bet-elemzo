/**
 * Bread Board Capital - cikkek kezelese API vegpont
 *
 * Ez a fuggveny a data/cikkek.json fajlt modositja KOZVETLENUL a GitHub
 * repoban, a GitHub "Contents API"-jan keresztul - nem kell hozza kulon
 * adatbazis. Ugyanugy jelszo-vedett, mint a frissites.js.
 *
 * Kornyezeti valtozok (Vercel Environment Variables, ugyanazok mint a
 * frissites.js-hez):
 *   - GH_ACTIONS_TOKEN : GitHub Personal Access Token
 *       FONTOS: ehhez a tokenhez most mar "Contents: Read and write"
 *       jogosultsag IS kell, nem csak "Actions: Read and write"!
 *   - REFRESH_PASSWORD : ugyanaz a jelszo, mint az adatfrissiteshez
 *   - GITHUB_OWNER      : a GitHub felhasznaloneved
 *   - GITHUB_REPO_NAME  : a repo neve
 */

const CIKKEK_UTVONAL = "data/cikkek.json";

async function fajlLekerese(owner, repo, token) {
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${CIKKEK_UTVONAL}?ref=main`,
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
    throw new Error(`Nem sikerült beolvasni a cikkek.json fájlt (HTTP ${valasz.status}): ${szoveg}`);
  }
  const nyers = await valasz.json();
  const tartalom = Buffer.from(nyers.content, "base64").toString("utf-8");
  return { adat: JSON.parse(tartalom), sha: nyers.sha };
}

async function fajlIrasa(owner, repo, token, ujTartalomObjektum, sha, uzenet) {
  const ujTartalomSzoveg = JSON.stringify(ujTartalomObjektum, null, 2);
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${CIKKEK_UTVONAL}`,
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
    throw new Error(`Nem sikerült menteni a cikkek.json fájlt (HTTP ${valasz.status}): ${szoveg}`);
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
    res.status(500).json({
      hiba: "Hiányzó szerver-beállítás (GH_ACTIONS_TOKEN / GITHUB_OWNER / GITHUB_REPO_NAME).",
    });
    return;
  }

  try {
    const { adat, sha } = await fajlLekerese(owner, repo, token);
    if (!Array.isArray(adat.cikkek)) adat.cikkek = [];

    if (req.method === "POST") {
      const { cim, szerzo, link } = body;
      if (!cim || !szerzo || !link) {
        res.status(400).json({ hiba: "Hiányzik a cím, szerző vagy link mező." });
        return;
      }
      let ellenorzottLink;
      try {
        ellenorzottLink = new URL(link).toString();
      } catch {
        res.status(400).json({ hiba: "A link nem tűnik érvényes URL-nek." });
        return;
      }

      const ujCikk = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        cim: String(cim).trim(),
        szerzo: String(szerzo).trim(),
        link: ellenorzottLink,
        hozzaadva: new Date().toISOString(),
      };
      adat.cikkek.unshift(ujCikk);
      await fajlIrasa(owner, repo, token, adat, sha, `Új cikk hozzáadva: ${ujCikk.cim}`);
      res.status(200).json({ ok: true, cikk: ujCikk });
      return;
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) {
        res.status(400).json({ hiba: "Hiányzik az id mező." });
        return;
      }
      const elozoHossz = adat.cikkek.length;
      adat.cikkek = adat.cikkek.filter((c) => c.id !== id);
      if (adat.cikkek.length === elozoHossz) {
        res.status(404).json({ hiba: "Nem található ilyen azonosítójú cikk." });
        return;
      }
      await fajlIrasa(owner, repo, token, adat, sha, `Cikk törölve: ${id}`);
      res.status(200).json({ ok: true });
      return;
    }
  } catch (hiba) {
    res.status(500).json({ hiba: hiba.message });
  }
}
