"""
BET adatletolto - 2. lepes
Letolti minden reszveny teljes napi arfolyam-tortenetet (a bevezetes napjaig
visszamenoleg), es reszvenyenkent kulon fajlba menti.

Egy sor jelentese:
  datum, nyito, legmagasabb, legalacsonyabb, zaro, forgalom_Ft, mennyiseg_db
"""

import json
import os
import time
from datetime import datetime, timezone

from bet_api import BetKapcsolat

KIMENET_MAPPA = "data/arfolyam"


def datum(ezredmasodperc):
    """A BET ezredmasodpercben adja a datumot, mi olvashato formara alakitjuk."""
    return datetime.fromtimestamp(ezredmasodperc / 1000, timezone.utc).strftime("%Y-%m-%d")


def main():
    with open("data/reszvenyek.json", encoding="utf-8") as f:
        reszvenyek = json.load(f)["reszvenyek"]

    os.makedirs(KIMENET_MAPPA, exist_ok=True)
    bet = BetKapcsolat()

    osszes_sor = 0
    hibas = []

    for i, r in enumerate(reszvenyek, 1):
        kod = r["seccode"]
        # A "/" nem hasznalhato fajlnevben (pl. FORRAS/OE)
        fajlnev = kod.replace("/", "_").replace(" ", "_")
        lekerdezes = f"SecurityHistoricDataSource;securityId={r['securityid']}"

        try:
            valasz = bet.lekerdez([lekerdezes])
            nyers = valasz[lekerdezes]["values"]
        except Exception as hiba:
            print(f"[{i:2d}/{len(reszvenyek)}] {kod:14s} HIBA: {hiba}")
            hibas.append(kod)
            time.sleep(1)
            continue

        sorok = []
        for sor in nyers:
            sorok.append({
                "datum": datum(sor[0]),
                "nyito": sor[1],
                "max": sor[2],
                "min": sor[3],
                "zaro": sor[4],
                "forgalom_ft": sor[5],
                "mennyiseg_db": sor[6],
            })
        sorok.sort(key=lambda s: s["datum"])

        kimenet = {
            "seccode": kod,
            "securityid": r["securityid"],
            "isin": r.get("isin"),
            "letoltve": datetime.now(timezone.utc).isoformat(),
            "napok_szama": len(sorok),
            "elso_nap": sorok[0]["datum"] if sorok else None,
            "utolso_nap": sorok[-1]["datum"] if sorok else None,
            "adatok": sorok,
        }

        utvonal = f"{KIMENET_MAPPA}/{fajlnev}.json"
        with open(utvonal, "w", encoding="utf-8") as f:
            json.dump(kimenet, f, ensure_ascii=False, separators=(",", ":"))

        osszes_sor += len(sorok)
        meret = os.path.getsize(utvonal) / 1024
        print(f"[{i:2d}/{len(reszvenyek)}] {kod:14s} {len(sorok):6d} nap  "
              f"{kimenet['elso_nap']} -> {kimenet['utolso_nap']}  ({meret:.0f} kB)")

        # Udvariassag a BET szerverevel szemben
        time.sleep(0.7)

    print(f"\nKESZ. Osszesen {osszes_sor:,} napi adatsor, {len(reszvenyek) - len(hibas)} reszvenyre.")
    if hibas:
        print("Sikertelen:", ", ".join(hibas))


if __name__ == "__main__":
    main()
