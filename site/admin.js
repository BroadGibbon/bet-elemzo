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
    uzenetEl.className = "admin-panel__uzenet";

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
    } catch (halozatiHiba) {
      uzenetEl.textContent = "Hálózati hiba: " + halozatiHiba.message;
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
