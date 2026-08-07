"""
BET adatletolto - 1. lepes
Letolti a Budapesti Ertektozsde osszes reszvenyenek aktualis adatait,
es elmenti JSON fajlba.
"""

import json
import re
import time
import urllib.request
import http.cookiejar
from datetime import datetime, timezone

BASE = "https://www.bet.hu"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# Ez a "lekerdezes", ami az OSSZES reszvenyt visszaadja
OSSZES_RESZVENY = (
    "PromptTablesDataSource;"
    "instrgrpid=W_RESZVENYA,W_RESZVENYB,W_RESZVENYT;"
    "instridExclude=SME1;filterEmpty=false"
)


def uj_bongeszo():
    """Letrehoz egy 'bongeszot', ami megjegyzi a sutiket."""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", UA)]
    return opener


def belepes(opener):
    """Megnyit egy BET oldalt, es kiszedi belole a biztonsagi tokent."""
    html = opener.open(BASE + "/oldalak/azonnali_piac", timeout=30).read().decode("utf-8", "replace")
    talalat = re.search(r'name="_csrf"\s+content="([^"]+)"', html)
    if not talalat:
        raise RuntimeError("Nem talaltam a biztonsagi tokent a BET oldalan.")
    return talalat.group(1)


def lekerdez(opener, token, lekerdezesek):
    """Elkuldi a lekerdezest a BET adatvegpontjara, es visszaadja a valaszt."""
    url = f"{BASE}/dataSourceRegistry/batch?_csrf={token}"
    adat = json.dumps(lekerdezesek).encode("utf-8")
    keres = urllib.request.Request(url, data=adat, method="POST")
    keres.add_header("Content-Type", "application/json; charset=utf-8")
    keres.add_header("Referer", BASE + "/oldalak/azonnali_piac")
    valasz = opener.open(keres, timeout=60).read().decode("utf-8", "replace")
    return json.loads(valasz)


def lekerdez_ujraprobalva(lekerdezesek, probak=6):
    """
    A BET tobb szerver mogott van, es a biztonsagi token nem mindig
    'talal haza' -> neha 403-at kapunk. Ilyenkor uj munkamenettel ujrapobaljuk.
    """
    utolso_hiba = None
    for proba in range(1, probak + 1):
        try:
            opener = uj_bongeszo()
            token = belepes(opener)
            return lekerdez(opener, token, lekerdezesek)
        except urllib.error.HTTPError as hiba:
            utolso_hiba = hiba
            print(f"  {proba}. proba sikertelen ({hiba.code}), ujraprobalom...")
            time.sleep(2 * proba)
    raise RuntimeError(f"Nem sikerult letolteni {probak} proba utan sem: {utolso_hiba}")


def main():
    valasz = lekerdez_ujraprobalva([OSSZES_RESZVENY])
    sorok = valasz[OSSZES_RESZVENY]["rows"]
    print(f"Letoltve: {len(sorok)} reszveny")

    kimenet = {
        "letoltve": datetime.now(timezone.utc).isoformat(),
        "forras": "bet.hu (15 perccel keslelt adat)",
        "darab": len(sorok),
        "reszvenyek": sorted(sorok, key=lambda r: r["seccode"]),
    }

    with open("data/reszvenyek.json", "w", encoding="utf-8") as f:
        json.dump(kimenet, f, ensure_ascii=False, indent=2)

    print("Mentve ide: data/reszvenyek.json")
    for r in kimenet["reszvenyek"][:5]:
        print(f"  {r['seccode']:14s} {r['lasttradedprice']}")


if __name__ == "__main__":
    main()
