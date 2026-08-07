"""
BET adatletolto - 7. lepes
Kiszamolja a piaci (teljes BET) es szektoronkenti atlagokat/medianokat a
legfontosabb mutatokra. Ez adja az alapot a cegoldalon lathato
"sajat ceg vs BET atlag" es "sajat ceg vs szektor atlag" osszehasonlitasokhoz.

Medianokat hasznalunk atlag helyett, mert nehany extrem ertek (pl. egy
csod szelen allo ceg -300%-os ROE-je) az atlagot teljesen eltorzitana,
a medianra viszont nincs ekkora hatasa.
"""

import json
import os
import statistics

MUTATOK_MAPPA = "data/mutatok"
KIMENET_UTVONAL = "data/piaci_atlagok.json"


def median_kiszamitasa(ertekek):
    """Median egy listabol, None ertekek nelkul. Ures listanal None-t ad vissza."""
    tiszta = [e for e in ertekek if e is not None]
    if not tiszta:
        return None
    return statistics.median(tiszta)


def main():
    with open("data/szektorok.json", encoding="utf-8") as f:
        szektor_map = json.load(f)["szektorok"]

    cegek_adatai = []
    for fajl in sorted(os.listdir(MUTATOK_MAPPA)):
        if not fajl.endswith(".json"):
            continue
        with open(f"{MUTATOK_MAPPA}/{fajl}", encoding="utf-8") as f:
            d = json.load(f)
        kod = d["seccode"]
        szektor_info = szektor_map.get(kod, {})
        cegek_adatai.append({
            "seccode": kod,
            "szektor": szektor_info.get("szektor", "Egyéb szolgáltatás"),
            "roe": d["bet_sajat_mutatok"].get("roe_bet"),
            "roa": d["bet_sajat_mutatok"].get("roa_bet"),
            "tokeattetel": d["bet_sajat_mutatok"].get("tokeattetel_bet"),
            "pe": d["arfolyam_mutatok"].get("pe"),
            "pbv": d["arfolyam_mutatok"].get("pbv"),
        })

    def csoport_atlagai(cegek):
        return {
            "roe_median": median_kiszamitasa([c["roe"] for c in cegek]),
            "roa_median": median_kiszamitasa([c["roa"] for c in cegek]),
            "tokeattetel_median": median_kiszamitasa([c["tokeattetel"] for c in cegek]),
            "pe_median": median_kiszamitasa([c["pe"] for c in cegek]),
            "pbv_median": median_kiszamitasa([c["pbv"] for c in cegek]),
            "cegek_szama": len(cegek),
        }

    piac_egesz = csoport_atlagai(cegek_adatai)

    szektorok_szerint = {}
    for szektor_nev in sorted(set(c["szektor"] for c in cegek_adatai)):
        tagok = [c for c in cegek_adatai if c["szektor"] == szektor_nev]
        szektorok_szerint[szektor_nev] = {
            **csoport_atlagai(tagok),
            "tagok": [c["seccode"] for c in tagok],
        }

    kimenet = {
        "piac_egesz": piac_egesz,
        "szektorok": szektorok_szerint,
    }

    with open(KIMENET_UTVONAL, "w", encoding="utf-8") as f:
        json.dump(kimenet, f, ensure_ascii=False, indent=2)

    print("BET egesz piac:", json.dumps(piac_egesz, ensure_ascii=False, indent=2))
    print(f"\n{len(szektorok_szerint)} szektor kiszamolva.")
    for nev, adat in szektorok_szerint.items():
        print(f"  {nev:40s} {adat['cegek_szama']} cég, ROE medián: {adat['roe_median']}")


if __name__ == "__main__":
    main()
