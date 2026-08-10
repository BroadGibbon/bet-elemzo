/* ============================================================
   Bread Board Capital - Hazi cipo aloldal logikaja
   ============================================================ */

const SZERZO_KEPEK_CIPO = {
  "Lajer Máté": "assets/szerzo-lajer-mate.png",
  "Katona Mátyás": "assets/szerzo-katona-matyas.png",
};

function szerzoMonogramCipo(nev) {
  return nev.split(" ").filter(Boolean).map(sz => sz[0]).join("").toUpperCase();
}

function szerzoKarikaHtmlCipo(szerzo) {
  const kep = SZERZO_KEPEK_CIPO[szerzo];
  if (kep) return `<img src="${kep}" alt="${szerzo}">`;
  return `<span class="cikk-karika__monogram">${szerzoMonogramCipo(szerzo)}</span>`;
}

let AKTUALIS_KEPEK = [];
let AKTUALIS_INDEX = 0;

function kepMegjelenitese() {
  const kep = AKTUALIS_KEPEK[AKTUALIS_INDEX];
  document.getElementById("cipoAktualisKep").src = kep.url;
  document.getElementById("cipoKepSzoveg").textContent = kep.szoveg || "";
  document.getElementById("cipoKepSzamlalo").textContent =
    `${AKTUALIS_INDEX + 1} / ${AKTUALIS_KEPEK.length}`;
}

function lapozas(irany) {
  AKTUALIS_INDEX = (AKTUALIS_INDEX + irany + AKTUALIS_KEPEK.length) % AKTUALIS_KEPEK.length;
  kepMegjelenitese();
}

async function inditas() {
  const parancssor = new URLSearchParams(window.location.search);
  const id = parancssor.get("id");

  if (!id) {
    document.getElementById("betoltesUzenet").hidden = true;
    const hiba = document.getElementById("hibaUzenet");
    hiba.hidden = false;
    hiba.textContent = "Nincs megadva cipó (hiányzik az ?id= paraméter az URL-ből).";
    return;
  }

  try {
    const adat = await adatFajlLetoltese("data/hazi_cipok.json");
    const cipo = (adat.cipok || []).find(c => c.id === id);

    if (!cipo) {
      document.getElementById("betoltesUzenet").hidden = true;
      const hiba = document.getElementById("hibaUzenet");
      hiba.hidden = false;
      hiba.textContent = "Nem található ilyen házi cipó.";
      return;
    }

    document.getElementById("cipoSzerzoKarika").innerHTML = szerzoKarikaHtmlCipo(cipo.szerzo);
    document.getElementById("cipoSzerzoNev").textContent = cipo.szerzo;
    document.getElementById("cipoLeiras").textContent = cipo.leiras;

    AKTUALIS_KEPEK = cipo.kepek || [];
    AKTUALIS_INDEX = 0;

    if (!AKTUALIS_KEPEK.length) {
      document.getElementById("betoltesUzenet").hidden = true;
      const hiba = document.getElementById("hibaUzenet");
      hiba.hidden = false;
      hiba.textContent = "Ehhez a cipóhoz nincs feltöltve kép.";
      return;
    }

    kepMegjelenitese();

    document.getElementById("kepNyilBal").addEventListener("click", () => lapozas(-1));
    document.getElementById("kepNyilJobb").addEventListener("click", () => lapozas(1));
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") lapozas(-1);
      if (e.key === "ArrowRight") lapozas(1);
    });

    document.title = `${cipo.leiras} — Bread Board Capital`;
    document.getElementById("betoltesUzenet").hidden = true;
    document.getElementById("cipoTartalom").hidden = false;

  } catch (hiba) {
    console.error(hiba);
    document.getElementById("betoltesUzenet").hidden = true;
    const hibaEl = document.getElementById("hibaUzenet");
    hibaEl.hidden = false;
    hibaEl.textContent = "Hiba történt az adatok betöltése közben.";
  }
}

inditas();
