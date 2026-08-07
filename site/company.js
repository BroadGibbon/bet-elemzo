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

  if (!pontok || pontok.length < 2) {
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, szelesseg, magassag);
    ctx.fillStyle = "#BEB3A0";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Nincs elég adat a grafikonhoz", szelesseg / 2, magassag / 2);
    canvas._chartAdat = null;
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

  // A rajzolashoz hasznalt adatokat elmentjuk a vaszonra, hogy a
  // hover-kezeles (lentebb) barmikor ujra tudja rajzolni tiszta allapotbol.
  canvas._chartAdat = {
    pontok, xVaszonra, yVaszonra, formatterY, szinCss, magassag,
    felso_margo, rajzMagassag, dpr, szelesseg, bal_margo, jobb_margo, yMin, yMax,
  };

  vonaldiagramAlapRajzolasa(canvas, canvas._chartAdat);

  // Az eger-esemenyeket csak EGYSZER kotjuk be egy vaszonra (nem minden
  // ujrarajzolaskor), kulonben egymásra halmozódnának a listenerek.
  if (!canvas._hoverBekotve) {
    canvas._hoverBekotve = true;
    canvas.addEventListener("mousemove", (e) => vonaldiagramHoverKezelese(canvasId, e));
    canvas.addEventListener("mouseleave", () => vonaldiagramHoverElrejtese(canvasId));
  }
}


// ------------------------------------------------------------------
// A vonaldiagram "tiszta" allapotanak (racsvonalak, tengelyfeliratok,
// vonal, kitoltes) kirajzolasa - ezt hasznalja mind a kezdeti rajzolas,
// mind a hover-kezeles (ami minden egermozdulaskor ujrarajzolja ezt,
// mielott ra rajzolna a sajat jelzovonalat).
// ------------------------------------------------------------------
function vonaldiagramAlapRajzolasa(canvas, adat) {
  const { pontok, xVaszonra, yVaszonra, formatterY, szinCss, magassag,
    felso_margo, rajzMagassag, dpr, szelesseg, bal_margo, jobb_margo, yMin, yMax } = adat;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, szelesseg, magassag);

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
// Vonaldiagram hover: a legkozelebbi ponthoz tartozo datum/ertek
// megjelenitese egy kis buborekban, plusz egy fuggoleges jelzovonal.
// ------------------------------------------------------------------
function vonaldiagramHoverKezelese(canvasId, esemeny) {
  const canvas = document.getElementById(canvasId);
  const adat = canvas._chartAdat;
  if (!adat) return;

  const rect = canvas.getBoundingClientRect();
  const egerX = esemeny.clientX - rect.left;

  // A legkozelebbi pont keresese az eger X pozicioja alapjan
  let legkozelebbi = adat.pontok[0];
  let legkisebbTav = Infinity;
  for (const p of adat.pontok) {
    const tav = Math.abs(adat.xVaszonra(p.x) - egerX);
    if (tav < legkisebbTav) { legkisebbTav = tav; legkozelebbi = p; }
  }

  // Eloszor TISZTAN ujrarajzoljuk az alap-diagramot (kulonben az elozo
  // hover-jelzovonalak egymasra halmozodnanak), utana rakjuk ra a
  // jelzovonalat es a kiemelt pontot.
  vonaldiagramAlapRajzolasa(canvas, adat);

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const px = adat.xVaszonra(legkozelebbi.x);
  ctx.beginPath();
  ctx.moveTo(px, adat.felso_margo);
  ctx.lineTo(px, adat.felso_margo + adat.rajzMagassag);
  ctx.strokeStyle = "rgba(60,42,27,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, adat.yVaszonra(legkozelebbi.y), 4, 0, Math.PI * 2);
  ctx.fillStyle = adat.szinCss;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  const tooltip = document.getElementById(canvasId + "Tooltip") || document.getElementById("arfolyamTooltip");
  if (tooltip) {
    tooltip.hidden = false;
    const datumSzoveg = legkozelebbi.x.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "2-digit" });
    const ertekSzoveg = adat.formatterY ? adat.formatterY(legkozelebbi.y) : legkozelebbi.y;
    tooltip.innerHTML = `<strong>${ertekSzoveg}</strong>${datumSzoveg}`;
    tooltip.style.left = `${px}px`;
    tooltip.style.top = `${adat.yVaszonra(legkozelebbi.y)}px`;
  }
}

function vonaldiagramHoverElrejtese(canvasId) {
  const tooltip = document.getElementById(canvasId + "Tooltip") || document.getElementById("arfolyamTooltip");
  if (tooltip) tooltip.hidden = true;
  const canvas = document.getElementById(canvasId);
  if (canvas && canvas._chartAdat) {
    vonaldiagramAlapRajzolasa(canvas, canvas._chartAdat);
  }
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

  arfolyamGrafikonFrissitese("1M");
}


// ------------------------------------------------------------------
// Eredmenykimutatas / merleg tablazatok (BET osszefoglalobol)
// ------------------------------------------------------------------
const MERLEG_SOROK = ["Eszközök összesen", "Befektetett eszközök", "Saját tőke", "Jegyzett tőke",
  "Hitelek", "Ügyfelekkel szembeni kötelezettségek"];
const EREDMENY_SOROK = ["Árbevétel", "Nettó kamatbevétel", "Nem kamatjellegű bevételek",
  "Üzleti eredmény", "Pénzügyi tevékenység nettó eredménye", "Adózás előtti eredmény",
  "Adózott eredmény", "Egy részvényre jutó eredmény (EPS)", "Egy (törzs)részvényre jutó osztalék"];

function penzugyiTablaFeleptese(sorok, sorNevek, evekSzama = 6) {
  const jelenLevoSorok = sorNevek.filter(nev => sorok[nev]);
  if (!jelenLevoSorok.length) return `<p class="csempe__lablec">Nincs adat.</p>`;

  const mindenEv = new Set();
  jelenLevoSorok.forEach(nev => Object.keys(sorok[nev]).forEach(ev => mindenEv.add(ev)));
  const evek = [...mindenEv].sort((a, b) => Number(a) - Number(b)).slice(-evekSzama);

  const perReszvenySorMinta = /részvényre jutó/;

  function yoySzazalek(elozo, jelenlegi) {
    if (elozo == null || jelenlegi == null || elozo === 0) return null;
    return (jelenlegi - elozo) / Math.abs(elozo);
  }

  let html = `<table class="adat-tablazat adat-tablazat--penzugyi"><thead><tr><th>Sor</th>${evek.map(e => `<th>${e}</th>`).join("")}</tr></thead><tbody>`;
  for (const nev of jelenLevoSorok) {
    const perReszveny = perReszvenySorMinta.test(nev);
    html += `<tr class="penzugyi-sor"><td>${nev}</td>${evek.map(ev => {
      const ertek = sorok[nev][ev];
      if (ertek == null) return "<td>—</td>";
      return `<td>${perReszveny ? Math.round(ertek).toLocaleString("hu-HU") + " Ft" : penzFormazas(ertek)}</td>`;
    }).join("")}</tr>`;

    html += `<tr class="penzugyi-sor__yoy">${evek.map((ev, i) => {
      if (i === 0) return "<td></td>";
      const yoy = yoySzazalek(sorok[nev][evek[i - 1]], sorok[nev][ev]);
      if (yoy == null) return "<td>—</td>";
      const osztaly = yoy > 0 ? "yoy--pos" : yoy < 0 ? "yoy--neg" : "";
      return `<td class="${osztaly}">${szazalekFormazas(yoy)}</td>`;
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
  const uzemiSor = sorok["Üzleti eredmény"] || {};
  const eredmenySor = sorok["Adózott eredmény"] || {};

  const evek = [...new Set([...Object.keys(bevetelSor), ...Object.keys(uzemiSor), ...Object.keys(eredmenySor)])]
    .sort((a, b) => Number(a) - Number(b)).slice(-10);

  const dpr = window.devicePixelRatio || 1;
  const szelesseg = canvas.clientWidth || canvas.parentElement.clientWidth;
  const magassag = canvas.clientHeight || 260;
  canvas.width = szelesseg * dpr;
  canvas.height = magassag * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, szelesseg, magassag);

  if (!evek.length) {
    ctx.fillStyle = "#BEB3A0";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Nincs elég adat", szelesseg / 2, magassag / 2);
    return;
  }

  const bal_margo = 70, jobb_margo = 15, felso_margo = 30, also_margo = 30;
  const rajzSzelesseg = szelesseg - bal_margo - jobb_margo;
  const rajzMagassag = magassag - felso_margo - also_margo;

  const mindErtek = evek.flatMap(ev => [bevetelSor[ev] || 0, uzemiSor[ev] || 0, eredmenySor[ev] || 0]);
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
      const barW = oszlopSzelesseg * 0.4;
      const y0 = yVaszonra(0), y1 = yVaszonra(bevetel);
      ctx.fillStyle = "#E8BD82";
      ctx.fillRect(x0 + oszlopSzelesseg * 0.3, Math.min(y0, y1), barW, Math.abs(y1 - y0));
    }
    ctx.fillStyle = "#8a7a68";
    ctx.fillText(ev, x0 + oszlopSzelesseg / 2, magassag - 8);
  });

  function vonalRajzolasa(sor, szin) {
    ctx.beginPath();
    let elsoVan = false;
    evek.forEach((ev, i) => {
      if (sor[ev] == null) return;
      const x = bal_margo + i * oszlopSzelesseg + oszlopSzelesseg / 2;
      const y = yVaszonra(sor[ev]);
      if (!elsoVan) { ctx.moveTo(x, y); elsoVan = true; } else { ctx.lineTo(x, y); }
    });
    ctx.strokeStyle = szin;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    evek.forEach((ev, i) => {
      if (sor[ev] == null) return;
      const x = bal_margo + i * oszlopSzelesseg + oszlopSzelesseg / 2;
      const y = yVaszonra(sor[ev]);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = szin;
      ctx.fill();
    });
  }

  vonalRajzolasa(uzemiSor, "#C98A4B");
  vonalRajzolasa(eredmenySor, "#3C2A1B");

  // Jelmagyarazat
  ctx.textAlign = "left";
  ctx.font = "11px 'IBM Plex Mono', monospace";
  const jelmagyarazat = [
    { szin: "#E8BD82", nev: "Árbevétel", tipus: "negyzet" },
    { szin: "#C98A4B", nev: "Üzemi eredmény", tipus: "vonal" },
    { szin: "#3C2A1B", nev: "Nettó eredmény", tipus: "vonal" },
  ];
  let xPoz = bal_margo;
  jelmagyarazat.forEach(j => {
    if (j.tipus === "negyzet") {
      ctx.fillStyle = j.szin;
      ctx.fillRect(xPoz, 4, 10, 10);
    } else {
      ctx.beginPath();
      ctx.moveTo(xPoz, 9); ctx.lineTo(xPoz + 14, 9);
      ctx.strokeStyle = j.szin; ctx.lineWidth = 2.5; ctx.stroke();
      xPoz += 4;
    }
    ctx.fillStyle = "#3C2A1B";
    ctx.fillText(j.nev, xPoz + 16, 13);
    xPoz += 16 + ctx.measureText(j.nev).width + 18;
  });
}


// ------------------------------------------------------------------
// DuPont ROE-lebontas - fa-diagram: fent a szamolt ROE, alatta
// elagazva a bemeno tenyezok (2 vagy 3, aszerint van-e bevetel-adat).
// ------------------------------------------------------------------
function dupontDoboz(x, y, szelesseg, magassag, cim, ertek, szin, szoveges) {
  return `
    <rect x="${x}" y="${y}" width="${szelesseg}" height="${magassag}" rx="8" fill="${szin}"/>
    <text x="${x + szelesseg / 2}" y="${y + magassag / 2 - 6}" text-anchor="middle"
      font-family="Work Sans, sans-serif" font-size="11" fill="#FBECD2" opacity="0.9">${cim}</text>
    <text x="${x + szelesseg / 2}" y="${y + magassag / 2 + 14}" text-anchor="middle"
      font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15" fill="#FBECD2">${szoveges != null ? szoveges : ertek}</text>`;
}

function dupontFaSvg(d) {
  const szelesseg = 600;
  const dobozSzelesseg = 150, dobozMagassag = 56;
  const gyokerY = 15, agakY = 110;

  const harmasBontas = d["nettó_margin"] != null;
  const gyokerX = szelesseg / 2 - dobozSzelesseg / 2;

  let svg = dupontDoboz(gyokerX, gyokerY, dobozSzelesseg, dobozMagassag,
    "Számolt ROE", null, "#3C2A1B", szazalekFormazas(d.roe_szamolt));

  const agak = harmasBontas
    ? [
        { cim: "Nettó árrés", ertek: szazalekFormazas(d["nettó_margin"]), szin: "#4B7A3F" },
        { cim: "Eszközforgás", ertek: szamFormazas(d.eszkoz_forgas) + "×", szin: "#C98A4B" },
        { cim: "Tőkeáttétel", ertek: szamFormazas(d.tokeattetel) + "×", szin: "#A6412B" },
      ]
    : [
        { cim: "ROA", ertek: szazalekFormazas(d.roa), szin: "#4B7A3F" },
        { cim: "Tőkeáttétel", ertek: szamFormazas(d.tokeattetel) + "×", szin: "#A6412B" },
      ];

  const res = szelesseg / (agak.length + 1);
  const gyokerKozepX = szelesseg / 2;
  const gyokerAljaY = gyokerY + dobozMagassag;

  agak.forEach((ag, i) => {
    const agX = res * (i + 1) - dobozSzelesseg / 2;
    const agKozepX = agX + dobozSzelesseg / 2;
    // Osszekoto vonal: a gyoker aljatol az ag tetejeig, enyhe gorbevel
    svg += `<path d="M${gyokerKozepX},${gyokerAljaY} C${gyokerKozepX},${gyokerAljaY + 30} ${agKozepX},${agakY - 30} ${agKozepX},${agakY}"
      stroke="#BEB3A0" stroke-width="2" fill="none"/>`;
    svg += dupontDoboz(agX, agakY, dobozSzelesseg, dobozMagassag, ag.cim, null, ag.szin, ag.ertek);
  });

  // A szorzas jelenek berajzolasa a doboz-parok kozott
  for (let i = 0; i < agak.length - 1; i++) {
    const x1 = res * (i + 1) + dobozSzelesseg / 2;
    const x2 = res * (i + 2) - dobozSzelesseg / 2;
    svg += `<text x="${(x1 + x2) / 2}" y="${agakY + dobozMagassag / 2 + 5}" text-anchor="middle"
      font-family="Work Sans, sans-serif" font-size="18" fill="#3C2A1B">×</text>`;
  }

  const magassagOsszesen = agakY + dobozMagassag + 15;
  return `<svg viewBox="0 0 ${szelesseg} ${magassagOsszesen}" width="${szelesseg}" height="${magassagOsszesen}">${svg}</svg>`;
}

function dupontMegjelenitese(adat) {
  const d = adat.mutatok?.dupont;
  const cel = document.getElementById("cfDupont");
  if (!d) {
    cel.innerHTML = `<p class="csempe__lablec">Nincs elég adat a DuPont-bontáshoz.</p>`;
    return;
  }
  cel.innerHTML = `<div class="dupont-fa-wrap">${dupontFaSvg(d)}</div>`;
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
// Mutatok reszletesen: tablazatos osszehasonlitas piros-zold skalaval.
// Minden mutatonal meghatarozzuk, hogy magasabb vagy alacsonyabb ertek
// szamit "jobbnak", es ez alapjan szinezzuk a BET / szektor oszlopokat -
// aszerint, hogy a SAJAT cegunk hogyan viszonyul hozzajuk.
// ------------------------------------------------------------------
function osszehasonlitoSzin(sajat, referencia, irany) {
  if (sajat == null || referencia == null) return null;
  const nevezo = Math.abs(referencia) > 1e-9 ? Math.abs(referencia) : 1e-9;
  let relDelta = (sajat - referencia) / nevezo;
  if (irany === "alacsonyabb_jobb") relDelta = -relDelta;
  const hatarolt = Math.max(-1, Math.min(1, relDelta / 0.4)); // +-40% valtozasnal mar teli szin

  const NEUTRAL = [251, 236, 210]; // --vajkrem
  const ZOLD = [75, 122, 63];
  const PIROS = [166, 65, 43];
  const cel = hatarolt >= 0 ? ZOLD : PIROS;
  const arany = Math.abs(hatarolt);
  const r = Math.round(NEUTRAL[0] + (cel[0] - NEUTRAL[0]) * arany);
  const g = Math.round(NEUTRAL[1] + (cel[1] - NEUTRAL[1]) * arany);
  const b = Math.round(NEUTRAL[2] + (cel[2] - NEUTRAL[2]) * arany);
  return `rgb(${r},${g},${b})`;
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
      irany: "magasabb_jobb", formatter: szazalekFormazas },
    { nev: "ROA (eszközarányos megtérülés)", sajat: m.bet_sajat_mutatok?.roa_bet,
      piacMedian: piac.piac_egesz?.roa_median, szektorMedian: szektorAdat?.roa_median,
      irany: "magasabb_jobb", formatter: szazalekFormazas },
    { nev: "Tőkeáttétel (Kötelezettség / Saját tőke)", sajat: m.bet_sajat_mutatok?.tokeattetel_bet,
      piacMedian: piac.piac_egesz?.tokeattetel_median, szektorMedian: szektorAdat?.tokeattetel_median,
      irany: "alacsonyabb_jobb", formatter: v => szamFormazas(v) + "×" },
    { nev: "P/E (ár / egy részvényre jutó eredmény)", sajat: m.arfolyam_mutatok?.pe,
      piacMedian: piac.piac_egesz?.pe_median, szektorMedian: szektorAdat?.pe_median,
      irany: "alacsonyabb_jobb", formatter: v => szamFormazas(v) },
    { nev: "P/BV (ár / könyv szerinti érték)", sajat: m.arfolyam_mutatok?.pbv,
      piacMedian: piac.piac_egesz?.pbv_median, szektorMedian: szektorAdat?.pbv_median,
      irany: "alacsonyabb_jobb", formatter: v => szamFormazas(v) },
  ];

  let html = `<table class="adat-tablazat osszehasonlito-tablazat"><thead><tr>
    <th>Mutató</th><th>Ez a cég</th><th>BÉT medián</th><th>Szektor medián</th>
  </tr></thead><tbody>`;

  for (const s of sorok) {
    const betSzin = osszehasonlitoSzin(s.sajat, s.piacMedian, s.irany);
    const szektorSzin = osszehasonlitoSzin(s.sajat, s.szektorMedian, s.irany);
    html += `<tr>
      <td>${s.nev}</td>
      <td class="osszehasonlito-tablazat__sajat">${s.formatter(s.sajat)}</td>
      <td style="${betSzin ? `background:${betSzin}` : ""}">${s.piacMedian != null ? s.formatter(s.piacMedian) : "n/a"}</td>
      <td style="${szektorSzin ? `background:${szektorSzin}` : ""}">${s.szektorMedian != null ? s.formatter(s.szektorMedian) : "n/a"}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  html += `<p class="csempe__lablec">A BÉT / szektor oszlopok háttérszíne azt mutatja, mennyivel jobb (zöld) vagy
    rosszabb (piros) ehhez a mutatóhoz képest a cég saját értéke. A tőkeáttételnél és az ár-alapú
    mutatóknál (P/E, P/BV) az alacsonyabb érték számít kedvezőbbnek.</p>`;
  cel.innerHTML = html;
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
// Egy vesszovel elvalasztott nevlista szetszedese egyeni "Nev (beosztas)"
// elemekre. FONTOS: a vesszo NEM mindig valaszto - pl. "BECSEI Andras
// (vezerigazgato-helyettes, Retail Divizio)" eseten a zarojelen BELULI
// vesszo nem hataroljelolo, ezert zarojel-melysegben szamolunk.
// ------------------------------------------------------------------
function nevlistaSzetvalasztasa(szoveg) {
  if (!szoveg) return [];
  const elemek = [];
  let aktualis = "";
  let melyseg = 0;
  for (const ch of szoveg) {
    if (ch === "(") melyseg++;
    if (ch === ")") melyseg--;
    if (ch === "," && melyseg === 0) {
      elemek.push(aktualis.trim());
      aktualis = "";
    } else {
      aktualis += ch;
    }
  }
  if (aktualis.trim()) elemek.push(aktualis.trim());
  return elemek.filter(Boolean);
}

function szemelyKartyaHtml(bejegyzes) {
  const m = bejegyzes.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const nev = m ? m[1].trim() : bejegyzes;
  const beosztas = m ? m[2].trim() : "";
  return `<div class="szemely-kartya">
    <div class="szemely-kartya__nev">${nev}</div>
    ${beosztas ? `<div class="szemely-kartya__beosztas">${beosztas}</div>` : ""}
  </div>`;
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

  const csoportok = [
    ["Igazgatóság", a.igazgatosag],
    ["Vállalatvezetés", a.vallalatvezetes],
    ["Felügyelőbizottság", a.felugyelobizottsag],
  ];

  cegvezetesCel.innerHTML = csoportok.map(([cim, tartalom]) => {
    const szemelyek = nevlistaSzetvalasztasa(tartalom);
    return `
      <div class="cegvezetes-csoport">
        <h4 class="cegvezetes-csoport__cim">${cim}</h4>
        <div class="cegvezetes-csoport__kartyak">
          ${szemelyek.length
            ? szemelyek.map(szemelyKartyaHtml).join("")
            : `<p class="csempe__lablec">Nincs adat</p>`}
        </div>
      </div>`;
  }).join("");
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

// ------------------------------------------------------------------
// Valodi Sankey-szalagok: gorbe, aranyos szelessegu "folyok" a csomopontok
// kozott, a GuruFocus-fele eredmenykimutatas-folyamatabra mintajara.
// ------------------------------------------------------------------
function sankeySzallag(x0, y0, h0, x1, y1, h1, szin) {
  const kp = (x0 + x1) / 2;
  return `<path d="M${x0},${y0} C${kp},${y0} ${kp},${y1} ${x1},${y1}
    L${x1},${y1 + h1} C${kp},${y1 + h1} ${kp},${y0 + h0} ${x0},${y0 + h0} Z"
    fill="${szin}" opacity="0.55"/>`;
}

function sankeyCsomopont(x, y, h, szelesseg, szin, nev, ertek, igazitas) {
  let szoveg = "";
  if (h > 16) {
    const textX = igazitas === "jobb" ? x - 8 : x + szelesseg + 8;
    const anchor = igazitas === "jobb" ? "end" : "start";
    szoveg = `
      <text x="${textX}" y="${y + h / 2 - 5}" text-anchor="${anchor}" font-family="Work Sans, sans-serif" font-weight="600" font-size="12" fill="#3C2A1B">${nev}</text>
      <text x="${textX}" y="${y + h / 2 + 11}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="11" fill="#8a7a68">${penzFormazas(ertek)}</text>`;
  }
  return `<rect x="${x}" y="${y}" width="${szelesseg}" height="${h}" rx="2" fill="${szin}"/>${szoveg}`;
}

/**
 * Egy "elagazas" kirajzolasa: egy forras-csomopont ketfele agra bomlik
 * (pl. Bevetel -> Koltsegek + Uzemi eredmeny). Visszaadja az SVG-t es a
 * "folytatodo" ag also/felso pixelpoziciojat, hogy a kovetkezo elagazas
 * pontosan ide tudjon csatlakozni.
 */
function sankeyElagazasRajzolasa(opciok) {
  const { x0, x1, yKozep, forrasNev, forrasErtek, agNev, agErtek,
    folytatasNev, folytatasErtek, skala, csomopontSzelesseg, folytatasSzinnel,
    forrasRajzolando = true } = opciok;

  const forrasH = forrasErtek * skala;
  const agH = Math.max(agErtek, 0) * skala;
  const folytatasH = Math.max(folytatasErtek, 0) * skala;

  const forrasY = yKozep - forrasH / 2;
  // Az ag felul, a folytatas alul helyezkedik el a cel oldalon
  const agY = forrasY;
  const folytatasY = forrasY + agH;

  let svg = "";
  svg += sankeySzallag(x0, forrasY, agH, x1, agY, agH, "#BEB3A0");
  svg += sankeySzallag(x0, forrasY + agH, folytatasH, x1, folytatasY, folytatasH, folytatasSzinnel || "#C98A4B");
  if (forrasRajzolando) {
    svg += sankeyCsomopont(x0 - csomopontSzelesseg, forrasY, forrasH, csomopontSzelesseg, "#3C2A1B", forrasNev, forrasErtek, "jobb");
  }
  svg += sankeyCsomopont(x1, agY, agH, csomopontSzelesseg, "#A6412B", agNev, agErtek, "bal");
  svg += sankeyCsomopont(x1, folytatasY, folytatasH, csomopontSzelesseg, "#4B7A3F", folytatasNev, folytatasErtek, "bal");

  return { svg, folytatasYKozep: folytatasY + folytatasH / 2, folytatasH };
}

function sankeyEredmenyDiagram(revenue, koltseg, uzemiEredmeny, ado, nettoEredmeny, szelesseg) {
  const csomopontSzelesseg = 10;
  const x0 = 150;
  const oszlopTav = (szelesseg - x0 - 2 * csomopontSzelesseg - 150) / 2;
  const x1 = x0 + oszlopTav, x2 = x1 + oszlopTav;
  const maxErtek = revenue;
  const rendelkezesreAlloMagassag = 130;
  const skala = rendelkezesreAlloMagassag / maxErtek;
  const yKozep = 75;

  let svg = "";

  const elso = sankeyElagazasRajzolasa({
    x0, x1, yKozep,
    forrasNev: "Árbevétel", forrasErtek: revenue,
    agNev: "Költségek", agErtek: koltseg,
    folytatasNev: "Üzemi eredmény", folytatasErtek: uzemiEredmeny,
    skala, csomopontSzelesseg, folytatasSzinnel: "#C98A4B",
  });
  svg += elso.svg;

  const masodik = sankeyElagazasRajzolasa({
    x0: x1, x1: x2, yKozep: elso.folytatasYKozep,
    forrasNev: "Üzemi eredmény", forrasErtek: uzemiEredmeny,
    agNev: "Adó", agErtek: ado,
    folytatasNev: "Nettó eredmény", folytatasErtek: nettoEredmeny,
    skala, csomopontSzelesseg, folytatasSzinnel: "#4B7A3F",
    forrasRajzolando: false, // mar kirajzolodott az elozo lepes "folytatas" dobozakent
  });
  svg += masodik.svg;

  const magassagOsszesen = Math.max(yKozep + maxErtek * skala / 2, elso.folytatasYKozep + elso.folytatasH / 2) + 40;
  return `<svg viewBox="0 0 ${szelesseg} ${magassagOsszesen}" width="${szelesseg}" height="${magassagOsszesen}">${svg}</svg>`;
}

function sankeyMerlegDiagram(assets, liabilities, equity, szelesseg) {
  const csomopontSzelesseg = 10;
  const x0 = 155, x1 = szelesseg - 150;
  const skala = 130 / assets;
  const yKozep = 75;

  const { svg, folytatasYKozep, folytatasH } = sankeyElagazasRajzolasa({
    x0, x1, yKozep,
    forrasNev: "Eszközök összesen", forrasErtek: assets,
    agNev: "Kötelezettségek", agErtek: liabilities,
    folytatasNev: "Saját tőke", folytatasErtek: equity,
    skala, csomopontSzelesseg, folytatasSzinnel: "#4B7A3F",
  });

  const magassagOsszesen = Math.max(yKozep + assets * skala / 2, folytatasYKozep + folytatasH / 2) + 40;
  return `<svg viewBox="0 0 ${szelesseg} ${magassagOsszesen}" width="${szelesseg}" height="${magassagOsszesen}">${svg}</svg>`;
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

  const vanEredmenyAdat = revenue && profitLoss && revenue.ertek > 0 &&
    profitLoss.ertek >= 0 && profitLoss.ertek <= revenue.ertek;
  const vanMerlegAdat = assets && equity && liabilities && assets.ertek > 0 &&
    equity.ertek >= 0 && liabilities.ertek >= 0;

  if (!vanEredmenyAdat && !vanMerlegAdat) {
    szekcio.hidden = true;
    return;
  }
  szekcio.hidden = false;

  let html = "";

  if (vanEredmenyAdat) {
    const koltsegekAdo = revenue.ertek - profitLoss.ertek;
    const ado = profitLossBeforeTax && profitLossBeforeTax.ertek >= profitLoss.ertek
      ? profitLossBeforeTax.ertek - profitLoss.ertek : Math.max(koltsegekAdo * 0.15, 0);
    const uzemiEredmeny = profitLossBeforeTax ? profitLossBeforeTax.ertek : profitLoss.ertek + ado;
    const koltseg = Math.max(revenue.ertek - uzemiEredmeny, 0);

    html += `<h4 class="sankey-alcim">Árbevétel → eredmény (${revenue.idokulcs.split("..").pop()})</h4>`;
    html += sankeyEredmenyDiagram(revenue.ertek, koltseg, uzemiEredmeny, ado, profitLoss.ertek, 680);
  }

  if (vanMerlegAdat) {
    html += `<h4 class="sankey-alcim">Mérleg összetétele (${assets.idokulcs})</h4>`;
    if (liabilities.szamolt) {
      html += `<p class="csempe__lablec">(kötelezettség = eszközök − saját tőke, mert nincs külön címkézve)</p>`;
    }
    html += sankeyMerlegDiagram(assets.ertek, liabilities.ertek, equity.ertek, 680);
  }

  document.getElementById("sankeyDiagram").innerHTML = html;
}


// ------------------------------------------------------------------
// Tabok kozotti valtas - fontos, hogy amikor egy ful lathatova valik,
// ujrarajzoljuk a benne levo grafikonokat, mert amikor a ful meg
// "display:none" volt, a vaszon (canvas) 0 szelessegu volt, es semmi
// nem jelent meg rajta.
// ------------------------------------------------------------------
function tabokBekotese(adat) {
  document.getElementById("cfTabok").addEventListener("click", (e) => {
    const gomb = e.target.closest(".cf-tab");
    if (!gomb) return;
    document.querySelectorAll(".cf-tab").forEach(b => b.classList.remove("cf-tab--aktiv"));
    document.querySelectorAll(".cf-tabtartalom").forEach(t => t.classList.remove("cf-tabtartalom--aktiv"));
    gomb.classList.add("cf-tab--aktiv");
    document.querySelector(`[data-tabtartalom="${gomb.dataset.tab}"]`).classList.add("cf-tabtartalom--aktiv");

    if (gomb.dataset.tab === "penzugyek") {
      penzugyGrafikonRajzolasa(adat);
    }
    if (gomb.dataset.tab === "osszefoglalo") {
      arfolyamGrafikonFrissitese(document.querySelector("#idosikValaszto .aktiv")?.dataset.idosik || "1M");
    }
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

    // FONTOS: eloszor lathatova tesszuk a konteinert, csak utana rajzolunk
    // grafikont - kulonben a vaszon (canvas) meg 0 szelesseggel rendelkezik
    // (mert a szulo "hidden" volt), es semmi nem jelenik meg rajta.
    document.getElementById("betoltesUzenet").hidden = true;
    document.getElementById("ceglapFo").hidden = false;

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

    tabokBekotese(adat);

    // Ujrarajzolas ablakmeret-valtaskor
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        arfolyamGrafikonFrissitese(document.querySelector("#idosikValaszto .aktiv")?.dataset.idosik || "1M");
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
