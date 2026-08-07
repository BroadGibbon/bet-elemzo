/* ============================================================
   Bread Board Capital - kozos beallitasok
   Ezt a fajlt hasznalja mind a fooldal (script.js), mind a
   ceglap (company.js). Csak EGYSZER kell kitoltened.
   ============================================================ */

// CSERELD LE a sajat GitHub felhasznalonevedre es repod nevere!
const GITHUB_USER = "BroadGibon";
const GITHUB_REPO = "bet-elemzo";

const ADAT_BAZIS_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main`;
const ADAT_BAZIS_URL_TARTALEK = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}`;

/**
 * Egy JSON fajl letoltese a repobol, automatikus tartalek-forrassal,
 * ha az elsodleges (raw.githubusercontent.com) nem valaszolna.
 */
async function adatFajlLetoltese(relativUtvonal) {
  try {
    const valasz = await fetch(`${ADAT_BAZIS_URL}/${relativUtvonal}`, { cache: "no-store" });
    if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
    return await valasz.json();
  } catch (elsoHiba) {
    const valasz = await fetch(`${ADAT_BAZIS_URL_TARTALEK}/${relativUtvonal}`, { cache: "no-store" });
    if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
    return await valasz.json();
  }
}

/**
 * Egy JSON fajl letoltese, de ha nem talalhato (404), nem dob hibat,
 * hanem null-t ad vissza. Hasznos olyan adatokhoz, amik nem minden
 * cegnel elerhetok (pl. iXBRL - csak kb. 35 cegnel van).
 */
async function adatFajlLetoltveVagyNull(relativUtvonal) {
  try {
    return await adatFajlLetoltese(relativUtvonal);
  } catch (hiba) {
    return null;
  }
}
