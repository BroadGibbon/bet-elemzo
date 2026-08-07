"""
BET adatletolto - 6. lepes
Kiszamolja minden ceghez a penzugyi mutatokat: alapmutatok (P/E, P/BV),
DuPont ROE-lebontas, profitabilitasi/likviditasi/szolvencia rátak, es egy
Piotroski-ihletesu pontszamot.

Elsodleges forras: a BET sajat "Fontosabb penzugyi mutatok" es
"Osszefoglalo eves adatok" tablazata (data/penzugy/*.json) - ez minden
51 cegnel egysegesen tartalmazza az Adozott eredmeny / Sajat toke /
Eszkozok osszesen sorokat, fuggetlenul a szektortol.

Masodlagos, kiegeszito forras (ahol van): a reszletes iXBRL adat
(data/ixbrl/*.json) - ebbol jon a cash flow es a forgoeszkoz-adat,
ha a ceg cimkezte oket.

FONTOS: nem minden mutato szamolhato minden cegnel. Ahol hianyzik az
alapadat, ott a mutato erteke null lesz, es a Piotroski pontszam
nevezoje (hany kriteriumbol all) is ennek megfeleloen valtozik -
inkabb ezt jelezzuk vilagosan, mint hogy hianyos adatbol hamis
pontossagot mutassunk.
"""

import json
import os
import re

PENZUGY_MAPPA = "data/penzugy"
IXBRL_MAPPA = "data/ixbrl"
KIMENET_MAPPA = "data/mutatok"


def szam(ertek):
    """Rugalmas szamma alakitas: kezeli a None-t es a mar szam tipusokat is."""
    if ertek is None:
        return None
    if isinstance(ertek, (int, float)):
        return float(ertek)
    try:
        return float(str(ertek).replace(" ", "").replace("\xa0", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def sor_ertekei(sorok, cimke):
    """Egy adott sor (pl. 'Saját tőke') ev->ertek szotaranak lekerese, szammal."""
    nyers = sorok.get(cimke, {})
    return {ev: szam(v) for ev, v in nyers.items() if szam(v) is not None}


def legutolso_ev(evek_listaja):
    """A legkesobbi ev kivalasztasa egy evszam-listabol (stringkent tarolva)."""
    if not evek_listaja:
        return None
    return sorted(evek_listaja, key=lambda e: int(e))[-1]


def penzugyi_alapadatok_kigyujtese(penzugy_adat):
    """A BET osszefoglalobol kigyujti a legfontosabb sorokat, evenkent."""
    sorok = penzugy_adat.get("eves_osszefoglalo", {}).get("sorok", {})
    penznemek = penzugy_adat.get("eves_osszefoglalo", {}).get("penznemek", {})

    return {
        "adozott_eredmeny": sor_ertekei(sorok, "Adózott eredmény"),
        "sajat_toke": sor_ertekei(sorok, "Saját tőke"),
        "eszkozok": sor_ertekei(sorok, "Eszközök összesen"),
        "jegyzett_toke": sor_ertekei(sorok, "Jegyzett tőke"),
        "arbevetel": sor_ertekei(sorok, "Árbevétel"),
        "eps": sor_ertekei(sorok, "Egy részvényre jutó eredmény (EPS)"),
        "osztalek": sor_ertekei(sorok, "Egy (törzs)részvényre jutó osztalék"),
        "penznemek": penznemek,
    }


def bet_sajat_mutatok_kigyujtese(penzugy_adat):
    """A BET mar kiszamolt ROE/ROA/tokeattetel mutatoit hasznaljuk elsodlegesen."""
    sorok = penzugy_adat.get("penzugyi_mutatok", {}).get("sorok", {})
    return {
        "roe_bet": sor_ertekei(sorok, "Adózott eredmény osztva a saját tőke összegével"),
        "roa_bet": sor_ertekei(sorok, "Adózott eredmény osztva az összes eszköz összegével"),
        "tokeattetel_bet": sor_ertekei(sorok, "Összes kötelezettség osztva a saját tőke összegével"),
    }


def ixbrl_kiegeszites(ixbrl_adat):
    """Ha van reszletes iXBRL adat, ebbol vesszuk a cash flow-t es forgoeszkozoket."""
    if not ixbrl_adat:
        return {"cfo": {}, "forgo_eszkoz": {}, "rovid_kotelezettseg": {}}
    adatok = ixbrl_adat.get("adatok", {})

    def evre_bontva(fogalom_kulcsok):
        """Tobb lehetseges IFRS cimke kozul az elsot hasznaljuk, ami letezik."""
        for kulcs in fogalom_kulcsok:
            if kulcs in adatok:
                eredmeny = {}
                for idokulcs, ertek in adatok[kulcs].items():
                    ev = idokulcs.split("..")[-1][:4]  # "2024-12-31" vagy "2024-01-01..2024-12-31"
                    eredmeny[ev] = ertek
                return eredmeny
        return {}

    return {
        "cfo": evre_bontva(["CashFlowsFromUsedInOperatingActivities"]),
        "forgo_eszkoz": evre_bontva(["CurrentAssets"]),
        "rovid_kotelezettseg": evre_bontva(["CurrentLiabilities"]),
    }


def dupont_bontas(ni, equity, assets, revenue=None):
    """
    ROE = (NI/Assets) x (Assets/Equity)  -- ez MINDEN cegnel szamolhato.
    Ha van bevetel-adat is, a harom-tenyezos valtozatot is visszaadjuk:
    ROE = (NI/Revenue) x (Revenue/Assets) x (Assets/Equity)
    """
    if not ni or not equity or not assets or equity == 0 or assets == 0:
        return None
    roa = ni / assets
    tokeattetel = assets / equity
    eredmeny = {
        "roa": roa,
        "tokeattetel": tokeattetel,
        "roe_szamolt": roa * tokeattetel,
    }
    if revenue and revenue != 0:
        eredmeny["nettó_margin"] = ni / revenue
        eredmeny["eszkoz_forgas"] = revenue / assets
    return eredmeny


def piotroski_pontszam(evek, adozott_eredmeny, sajat_toke, eszkozok, arbevetel, eps, cfo):
    """
    Piotroski F-score - ihletett valtozat. A klasszikus modszer 9 kriteriumat
    hasznaljuk, DE csak azokat szamoljuk bele, amikhez tenyleg van adatunk.
    A vegeredmenyt "X/N pont" formaban adjuk vissza, ahol N a ténylegesen
    ertekelheto kriteriumok szama - igy sosem allitunk tobbet, mint amit az
    adat tenyleg alatamaszt.
    """
    evek_sorban = sorted(evek, key=lambda e: int(e))
    if len(evek_sorban) < 2:
        return None
    ev_u, ev_e = evek_sorban[-1], evek_sorban[-2]  # utolso, eloz(o)

    pontok = 0
    ertekelheto = 0
    reszletek = {}

    def kriterium(nev, feltetel_igaz, van_adat):
        nonlocal pontok, ertekelheto
        if van_adat:
            ertekelheto += 1
            if feltetel_igaz:
                pontok += 1
            reszletek[nev] = "✓" if feltetel_igaz else "✗"
        else:
            reszletek[nev] = "nincs adat"

    ni_u, ni_e = adozott_eredmeny.get(ev_u), adozott_eredmeny.get(ev_e)
    eq_u, eq_e = sajat_toke.get(ev_u), sajat_toke.get(ev_e)
    as_u, as_e = eszkozok.get(ev_u), eszkozok.get(ev_e)
    rev_u, rev_e = arbevetel.get(ev_u), arbevetel.get(ev_e)
    eps_u, eps_e = eps.get(ev_u), eps.get(ev_e)
    cfo_u = cfo.get(ev_u)

    # 1. Pozitiv adozott eredmeny
    kriterium("Pozitív nettó eredmény", ni_u is not None and ni_u > 0, ni_u is not None)

    # 2. Pozitiv mukodesi cash flow (csak ha van iXBRL adat)
    kriterium("Pozitív működési cash flow", cfo_u is not None and cfo_u > 0, cfo_u is not None)

    # 3. Novekvo ROA
    roa_u = ni_u / as_u if (ni_u is not None and as_u) else None
    roa_e = ni_e / as_e if (ni_e is not None and as_e) else None
    kriterium("Növekvő eszközarányos megtérülés (ROA)",
              roa_u is not None and roa_e is not None and roa_u > roa_e,
              roa_u is not None and roa_e is not None)

    # 4. Cash flow > adozott eredmeny (eredmeny-minoseg)
    kriterium("Cash flow meghaladja a nyereséget (minőségi jel)",
              cfo_u is not None and ni_u is not None and cfo_u > ni_u,
              cfo_u is not None and ni_u is not None)

    # 5. Csokkeno tokeattetel (kotelezettseg/eszkoz aranya csokken)
    lev_u = (as_u - eq_u) / as_u if (as_u and eq_u is not None) else None
    lev_e = (as_e - eq_e) / as_e if (as_e and eq_e is not None) else None
    kriterium("Csökkenő eladósodottság",
              lev_u is not None and lev_e is not None and lev_u < lev_e,
              lev_u is not None and lev_e is not None)

    # 6. Nem bocsatott ki uj reszvenyt (EPS-bol visszaszamolt darabszam nem nott)
    darab_u = ni_u / eps_u if (ni_u is not None and eps_u) else None
    darab_e = ni_e / eps_e if (ni_e is not None and eps_e) else None
    kriterium("Nincs jelentős részvénykibocsátás (közelítés)",
              darab_u is not None and darab_e is not None and darab_u <= darab_e * 1.01,
              darab_u is not None and darab_e is not None)

    # 7. Novekvo nettó margin (bruttó helyett, mert reszletes koltsegsor nincs)
    margin_u = ni_u / rev_u if (ni_u is not None and rev_u) else None
    margin_e = ni_e / rev_e if (ni_e is not None and rev_e) else None
    kriterium("Növekvő nettó árrés (közelítés bruttó árrés helyett)",
              margin_u is not None and margin_e is not None and margin_u > margin_e,
              margin_u is not None and margin_e is not None)

    # 8. Novekvo eszkozforgas
    forgas_u = rev_u / as_u if (rev_u and as_u) else None
    forgas_e = rev_e / as_e if (rev_e and as_e) else None
    kriterium("Növekvő eszközforgási sebesség",
              forgas_u is not None and forgas_e is not None and forgas_u > forgas_e,
              forgas_u is not None and forgas_e is not None)

    if ertekelheto == 0:
        return None

    return {
        "pontszam": pontok,
        "maximum": ertekelheto,
        "reszletek": reszletek,
        "ev": ev_u,
    }


def ceg_mutatoinak_szamitasa(kod, penzugy_adat, ixbrl_adat, ar_adat):
    alap = penzugyi_alapadatok_kigyujtese(penzugy_adat)
    bet_mutatok = bet_sajat_mutatok_kigyujtese(penzugy_adat)
    ixbrl_kieg = ixbrl_kiegeszites(ixbrl_adat)

    minden_ev = set()
    for d in [alap["adozott_eredmeny"], alap["sajat_toke"], alap["eszkozok"]]:
        minden_ev |= set(d.keys())
    if not minden_ev:
        return None

    utolso_ev = legutolso_ev(minden_ev)

    ni = alap["adozott_eredmeny"].get(utolso_ev)
    eq = alap["sajat_toke"].get(utolso_ev)
    assets = alap["eszkozok"].get(utolso_ev)
    revenue = alap["arbevetel"].get(utolso_ev)

    dupont = dupont_bontas(ni, eq, assets, revenue)

    # Ar-alapu mutatok (P/E, P/BV) - a jelenlegi arfolyammal, az utolso
    # ismert eves adattal
    # Ar-alapu mutatok (P/E, P/BV) - a jelenlegi arfolyammal, az utolso
    # ismert eves adattal. FONTOS: ha a ceg nem HUF-ban jelent (pl. a becsi
    # VIG EUR-ban), ezeket nem szamoljuk - a HUF-os arfolyam es a devizas
    # eredmeny osszevetese ertelmetlen es felrevezeto szam lenne.
    penznem = alap["penznemek"].get(utolso_ev, "HUF")
    ar = ar_adat.get("lasttradedprice") if ar_adat else None
    reszvenyszam = ar_adat.get("listedqty") if ar_adat else None
    pe, pbv = None, None
    if penznem == "HUF":
        eps_ertek = alap["eps"].get(utolso_ev)
        if not eps_ertek and ni and reszvenyszam:
            eps_ertek = ni / reszvenyszam  # ni mar tenyleges HUF, nem kell skalazni
        if ar and eps_ertek and eps_ertek != 0:
            pe = ar / eps_ertek
        if ar and eq and reszvenyszam:
            bvps = eq / reszvenyszam  # eq mar tenyleges HUF
            if bvps != 0:
                pbv = ar / bvps

    piotroski = piotroski_pontszam(
        minden_ev, alap["adozott_eredmeny"], alap["sajat_toke"], alap["eszkozok"],
        alap["arbevetel"], alap["eps"], ixbrl_kieg["cfo"])

    # Likviditasi ratak - csak ha van iXBRL forgoeszkoz-adat
    likviditas = None
    if utolso_ev in ixbrl_kieg["forgo_eszkoz"] and utolso_ev in ixbrl_kieg["rovid_kotelezettseg"]:
        fe = ixbrl_kieg["forgo_eszkoz"][utolso_ev]
        rk = ixbrl_kieg["rovid_kotelezettseg"][utolso_ev]
        if rk:
            likviditas = {"likviditasi_rata": fe / rk}

    return {
        "seccode": kod,
        "utolso_ev": utolso_ev,
        "penznem": penznem,
        "arfolyam_mutatok": {"pe": pe, "pbv": pbv},
        "dupont": dupont,
        "bet_sajat_mutatok": {k: v.get(utolso_ev) for k, v in bet_mutatok.items()},
        "likviditas": likviditas,
        "piotroski": piotroski,
        "historikus": {
            "evek": sorted(minden_ev, key=lambda e: int(e)),
            "roe_bet": bet_mutatok["roe_bet"],
            "roa_bet": bet_mutatok["roa_bet"],
            "tokeattetel_bet": bet_mutatok["tokeattetel_bet"],
            "adozott_eredmeny": alap["adozott_eredmeny"],
            "arbevetel": alap["arbevetel"],
            "sajat_toke": alap["sajat_toke"],
            "eszkozok": alap["eszkozok"],
        },
    }


def main():
    os.makedirs(KIMENET_MAPPA, exist_ok=True)

    with open("data/reszvenyek.json", encoding="utf-8") as f:
        reszvenyek = {r["seccode"]: r for r in json.load(f)["reszvenyek"]}

    sikeres = 0
    for fajl in sorted(os.listdir(PENZUGY_MAPPA)):
        if not fajl.endswith(".json"):
            continue
        with open(f"{PENZUGY_MAPPA}/{fajl}", encoding="utf-8") as f:
            penzugy_adat = json.load(f)
        kod = penzugy_adat["seccode"]

        ixbrl_adat = None
        ixbrl_utvonal = f"{IXBRL_MAPPA}/{fajl}"
        if os.path.exists(ixbrl_utvonal):
            with open(ixbrl_utvonal, encoding="utf-8") as f:
                ixbrl_adat = json.load(f)

        ar_adat = reszvenyek.get(kod)

        eredmeny = ceg_mutatoinak_szamitasa(kod, penzugy_adat, ixbrl_adat, ar_adat)
        if eredmeny is None:
            print(f"{kod:14s} KIHAGYVA - nincs eleg alapadat")
            continue

        with open(f"{KIMENET_MAPPA}/{fajl}", "w", encoding="utf-8") as f:
            json.dump(eredmeny, f, ensure_ascii=False, indent=2)

        piotroski_txt = (f"{eredmeny['piotroski']['pontszam']}/{eredmeny['piotroski']['maximum']}"
                          if eredmeny["piotroski"] else "n/a")
        print(f"{kod:14s} ROE={eredmeny['bet_sajat_mutatok']['roe_bet']}  "
              f"P/E={eredmeny['arfolyam_mutatok']['pe']}  Piotroski={piotroski_txt}")
        sikeres += 1

    print(f"\nKESZ. {sikeres} ceg mutatoi kiszamolva.")


if __name__ == "__main__":
    main()
