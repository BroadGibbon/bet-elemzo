/* ============================================================
   Bread Board Capital - Ceglap
   Adatok osszegyujtese egy adott reszvenyhez, es minden blokk
   megjelenitese. A GITHUB_USER / GITHUB_REPO beallitas a
   config.js fajlban van.
   ============================================================ */

function fajlnevKodolas(kod) {
  return kod.replace(/\//g, "_").replace(/ /g, "_");
}

function szazalekFormazas(pct, tizedesjegy = 2) {
  if (pct === null || pct === undefined || isNaN(pct)) return "n/a";
  const elojel = pct > 0 ? "+" : "";
  return elojel + (pct * 100).toFixed(tizedesjegy).replace(".", ",") + "%";
}

function szazalekFormazasNyers(pctSzazalekban, tizedesjegy = 2) {
  // olyan ertekekhez, amik mar %-ban vannak (pl. changepctg), nem 0-1 aranyban
  if (pctSzazalekban === null || pctSzazalekban === undefined || isNaN(pctSzazalekban)) return "n/a";
  const elojel = pctSzazalekban > 0 ? "+" : "";
  return elojel + pctSzazalekban.toFixed(tizedesjegy).replace(".", ",") + "%";
}

function szamFormazas(ertek, tizedesjegy = 2) {
  if (ertek === null || ertek === undefined || isNaN(ertek)) return "n/a";
  return ertek.toFixed(tizedesjegy).replace(".", ",");
}

function penzFormazas(hufErtek) {
  if (hufErtek === null || hufErtek === undefined || isNaN(hufErtek)) return "n/a";
  const elojel = hufErtek < 0 ? "-" : "";
  const abs = Math.abs(hufErtek);
  if (abs >= 1_000_000_000_000) return elojel + (abs / 1_000_000_000_000).toFixed(2).replace(".", ",") + " billió Ft";
  if (abs >= 1_000_000_000) return elojel + (abs / 1_000_000_000).toFixed(2).replace(".", ",") + " Mrd Ft";
  if (abs >= 1_000_000) return elojel + (abs / 1_000_000).toFixed(1).replace(".", ",") + " M Ft";
  return elojel + Math.round(abs).toLocaleString("hu-HU") + " Ft";
}


// ------------------------------------------------------------------
// Osszes adat betoltese egy tickerhez. Ami nem letezik (pl. iXBRL),
// null lesz - ezt minden megjelenito fuggvenynek kezelnie kell.
// ------------------------------------------------------------------
async function cegAdatainakBetoltese(ticker) {
  const fajlnev = fajlnevKodolas(ticker);

  const [reszvenyekAdat, arfolyam, penzugy, mutatok, ixbrl, alapadatok, szektorok, piacAtlagok] =
    await Promise.all([
      adatFajlLetoltese("data/reszvenyek.json"),
      adatFajlLetoltveVagyNull(`data/arfolyam/${fajlnev}.json`),
      adatFajlLetoltveVagyNull(`data/penzugy/${fajlnev}.json`),
      adatFajlLetoltveVagyNull(`data/mutatok/${fajlnev}.json`),
      adatFajlLetoltveVagyNull(`data/ixbrl/${fajlnev}.json`),
      adatFajlLetoltveVagyNull(`data/alapadatok/${fajlnev}.json`),
      adatFajlLetoltese("data/szektorok.json"),
      adatFajlLetoltveVagyNull("data/piaci_atlagok.json"),
    ]);

  const elo = (reszvenyekAdat.reszvenyek || []).find(r => r.seccode === ticker) || null;
  const szektorInfo = (szektorok.szektorok || {})[ticker] || null;

  return {
    ticker, elo, arfolyam, penzugy, mutatok, ixbrl, alapadatok, szektorInfo, piacAtlagok,
    osszesReszveny: reszvenyekAdat.reszvenyek || [],
  };
}


function hivatalosCegnevKinyerese(penzugy) {
  const cim = penzugy?.eves_osszefoglalo?.cim || "";
  const m = cim.match(/Összefoglaló éves adatok - (.+)/);
  return m ? m[1] : null;
}


// ------------------------------------------------------------------
// Fejlec: ticker, cegnev, szektor, ar, valtozas
// ------------------------------------------------------------------
function fejlecMegjelenitese(adat) {
  document.getElementById("cfTicker").textContent = adat.ticker;
  document.getElementById("cfNev").textContent =
    hivatalosCegnevKinyerese(adat.penzugy) || adat.ticker;
  document.getElementById("cfSzektor").textContent =
    adat.szektorInfo?.szektor || "Nincs besorolva";

  const ar = adat.elo?.lasttradedprice;
  const penznem = adat.elo?.currencyid || "HUF";
  document.getElementById("cfAr").textContent =
    ar != null ? `${ar.toLocaleString("hu-HU")} ${penznem}` : "n/a";

  const valtozas = adat.elo?.changepctg;
  const valtozasEl = document.getElementById("cfValtozas");
  valtozasEl.textContent = szazalekFormazasNyers(valtozas);
  valtozasEl.className = "cf-header__valtozas " +
    (valtozas > 0 ? "cf-header__valtozas--pos" : valtozas < 0 ? "cf-header__valtozas--neg" : "");

  document.title = `${adat.ticker} — Bread Board Capital`;
}


// ------------------------------------------------------------------
// Gyors stat-sav: napi sav, 52 hetes sav, forgalom, kapitalizacio
// ------------------------------------------------------------------
function statSavMegjelenitese(adat) {
  const e = adat.elo || {};
  const elemek = [
    { label: "Napi sáv", ertek: `${e.lowprice ?? "n/a"} – ${e.highprice ?? "n/a"}` },
    { label: "52 hetes sáv", ertek: `${e.low52weekprice ?? "n/a"} – ${e.high52weekprice ?? "n/a"}` },
    { label: "Napi forgalom", ertek: penzFormazas(e.valuetoday) },
    { label: "Piaci kapitalizáció", ertek: penzFormazas(e.marketcap ? e.marketcap * 1_000_000 : null) },
    { label: "P/E", ertek: adat.mutatok?.arfolyam_mutatok?.pe != null ? szamFormazas(adat.mutatok.arfolyam_mutatok.pe) : "n/a" },
    { label: "P/BV", ertek: adat.mutatok?.arfolyam_mutatok?.pbv != null ? szamFormazas(adat.mutatok.arfolyam_mutatok.pbv) : "n/a" },
  ];

  document.getElementById("cfStatsav").innerHTML = elemek.map(el => `
    <div class="cf-statsav__elem">
      <span class="cf-statsav__label">${el.label}</span>
      <span class="cf-statsav__ertek">${el.ertek}</span>
    </div>
  `).join("");
}


// ------------------------------------------------------------------
// Alapadatok csempe (ISIN, nevertek, bevezetes datuma...)
// ------------------------------------------------------------------
function alapadatokMegjelenitese(adat) {
  const a = adat.alapadatok;
  const cel = document.getElementById("cfAlapadatok");
  if (!a) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elérhető alapadat ehhez a részvényhez.</p>`;
    return;
  }
  const sorok = [
    ["ISIN", a.isin],
    ["Névérték", a.nevertek],
    ["Bevezetés időpontja", a.bevezetes_datuma],
    ["Bevezetett mennyiség", a.bevezetett_mennyiseg ? `${a.bevezetett_mennyiseg} db` : "n/a"],
    ["Kereskedés pénzneme", a.kereskedes_penzneme],
  ];
  cel.innerHTML = sorok.map(([label, ertek]) => `
    <dt>${label}</dt><dd>${ertek || "n/a"}</dd>
  `).join("");
}


// ------------------------------------------------------------------
// Kulcsmutato csempek (P/E, P/BV, ROE, ROA)
// ------------------------------------------------------------------
function kulcsmutatokMegjelenitese(adat) {
  const m = adat.mutatok;
  const cel = document.getElementById("cfKulcsmutatok");
  if (!m) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elérhető mutató.</p>`;
    return;
  }
  const kartyak = [
    ["P/E", m.arfolyam_mutatok?.pe != null ? szamFormazas(m.arfolyam_mutatok.pe) : "n/a"],
    ["P/BV", m.arfolyam_mutatok?.pbv != null ? szamFormazas(m.arfolyam_mutatok.pbv) : "n/a"],
    ["ROE", szazalekFormazas(m.bet_sajat_mutatok?.roe_bet)],
    ["ROA", szazalekFormazas(m.bet_sajat_mutatok?.roa_bet)],
    ["Tőkeáttétel", m.dupont?.tokeattetel != null ? szamFormazas(m.dupont.tokeattetel) + "×" : "n/a"],
    ["Piotroski", m.piotroski ? `${m.piotroski.pontszam}/${m.piotroski.maximum}` : "n/a"],
  ];
  cel.innerHTML = kartyak.map(([label, ertek]) => `
    <div class="mutato-kartya">
      <div class="mutato-kartya__label">${label}</div>
      <div class="mutato-kartya__ertek">${ertek}</div>
    </div>
  `).join("");
}


// ------------------------------------------------------------------
// Egyszeru vonaldiagram vaszonra (canvas) - kulso konyvtar nelkul.
// pontok: [{x: Date, y: szam}, ...] - x szerint novekvo sorrendben.
// ------------------------------------------------------------------
function vonaldiagramRajzolasa(canvasId, pontok, szinCss, formatterY) {
  const canvas = document.getElementById(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const szelesseg = canvas.clientWidth || canvas.parentElement.clientWidth;
  const magassag = canvas.clientHeight || 260;
  canvas.width = szelesseg * dpr;
  canvas.height = magassag * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, szelesseg, magassag);

  if (!pontok || pontok.length < 2) {
    ctx.fillStyle = "#BEB3A0";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Nincs elég adat a grafikonhoz", szelesseg / 2, magassag / 2);
    return;
  }

  const bal_margo = 55, jobb_margo = 15, felso_margo = 15, also_margo = 30;
  const rajzSzelesseg = szelesseg - bal_margo - jobb_margo;
  const rajzMagassag = magassag - felso_margo - also_margo;

  const xMin = pontok[0].x.getTime();
  const xMax = pontok[pontok.length - 1].x.getTime();
  const yErtekek = pontok.map(p => p.y);
  let yMin = Math.min(...yErtekek);
  let yMax = Math.max(...yErtekek);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPuffer = (yMax - yMin) * 0.08;
  yMin -= yPuffer; yMax += yPuffer;

  function xVaszonra(x) {
    return bal_margo + ((x.getTime() - xMin) / (xMax - xMin)) * rajzSzelesseg;
  }
  function yVaszonra(y) {
    return felso_margo + (1 - (y - yMin) / (yMax - yMin)) * rajzMagassag;
  }

  // Vizszintes segedvonalak + Y feliratok
  ctx.strokeStyle = "rgba(190,179,160,0.35)";
  ctx.fillStyle = "#8a7a68";
  ctx.font = "11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  const lepesek = 4;
  for (let i = 0; i <= lepesek; i++) {
    const y = yMin + (i / lepesek) * (yMax - yMin);
    const yPix = yVaszonra(y);
    ctx.beginPath();
    ctx.moveTo(bal_margo, yPix);
    ctx.lineTo(szelesseg - jobb_margo, yPix);
    ctx.stroke();
    ctx.fillText(formatterY ? formatterY(y) : Math.round(y).toLocaleString("hu-HU"), bal_margo - 8, yPix + 4);
  }

  // X tengely datum-feliratok (elso, kozepso, utolso)
  ctx.textAlign = "center";
  [0, Math.floor(pontok.length / 2), pontok.length - 1].forEach(idx => {
    const p = pontok[idx];
    const label = p.x.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "2-digit" });
    ctx.fillText(label, xVaszonra(p.x), magassag - 8);
  });

  // Vonal
  ctx.beginPath();
  pontok.forEach((p, i) => {
    const px = xVaszonra(p.x), py = yVaszonra(p.y);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = szinCss;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Kitoltes a vonal alatt, halvanyan
  ctx.lineTo(xVaszonra(pontok[pontok.length - 1].x), yVaszonra(yMin));
  ctx.lineTo(xVaszonra(pontok[0].x), yVaszonra(yMin));
  ctx.closePath();
  ctx.fillStyle = szinCss + "22";
  ctx.fill();
}


// ------------------------------------------------------------------
// Arfolyamgrafikon idosik-szures szerint
// ------------------------------------------------------------------
let ARFOLYAM_ADAT_CACHE = null;

function arfolyamGrafikonFrissitese(idosik) {
  if (!ARFOLYAM_ADAT_CACHE || !ARFOLYAM_ADAT_CACHE.length) {
    vonaldiagramRajzolasa("arfolyamGrafikon", [], "#3C2A1B");
    return;
  }
  const most = new Date(ARFOLYAM_ADAT_CACHE[ARFOLYAM_ADAT_CACHE.length - 1].x);
  let hataridoNap = null;
  switch (idosik) {
    case "1H": hataridoNap = 7; break;
    case "1M": hataridoNap = 31; break;
    case "6M": hataridoNap = 183; break;
    case "1Y": hataridoNap = 366; break;
    case "5Y": hataridoNap = 366 * 5; break;
    default: hataridoNap = null; // MAX
  }
  let szurt = ARFOLYAM_ADAT_CACHE;
  if (hataridoNap) {
    const hatarido = new Date(most);
    hatarido.setDate(hatarido.getDate() - hataridoNap);
    szurt = ARFOLYAM_ADAT_CACHE.filter(p => p.x >= hatarido);
  }
  vonaldiagramRajzolasa("arfolyamGrafikon", szurt, "#C98A4B",
    y => Math.round(y).toLocaleString("hu-HU"));
}

function arfolyamSzekcioMegjelenitese(adat) {
  const nyers = adat.arfolyam?.adatok || [];
  ARFOLYAM_ADAT_CACHE = nyers.map(n => ({ x: new Date(n.datum), y: n.zaro })).filter(p => p.y != null);

  document.getElementById("idosikValaszto").addEventListener("click", (e) => {
    const gomb = e.target.closest("button");
    if (!gomb) return;
    document.querySelectorAll("#idosikValaszto button").forEach(b => b.classList.remove("aktiv"));
    gomb.classList.add("aktiv");
    arfolyamGrafikonFrissitese(gomb.dataset.idosik);
  });

  arfolyamGrafikonFrissitese("1Y");
}


// ------------------------------------------------------------------
// Eredmenykimutatas / merleg tablazatok (BET osszefoglalobol)
// ------------------------------------------------------------------
const MERLEG_SOROK = ["Eszközök összesen", "Befektetett eszközök", "Saját tőke", "Jegyzett tőke",
  "Hitelek", "Ügyfelekkel szembeni kötelezettségek"];
const EREDMENY_SOROK = ["Árbevétel", "Nettó kamatbevétel", "Nem kamatjellegű bevételek",
  "Üzleti eredmény", "Pénzügyi tevékenység nettó eredménye", "Adózás előtti eredmény",
  "Adózott eredmény", "Egy részvényre jutó eredmény (EPS)", "Egy (törzs)részvényre jutó osztalék"];

function penzugyiTablaFeleptese(sorok, sorNevek, evekSzama = 5) {
  const jelenLevoSorok = sorNevek.filter(nev => sorok[nev]);
  if (!jelenLevoSorok.length) return `<p class="csempe__lablec">Nincs adat.</p>`;

  const mindenEv = new Set();
  jelenLevoSorok.forEach(nev => Object.keys(sorok[nev]).forEach(ev => mindenEv.add(ev)));
  const evek = [...mindenEv].sort((a, b) => Number(a) - Number(b)).slice(-evekSzama);

  const perReszvenySorMinta = /részvényre jutó/;

  let html = `<table class="adat-tablazat"><thead><tr><th>Sor</th>${evek.map(e => `<th>${e}</th>`).join("")}</tr></thead><tbody>`;
  for (const nev of jelenLevoSorok) {
    const perReszveny = perReszvenySorMinta.test(nev);
    html += `<tr><td>${nev}</td>${evek.map(ev => {
      const ertek = sorok[nev][ev];
      if (ertek == null) return "<td>—</td>";
      return `<td>${perReszveny ? Math.round(ertek).toLocaleString("hu-HU") + " Ft" : penzFormazas(ertek)}</td>`;
    }).join("")}</tr>`;
  }
  html += "</tbody></table>";
  return html;
}

function penzugyiTablazatokMegjelenitese(adat) {
  const sorok = adat.penzugy?.eves_osszefoglalo?.sorok || {};
  document.getElementById("cfEredmenykimutatas").innerHTML = penzugyiTablaFeleptese(sorok, EREDMENY_SOROK);
  document.getElementById("cfMerleg").innerHTML = penzugyiTablaFeleptese(sorok, MERLEG_SOROK);
}


// ------------------------------------------------------------------
// Bevetel / uzemi eredmeny / nettó eredmeny historikus oszlopdiagram
// ------------------------------------------------------------------
function penzugyGrafikonRajzolasa(adat) {
  const sorok = adat.penzugy?.eves_osszefoglalo?.sorok || {};
  const canvas = document.getElementById("penzugyGrafikon");
  const bevetelSor = sorok["Árbevétel"] || sorok["Nettó kamatbevétel"] || {};
  const eredmenySor = sorok["Adózott eredmény"] || {};

  const evek = [...new Set([...Object.keys(bevetelSor), ...Object.keys(eredmenySor)])]
    .sort((a, b) => Number(a) - Number(b)).slice(-10);

  const dpr = window.devicePixelRatio || 1;
  const szelesseg = canvas.clientWidth || canvas.parentElement.clientWidth;
  const magassag = canvas.clientHeight || 260;
  canvas.width = szelesseg * dpr;
  canvas.height = magassag * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, szelesseg, magassag);

  if (!evek.length) {
    ctx.fillStyle = "#BEB3A0";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Nincs elég adat", szelesseg / 2, magassag / 2);
    return;
  }

  const bal_margo = 65, jobb_margo = 15, felso_margo = 15, also_margo = 30;
  const rajzSzelesseg = szelesseg - bal_margo - jobb_margo;
  const rajzMagassag = magassag - felso_margo - also_margo;

  const mindErtek = evek.flatMap(ev => [bevetelSor[ev] || 0, eredmenySor[ev] || 0]);
  const yMax = Math.max(...mindErtek, 1) * 1.15;
  const yMin = Math.min(0, ...mindErtek);

  function yVaszonra(y) {
    return felso_margo + (1 - (y - yMin) / (yMax - yMin)) * rajzMagassag;
  }

  const oszlopSzelesseg = rajzSzelesseg / evek.length;

  // Y tengely feliratok
  ctx.strokeStyle = "rgba(190,179,160,0.35)";
  ctx.fillStyle = "#8a7a68";
  ctx.font = "11px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = yMin + (i / 4) * (yMax - yMin);
    const yPix = yVaszonra(y);
    ctx.beginPath();
    ctx.moveTo(bal_margo, yPix);
    ctx.lineTo(szelesseg - jobb_margo, yPix);
    ctx.stroke();
    ctx.fillText(penzFormazas(y), bal_margo - 8, yPix + 4);
  }

  // Bevetel oszlopok
  ctx.textAlign = "center";
  evek.forEach((ev, i) => {
    const x0 = bal_margo + i * oszlopSzelesseg;
    const bevetel = bevetelSor[ev];
    if (bevetel != null) {
      const barW = oszlopSzelesseg * 0.35;
      const y0 = yVaszonra(0), y1 = yVaszonra(bevetel);
      ctx.fillStyle = "#E8BD82";
      ctx.fillRect(x0 + oszlopSzelesseg * 0.15, Math.min(y0, y1), barW, Math.abs(y1 - y0));
    }
    ctx.fillStyle = "#8a7a68";
    ctx.fillText(ev, x0 + oszlopSzelesseg / 2, magassag - 8);
  });

  // Nettó eredmeny vonal
  ctx.beginPath();
  evek.forEach((ev, i) => {
    const x = bal_margo + i * oszlopSzelesseg + oszlopSzelesseg / 2;
    const y = yVaszonra(eredmenySor[ev] ?? 0);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#3C2A1B";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  evek.forEach((ev, i) => {
    if (eredmenySor[ev] == null) return;
    const x = bal_margo + i * oszlopSzelesseg + oszlopSzelesseg / 2;
    const y = yVaszonra(eredmenySor[ev]);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#3C2A1B";
    ctx.fill();
  });

  // Jelmagyarazat
  ctx.textAlign = "left";
  ctx.fillStyle = "#E8BD82";
  ctx.fillRect(bal_margo, 2, 10, 10);
  ctx.fillStyle = "#3C2A1B";
  ctx.fillText("Árbevétel", bal_margo + 15, 11);
  ctx.beginPath();
  ctx.moveTo(bal_margo + 100, 7); ctx.lineTo(bal_margo + 115, 7);
  ctx.strokeStyle = "#3C2A1B"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillText("Adózott eredmény", bal_margo + 120, 11);
}


// ------------------------------------------------------------------
// DuPont ROE-lebontas
// ------------------------------------------------------------------
function dupontMegjelenitese(adat) {
  const d = adat.mutatok?.dupont;
  const cel = document.getElementById("cfDupont");
  if (!d) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elég adat a DuPont-bontáshoz.</p>`;
    return;
  }
  let html = `
    <div class="dupont-sor">
      <span class="dupont-sor__label">Eszközarányos megtérülés (ROA)</span>
      <span class="dupont-sor__ertek">${szazalekFormazas(d.roa)}</span>
    </div>
    <div class="dupont-sor">
      <span class="dupont-sor__label">Tőkeáttétel (Eszközök / Saját tőke)</span>
      <span class="dupont-sor__ertek">${szamFormazas(d.tokeattetel)}×</span>
    </div>`;
  if (d["nettó_margin"] != null) {
    html = `
    <div class="dupont-sor">
      <span class="dupont-sor__label">Nettó árrés (Eredmény / Árbevétel)</span>
      <span class="dupont-sor__ertek">${szazalekFormazas(d["nettó_margin"])}</span>
    </div>
    <div class="dupont-sor">
      <span class="dupont-sor__label">Eszközforgás (Árbevétel / Eszközök)</span>
      <span class="dupont-sor__ertek">${szamFormazas(d.eszkoz_forgas)}×</span>
    </div>
    <div class="dupont-sor">
      <span class="dupont-sor__label">Tőkeáttétel (Eszközök / Saját tőke)</span>
      <span class="dupont-sor__ertek">${szamFormazas(d.tokeattetel)}×</span>
    </div>`;
  }
  html += `
    <div class="dupont-eredmeny">
      <span>Számolt ROE</span>
      <span>${szazalekFormazas(d.roe_szamolt)}</span>
    </div>`;
  cel.innerHTML = html;
}


// ------------------------------------------------------------------
// Piotroski F-score megjelenitese
// ------------------------------------------------------------------
function piotroskiMegjelenitese(adat) {
  const p = adat.mutatok?.piotroski;
  const cel = document.getElementById("cfPiotroski");
  if (!p) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elég többéves adat a Piotroski-pontszámhoz.</p>`;
    return;
  }
  const jelekHtml = Object.entries(p.reszletek).map(([nev, jel]) => {
    const osztaly = jel === "✓" ? "piotroski-jel--ok" : jel === "✗" ? "piotroski-jel--nem" : "piotroski-jel--nincs";
    return `<li><span>${nev}</span><span class="${osztaly}">${jel}</span></li>`;
  }).join("");
  cel.innerHTML = `
    <div class="piotroski-pontszam">${p.pontszam} / ${p.maximum}</div>
    <ul class="piotroski-lista">${jelekHtml}</ul>
    <p class="csempe__lablec">
      A klasszikus Piotroski-módszer 9 kritériumán alapul, de csak azokat számoltuk,
      amikhez ténylegesen volt adat (${p.ev} és az előző év összevetésével) -
      ezért a nevező néha 9-nél kevesebb.
    </p>`;
}



// ------------------------------------------------------------------
// Kereskedesi adatok csempe (bid/ask, nyito/zaro)
// ------------------------------------------------------------------
function kereskedesMegjelenitese(adat) {
  const e = adat.elo || {};
  const cel = document.getElementById("cfKereskedes");
  const sorok = [
    ["Nyitó ár", e.openprice],
    ["Záró ár (előző nap)", e.lastclose],
    ["Vételi ár", e.bestbidprice],
    ["Eladási ár", e.bestaskprice],
    ["Átlagár", e.waprice != null ? Math.round(e.waprice) : null],
    ["Kötések száma ma", e.numtrades],
    ["Mai darabszám", e.volumetoday != null ? Math.round(e.volumetoday).toLocaleString("hu-HU") : null],
  ];
  cel.innerHTML = sorok.map(([label, ertek]) => `
    <dt>${label}</dt><dd>${ertek != null ? ertek : "n/a"}</dd>
  `).join("");
}


// ------------------------------------------------------------------
// Mutatok reszletesen: sajat tortenet + vs szektor + vs BET piac
// ------------------------------------------------------------------
function osszehasonlitoSavHtml(sajatErtek, piacMedian, szektorMedian, formatterFn, skalaMax) {
  if (sajatErtek == null) return `<p class="csempe__lablec">Nincs adat.</p>`;
  const ertekek = [sajatErtek, piacMedian, szektorMedian].filter(v => v != null);
  const maxErtek = skalaMax || Math.max(...ertekek.map(Math.abs)) * 1.3 || 1;
  const minErtek = Math.min(0, ...ertekek) - maxErtek * 0.05;
  const felsoHatar = maxErtek;

  function pozicioSzazalek(v) {
    return Math.max(0, Math.min(100, ((v - minErtek) / (felsoHatar - minErtek)) * 100));
  }

  let jelolok = `<div class="osszehasonlito-sav__jelolo osszehasonlito-sav__jelolo--sajat"
    style="left:${pozicioSzazalek(sajatErtek)}%" title="Saját érték: ${formatterFn(sajatErtek)}"></div>`;
  if (piacMedian != null) {
    jelolok += `<div class="osszehasonlito-sav__jelolo osszehasonlito-sav__jelolo--piac"
      style="left:${pozicioSzazalek(piacMedian)}%" title="BÉT medián: ${formatterFn(piacMedian)}"></div>`;
  }

  return `
    <div class="osszehasonlito-sav">${jelolok}</div>
    <div class="osszehasonlito-legenda">
      <span style="color:var(--espresso)">Saját: ${formatterFn(sajatErtek)}</span>
      ${piacMedian != null ? `<span style="color:var(--karamell)">BÉT medián: ${formatterFn(piacMedian)}</span>` : ""}
      ${szektorMedian != null ? `<span>Szektor medián: ${formatterFn(szektorMedian)}</span>` : ""}
    </div>`;
}

function mutatoReszletekMegjelenitese(adat) {
  const m = adat.mutatok;
  const piac = adat.piacAtlagok;
  const cel = document.getElementById("cfMutatoReszletek");

  if (!m || !piac) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elég adat az összehasonlításhoz.</p>`;
    return;
  }

  const szektorNev = adat.szektorInfo?.szektor;
  const szektorAdat = szektorNev ? piac.szektorok?.[szektorNev] : null;

  const sorok = [
    { nev: "ROE (saját tőke megtérülése)", sajat: m.bet_sajat_mutatok?.roe_bet,
      piacMedian: piac.piac_egesz?.roe_median, szektorMedian: szektorAdat?.roe_median,
      formatter: szazalekFormazas },
    { nev: "ROA (eszközarányos megtérülés)", sajat: m.bet_sajat_mutatok?.roa_bet,
      piacMedian: piac.piac_egesz?.roa_median, szektorMedian: szektorAdat?.roa_median,
      formatter: szazalekFormazas },
    { nev: "Tőkeáttétel (Kötelezettség / Saját tőke)", sajat: m.bet_sajat_mutatok?.tokeattetel_bet,
      piacMedian: piac.piac_egesz?.tokeattetel_median, szektorMedian: szektorAdat?.tokeattetel_median,
      formatter: v => szamFormazas(v) + "×" },
    { nev: "P/E", sajat: m.arfolyam_mutatok?.pe,
      piacMedian: piac.piac_egesz?.pe_median, szektorMedian: szektorAdat?.pe_median,
      formatter: v => szamFormazas(v) },
    { nev: "P/BV", sajat: m.arfolyam_mutatok?.pbv,
      piacMedian: piac.piac_egesz?.pbv_median, szektorMedian: szektorAdat?.pbv_median,
      formatter: v => szamFormazas(v) },
  ];

  cel.innerHTML = sorok.map(s => `
    <div class="mutato-blokk">
      <div class="mutato-blokk__fejlec">
        <span class="mutato-blokk__nev">${s.nev}</span>
        <span class="mutato-blokk__sajat">${s.formatter(s.sajat)}</span>
      </div>
      ${osszehasonlitoSavHtml(s.sajat, s.piacMedian, s.szektorMedian, s.formatter)}
    </div>
  `).join("");
}


// ------------------------------------------------------------------
// Hasonlo vallalatok (szektortarsak) tablazat
// ------------------------------------------------------------------
async function peerTablazatMegjelenitese(adat) {
  const cel = document.getElementById("cfPeerTablazat");
  const szektorNev = adat.szektorInfo?.szektor;
  const piac = adat.piacAtlagok;
  if (!szektorNev || !piac?.szektorok?.[szektorNev]) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs szektor-besorolás ehhez a céghez.</p>`;
    return;
  }
  const tagok = piac.szektorok[szektorNev].tagok.filter(t => t !== adat.ticker);
  if (!tagok.length) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs másik cég ebben a szektorban.</p>`;
    return;
  }

  const peerAdatok = await Promise.all(tagok.map(async (kod) => {
    const m = await adatFajlLetoltveVagyNull(`data/mutatok/${fajlnevKodolas(kod)}.json`);
    return { kod, m };
  }));

  let html = `<table class="adat-tablazat"><thead><tr>
    <th>Ticker</th><th>ROE</th><th>ROA</th><th>P/E</th><th>P/BV</th><th>Piotroski</th>
  </tr></thead><tbody>`;
  html += `<tr style="font-weight:600"><td>${adat.ticker} (ez a cég)</td>
    <td>${szazalekFormazas(adat.mutatok?.bet_sajat_mutatok?.roe_bet)}</td>
    <td>${szazalekFormazas(adat.mutatok?.bet_sajat_mutatok?.roa_bet)}</td>
    <td>${adat.mutatok?.arfolyam_mutatok?.pe != null ? szamFormazas(adat.mutatok.arfolyam_mutatok.pe) : "n/a"}</td>
    <td>${adat.mutatok?.arfolyam_mutatok?.pbv != null ? szamFormazas(adat.mutatok.arfolyam_mutatok.pbv) : "n/a"}</td>
    <td>${adat.mutatok?.piotroski ? adat.mutatok.piotroski.pontszam + "/" + adat.mutatok.piotroski.maximum : "n/a"}</td></tr>`;
  for (const p of peerAdatok) {
    if (!p.m) continue;
    html += `<tr><td><a href="company.html?ticker=${encodeURIComponent(p.kod)}">${p.kod}</a></td>
      <td>${szazalekFormazas(p.m.bet_sajat_mutatok?.roe_bet)}</td>
      <td>${szazalekFormazas(p.m.bet_sajat_mutatok?.roa_bet)}</td>
      <td>${p.m.arfolyam_mutatok?.pe != null ? szamFormazas(p.m.arfolyam_mutatok.pe) : "n/a"}</td>
      <td>${p.m.arfolyam_mutatok?.pbv != null ? szamFormazas(p.m.arfolyam_mutatok.pbv) : "n/a"}</td>
      <td>${p.m.piotroski ? p.m.piotroski.pontszam + "/" + p.m.piotroski.maximum : "n/a"}</td></tr>`;
  }
  html += "</tbody></table>";
  cel.innerHTML = html;
}


// ------------------------------------------------------------------
// Tulajdonosok es cegvezetes tab
// ------------------------------------------------------------------
function tulajdonosokMegjelenitese(adat) {
  const a = adat.alapadatok;
  const tulajCel = document.getElementById("cfTulajdonosok");
  const kozkezCel = document.getElementById("cfKozkezhanyad");
  const cegvezetesCel = document.getElementById("cfCegvezetes");

  if (!a) {
    tulajCel.innerHTML = `<p class="csempe__lablec">Nincs adat.</p>`;
    cegvezetesCel.innerHTML = "";
    return;
  }

  if (a.tulajdonosok && a.tulajdonosok.length) {
    tulajCel.innerHTML = `<table class="adat-tablazat"><thead><tr>
      <th>Tulajdonos</th><th>Hányad</th><th>Darabszám</th></tr></thead><tbody>` +
      a.tulajdonosok.map(t => `<tr><td>${t.nev}</td><td>${t.tulajdoni_hanyad}</td>
        <td>${Number(t.darabszam).toLocaleString("hu-HU")}</td></tr>`).join("") +
      "</tbody></table>";
  } else {
    tulajCel.innerHTML = `<p class="csempe__lablec">Nincs 5% fölötti bejelentett tulajdonos.</p>`;
  }
  kozkezCel.textContent = a.kozkezhanyad
    ? `Közkézhányad: ${a.kozkezhanyad} (frissítve: ${a.kozkezhanyad_frissitve || "n/a"})`
    : "";

  const blokkok = [
    ["Igazgatóság", a.igazgatosag],
    ["Vállalatvezetés", a.vallalatvezetes],
    ["Felügyelőbizottság", a.felugyelobizottsag],
  ];
  cegvezetesCel.innerHTML = blokkok.map(([cim, tartalom]) => `
    <div class="kv-blokk">
      <div class="kv-blokk__cim">${cim}</div>
      <div class="kv-blokk__tartalom">${tartalom || "Nincs adat"}</div>
    </div>
  `).join("");
}


// ------------------------------------------------------------------
// Sankey-szeru folyamatabra: eredmenykimutatas es merleg összetetel.
// Csak ott jelenik meg, ahol van reszletes iXBRL adat.
// ------------------------------------------------------------------
function ixbrlErtekKereses(ixbrlAdatok, fogalomLista, idopontTipus) {
  // idopontTipus: "idoszak" (pl. eves profit) vagy "idopont" (pl. merlegsor)
  for (const fogalom of fogalomLista) {
    const ertekek = ixbrlAdatok[fogalom];
    if (!ertekek) continue;
    const kulcsok = Object.keys(ertekek);
    const szurtKulcsok = idopontTipus === "idoszak"
      ? kulcsok.filter(k => k.includes(".."))
      : kulcsok.filter(k => !k.includes(".."));
    if (!szurtKulcsok.length) continue;
    // A legkesobbi datumot valasztjuk (a periodus vegdatuma vagy az idopont)
    szurtKulcsok.sort((a, b) => a.split("..").pop().localeCompare(b.split("..").pop()));
    const utolsoKulcs = szurtKulcsok[szurtKulcsok.length - 1];
    return { ertek: ertekek[utolsoKulcs], idokulcs: utolsoKulcs };
  }
  return null;
}

function folyamatSavSvg(cimkekEsErtekek, szinek, szelesseg, magassagEgyseg) {
  const osszeg = cimkekEsErtekek.reduce((s, c) => s + Math.max(c.ertek, 0), 0);
  if (osszeg <= 0) return "";
  let x = 0;
  let elemek = "";
  cimkekEsErtekek.forEach((c, i) => {
    const w = (Math.max(c.ertek, 0) / osszeg) * szelesseg;
    elemek += `<rect x="${x}" y="0" width="${w}" height="${magassagEgyseg}" fill="${szinek[i % szinek.length]}" stroke="#3C2A1B" stroke-width="1"/>`;
    if (w > 60) {
      elemek += `<text x="${x + w / 2}" y="${magassagEgyseg / 2 - 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="#3C2A1B">${c.nev}</text>`;
      elemek += `<text x="${x + w / 2}" y="${magassagEgyseg / 2 + 12}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="#3C2A1B" opacity="0.75">${penzFormazas(c.ertek)}</text>`;
    }
    x += w;
  });
  return elemek;
}

function sankeyMegjelenitese(adat) {
  const szekcio = document.getElementById("sankeySzekcio");
  const ixbrlAdatok = adat.ixbrl?.adatok;
  if (!ixbrlAdatok) {
    szekcio.hidden = true;
    return;
  }

  const revenue = ixbrlErtekKereses(ixbrlAdatok,
    ["Revenue", "RevenueFromContractsWithCustomers", "InterestRevenueCalculatedUsingEffectiveInterestMethod"], "idoszak");
  const profitLossBeforeTax = ixbrlErtekKereses(ixbrlAdatok, ["ProfitLossBeforeTax"], "idoszak");
  const profitLoss = ixbrlErtekKereses(ixbrlAdatok, ["ProfitLoss"], "idoszak");
  const assets = ixbrlErtekKereses(ixbrlAdatok, ["Assets"], "idopont");
  const equity = ixbrlErtekKereses(ixbrlAdatok, ["Equity"], "idopont");
  let liabilities = ixbrlErtekKereses(ixbrlAdatok, ["Liabilities"], "idopont");
  if (!liabilities && assets && equity) {
    // Nem minden ceg cimkezi kulon az osszesitett "Liabilities" sort - ha
    // hianyzik, Eszkozok - Sajat toke alapjan szamoljuk (ez mindig igaz
    // azonossag a merlegben, tehat biztonsagos kozelites).
    liabilities = { ertek: assets.ertek - equity.ertek, idokulcs: assets.idokulcs, szamolt: true };
  }

  const vanEredmenyAdat = revenue && profitLoss;
  const vanMerlegAdat = assets && equity && liabilities;

  if (!vanEredmenyAdat && !vanMerlegAdat) {
    szekcio.hidden = true;
    return;
  }
  szekcio.hidden = false;

  const szelesseg = 640, sorMagassag = 60, sorTav = 45;
  let svgTartalom = "";
  let yPoz = 10;

  if (vanEredmenyAdat) {
    const koltsegekAdo = revenue.ertek - profitLoss.ertek;
    const ado = profitLossBeforeTax ? Math.max(profitLossBeforeTax.ertek - profitLoss.ertek, 0) : null;
    const koltsegek = ado != null ? koltsegekAdo - ado : koltsegekAdo;

    svgTartalom += `<text x="0" y="${yPoz}" font-family="Alfa Slab One" font-size="13" fill="#3C2A1B">Árbevétel → eredmény</text>`;
    yPoz += 15;
    svgTartalom += `<g transform="translate(0,${yPoz})">` +
      folyamatSavSvg([{ nev: "Árbevétel", ertek: revenue.ertek }], ["#E8BD82"], szelesseg, sorMagassag) + "</g>";
    yPoz += sorMagassag + sorTav;

    const masodikSor = [{ nev: "Költségek", ertek: Math.max(koltsegek, 0) }];
    if (ado != null && ado > 0) masodikSor.push({ nev: "Adó", ertek: ado });
    masodikSor.push({ nev: "Nettó eredmény", ertek: Math.max(profitLoss.ertek, 0) });

    svgTartalom += `<g transform="translate(0,${yPoz})">` +
      folyamatSavSvg(masodikSor, ["#BEB3A0", "#A6412B", "#4B7A3F"], szelesseg, sorMagassag) + "</g>";
    yPoz += sorMagassag + sorTav;
  }

  if (vanMerlegAdat) {
    svgTartalom += `<text x="0" y="${yPoz}" font-family="Alfa Slab One" font-size="13" fill="#3C2A1B">Mérleg összetétel</text>`;
    if (liabilities.szamolt) {
      svgTartalom += `<text x="0" y="${yPoz + 13}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#8a7a68">(kötelezettség = eszközök − saját tőke, mert nincs külön címkézve)</text>`;
      yPoz += 13;
    }
    yPoz += 15;
    svgTartalom += `<g transform="translate(0,${yPoz})">` +
      folyamatSavSvg([{ nev: "Eszközök összesen", ertek: assets.ertek }], ["#C98A4B"], szelesseg, sorMagassag) + "</g>";
    yPoz += sorMagassag + sorTav;
    svgTartalom += `<g transform="translate(0,${yPoz})">` +
      folyamatSavSvg([
        { nev: "Kötelezettségek", ertek: liabilities.ertek },
        { nev: "Saját tőke", ertek: equity.ertek },
      ], ["#BEB3A0", "#4B7A3F"], szelesseg, sorMagassag) + "</g>";
    yPoz += sorMagassag + 10;
  }

  document.getElementById("sankeyDiagram").innerHTML =
    `<svg viewBox="0 0 ${szelesseg} ${yPoz}" width="${szelesseg}" height="${yPoz}">${svgTartalom}</svg>`;
}


// ------------------------------------------------------------------
// Tabok kozotti valtas
// ------------------------------------------------------------------
function tabokBekotese() {
  document.getElementById("cfTabok").addEventListener("click", (e) => {
    const gomb = e.target.closest(".cf-tab");
    if (!gomb) return;
    document.querySelectorAll(".cf-tab").forEach(b => b.classList.remove("cf-tab--aktiv"));
    document.querySelectorAll(".cf-tabtartalom").forEach(t => t.classList.remove("cf-tabtartalom--aktiv"));
    gomb.classList.add("cf-tab--aktiv");
    document.querySelector(`[data-tabtartalom="${gomb.dataset.tab}"]`).classList.add("cf-tabtartalom--aktiv");
  });
}


// ------------------------------------------------------------------
// Inditas
// ------------------------------------------------------------------
async function inditas() {
  const parancssor = new URLSearchParams(window.location.search);
  const ticker = parancssor.get("ticker");

  if (!ticker) {
    document.getElementById("betoltesUzenet").hidden = true;
    const hiba = document.getElementById("hibaUzenet");
    hiba.hidden = false;
    hiba.textContent = "Nincs megadva részvény (hiányzik a ?ticker= paraméter az URL-ből).";
    return;
  }

  try {
    const adat = await cegAdatainakBetoltese(ticker);

    if (!adat.elo) {
      document.getElementById("betoltesUzenet").hidden = true;
      const hiba = document.getElementById("hibaUzenet");
      hiba.hidden = false;
      hiba.textContent = `Nem található "${ticker}" nevű részvény.`;
      return;
    }

    fejlecMegjelenitese(adat);
    statSavMegjelenitese(adat);
    alapadatokMegjelenitese(adat);
    kereskedesMegjelenitese(adat);
    kulcsmutatokMegjelenitese(adat);
    arfolyamSzekcioMegjelenitese(adat);
    penzugyiTablazatokMegjelenitese(adat);
    penzugyGrafikonRajzolasa(adat);
    dupontMegjelenitese(adat);
    piotroskiMegjelenitese(adat);
    mutatoReszletekMegjelenitese(adat);
    tulajdonosokMegjelenitese(adat);
    sankeyMegjelenitese(adat);
    peerTablazatMegjelenitese(adat); // aszinkron, nem kell megvarni a tobbihez

    tabokBekotese();

    document.getElementById("betoltesUzenet").hidden = true;
    document.getElementById("ceglapFo").hidden = false;

    // Ujrarajzolas ablakmeret-valtaskor
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        arfolyamGrafikonFrissitese(document.querySelector("#idosikValaszto .aktiv")?.dataset.idosik || "1Y");
        penzugyGrafikonRajzolasa(adat);
      }, 200);
    });

  } catch (hiba) {
    console.error(hiba);
    document.getElementById("betoltesUzenet").hidden = true;
    const hibaEl = document.getElementById("hibaUzenet");
    hibaEl.hidden = false;
    hibaEl.textContent = "Hiba történt az adatok betöltése közben. Ellenőrizd a config.js " +
      "GITHUB_USER / GITHUB_REPO beállítását.";
  }
}

inditas();
