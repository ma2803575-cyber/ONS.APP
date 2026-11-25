"""Download Quran text/tafsir (api.alquran.cloud) and Hisn al-Muslim adhkar (rn0x/Adhkar-json)
and build backend/data/*.json. Run once; the built files are already shipped in the repo."""
import json, re, urllib.request, pathlib
OUT = pathlib.Path(__file__).resolve().parent.parent / "backend" / "data"
OUT.mkdir(parents=True, exist_ok=True)
def get(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)
def edition(e):
    return get(f"https://api.alquran.cloud/v1/quran/{e}")["data"]["surahs"]
uth, clean, muy, jal = (edition(e) for e in ("quran-uthmani", "quran-simple-clean", "ar.muyassar", "ar.jalalayn"))
meta = get("https://api.alquran.cloud/v1/surah")["data"]
BASM = re.compile(r"^\ufeff?بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*")
BASM_C = re.compile(r"^\ufeff?بسم الله الرحمن الرحيم\s*")
surahs, ayahs = [], []
g = 0
for i, m in enumerate(meta):
    s = m["number"]
    surahs.append({"n": s, "name": re.sub(r"^سُورَةُ\s*", "", m["name"]), "en": m["englishName"],
                   "tr": m["englishNameTranslation"], "type": m["revelationType"], "count": m["numberOfAyahs"]})
    for j, a in enumerate(uth[i]["ayahs"]):
        g += 1
        assert a["number"] == g
        t = a["text"].replace("\ufeff", "")
        c = clean[i]["ayahs"][j]["text"].replace("\ufeff", "")
        if s not in (1, 9) and j == 0:
            w = t.split(" ")
            assert re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]", "", w[0]).startswith("بسم") and len(w) > 4, (s, t)
            t = " ".join(w[4:]); c = BASM_C.sub("", c)
        ayahs.append({"g": g, "s": s, "n": a["numberInSurah"], "t": t, "c": c, "j": a["juz"],
                      "p": a["page"], "h": (a["hizbQuarter"] + 3) // 4, "q": a["hizbQuarter"], "sj": bool(a["sajda"]),
                      "ty": muy[i]["ayahs"][j]["text"], "tj": jal[i]["ayahs"][j]["text"]})
assert g == 6236
(OUT / "quran.json").write_text(json.dumps({"surahs": surahs, "ayahs": ayahs}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
ad = get("https://raw.githubusercontent.com/rn0x/Adhkar-json/main/adhkar.json")
cats = [{"id": c["id"], "category": c["category"].strip(), "items": [
    {"id": it["id"], "text": it["text"].strip(), "count": it.get("count", 1)} for it in c["array"]]} for c in ad]
(OUT / "adhkar.json").write_text(json.dumps(cats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("ok", g, len(cats))
# Forty Hadith of an-Nawawi (fawazahmed0/hadith-api, ara-nawawi edition)
nw = get("https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-nawawi.json")["hadiths"]
(OUT / "nawawi.json").write_text(json.dumps([{"n": x["hadithnumber"], "text": x["text"].strip()} for x in nw if x["hadithnumber"] > 0], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
