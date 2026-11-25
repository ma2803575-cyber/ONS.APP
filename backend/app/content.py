"""Loads the verified Quran / tafsir / adhkar / hadith data and builds search indexes."""
import json, re, math, functools
from collections import Counter, defaultdict
from . import config

_DIAC = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
def norm(s: str) -> str:
    s = _DIAC.sub("", s)
    s = re.sub("[إأآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\u0621-\u064A0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

_PRE = ("وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ل", "ف")
_SUF = ("ات", "ون", "ين", "ها", "هم", "ه", "ي", "ا")
def stem(w: str) -> str:
    for p in _PRE:
        if w.startswith(p) and len(w) - len(p) >= 3:
            w = w[len(p):]; break
    for s in _SUF:
        if w.endswith(s) and len(w) - len(s) >= 3:
            w = w[: -len(s)]; break
    return w

STOP = set(norm(x) for x in "في من على الى عن ما ان لا هل هي هو يا كل اي ثم او قد لم لن اذا هذا هذه ذلك التي الذي الذين و بين مع كان كانت يكون انه انها لهم لكم لكن اللهم".split())
def tokens(s: str):
    return [stem(w) for w in norm(s).split() if w not in STOP and len(w) > 1]

@functools.lru_cache(1)
def quran():
    d = json.loads((config.DATA_DIR / "quran.json").read_text(encoding="utf-8"))
    return d

@functools.lru_cache(1)
def adhkar():
    return json.loads((config.DATA_DIR / "adhkar.json").read_text(encoding="utf-8"))

@functools.lru_cache(1)
def nawawi():
    return json.loads((config.DATA_DIR / "nawawi.json").read_text(encoding="utf-8"))

def surahs(): return quran()["surahs"]
def ayahs(): return quran()["ayahs"]

@functools.lru_cache(1)
def surah_start():
    st, g = {}, 1
    for s in surahs():
        st[s["n"]] = g; g += s["count"]
    return st

def gid(surah: int, ayah: int) -> int:
    return surah_start()[surah] + ayah - 1

def ayah_by_ref(surah: int, ayah: int):
    if surah not in surah_start() or ayah < 1 or ayah > surahs()[surah - 1]["count"]:
        return None
    return ayahs()[gid(surah, ayah) - 1]

@functools.lru_cache(1)
def pages_index():
    pg = defaultdict(list)
    for a in ayahs(): pg[a["p"]].append(a["g"])
    return pg

# ---- BM25 -------------------------------------------------------------
class BM25:
    def __init__(self, docs):
        self.docs = [Counter(d) for d in docs]
        self.len = [len(d) for d in docs]
        self.avg = sum(self.len) / max(1, len(docs))
        df = Counter()
        for d in self.docs: df.update(d.keys())
        N = len(docs)
        self.idf = {t: math.log(1 + (N - n + .5) / (n + .5)) for t, n in df.items()}
        self.inv = defaultdict(list)
        for i, d in enumerate(self.docs):
            for t in d: self.inv[t].append(i)
    def search(self, q, k=10, k1=1.4, b=.75):
        sc = defaultdict(float)
        for t in set(q):
            if t not in self.idf: continue
            for i in self.inv[t]:
                f = self.docs[i][t]
                sc[i] += self.idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * self.len[i] / self.avg))
        return sorted(sc.items(), key=lambda x: -x[1])[:k]

@functools.lru_cache(1)
def ayah_index():  # ayah text (weighted x2) + Tafsir al-Muyassar
    docs = [tokens(a["c"]) * 2 + tokens(a["ty"]) for a in ayahs()]
    return BM25(docs)

@functools.lru_cache(1)
def adhkar_flat():
    out = []
    for c in adhkar():
        for it in c["items"]:
            out.append({"cat_id": c["id"], "category": c["category"], "item_id": it["id"], "text": it["text"], "count": it["count"]})
    return out

@functools.lru_cache(1)
def adhkar_index():
    return BM25([tokens(x["category"]) * 3 + tokens(x["text"]) for x in adhkar_flat()])

@functools.lru_cache(1)
def hadith_index():
    return BM25([tokens(h["text"]) for h in nawawi()])

def search_quran(q: str, limit=30):
    """Word search over simple-clean text (exact words, no tafsir) for the reader's search box."""
    nq = norm(q)
    words = nq.split()
    if not words: return []
    out = []
    for a in ayahs():
        c = norm(a["c"])
        if nq in c or all(w in c for w in words):
            out.append(a)
            if len(out) >= limit: break
    return out

def ayah_view(a, tafsir=None):
    s = surahs()[a["s"] - 1]
    d = {"g": a["g"], "surah": a["s"], "surah_name": s["name"], "n": a["n"], "text": a["t"], "juz": a["j"],
         "hizb": a["h"], "page": a["p"], "sajda": a["sj"]}
    if tafsir == "muyassar": d["tafsir"] = a["ty"]
    if tafsir == "jalalayn": d["tafsir"] = a["tj"]
    return d

TAFSIR_SOURCES = {
    "muyassar": "التفسير الميسر – مجمع الملك فهد لطباعة المصحف الشريف (عبر api.alquran.cloud، الإصدار ar.muyassar)",
    "jalalayn": "تفسير الجلالين – جلال الدين المحلي وجلال الدين السيوطي (عبر api.alquran.cloud، الإصدار ar.jalalayn)",
}
QURAN_SOURCE = "نص المصحف: الرسم العثماني (quran-uthmani) من api.alquran.cloud / مشروع Tanzil"
ADHKAR_SOURCE = "حصن المسلم – سعيد بن علي بن وهف القحطاني (بيانات rn0x/Adhkar-json على GitHub)"
HADITH_SOURCE = "الأربعون النووية للإمام النووي (بيانات fawazahmed0/hadith-api)"

RECITERS = [
    {"id": "ar.alafasy", "name": "مشاري راشد العفاسي"},
    {"id": "ar.husary", "name": "محمود خليل الحصري"},
    {"id": "ar.minshawi", "name": "محمد صديق المنشاوي"},
    {"id": "ar.mahermuaiqly", "name": "ماهر المعيقلي"},
    {"id": "ar.hudhaify", "name": "علي الحذيفي"},
    {"id": "ar.muhammadayyoub", "name": "محمد أيوب"},
]
AUDIO_BASE = "https://cdn.islamic.network/quran/audio/128"
def audio_url(reciter: str, g: int) -> str:
    return f"{AUDIO_BASE}/{reciter}/{g}.mp3"

# Quranic duas: references only; text is read from the verified Quran data (nothing typed by hand).
QURAN_DUAS = [
    ("الدنيا والآخرة", [(2, 201)]), ("الثبات والنصر", [(2, 250), (3, 147)]), ("خاتمة البقرة: التيسير والعفو", [(2, 286)]),
    ("ثبات القلب", [(3, 8)]), ("التوبة والمغفرة", [(7, 23), (23, 118)]), ("الوالدان", [(14, 41), (17, 24), (71, 28)]),
    ("الذرية والأهل", [(25, 74), (3, 38), (14, 40)]), ("شرح الصدر وتيسير الأمر", [(20, 25), (20, 26), (20, 27), (20, 28)]),
    ("الكرب والهم", [(21, 87)]), ("المرض", [(21, 83)]), ("الرزق والحاجة", [(28, 24)]),
    ("زيادة العلم", [(20, 114)]), ("الدعاء للمؤمنين السابقين (الأموات)", [(59, 10)]),
    ("حسن الخاتمة", [(12, 101), (3, 193)]), ("الشكر", [(27, 19), (46, 15)]),
]
OCCASION_GROUPS = [
    ("الكرب والهم والحزن", [34, 35, 46, 53, 106, 126]), ("الاستغفار والتوبة", [129, 44, 40, 45]),
    ("المرض", [49, 50, 51, 124, 125]), ("السفر", list(range(95, 106))), ("الطعام والصيام", list(range(68, 77))),
    ("النوم والاستيقاظ", [2, 3, 29, 30, 31]), ("المنزل والمسجد", [6, 7, 8, 9, 10, 11, 12]),
    ("الطقس", list(range(61, 67))), ("الزواج والأولاد", [47, 48, 79, 80, 81]),
    ("الميت والمقابر", [52, 54, 55, 56, 57, 58, 59, 60]), ("الاستخارة وتيسير الأمور", [28, 43, 41]),
]
DECEASED_CATS = [52, 54, 55, 56, 57, 58, 59, 60]

def surah_by_name(text: str):
    """Match a surah by (normalized) name inside free text. Returns surah number or None."""
    nt = " " + norm(text) + " "
    best = None
    for s in surahs():
        n = norm(s["name"])
        n = re.sub(r"^ال", "", n)
        if len(n) >= 3 and re.search(r"(^|\s)(ال)?" + re.escape(n) + r"(\s|$)", nt):
            if not best or len(n) > best[1]: best = (s["n"], len(n))
    return best[0] if best else None
