"""
Kozos segedeszkozok a BET adatok letoltesehez.
Ezt a fajlt a tobbi szkript hasznalja, onmagaban nem kell futtatni.
"""

import json
import re
import time
import urllib.request
import urllib.error
import urllib.parse
import http.cookiejar

BASE = "https://www.bet.hu"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
REFERER = BASE + "/oldalak/azonnali_piac"


class BetKapcsolat:
    """
    Egy elo kapcsolat a BET-hez. Megjegyzi a sutit es a biztonsagi tokent,
    es ha lejar vagy elromlik, magatol megujitja.
    """

    def __init__(self):
        self.opener = None
        self.token = None
        self._uj_munkamenet()

    def _uj_munkamenet(self):
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))
        self.opener.addheaders = [("User-Agent", UA)]
        html = self.opener.open(REFERER, timeout=30).read().decode("utf-8", "replace")
        talalat = re.search(r'name="_csrf"\s+content="([^"]+)"', html)
        if not talalat:
            raise RuntimeError("Nem talaltam a biztonsagi tokent a BET oldalan.")
        self.token = talalat.group(1)

    def _egy_probalkozas(self, lekerdezesek):
        url = f"{BASE}/dataSourceRegistry/batch?_csrf={self.token}"
        adat = json.dumps(lekerdezesek).encode("utf-8")
        keres = urllib.request.Request(url, data=adat, method="POST")
        keres.add_header("Content-Type", "application/json; charset=utf-8")
        keres.add_header("Referer", REFERER)
        valasz = self.opener.open(keres, timeout=90).read().decode("utf-8", "replace")
        return json.loads(valasz)

    def lekerdez(self, lekerdezesek, probak=5):
        """Lekerdezes ujraprobalkozassal. A BET neha 403-at ad, olyankor uj munkamenet kell."""
        utolso = None
        for proba in range(1, probak + 1):
            try:
                return self._egy_probalkozas(lekerdezesek)
            except (urllib.error.HTTPError, urllib.error.URLError) as hiba:
                utolso = hiba
                time.sleep(1.5 * proba)
                try:
                    self._uj_munkamenet()
                except Exception:
                    pass
        raise RuntimeError(f"Sikertelen lekerdezes {probak} proba utan: {utolso}")

    def oldal(self, utvonal, probak=4):
        """Letolt egy sima HTML oldalt a BET-rol. Az utvonalat a hivo felnek mar
        helyesen kell kodolnia (lasd fetch_penzugy.py: bet_utvonalnev fuggveny) -
        itt nem kodolunk ujra, mert az mar kodolt reszeket (pl. '%20') dupla
        kodolna ('%2520'-ra)."""
        utolso = None
        for proba in range(1, probak + 1):
            try:
                keres = urllib.request.Request(BASE + utvonal)
                keres.add_header("User-Agent", UA)
                return self.opener.open(keres, timeout=60).read().decode("utf-8", "replace")
            except (urllib.error.HTTPError, urllib.error.URLError) as hiba:
                utolso = hiba
                time.sleep(1.5 * proba)
        raise RuntimeError(f"Nem sikerult letolteni: {utvonal} ({utolso})")
