/* ============================================================
   Bread Board Capital - BET reszvenyterkep
   Adatletoltes, treemap-elrendezes es interakcio.
   ============================================================ */

// ------------------------------------------------------------------
// BEALLITAS - EZT A KET SORT CSERELD LE a sajat GitHub adataidra!
// Pelda: ha a repod cime github.com/pistike123/bet-elemzo, akkor:
//   GITHUB_USER = "pistike123"
//   GITHUB_REPO = "bet-elemzo"
// ------------------------------------------------------------------
const GITHUB_USER = "IDE_A_GITHUB_FELHASZNALONEVED";
const GITHUB_REPO = "IDE_A_REPO_NEVE";
const ADAT_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/reszvenyek.json`;

// Ha a raw.githubusercontent.com valamiert nem elerheto/lassu, ez egy
// jo alternativa (ugyanaz az adat, mas szolgaltatotol):
const ADAT_URL_TARTALEK = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}/data/reszvenyek.json`;


// ------------------------------------------------------------------
// Squarified treemap algoritmus (Bruls, Huizing, van Wijk, 1999)
// Bemenet: [{ertek: szam, ...egyeb mezok}], illetve a rendelkezesre
// allo teglalap merete. Kimenet: minden elemhez {x, y, w, h}.
// ------------------------------------------------------------------
function squarify(elemek, x, y, szelesseg, magassag) {
  const rendezett = [...elemek].sort((a, b) => b.ertek - a.ertek);
  const osszeg = rendezett.reduce((s, e) => s + e.ertek, 0);
  if (osszeg <= 0 || rendezett.length === 0) return [];

  // Terulet-egysegre valtjuk az ertekeket (a rendelkezesre allo pixel-terulethez)
  const teruletEgyseg = (szelesseg * magassag) / osszeg;
  const sorbanAllok = rendezett.map(e => ({ item: e, terulet: e.ertek * teruletEgyseg }));

  const eredmeny = [];
  let konteiner = { x, y, w: szelesseg, h: magassag };

  // Egy sor "legrosszabb" (legkevesbe negyzet-alaku) oldalaranyat adja vissza
  function legrosszabbArany(sor, oldalHossz) {
    const sorTerulet = sor.reduce((s, e) => s + e.terulet, 0);
    if (sorTerulet <= 0 || oldalHossz <= 0) return Infinity;
    const vastagsag = sorTerulet / oldalHossz;
    let maxArany = 0;
    for (const e of sor) {
      const masikOldal = e.terulet / vastagsag;
      const arany = Math.max(vastagsag / masikOldal, masikOldal / vastagsag);
      maxArany = Math.max(maxArany, arany);
    }
    return maxArany;
  }

  // Lerak egy kesz sort a konteiner rovidebb oldala menten, majd
  // visszaadja a fennmaradt (zsugorodott) konteinert.
  function sorLerakasa(sor, kont) {
    const sorTerulet = sor.reduce((s, e) => s + e.terulet, 0);
    const vizszintesSav = kont.w <= kont.h; // a rovidebb oldal a szelesseg
    const oldalHossz = vizszintesSav ? kont.w : kont.h;
    const vastagsag = sorTerulet / oldalHossz;

    let poz = 0;
    for (const e of sor) {
      const meret = e.terulet / vastagsag;
      if (vizszintesSav) {
        // teli szelesseg sav fent, elemek balrol jobbra
        eredmeny.push({ item: e.item, x: kont.x + poz, y: kont.y, w: meret, h: vastagsag });
      } else {
        // teli magassagu sav balt, elemek fentrol le
        eredmeny.push({ item: e.item, x: kont.x, y: kont.y + poz, w: vastagsag, h: meret });
      }
      poz += meret;
    }

    if (vizszintesSav) {
      return { x: kont.x, y: kont.y + vastagsag, w: kont.w, h: kont.h - vastagsag };
    } else {
      return { x: kont.x + vastagsag, y: kont.y, w: kont.w - vastagsag, h: kont.h };
    }
  }

  let sorAktualis = [];
  let hatralevo = [...sorbanAllok];

  while (hatralevo.length) {
    const jelolt = hatralevo[0];
    const oldalHossz = Math.min(konteiner.w, konteiner.h);
    const probaSor = [...sorAktualis, jelolt];

    const regiArany = legrosszabbArany(sorAktualis, oldalHossz);
    const ujArany = legrosszabbArany(probaSor, oldalHossz);

    if (sorAktualis.length === 0 || ujArany <= regiArany) {
      sorAktualis = probaSor;
      hatralevo = hatralevo.slice(1);
    } else {
      konteiner = sorLerakasa(sorAktualis, konteiner);
      sorAktualis = [];
    }
  }
  if (sorAktualis.length) {
    konteiner = sorLerakasa(sorAktualis, konteiner);
  }

  return eredmeny;
}


// ------------------------------------------------------------------
// Szin szamitasa a napi valtozas szazalek alapjan.
// A markakonyv szerint KIZAROLAG ez a ket szin hasznalhato adatra:
// Friss Zold (novekedes) es Sult Piros (csokkenes).
// ------------------------------------------------------------------
function valtozasSzine(changepctg) {
  if (changepctg === null || changepctg === undefined || isNaN(changepctg)) {
    return "#5a4a3a"; // nincs adat - semleges, sotet espresso-arnyalat
  }
  const NEUTRAL = [107, 91, 71];     // egy sotetebb, semleges espresso-tonus
  const ZOLD = [75, 122, 63];        // --friss-zold
  const PIROS = [166, 65, 43];       // --sult-piros

  // +-5% vagy afolotti mozgasnal mar teljesen telitett a szin
  const hatarErtek = 5;
  const arany = Math.min(Math.abs(changepctg) / hatarErtek, 1);
  const cel = changepctg >= 0 ? ZOLD : PIROS;

  const r = Math.round(NEUTRAL[0] + (cel[0] - NEUTRAL[0]) * arany);
  const g = Math.round(NEUTRAL[1] + (cel[1] - NEUTRAL[1]) * arany);
  const b = Math.round(NEUTRAL[2] + (cel[2] - NEUTRAL[2]) * arany);
  return `rgb(${r}, ${g}, ${b})`;
}


// ------------------------------------------------------------------
// Formazasi segedfuggvenyek
// ------------------------------------------------------------------
function forintFormazas(millioHuf) {
  if (millioHuf === null || millioHuf === undefined) return "n/a";
  if (millioHuf >= 1_000_000) return (millioHuf / 1_000_000).toFixed(1).replace(".", ",") + " billió Ft";
  if (millioHuf >= 1_000) return (millioHuf / 1_000).toFixed(1).replace(".", ",") + " Mrd Ft";
  return Math.round(millioHuf).toLocaleString("hu-HU") + " M Ft";
}

function szazalekFormazas(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "n/a";
  const elojel = pct > 0 ? "+" : "";
  return elojel + pct.toFixed(2).replace(".", ",") + "%";
}


// ------------------------------------------------------------------
// Ticker szalag feltoltese a legnagyobb kapitalizaciou papirokkal
// ------------------------------------------------------------------
function tickerSzalagFeltoltese(reszvenyek) {
  const track = document.getElementById("tickerTrack");
  const rendezett = [...reszvenyek]
    .filter(r => r.marketcap)
    .sort((a, b) => b.marketcap - a.marketcap)
    .slice(0, 20);

  function elemekLetrehozasa() {
    return rendezett.map(r => {
      const pct = r.changepctg;
      const irany = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      const nyil = pct > 0 ? "▲" : pct < 0 ? "▼" : "—";
      const span = document.createElement("span");
      span.className = "ticker-item";
      span.innerHTML = `<span class="ticker-item__code">${r.seccode}</span>` +
        `<span class="ticker-item--${irany}">${nyil} ${szazalekFormazas(pct)}</span>`;
      return span;
    });
  }

  // Ketszer egymas utan, hogy a vegtelen scroll varratlanul illeszkedjen
  elemekLetrehozasa().forEach(el => track.appendChild(el));
  elemekLetrehozasa().forEach(el => track.appendChild(el));
}


// ------------------------------------------------------------------
// Reszlet-panel (tooltip) megjelenitese egy kivalasztott reszvenyhez
// ------------------------------------------------------------------
function reszletPanelMutatasa(reszveny, celX, celY) {
  const tooltip = document.getElementById("tooltip");
  const pct = reszveny.changepctg;
  const pctOsztaly = pct > 0 ? "tooltip__pct--pos" : pct < 0 ? "tooltip__pct--neg" : "";

  tooltip.innerHTML = `
    <div class="tooltip__title">
      <span>${reszveny.seccode}</span>
      <span class="${pctOsztaly}">${szazalekFormazas(pct)}</span>
    </div>
    <div class="tooltip__row"><span>Utolsó ár</span><span>${(reszveny.lasttradedprice ?? 0).toLocaleString("hu-HU")} ${reszveny.currencyid || ""}</span></div>
    <div class="tooltip__row"><span>Napi sáv</span><span>${(reszveny.lowprice ?? "n/a")} – ${(reszveny.highprice ?? "n/a")}</span></div>
    <div class="tooltip__row"><span>Piaci kapitalizáció</span><span>${forintFormazas(reszveny.marketcap)}</span></div>
    <div class="tooltip__row"><span>Napi forgalom</span><span>${forintFormazas(reszveny.valuetoday ? reszveny.valuetoday / 1_000_000 : null)}</span></div>
    <div class="tooltip__row"><span>52 hetes sáv</span><span>${(reszveny.low52weekprice ?? "n/a")} – ${(reszveny.high52weekprice ?? "n/a")}</span></div>
  `;

  tooltip.hidden = false;
  const wrap = document.querySelector(".treemap-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  let left = celX - wrapRect.left + 12;
  let top = celY - wrapRect.top + 12;

  // Ne logjon ki a jobb szelen
  const tooltipSzelesseg = 240;
  if (left + tooltipSzelesseg > wrapRect.width) {
    left = celX - wrapRect.left - tooltipSzelesseg - 12;
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function reszletPanelElrejtese() {
  document.getElementById("tooltip").hidden = true;
}


// ------------------------------------------------------------------
// A treemap teljes ujrarajzolasa
// ------------------------------------------------------------------
let AKTUALIS_ADATOK = [];

function treemapRajzolasa() {
  const container = document.getElementById("treemap");
  const szelesseg = container.clientWidth;
  const magassag = container.clientHeight;

  const elemek = AKTUALIS_ADATOK.map(r => ({ ertek: r.marketcap, adat: r }));
  const elrendezes = squarify(elemek, 0, 0, szelesseg, magassag);

  container.innerHTML = "";
  for (const cella of elrendezes) {
    const r = cella.item.adat;
    const div = document.createElement("div");
    const kicsi = cella.w < 55 || cella.h < 40;
    div.className = "tile" + (kicsi ? " tile--tiny" : "");
    div.style.left = `${cella.x}px`;
    div.style.top = `${cella.y}px`;
    div.style.width = `${cella.w}px`;
    div.style.height = `${cella.h}px`;
    div.style.background = valtozasSzine(r.changepctg);
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", `${r.seccode}, ${szazalekFormazas(r.changepctg)}`);

    div.innerHTML = `
      <span class="tile__code">${r.seccode}</span>
      <span class="tile__pct">${szazalekFormazas(r.changepctg)}</span>
    `;

    div.addEventListener("mouseenter", (e) => reszletPanelMutatasa(r, e.clientX, e.clientY));
    div.addEventListener("mousemove", (e) => reszletPanelMutatasa(r, e.clientX, e.clientY));
    div.addEventListener("mouseleave", reszletPanelElrejtese);
    div.addEventListener("focus", () => {
      const rect = div.getBoundingClientRect();
      reszletPanelMutatasa(r, rect.left, rect.top);
    });
    div.addEventListener("blur", reszletPanelElrejtese);
    div.addEventListener("click", () => {
      document.querySelectorAll(".tile--selected").forEach(t => t.classList.remove("tile--selected"));
      div.classList.add("tile--selected");
    });

    container.appendChild(div);
  }
}

// Ujrarajzolas ablakmeret-valtozaskor (debounce-olva, hogy ne pörögjön feleslegesen)
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(treemapRajzolasa, 150);
});


// ------------------------------------------------------------------
// Hianyzo adatu reszvenyek listazasa a lap aljan
// ------------------------------------------------------------------
function hianyzoAdatokMutatasa(hianyzok) {
  if (!hianyzok.length) return;
  const section = document.getElementById("missingSection");
  const list = document.getElementById("missingList");
  list.innerHTML = hianyzok.map(r => `<li>${r.seccode} — nincs piaci kapitalizáció adat</li>`).join("");
  section.hidden = false;
}


// ------------------------------------------------------------------
// Inditas: adat letoltese, majd minden feleptese
// ------------------------------------------------------------------
async function adatLetoltese() {
  try {
    const valasz = await fetch(ADAT_URL, { cache: "no-store" });
    if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
    return await valasz.json();
  } catch (elsoHiba) {
    console.warn("Elsodleges adatforras nem elerheto, tartalek probalasa:", elsoHiba);
    const valasz = await fetch(ADAT_URL_TARTALEK, { cache: "no-store" });
    if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
    return await valasz.json();
  }
}

async function inditas() {
  const freshnessNote = document.getElementById("freshnessNote");
  try {
    const adat = await adatLetoltese();
    const reszvenyek = adat.reszvenyek || [];

    const megjelenítheto = reszvenyek.filter(r => r.marketcap && r.marketcap > 0);
    const hianyzo = reszvenyek.filter(r => !r.marketcap || r.marketcap <= 0);

    AKTUALIS_ADATOK = megjelenítheto;

    const letoltveDatum = adat.letoltve ? new Date(adat.letoltve) : null;
    freshnessNote.textContent = letoltveDatum
      ? `Adatok frissítve: ${letoltveDatum.toLocaleString("hu-HU")} — ${megjelenítheto.length} részvény a térképen. Forrás: bet.hu`
      : `${megjelenítheto.length} részvény a térképen.`;

    tickerSzalagFeltoltese(reszvenyek);
    treemapRajzolasa();
    hianyzoAdatokMutatasa(hianyzo);

  } catch (hiba) {
    console.error(hiba);
    freshnessNote.textContent =
      "Nem sikerült betölteni az adatokat. Ellenőrizd a script.js tetején a " +
      "GITHUB_USER és GITHUB_REPO beállítást, és hogy a repo publikus-e.";
    freshnessNote.style.color = "#A6412B";
  }
}

inditas();
