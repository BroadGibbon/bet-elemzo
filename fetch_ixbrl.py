"""
BET adatletolto - 4. lepes
Letolti a cegek hivatalos ESEF/iXBRL eves jelenteseit az MNB nyilvanos
kozzeteteli rendszerebol (kozzetetelek.mnb.hu), es kinyeri belolük a
teljes, gepekkel olvashato eredmenykimutatast, merleget es cash flow-t.

Ez NEM a BET oldala - ez a Magyar Nemzeti Bank hivatalos, torvenyi
kotelezettsegen alapulo kozzeteteli rendszere, ahol minden tozsdei ceg
koteles az eves jelenteset elhelyezni. Bejelentkezes nelkul, nyilvanosan
kereshetot.

FONTOS: a nyers ESEF csomagok (5-6 MB cegenkent es evenkent) NEM kerulnek
a git repoba - csak a beloluk kinyert, tomor JSON adat. A nyers fajlokat
egy ideiglenes mappaba toltjuk, es a feldolgozas utan eldobjuk.
"""

import json
import os
import re
import shutil
import time
import urllib.parse
import urllib.request
import http.cookiejar
import zipfile

MNB_BASE = "https://kozzetetelek.mnb.hu"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

IDEIGLENES_MAPPA = "_ideiglenes_ixbrl"
KIMENET_MAPPA = "data/ixbrl"

# Az "eves jelentes" dokumentum-altipus kodja az MNB rendszereben
EVES_JELENTES_ALTIPUS = "38"

# A cegnevekbol ezeket a jogi vegzodeseket vagjuk le a kereseshez, mert az
# MNB rendszereben a hivatalos, teljes jogi nev szerepel, ami néha máshogy
# rovidul, mint a BET oldalan latott valtozat.
JOGI_VEGZODES = re.compile(
    r'\b(Nyrt\.?|Nyilvánosan\s+Működő\s+Részvénytársaság|Zrt\.?|Rt\.?|Kft\.?)\b\.?',
    re.IGNORECASE,
)

# Egy ESEF csomag fajlneve mindig ezt a mintat koveti:
# {20 karakteres LEI kod}-{ev-honap-nap}-{barmi}-{hu vagy en}{barmi}.zip
ESEF_FAJLNEV_MINTA = re.compile(
    r'([A-Z0-9]{20})-(\d{4}-\d{2}-\d{2})[\w-]*-(hu|en)[\w]*\.zip'
)


class MnbKapcsolat:
    """Egy elo kapcsolat az MNB kozzeteteli rendszerehez."""

    def __init__(self):
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))
        self.opener.addheaders = [("User-Agent", UA)]
        # Egy kezdeti latogatas kell a sutik beallitasahoz
        self.opener.open(MNB_BASE + "/search/advanced", timeout=30).read()

    def kereses(self, cegnev_resz, probak=3):
        """Megkeresi egy ceg 'eves jelentes' tipusu kozzeteteleit."""
        adat = urllib.parse.urlencode({
            "Concerned": cegnev_resz,
            "DocumentSubType": EVES_JELENTES_ALTIPUS,
            "selectedInstitutionTypes": "NyilvanosErtekpapirKibocsato",
            "pagesize": "100",
            "orderby": "10",  # datum szerint csokkeno
        }).encode()
        for proba in range(probak):
            try:
                keres = urllib.request.Request(
                    MNB_BASE + "/search", data=adat, method="POST")
                keres.add_header("User-Agent", UA)
                html = self.opener.open(keres, timeout=30).read().decode("utf-8", "replace")
                return list(dict.fromkeys(re.findall(r'viewid=(K\d+/\d+)', html)))
            except Exception:
                time.sleep(1.5 * (proba + 1))
        return []

    def reszletek(self, viewid, probak=3):
        """Letolti egy kozzetetel reszletes oldalat (itt vannak a fajl-linkek)."""
        for proba in range(probak):
            try:
                keres = urllib.request.Request(
                    f"{MNB_BASE}/kozzetetelek?viewid={urllib.parse.quote(viewid)}")
                keres.add_header("User-Agent", UA)
                return self.opener.open(keres, timeout=30).read().decode("utf-8", "replace")
            except Exception:
                time.sleep(1.5 * (proba + 1))
        return ""

    def fajl_letoltese(self, doc_id, viewid, cel_utvonal, probak=3):
        """Letolt egy csatolt fajlt (pl. az ESEF ZIP-et)."""
        url = f"{MNB_BASE}/downloadkozzetetel?id={doc_id}&did={urllib.parse.quote(viewid)}"
        for proba in range(probak):
            try:
                keres = urllib.request.Request(url)
                keres.add_header("User-Agent", UA)
                nyers = self.opener.open(keres, timeout=60).read()
                with open(cel_utvonal, "wb") as f:
                    f.write(nyers)
                return True
            except Exception:
                time.sleep(1.5 * (proba + 1))
        return False


def cegnev_a_kereseshez(teljes_nev):
    """A hivatalos cegnevbol levagja a jogi vegzodest (Nyrt., Zrt. stb.)."""
    return JOGI_VEGZODES.sub("", teljes_nev).strip(" .,")


def esef_csomagok_keresese(mnb, cegnev, max_jelolt=40):
    """
    Vegignezi egy ceg 'eves jelentes' kozzeteteleit, es visszaadja azokat,
    amelyekben talalhato egy ESEF/iXBRL csomag (fajlnev-minta alapjan).
    Egy elem: {viewid, datum, doc_id, lei, nyelv}
    """
    viewidk = mnb.kereses(cegnev)[:max_jelolt]
    talalatok = []
    for vid in viewidk:
        html = mnb.reszletek(vid)
        if not html:
            continue
        # datum a fajlnevek mellett all a tablazatban
        for m_fajl in re.finditer(
                r'<td>([^<]{5,120}\.zip)</td>\s*<td>[^<]*</td>\s*'
                r'<td><a[^>]*href="[^"]*downloadkozzetetel\?id=(\d+)', html):
            fajlnev, doc_id = m_fajl.groups()
            m_minta = ESEF_FAJLNEV_MINTA.search(fajlnev)
            if not m_minta:
                continue
            lei, datum, nyelv = m_minta.groups()
            talalatok.append({
                "viewid": vid, "doc_id": doc_id, "lei": lei,
                "datum": datum, "nyelv": nyelv, "fajlnev": fajlnev,
            })
        time.sleep(0.25)
    return talalatok


def legjobb_csomagok_kivalasztasa(talalatok):
    """
    Egy datumhoz (fordulonaphoz) tobb csomag is tartozhat (hu es en valtozat).
    A magyar valtozatot reszesitjuk elonyben. Ha tobb kulonbozo LEI kod van
    (pl. veletlenul egy hasonlo nevu masik ceg kevveredett bele), csak a
    leggyakoribb LEI-hez tartozokat tartjuk meg - ez vedelmet ad a
    felreazonositas ellen.
    """
    if not talalatok:
        return []

    lei_gyakorisag = {}
    for t in talalatok:
        lei_gyakorisag[t["lei"]] = lei_gyakorisag.get(t["lei"], 0) + 1
    fo_lei = max(lei_gyakorisag, key=lei_gyakorisag.get)

    datumonkent = {}
    for t in talalatok:
        if t["lei"] != fo_lei:
            continue
        kulcs = t["datum"]
        if kulcs not in datumonkent or t["nyelv"] == "hu":
            datumonkent[kulcs] = t

    return list(datumonkent.values())


def kontextusok_elemzese(xhtml_tartalom):
    """
    Kigyujti az iXBRL 'tiszta' (nem dimenzios/bontott) kontextusait -
    ezek a konszolidalt egesz-vallalati osszegek, nem pl. szegmens- vagy
    komponens-bontasok. A dimenzios adatot a <xbrli:segment> vagy
    <xbrli:scenario> elem jelzi egy kontextuson belul.
    """
    periodus = {}
    for cid, body in re.findall(
            r'<xbrli:context id="([^"]+)"[^>]*>(.*?)</xbrli:context>',
            xhtml_tartalom, re.S):
        if "<xbrli:segment>" in body or "<xbrli:scenario>" in body:
            continue  # dimenzios bontas, nem kell
        instant = re.search(r"<xbrli:instant>([^<]+)</xbrli:instant>", body)
        startend = re.search(
            r"<xbrli:startDate>([^<]+)</xbrli:startDate>.*?"
            r"<xbrli:endDate>([^<]+)</xbrli:endDate>", body, re.S)
        if instant:
            periodus[cid] = {"tipus": "idopont", "datum": instant.group(1)}
        elif startend:
            periodus[cid] = {"tipus": "idoszak",
                              "kezdet": startend.group(1), "veg": startend.group(2)}
    return periodus


def tenyek_kinyerese(xhtml_tartalom, tiszta_periodusok):
    """Kinyeri az osszes IFRS szamszeru tenyt a tiszta kontextusokhoz."""
    eredmeny = {}
    for m in re.finditer(
            r"<ix:nonFraction\b([^>]*)>(.*?)</ix:nonFraction>",
            xhtml_tartalom, re.S):
        attrib_str, ertek_nyers = m.groups()
        attribok = dict(re.findall(r'([\w:-]+)="([^"]*)"', attrib_str))
        fogalom = attribok.get("name", "")
        ctx = attribok.get("contextRef", "")
        if not fogalom.startswith("ifrs-full:") or ctx not in tiszta_periodusok:
            continue
        ertek_txt = re.sub("<[^>]+>", "", ertek_nyers).strip()
        if not ertek_txt or ertek_txt in ("‐", "-", "–", ""):
            continue
        try:
            ertek_szam = float(ertek_txt.replace(".", "").replace(",", "."))
        except ValueError:
            continue
        scale = int(attribok.get("scale", 0) or 0)
        if attribok.get("sign") == "-":
            ertek_szam = -ertek_szam
        ertek_vegleges = ertek_szam * (10 ** scale)

        kulcs = fogalom.replace("ifrs-full:", "")
        p = tiszta_periodusok[ctx]
        if p["tipus"] == "idopont":
            idokulcs = p["datum"]
        else:
            idokulcs = f"{p['kezdet']}..{p['veg']}"

        eredmeny.setdefault(kulcs, {})[idokulcs] = ertek_vegleges
    return eredmeny


def csomag_feldolgozasa(mnb, csomag_info, kod):
    """Letolt egy ESEF ZIP-et, kicsomagolja, kinyeri az adatot, majd torli a nyers fajlokat."""
    zip_utvonal = os.path.join(IDEIGLENES_MAPPA, f"{kod}_{csomag_info['datum']}.zip")
    if not mnb.fajl_letoltese(csomag_info["doc_id"], csomag_info["viewid"], zip_utvonal):
        return None

    try:
        with zipfile.ZipFile(zip_utvonal) as z:
            xhtml_nevek = [n for n in z.namelist() if n.endswith(".xhtml")]
            if not xhtml_nevek:
                return None
            tartalom = z.read(xhtml_nevek[0]).decode("utf-8", "replace")
    except Exception:
        return None
    finally:
        if os.path.exists(zip_utvonal):
            os.remove(zip_utvonal)  # a nyers ZIP-et nem tartjuk meg

    periodusok = kontextusok_elemzese(tartalom)
    return tenyek_kinyerese(tartalom, periodusok)


def main():
    import sys

    os.makedirs(KIMENET_MAPPA, exist_ok=True)
    os.makedirs(IDEIGLENES_MAPPA, exist_ok=True)

    # Opcionalis: python fetch_ixbrl.py KEZDET VEG - csak a resztvenylista
    # (abc sorrendbe rendezett) ezen szeletet dolgozza fel. Hasznos, ha a
    # teljes lista feldolgozasa egy futtatasban tul sokaig tartana.
    kezdet = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    veg = int(sys.argv[2]) if len(sys.argv) > 2 else None

    # A hivatalos cegneveket a mar letoltott penzugyi adatokbol vesszuk -
    # ott mar szerepel a BET altal hasznalt teljes nev.
    cegnevek = {}
    for fajl in os.listdir("data/penzugy"):
        if not fajl.endswith(".json"):
            continue
        with open(f"data/penzugy/{fajl}", encoding="utf-8") as f:
            d = json.load(f)
        cim = (d.get("eves_osszefoglalo") or {}).get("cim") or ""
        m = re.match(r"Összefoglaló éves adatok - (.+)", cim)
        if m:
            cegnevek[d["seccode"]] = m.group(1)

    tetelek = sorted(cegnevek.items())[kezdet:veg]
    print(f"Feldolgozando szelet: {kezdet} - {veg or len(cegnevek)} "
          f"({len(tetelek)} ceg az osszes {len(cegnevek)}-bol)")

    mnb = MnbKapcsolat()
    sikeres = 0
    nincs_adat = []

    for i, (kod, teljes_nev) in enumerate(tetelek, kezdet + 1):
        kereso_nev = cegnev_a_kereseshez(teljes_nev)
        print(f"[{i:2d}/{len(cegnevek)}] {kod:14s} keresve mint: '{kereso_nev}'")

        talalatok = esef_csomagok_keresese(mnb, kereso_nev)
        if not talalatok:
            # Lehet, hogy csak egy pillanatnyi halozati hiba volt - egyszer
            # ujraprobaljuk, mielott feladnank ennel a cegnel.
            time.sleep(2)
            talalatok = esef_csomagok_keresese(mnb, kereso_nev)
        legjobbak = legjobb_csomagok_kivalasztasa(talalatok)

        if not legjobbak:
            print("    -> nincs ESEF/iXBRL csomag (valoszinuleg nem konszolidalt/kis ceg)")
            nincs_adat.append(kod)
            continue

        legjobbak.sort(key=lambda t: t["datum"], reverse=True)
        cegadat = {}
        for csomag in legjobbak[:6]:  # legfeljebb 6 legfrissebb csomag cegenkent
            kinyert = csomag_feldolgozasa(mnb, csomag, kod)
            if kinyert:
                for fogalom, ertekek in kinyert.items():
                    cegadat.setdefault(fogalom, {}).update(ertekek)
            time.sleep(0.5)

        if cegadat:
            fajlnev = kod.replace("/", "_").replace(" ", "_")
            kimenet = {
                "seccode": kod,
                "hivatalos_nev": teljes_nev,
                "lei": legjobbak[0]["lei"],
                "csomagok_szama": len(legjobbak[:6]),
                "fogalmak_szama": len(cegadat),
                "adatok": cegadat,
            }
            with open(f"{KIMENET_MAPPA}/{fajlnev}.json", "w", encoding="utf-8") as f:
                json.dump(kimenet, f, ensure_ascii=False, indent=2)
            print(f"    -> {len(legjobbak[:6])} csomag, {len(cegadat)} IFRS fogalom kinyerve")
            sikeres += 1
        else:
            print("    -> talalt csomagot, de nincs benne cimkezett adat "
                  "(valoszinuleg nem konszolidalt jelentes - ilyenkor az EU "
                  "csak sima XHTML-t ir elo, cimkezes nelkul)")
            nincs_adat.append(kod)

    shutil.rmtree(IDEIGLENES_MAPPA, ignore_errors=True)

    print(f"\nKESZ. {sikeres}/{len(cegnevek)} cegnel talalhato ESEF/iXBRL adat.")
    if nincs_adat:
        print("Nincs ESEF adat (valoszinuleg nem konszolidalt vagy kis ceg):")
        print(" ", ", ".join(nincs_adat))


if __name__ == "__main__":
    main()
