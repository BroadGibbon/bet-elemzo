"""
BET adatletolto - 5. lepes
Letolti minden ceg cegadatlap-oldalarol az alapadatokat (ISIN, nevertek,
bevezetes datuma), a tulajdonosi szerkezetet (5% feletti tulajdonosok,
kozkezhanyad) es a cegvezetest (Igazgatosag, Vallalatvezetes,
Felugyelobizottsag).
"""

import json
import os
import re
import time
import html as html_modul

from bet_api import BetKapcsolat

KIMENET_MAPPA = "data/alapadatok"


def bet_utvonalnev(kod):
    """Ugyanaz a logika, mint a fetch_penzugy.py-ban: a '/' jelet a BET
    sajat '0xc2F' kodjara csereljuk, minden mast szabvanyosan kodolunk."""
    import urllib.parse
    ideiglenes = kod.replace("/", "\x00")
    kodolt = urllib.parse.quote(ideiglenes, safe="")
    return kodolt.replace("%00", "0xc2F")


def alapadatok_kinyerese(html_szoveg):
    """A cegadatlap tetejen levo egyszeru kulcs-ertek tablazatot dolgozza fel."""
    parok = re.findall(r'<tr><td>([^<]+)</td><td><span>([^<]*)</span></td></tr>', html_szoveg)
    eredmeny = {}
    for k, v in parok:
        eredmeny[k.strip()] = v.replace("\xa0", " ").strip()
    return {
        "isin": eredmeny.get("ISIN"),
        "bevezetes_datuma": eredmeny.get("Bevezetés időpontja"),
        "kereskedes_penzneme": eredmeny.get("Kereskedés pénzneme"),
        "nevertek": eredmeny.get("Névérték"),
        "bevezetett_mennyiseg": eredmeny.get("Bevezetett mennyiség (db)"),
        "kapitalizacio_m_ft": eredmeny.get("Kapitalizáció (m Ft)"),
    }


def tulajdonosok_kinyerese(html_szoveg):
    """
    A 'Részvénytulajdonosok' es 'Cégvezetés' szekciobol kiszedi az 5% folotti
    tulajdonosokat, a kozkezhanyadot, es a cegvezetes szemelyeit.
    A HTML-t '|' menten tokenekre bontjuk (minden cimke es ertek kulon token
    lesz), ez sokkal megbizhatobb, mint egy nagy regex.
    """
    eredmeny = {"tulajdonosok": [], "kozkezhanyad": None, "kozkezhanyad_frissitve": None,
                "igazgatosag": None, "vallalatvezetes": None, "felugyelobizottsag": None,
                "cegvezetes_frissitve": None}

    def tokenek(szoveg_resz):
        t = html_modul.unescape(re.sub(r'<[^>]+>', '|', szoveg_resz))
        t = re.sub(r'\|+', '|', t)
        return [d.strip().replace("\xa0", " ") for d in t.split('|') if d.strip()]

    # --- Tulajdonosok es kozkezhanyad ---
    i = html_szoveg.find("5%-ot meghaladó")
    j = html_szoveg.find("Cégvezetés")
    if i != -1 and j != -1:
        darabok = tokenek(html_szoveg[i:j])
        # Az elso 4 token a cim + fejlec (Nev / Tulajdoni hanyad / Reszveny darabszam)
        pos = 4
        while pos + 2 < len(darabok) and darabok[pos] != "Közkézhányad":
            nev, szazalek, darabszam = darabok[pos], darabok[pos + 1], darabok[pos + 2]
            if re.match(r'^\d{1,3}(?:,\d{1,2})?$', szazalek):
                eredmeny["tulajdonosok"].append({
                    "nev": nev,
                    "tulajdoni_hanyad": szazalek.replace(",", ".") + "%",
                    "darabszam": darabszam.replace(" ", ""),
                })
                pos += 3
            else:
                break  # varatlan minta, inkabb leallunk, mint hogy rossz adatot mentsunk

        if pos < len(darabok) and darabok[pos] == "Közkézhányad":
            # minta: Közkézhányad | : | 81,17 | %
            for offset in range(1, 4):
                if pos + offset < len(darabok):
                    m2 = re.match(r'^(\d{1,3}(?:,\d{1,2})?)$', darabok[pos + offset])
                    if m2:
                        eredmeny["kozkezhanyad"] = m2.group(1).replace(",", ".") + "%"
                        break

        # Utolsó frissítés dátuma a tulajdonosi reszhez
        for idx, d in enumerate(darabok):
            if d.startswith("Utolsó frissítés") and idx + 2 < len(darabok):
                eredmeny["kozkezhanyad_frissitve"] = darabok[idx + 2]
                break

    # --- Cegvezetes: Igazgatosag / Vallalatvezetes / Felugyelobizottsag ---
    cegvezetes_resz = html_szoveg[j:j + 4000] if j != -1 else ""
    if cegvezetes_resz:
        darabok = tokenek(cegvezetes_resz)
        cimke_terkep = {
            "Igazgatóság": "igazgatosag",
            "Vállalatvezetés": "vallalatvezetes",
            "Felügyelőbizottság": "felugyelobizottsag",
        }
        for idx, d in enumerate(darabok):
            if d in cimke_terkep and idx + 1 < len(darabok):
                eredmeny[cimke_terkep[d]] = darabok[idx + 1]
            if d.startswith("Utolsó frissítés") and idx + 2 < len(darabok):
                eredmeny["cegvezetes_frissitve"] = darabok[idx + 2]

    return eredmeny


def main():
    import sys
    kezdet = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    veg = int(sys.argv[2]) if len(sys.argv) > 2 else None

    with open("data/reszvenyek.json", encoding="utf-8") as f:
        reszvenyek = sorted(json.load(f)["reszvenyek"], key=lambda r: r["seccode"])[kezdet:veg]

    os.makedirs(KIMENET_MAPPA, exist_ok=True)
    bet = BetKapcsolat()

    hibas = []
    for i, r in enumerate(reszvenyek, 1):
        kod = r["seccode"]
        try:
            html_szoveg = bet.oldal(f"/oldalak/ceg_adatlap/$security/{bet_utvonalnev(kod)}")
            alap = alapadatok_kinyerese(html_szoveg)
            tulaj = tulajdonosok_kinyerese(html_szoveg)

            kimenet = {"seccode": kod, **alap, **tulaj}
            fajlnev = kod.replace("/", "_").replace(" ", "_")
            with open(f"{KIMENET_MAPPA}/{fajlnev}.json", "w", encoding="utf-8") as f:
                json.dump(kimenet, f, ensure_ascii=False, indent=2)

            print(f"[{i:2d}/{len(reszvenyek)}] {kod:14s} "
                  f"ISIN={alap['isin']}  tulajdonos-sorok={len(tulaj['tulajdonosok'])}")
        except Exception as hiba:
            print(f"[{i:2d}/{len(reszvenyek)}] {kod:14s} HIBA: {hiba}")
            hibas.append(kod)
        time.sleep(0.4)

    print(f"\nKESZ. {len(reszvenyek) - len(hibas)}/{len(reszvenyek)} ceg sikeres.")
    if hibas:
        print("Sikertelen:", ", ".join(hibas))


if __name__ == "__main__":
    main()
