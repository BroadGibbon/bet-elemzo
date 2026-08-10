/* ============================================================
   Bread Board Capital - BET reszvenyterkep
   Adatletoltes, treemap-elrendezes es interakcio.
   A GITHUB_USER / GITHUB_REPO beallitas a config.js fajlban van -
   azt kell kitoltened, nem ezt a fajlt.
   ============================================================ */


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
    <div class="tooltip__row"><span>Piaci kapitalizáció${reszveny._kapitalizacioForrasa ? " *" : ""}</span><span>${forintFormazas(reszveny.marketcap)}</span></div>
    <div class="tooltip__row"><span>Napi forgalom</span><span>${forintFormazas(reszveny.valuetoday ? reszveny.valuetoday / 1_000_000 : null)}</span></div>
    <div class="tooltip__row"><span>52 hetes sáv</span><span>${(reszveny.low52weekprice ?? "n/a")} – ${(reszveny.high52weekprice ?? "n/a")}</span></div>
    ${reszveny._kapitalizacioForrasa ? '<div class="tooltip__lablec">* a cégadatlapról, mert az élő adatfolyam nem ad rá értéket</div>' : ""}
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
      window.location.href = `company.html?ticker=${encodeURIComponent(r.seccode)}`;
    });
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = `company.html?ticker=${encodeURIComponent(r.seccode)}`;
      }
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
// Kereso mezo: szabad szoveges szures + legordulo javaslatlista
// ------------------------------------------------------------------
function keresoBekotese(reszvenyek) {
  const mezo = document.getElementById("keresoMezo");
  const lista = document.getElementById("keresoLista");

  function navigalas(kod) {
    window.location.href = `company.html?ticker=${encodeURIComponent(kod)}`;
  }

  function listaFrissitese(szures) {
    const szures_kisbetu = szures.trim().toLowerCase();
    if (!szures_kisbetu) {
      lista.hidden = true;
      lista.innerHTML = "";
      return;
    }
    const talalatok = reszvenyek
      .filter(r => r.seccode.toLowerCase().includes(szures_kisbetu))
      .slice(0, 12);

    if (!talalatok.length) {
      lista.innerHTML = `<div class="kereso__nincs">Nincs találat</div>`;
      lista.hidden = false;
      return;
    }

    lista.innerHTML = talalatok.map(r => `
      <div class="kereso__elem" data-kod="${r.seccode}" tabindex="0" role="option">
        <span class="kereso__kod">${r.seccode}</span>
        <span class="kereso__ar">${(r.lasttradedprice ?? 0).toLocaleString("hu-HU")} ${r.currencyid || ""}</span>
      </div>
    `).join("");
    lista.hidden = false;

    lista.querySelectorAll(".kereso__elem").forEach(el => {
      el.addEventListener("click", () => navigalas(el.dataset.kod));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") navigalas(el.dataset.kod);
      });
    });
  }

  mezo.addEventListener("input", () => listaFrissitese(mezo.value));
  mezo.addEventListener("focus", () => { if (mezo.value) listaFrissitese(mezo.value); });

  // Kattintas a kereson kivul: lista elrejtese
  document.addEventListener("click", (e) => {
    if (!document.getElementById("keresoDoboz").contains(e.target)) {
      lista.hidden = true;
    }
  });

  // Enter a mezoben: ha pontosan egy talalat van, navigaljunk oda
  mezo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const elso = lista.querySelector(".kereso__elem");
      if (elso) navigalas(elso.dataset.kod);
    }
  });
}


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
// Cikkek szekcio: a Bread Board Capital alapitoinak kulso portalokon
// megjelent irasai, csempeken, kattintasra uj fulon nyilnak meg.
// ------------------------------------------------------------------
const SZERZO_KEPEK = {
  "Lajer Máté": "assets/szerzo-lajer-mate.png",
  "Katona Mátyás": "assets/szerzo-katona-matyas.png",
};

function szerzoMonogram(nev) {
  return nev.split(" ").filter(Boolean).map(sz => sz[0]).join("").toUpperCase();
}

function szerzoKarikaBelseje(szerzo) {
  const kep = SZERZO_KEPEK[szerzo];
  if (kep) {
    return `<img src="${kep}" alt="${szerzo}" class="cikk-karika__kep">`;
  }
  return `<span class="cikk-karika__monogram">${szerzoMonogram(szerzo)}</span>`;
}

function cikkKarikaHtml(szerzo) {
  return `<span class="cikk-karika">${szerzoKarikaBelseje(szerzo)}</span>`;
}

async function cikkekMegjelenitese() {
  const cel = document.getElementById("cikkekLista");
  if (!cel) return;
  try {
    const adat = await adatFajlLetoltveVagyNull("data/cikkek.json");
    const cikkek = adat?.cikkek || [];

    if (!cikkek.length) {
      cel.innerHTML = `<p class="cikkek-ures">Hamarosan itt lesznek olvashatók a cikkek.</p>`;
      return;
    }

    cel.innerHTML = cikkek.map(c => `
      <a class="cikk-kartya" href="${c.link}" target="_blank" rel="noopener noreferrer">
        ${cikkKarikaHtml(c.szerzo)}
        <span class="cikk-kartya__szoveg">
          <span class="cikk-kartya__szerzo">${c.szerzo}</span>
          <span class="cikk-kartya__cim">${c.cim}</span>
        </span>
      </a>
    `).join("");
  } catch (hiba) {
    console.error(hiba);
    cel.innerHTML = `<p class="cikkek-ures">A cikkek listája jelenleg nem tölthető be.</p>`;
  }
}


// ------------------------------------------------------------------
// Hazi cipok karusel: kis "cipok" (kepes karusel-bejegyzesek) csempesora,
// jobbra-balra gorgetheto sav formajaban.
// ------------------------------------------------------------------
async function cipokMegjelenitese() {
  const cel = document.getElementById("cipokLista");
  if (!cel) return;
  try {
    const adat = await adatFajlLetoltveVagyNull("data/hazi_cipok.json");
    const cipok = adat?.cipok || [];

    if (!cipok.length) {
      cel.innerHTML = `<p class="cipok-ures">Hamarosan itt lesznek olvashatók a házi cipók.</p>`;
      return;
    }

    cel.innerHTML = cipok.map(c => `
      <a class="cipo-kartya" href="cipo.html?id=${encodeURIComponent(c.id)}">
        <div class="cipo-kartya__kepkeret">
          <img src="${c.borito_kep}" alt="" class="cipo-kartya__kep" loading="lazy">
        </div>
        <div class="cipo-kartya__szerzosor">
          <span class="cipo-kartya__szerzo-karika">${szerzoKarikaBelseje(c.szerzo)}</span>
          <span class="cipo-kartya__szerzo-nev">${c.szerzo}</span>
        </div>
      </a>
    `).join("");
  } catch (hiba) {
    console.error(hiba);
    cel.innerHTML = `<p class="cipok-ures">A házi cipók jelenleg nem tölthetők be.</p>`;
  }
}

function cipokNyilakBekotese() {
  const lista = document.getElementById("cipokLista");
  const balGomb = document.getElementById("cipokNyilBal");
  const jobbGomb = document.getElementById("cipokNyilJobb");
  if (!lista || !balGomb || !jobbGomb) return;

  const lepesTavolsag = 440; // kb. ket csempenyi
  balGomb.addEventListener("click", () => lista.scrollBy({ left: -lepesTavolsag, behavior: "smooth" }));
  jobbGomb.addEventListener("click", () => lista.scrollBy({ left: lepesTavolsag, behavior: "smooth" }));
}


// ------------------------------------------------------------------
// Inditas: adat letoltese, majd minden feleptese
// ------------------------------------------------------------------
async function adatLetoltese() {
  return adatFajlLetoltese("data/reszvenyek.json");
}

// ------------------------------------------------------------------
// Tartalek piaci kapitalizacio: nemelyik (jellemzoen alacsony forgalmu)
// papirnal az elo arfolyam-adatfolyam nem ad kapitalizaciot, DE a BET
// cegadatlapja igen (mar letoltottuk a data/alapadatok mappaba). Ezeknel
// ezt hasznaljuk tartalekkent, hogy a treemap-en is megjelenjenek.
// ------------------------------------------------------------------
function fajlnevKodolasTreemap(kod) {
  return kod.replace(/\//g, "_").replace(/ /g, "_");
}

function kapitalizacioSzovegParszolasa(szoveg) {
  if (!szoveg) return null;
  const tisztitott = String(szoveg).replace(/\s|\u00a0/g, "").replace(",", ".");
  const szam = parseFloat(tisztitott);
  return isNaN(szam) ? null : szam; // millio Ft-ban, ugyanugy mint a marketcap mezo
}

async function tartalekKapitalizaciokPotlasa(reszvenyek) {
  const hianyosak = reszvenyek.filter(r => !r.marketcap || r.marketcap <= 0);
  if (!hianyosak.length) return;

  await Promise.all(hianyosak.map(async (r) => {
    const alapadat = await adatFajlLetoltveVagyNull(`data/alapadatok/${fajlnevKodolasTreemap(r.seccode)}.json`);
    const potolt = kapitalizacioSzovegParszolasa(alapadat?.kapitalizacio_m_ft);
    if (potolt && potolt > 0) {
      r.marketcap = potolt;
      r._kapitalizacioForrasa = "cegadatlap"; // jelezzuk, hogy ez nem az elo adatfolyamrol jott
    }
  }));
}


async function inditas() {
  const freshnessNote = document.getElementById("freshnessNote");
  cikkekMegjelenitese(); // fuggetlen a reszveny-adattol, parhuzamosan futhat
  cipokMegjelenitese();
  cipokNyilakBekotese();
  try {
    const adat = await adatLetoltese();
    const reszvenyek = adat.reszvenyek || [];

    await tartalekKapitalizaciokPotlasa(reszvenyek);

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
    keresoBekotese(reszvenyek);

  } catch (hiba) {
    console.error(hiba);
    freshnessNote.textContent =
      "Nem sikerült betölteni az adatokat. Ellenőrizd a config.js fájlban a " +
      "GITHUB_USER és GITHUB_REPO beállítást, és hogy a repo publikus-e.";
    freshnessNote.style.color = "#A6412B";
  }
}

inditas();
