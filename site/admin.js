/* ============================================================
   Bread Board Capital - Admin oldal logikaja
   Cikkek kezelese (hozzaadas/torles) es adatfrissites inditasa.
   A jelszot csak egy JS valtozoban tartjuk (nem taroljuk sehol
   tartosan), es minden API-hivashoz ujra elkuldjuk - a szerver
   ellenorzi minden egyes alkalommal kulon.
   ============================================================ */

function aktualisJelszo() {
  return document.getElementById("globalisJelszo").value;
}


// ------------------------------------------------------------------
// Cikkek listazasa es torlese
// ------------------------------------------------------------------
async function cikkekBetoltese() {
  const cel = document.getElementById("cikkLista");
  cel.textContent = "Betöltés…";
  try {
    const adat = await adatFajlLetoltese("data/cikkek.json");
    const cikkek = adat.cikkek || [];

    if (!cikkek.length) {
      cel.innerHTML = `<p class="admin-ures">Még nincs felvéve egyetlen cikk sem.</p>`;
      return;
    }

    cel.innerHTML = cikkek.map(c => `
      <div class="admin-cikk-sor" data-id="${c.id}">
        <div class="admin-cikk-sor__info">
          <div class="admin-cikk-sor__szerzo">${c.szerzo}</div>
          <div class="admin-cikk-sor__cim">${c.cim}</div>
          <a class="admin-cikk-sor__link" href="${c.link}" target="_blank" rel="noopener noreferrer">${c.link}</a>
        </div>
        <button class="admin-cikk-sor__torles" data-id="${c.id}">Törlés</button>
      </div>
    `).join("");

    cel.querySelectorAll(".admin-cikk-sor__torles").forEach(gomb => {
      gomb.addEventListener("click", () => cikkTorlese(gomb.dataset.id, gomb));
    });
  } catch (hiba) {
    console.error(hiba);
    cel.innerHTML = `<p class="admin-ures">Nem sikerült betölteni a cikkeket.</p>`;
  }
}

async function cikkTorlese(id, gomb) {
  const jelszo = aktualisJelszo();
  if (!jelszo) {
    alert("Add meg a jelszót fent a Belépés dobozban.");
    return;
  }
  if (!confirm("Biztosan törlöd ezt a cikket?")) return;

  gomb.disabled = true;
  gomb.textContent = "Törlés…";
  try {
    const valasz = await fetch("/api/cikkek", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jelszo, id }),
    });
    const adat = await valasz.json();
    if (valasz.ok && adat.ok) {
      await cikkekBetoltese();
    } else {
      alert("Hiba: " + (adat.hiba || "ismeretlen hiba"));
      gomb.disabled = false;
      gomb.textContent = "Törlés";
    }
  } catch (halozatiHiba) {
    alert("Hálózati hiba: " + halozatiHiba.message);
    gomb.disabled = false;
    gomb.textContent = "Törlés";
  }
}


// ------------------------------------------------------------------
// Uj cikk hozzaadasa
// ------------------------------------------------------------------
function cikkHozzaadasBekotese() {
  const gomb = document.getElementById("cikkHozzaadGomb");
  const uzenetEl = document.getElementById("cikkUzenet");

  gomb.addEventListener("click", async () => {
    const jelszo = aktualisJelszo();
    const cim = document.getElementById("ujCikkCim").value.trim();
    const szerzo = document.getElementById("ujCikkSzerzo").value;
    const link = document.getElementById("ujCikkLink").value.trim();

    uzenetEl.textContent = "";

    if (!jelszo) {
      uzenetEl.textContent = "Add meg a jelszót fent a Belépés dobozban.";
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      return;
    }
    if (!cim || !link) {
      uzenetEl.textContent = "A cím és a link megadása kötelező.";
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      return;
    }

    gomb.disabled = true;
    uzenetEl.textContent = "Mentés folyamatban…";

    try {
      const valasz = await fetch("/api/cikkek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jelszo, cim, szerzo, link }),
      });
      const adat = await valasz.json();

      if (valasz.ok && adat.ok) {
        uzenetEl.textContent = "Cikk hozzáadva!";
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--siker";
        document.getElementById("ujCikkCim").value = "";
        document.getElementById("ujCikkLink").value = "";
        await cikkekBetoltese();
      } else {
        uzenetEl.textContent = "Hiba: " + (adat.hiba || "ismeretlen hiba történt.");
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      }
    } catch (hiba) {
      uzenetEl.textContent = "Hiba: " + hiba.message;
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
    } finally {
      gomb.disabled = false;
    }
  });
}


// ------------------------------------------------------------------
// Adatfrissites inditasa
// ------------------------------------------------------------------
function adatfrissitesBekotese() {
  const inditoGomb = document.getElementById("adminInditoGomb");
  const mitValaszto = document.getElementById("adminMit");
  const uzenetEl = document.getElementById("adminUzenet");

  inditoGomb.addEventListener("click", async () => {
    const jelszo = aktualisJelszo();
    const mit = mitValaszto.value;

    if (!jelszo) {
      uzenetEl.textContent = "Add meg a jelszót fent a Belépés dobozban.";
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      return;
    }

    inditoGomb.disabled = true;
    uzenetEl.textContent = "Indítás folyamatban…";
    uzenetEl.className = "admin-panel__uzenet";

    try {
      const valasz = await fetch("/api/frissites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jelszo, mit }),
      });
      const adat = await valasz.json();

      if (valasz.ok && adat.ok) {
        uzenetEl.textContent = "Elindítva! A GitHub Actions fülön követheted a lefutást.";
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--siker";
      } else {
        uzenetEl.textContent = "Hiba: " + (adat.hiba || "ismeretlen hiba történt.");
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      }
    } catch (halozatiHiba) {
      uzenetEl.textContent = "Hálózati hiba: " + halozatiHiba.message;
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
    } finally {
      inditoGomb.disabled = false;
    }
  });
}


document.addEventListener("DOMContentLoaded", () => {
  cikkekBetoltese();
  cikkHozzaadasBekotese();
  adatfrissitesBekotese();
});


/* ============================================================
   Hazi cipok kezelese
   ============================================================ */

// ------------------------------------------------------------------
// Kep tomoritese/atmeretezese a bongeszoben, MIELOTT feltoltenenk -
// ez azert kell, mert a szerver-oldali fuggveny kerese-merete
// korlatozott (kb. 4.5 MB), egy telefonos foto pedig ennel sokkal
// nagyobb is lehet nyersen.
// ------------------------------------------------------------------
function kepTomoritese(file, maxSzelesseg = 1600, minoseg = 0.82) {
  return new Promise((resolve, reject) => {
    const olvaso = new FileReader();
    olvaso.onload = (e) => {
      const kep = new Image();
      kep.onload = () => {
        let w = kep.width, h = kep.height;
        if (w > maxSzelesseg) {
          h = Math.round(h * (maxSzelesseg / w));
          w = maxSzelesseg;
        }
        const vaszon = document.createElement("canvas");
        vaszon.width = w;
        vaszon.height = h;
        vaszon.getContext("2d").drawImage(kep, 0, 0, w, h);
        resolve(vaszon.toDataURL("image/jpeg", minoseg));
      };
      kep.onerror = () => reject(new Error("Nem sikerült beolvasni a képet."));
      kep.src = e.target.result;
    };
    olvaso.onerror = () => reject(new Error("Nem sikerült olvasni a fájlt."));
    olvaso.readAsDataURL(file);
  });
}

async function kepFeltoltese(jelszo, utvonal, adatUrl) {
  const valasz = await fetch("/api/kep-feltoltes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jelszo, utvonal, adatUrl }),
  });
  const adat = await valasz.json();
  if (!valasz.ok || !adat.ok) {
    throw new Error(adat.hiba || "Ismeretlen hiba a kép feltöltésekor.");
  }
  return adat.url;
}


// ------------------------------------------------------------------
// Dinamikus kep-sorok (fajl + szoveg parok) az uj cipo urlapon
// ------------------------------------------------------------------
function ujCipoKepSorHozzaadasa() {
  const wrap = document.getElementById("ujCipoKepSorok");
  if (wrap.children.length >= 15) {
    alert("Legfeljebb 15 kép adható hozzá egy cipóhoz.");
    return;
  }
  const sor = document.createElement("div");
  sor.className = "admin-kep-sor";
  sor.innerHTML = `
    <input type="file" accept="image/*" class="admin-kep-sor__fajl">
    <input type="text" placeholder="Kép szövege / felirata" class="admin-kep-sor__szoveg">
    <button type="button" class="admin-kep-sor__torles" title="Sor eltávolítása">✕</button>
  `;
  sor.querySelector(".admin-kep-sor__torles").addEventListener("click", () => sor.remove());
  wrap.appendChild(sor);
}


// ------------------------------------------------------------------
// Cipok listazasa es torlese
// ------------------------------------------------------------------
async function cipokBetoltese() {
  const cel = document.getElementById("cipoLista");
  if (!cel) return;
  cel.textContent = "Betöltés…";
  try {
    const adat = await adatFajlLetoltese("data/hazi_cipok.json");
    const cipok = adat.cipok || [];

    if (!cipok.length) {
      cel.innerHTML = `<p class="admin-ures">Még nincs felvéve egyetlen házi cipó sem.</p>`;
      return;
    }

    cel.innerHTML = cipok.map(c => `
      <div class="admin-cikk-sor" data-id="${c.id}">
        <img src="${c.borito_kep}" alt="" class="admin-cipo-elonezet">
        <div class="admin-cikk-sor__info">
          <div class="admin-cikk-sor__szerzo">${c.szerzo} — ${c.kepek.length} kép</div>
          <div class="admin-cikk-sor__cim">${c.leiras}</div>
        </div>
        <button class="admin-cikk-sor__torles" data-id="${c.id}">Törlés</button>
      </div>
    `).join("");

    cel.querySelectorAll(".admin-cikk-sor__torles").forEach(gomb => {
      gomb.addEventListener("click", () => cipoTorlese(gomb.dataset.id, gomb));
    });
  } catch (hiba) {
    console.error(hiba);
    cel.innerHTML = `<p class="admin-ures">Nem sikerült betölteni a cipókat.</p>`;
  }
}

async function cipoTorlese(id, gomb) {
  const jelszo = aktualisJelszo();
  if (!jelszo) {
    alert("Add meg a jelszót fent a Belépés dobozban.");
    return;
  }
  if (!confirm("Biztosan törlöd ezt a cipót? (A már feltöltött képek a repóban maradnak, csak a bejegyzés törlődik.)")) return;

  gomb.disabled = true;
  gomb.textContent = "Törlés…";
  try {
    const valasz = await fetch("/api/hazi-cipok", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jelszo, id }),
    });
    const adat = await valasz.json();
    if (valasz.ok && adat.ok) {
      await cipokBetoltese();
    } else {
      alert("Hiba: " + (adat.hiba || "ismeretlen hiba"));
      gomb.disabled = false;
      gomb.textContent = "Törlés";
    }
  } catch (halozatiHiba) {
    alert("Hálózati hiba: " + halozatiHiba.message);
    gomb.disabled = false;
    gomb.textContent = "Törlés";
  }
}


// ------------------------------------------------------------------
// Uj cipo mentese: eloszor a kepek feltoltese egyenkent (tomoritve),
// utana a metaadat mentese egyetlen JSON-bejegyzeskent.
// ------------------------------------------------------------------
function cipoMentesBekotese() {
  const gomb = document.getElementById("cipoMentesGomb");
  const uzenetEl = document.getElementById("cipoUzenet");
  const haladasEl = document.getElementById("cipoHaladas");

  gomb.addEventListener("click", async () => {
    const jelszo = aktualisJelszo();
    const szerzo = document.getElementById("ujCipoSzerzo").value;
    const leiras = document.getElementById("ujCipoLeiras").value.trim();
    const boritoFajl = document.getElementById("ujCipoBoritoKep").files[0];
    const sorok = [...document.querySelectorAll("#ujCipoKepSorok .admin-kep-sor")];
    const kepSorAdatok = sorok
      .map(sor => ({
        fajl: sor.querySelector(".admin-kep-sor__fajl").files[0],
        szoveg: sor.querySelector(".admin-kep-sor__szoveg").value.trim(),
      }))
      .filter(s => s.fajl);

    uzenetEl.textContent = "";
    haladasEl.textContent = "";

    if (!jelszo) {
      uzenetEl.textContent = "Add meg a jelszót fent a Belépés dobozban.";
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      return;
    }
    if (!leiras || !boritoFajl || kepSorAdatok.length < 3) {
      uzenetEl.textContent = "Adj meg leírást, borítóképet, és legalább 3 képet (javasolt 8-12).";
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      return;
    }

    gomb.disabled = true;
    const cipoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    try {
      haladasEl.textContent = "Borítókép feltöltése…";
      const boritoDataUrl = await kepTomoritese(boritoFajl);
      const boritoUrl = await kepFeltoltese(
        jelszo, `site/assets/hazi-cipok/${cipoId}/borito.jpg`, boritoDataUrl);

      const kepek = [];
      for (let i = 0; i < kepSorAdatok.length; i++) {
        haladasEl.textContent = `Kép feltöltése… (${i + 1}/${kepSorAdatok.length})`;
        const dataUrl = await kepTomoritese(kepSorAdatok[i].fajl);
        const url = await kepFeltoltese(
          jelszo, `site/assets/hazi-cipok/${cipoId}/kep-${i + 1}.jpg`, dataUrl);
        kepek.push({ url, szoveg: kepSorAdatok[i].szoveg });
      }

      haladasEl.textContent = "Mentés…";
      const valasz = await fetch("/api/hazi-cipok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jelszo, szerzo, leiras, borito_kep: boritoUrl, kepek }),
      });
      const adat = await valasz.json();

      if (valasz.ok && adat.ok) {
        uzenetEl.textContent = "Cipó elmentve!";
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--siker";
        haladasEl.textContent = "";
        document.getElementById("ujCipoLeiras").value = "";
        document.getElementById("ujCipoBoritoKep").value = "";
        document.getElementById("ujCipoKepSorok").innerHTML = "";
        for (let i = 0; i < 3; i++) ujCipoKepSorHozzaadasa();
        await cipokBetoltese();
      } else {
        uzenetEl.textContent = "Hiba: " + (adat.hiba || "ismeretlen hiba történt.");
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
        haladasEl.textContent = "";
      }
    } catch (hiba) {
      uzenetEl.textContent = "Hiba: " + hiba.message;
      uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--hiba";
      haladasEl.textContent = "";
    } finally {
      gomb.disabled = false;
    }
  });
}


document.addEventListener("DOMContentLoaded", () => {
  cipokBetoltese();
  for (let i = 0; i < 3; i++) ujCipoKepSorHozzaadasa();
  document.getElementById("ujCipoKepHozzaad").addEventListener("click", ujCipoKepSorHozzaadasa);
  cipoMentesBekotese();
});
