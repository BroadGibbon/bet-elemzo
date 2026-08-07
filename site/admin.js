/* ============================================================
   Bread Board Capital - Admin adatfrissito panel
   Ez a fajl mindket oldalon (index.html, company.html) betoltodik.
   A jelszo maga a szerveren (Vercel kornyezeti valtozokent) van
   ellenorizve - itt csak elkuldjuk, sosem taroljuk vagy nezzuk ossze
   helyben, hogy a jelszo tenyleg csak egy helyen (a szerveren) eljen.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const megnyitoGomb = document.getElementById("adminMegnyitoGomb");
  const panel = document.getElementById("adminPanel");
  const inditoGomb = document.getElementById("adminInditoGomb");
  const jelszoMezo = document.getElementById("adminJelszo");
  const mitValaszto = document.getElementById("adminMit");
  const uzenetEl = document.getElementById("adminUzenet");

  if (!megnyitoGomb) return; // ez az oldal nem tartalmazza az admin panelt

  megnyitoGomb.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) jelszoMezo.focus();
  });

  inditoGomb.addEventListener("click", async () => {
    const jelszo = jelszoMezo.value;
    const mit = mitValaszto.value;

    if (!jelszo) {
      uzenetEl.textContent = "Add meg a jelszót.";
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
        uzenetEl.textContent = "Elindítva! A GitHub Actions fülön követheted a lefutást. " +
          "Az oldal a lefutás után, a következő megnyitáskor mutatja a friss adatot.";
        uzenetEl.className = "admin-panel__uzenet admin-panel__uzenet--siker";
        jelszoMezo.value = "";
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

  // Enter a jelszo mezoben is elinditsa a frissitest
  jelszoMezo?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") inditoGomb.click();
  });
});
