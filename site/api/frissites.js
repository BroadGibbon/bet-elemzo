/**
 * Bread Board Capital - adatfrissito API vegpont
 *
 * Ez egy Vercel szerver-oldali fuggveny (nem fut a bongeszoben!). A celja,
 * hogy a weboldalon levo "Frissites" gomb biztonsagosan el tudjon inditani
 * egy GitHub Actions workflow-t, anelkul, hogy a GitHub hozzaferesi kulcs
 * (token) valaha is lathato lenne a bongeszoben.
 *
 * A jelszot es a GitHub tokent SOSEM a kodban taroljuk, hanem a Vercel
 * projekt "Environment Variables" beallitasaban, kornyezeti valtozokent:
 *   - GH_ACTIONS_TOKEN : a GitHub Personal Access Token
 *   - REFRESH_PASSWORD : a jelszo, amit a gomb megnyomasakor be kell irni
 *   - GITHUB_OWNER      : a GitHub felhasznaloneved
 *   - GITHUB_REPO_NAME  : a repo neve
 */

// Csak ezek a workflow-fajlok inditathatok el a gombbal - ez a "feherlista"
// megvedi attol, hogy barmi mas (pl. egy masik repo workflow-ja) elinduljon,
// meg akkor is, ha valaki valahogy kitalalna a jelszot.
const ENGEDELYEZETT_WORKFLOWK = {
  arfolyam: "frissites.yml",
  penzugy: "penzugy.yml",
  ixbrl: "ixbrl.yml",
  mutatok: "mutatok.yml",
  tortenet: "tortenet.yml",
};

async function workflowInditasa(fajlnev, owner, repo, token) {
  const valasz = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${fajlnev}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (valasz.status === 204) {
    return { fajlnev, siker: true };
  }
  const hibaSzoveg = await valasz.text().catch(() => "");
  return { fajlnev, siker: false, hiba: `HTTP ${valasz.status}: ${hibaSzoveg}` };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ hiba: "Csak POST kérés engedélyezett." });
    return;
  }

  const { jelszo, mit } = req.body || {};

  // 1. Jelszo-ellenorzes. Ha a szerveren nincs beallitva jelszo, biztonsagi
  // okbol MINDIG elutasitunk - igy sose maradhat veletlenul vedelem nelkul.
  if (!process.env.REFRESH_PASSWORD || jelszo !== process.env.REFRESH_PASSWORD) {
    res.status(401).json({ hiba: "Hibás jelszó." });
    return;
  }

  const token = process.env.GH_ACTIONS_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    res.status(500).json({
      hiba: "A szerver nincs teljesen beállítva (hiányzik a GH_ACTIONS_TOKEN, " +
        "GITHUB_OWNER vagy GITHUB_REPO_NAME környezeti változó a Vercel projektben).",
    });
    return;
  }

  // 2. Melyik workflow(oka)t inditsuk. "mind" eseten az osszes feherlistas
  // workflow-t elinditjuk egymas utan (ezek csak elinditasok, nem varjuk meg
  // a lefutasukat, ezert ez gyors marad).
  const inditando = mit === "mind"
    ? Object.values(ENGEDELYEZETT_WORKFLOWK)
    : [ENGEDELYEZETT_WORKFLOWK[mit]];

  if (!inditando[0]) {
    res.status(400).json({ hiba: `Ismeretlen frissítés típus: "${mit}"` });
    return;
  }

  try {
    const eredmenyek = [];
    for (const fajlnev of inditando) {
      eredmenyek.push(await workflowInditasa(fajlnev, owner, repo, token));
    }
    const mindOk = eredmenyek.every(e => e.siker);
    res.status(mindOk ? 200 : 502).json({ ok: mindOk, eredmenyek });
  } catch (hiba) {
    res.status(500).json({ hiba: hiba.message });
  }
}
