"""
BET adatellenorzo - segedeszkoz
Vegignezi a mar letoltott data/ixbrl/*.json fajlokat, es minden cegre
megallapitja, mi a legfrissebb penzugyi ev, amire van adatunk.

Ez NEM tolt le semmit a halozatrol - csak a mar meglevo fajlokat elemzi,
ezert gyorsan lefut es barhol futtathato.

Hasznalat: python audit_ixbrl.py
"""

import json
import os
import re
from datetime import date

KIMENET_MAPPA = "data/ixbrl"


def legfrissebb_ev(adatok):
    """Megkeresi a legkesobbi datumot egy ceg osszes kinyert tenye kozott."""
    legkesobbi = None
    for fogalom, ertekek in adatok.items():
        for idokulcs in ertekek:
            # az idokulcs vagy egy datum ("2025-12-31"), vagy egy periodus
            # ("2025-01-01..2025-12-31") - mindket esetben a vegdatumot nezzuk
            datum_resz = idokulcs.split("..")[-1]
            m = re.match(r"(\d{4})-(\d{2})-(\d{2})", datum_resz)
            if m:
                d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                if legkesobbi is None or d > legkesobbi:
                    legkesobbi = d
    return legkesobbi


def main():
    if not os.path.isdir(KIMENET_MAPPA):
        print(f"Nincs '{KIMENET_MAPPA}' mappa - eloszor futtasd a fetch_ixbrl.py-t.")
        return

    ma = date.today()
    eredmenyek = []

    for fajl in sorted(os.listdir(KIMENET_MAPPA)):
        if not fajl.endswith(".json"):
            continue
        with open(f"{KIMENET_MAPPA}/{fajl}", encoding="utf-8") as f:
            d = json.load(f)
        legujabb = legfrissebb_ev(d.get("adatok", {}))
        kor_honapokban = None
        if legujabb:
            kor_honapokban = (ma.year - legujabb.year) * 12 + (ma.month - legujabb.month)
        eredmenyek.append({
            "kod": d.get("seccode", fajl.replace(".json", "")),
            "fogalmak": d.get("fogalmak_szama", len(d.get("adatok", {}))),
            "legujabb_datum": legujabb.isoformat() if legujabb else None,
            "kor_honap": kor_honapokban,
        })

    eredmenyek.sort(key=lambda x: (x["kor_honap"] is None, x["kor_honap"]))

    print(f"{'Ticker':14s} {'Legfrissebb adat':18s} {'Kor':>10s}  {'Fogalmak'}")
    print("-" * 60)
    for e in eredmenyek:
        if e["legujabb_datum"]:
            kor_txt = f"{e['kor_honap']} honap"
            figyelmezetes = "  <- REGI, ellenorizd" if e["kor_honap"] > 18 else ""
        else:
            kor_txt = "nincs datum"
            figyelmezetes = ""
        print(f"{e['kod']:14s} {e['legujabb_datum'] or '-':18s} {kor_txt:>10s}  "
              f"{e['fogalmak']:4d}{figyelmezetes}")

    print(f"\nOsszesen {len(eredmenyek)} cegre van iXBRL adat.")
    regiek = [e for e in eredmenyek if e["kor_honap"] and e["kor_honap"] > 18]
    if regiek:
        print(f"\n{len(regiek)} cegnel 18 honapnal regebbi a legfrissebb adat "
              f"(lehet, hogy meg nem publikaltak az uj eves jelentest, "
              f"vagy a keresonevet finomitani kell):")
        for e in regiek:
            print(f"  - {e['kod']}")


if __name__ == "__main__":
    main()
