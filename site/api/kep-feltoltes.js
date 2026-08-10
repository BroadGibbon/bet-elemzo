/**
 * Bread Board Capital - kep feltoltes API vegpont
 *
 * Egy tetszoleges kepet (mar a bongeszoben tomoritve/atmeretezve, base64
 * "data URL" formaban kapva) elment a GitHub repoba, a Contents API-n
 * keresztul - ugyanugy, mint ahogy a cikkek.json-t is irjuk.
 *
 * FONTOS MERETKORLAT: a Vercel szerver-oldali fuggvenyek alapertelmezett
 * kerese-meret korlatja kb. 4.5 MB. Ezert a kepet MINDIG a bongeszoben
 * kell eloszor tomoriteni/atmeretezni (lasd admin.js: kepTomoritese),
 * mielott ide kuldjuk - kulonben a feltoltes hibaval terhet vissza.
 *
 * Kornyezeti valtozok (ugyanazok, mint a tobbi API vegpontnal):
 *   - GH_ACTIONS_TOKEN : GitHub Personal Access Token ("Contents: Read
 *       and write" jogosultsaggal)
 *   - REFRESH_PASSWORD : jelszo
 *   - GITHUB_OWNER, GITHUB_REPO_NAME
 */

async function meglevoShaLekerese(owner, repo, token, utvonal) {
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${utvonal}?ref=main`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (valasz.status === 404) return null; // meg nem letezik a fajl - ez rendben van
  if (!valasz.ok) {
    throw new Error(`Nem sikerult ellenorizni a meglevo fajlt (HTTP ${valasz.status})`);
  }
  const adat = await valasz.json();
  return adat.sha;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ hiba: "Csak POST kérés engedélyezett." });
    return;
  }

  const { jelszo, utvonal, adatUrl } = req.body || {};

  if (!process.env.REFRESH_PASSWORD || jelszo !== process.env.REFRESH_PASSWORD) {
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

  if (!utvonal || !adatUrl) {
    res.status(400).json({ hiba: "Hiányzik az utvonal vagy az adatUrl mező." });
    return;
  }

  // Az utvonal csak a site/assets/hazi-cipok/ vagy site/assets/cikkek/ ala
  // mutathat - ez vedelem az ellen, hogy veletlenul (vagy szandekosan)
  // barmi mas fajlt felul tudjunk irni a repoban.
  const engedelyezettElotagok = ["site/assets/hazi-cipok/", "site/assets/cikkek/"];
  if (!engedelyezettElotagok.some((elotag) => utvonal.startsWith(elotag))) {
    res.status(400).json({
      hiba: "Csak a site/assets/hazi-cipok/ vagy site/assets/cikkek/ mappába lehet feltölteni.",
    });
    return;
  }

  const illeszkedes = adatUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!illeszkedes) {
    res.status(400).json({ hiba: "Az adatUrl nem tűnik érvényes kép data-URL-nek." });
    return;
  }
  const base64Tartalom = illeszkedes[2];

  try {
    const meglevoSha = await meglevoShaLekerese(owner, repo, token, utvonal);

    const valasz = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${utvonal}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Kép feltöltve: ${utvonal}`,
          content: base64Tartalom,
          sha: meglevoSha || undefined,
          branch: "main",
        }),
      }
    );

    if (!valasz.ok) {
      const szoveg = await valasz.text().catch(() => "");
      throw new Error(`GitHub hiba (HTTP ${valasz.status}): ${szoveg}`);
    }

    // A vegleges, publikusan elerheto URL - MINDIG a teljes repo-beli
    // utvonalat hasznaljuk (a "site/" elotagot NEM vagjuk le), mert a
    // raw.githubusercontent.com a tenyleges repo-struktura szerint szolgal ki.
    res.status(200).json({
      ok: true,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${utvonal}`,
    });
  } catch (hiba) {
    res.status(500).json({ hiba: hiba.message });
  }
}
