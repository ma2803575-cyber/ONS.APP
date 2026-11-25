"""ONS assistant: a retrieval-only assistant. It never generates religious text: every ayah, tafsir
passage, dhikr or hadith it shows is copied from the verified datasets, with its source attached."""
import re, math
from . import content as C

AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
FATWA = re.compile(r"(حكم|يجوز|هل يجوز|حلال|حرام|فتوي|فتوى|جائز|يحل|يبطل|تبطل|كفاره|كفارة|ما حكم)")
SPECIAL = {"ايه الكرسي": (2, 255), "اخر البقره": (2, 285), "ايه النور": (24, 35), "اخر ايه في البقره": (2, 286)}
HELP = [
    (("ختم", "ختمه"), "من شاشة «ختمة القرآن» اختر 30 أو 60 أو 90 يوماً أو مدة تحددها، وسجّل ما قرأته كل يوم، وسيحسب التطبيق نسبة الإنجاز."),
    (("حفظ", "مراجعه"), "من شاشة «الحفظ والمراجعة» أضف نطاق آيات، علّم ما حفظت، وقيّم إتقانك من 1 إلى 5 فيُجدول لك التطبيق موعد المراجعة القادمة."),
    (("مسبحه", "تسبيح"), "شاشة «المسبحة» فيها عدّاد بالضغط، وزر لإعادة الضبط، ويحفظ التطبيق مجموع تسبيحك اليومي إذا سجّلت الدخول."),
    (("علامه", "مرجعي", "bookmark"), "اضغط على رقم الآية في المصحف لتظهر قائمة فيها «علامة مرجعية»، وتجد علاماتك في شاشة «العلامات» داخل المصحف."),
    (("حساب", "تسجيل", "كلمه المرور"), "يمكنك استخدام القرآن والأذكار والمسبحة والمساعد بدون حساب. الحساب يحفظ تقدّمك (الختمة، الحفظ، العلامات) على الخادم."),
    (("ليلي", "مظلم", "خط", "تكبير"), "من «الإعدادات» تغيّر الوضع الليلي وحجم الخط، ومن المصحف نفسه أيضاً."),
]

def _ayah_item(a, src="muyassar"):
    d = C.ayah_view(a, src)
    d["type"] = "ayah"
    return d

def _sources(*names): return list(dict.fromkeys(names))

def answer(msg: str) -> dict:
    m = msg.translate(AR_DIGITS).strip()
    n = C.norm(m)
    if not n:
        return {"answer": "اكتب سؤالك أو موضوعاً تبحث عنه، مثل: آيات عن الصبر.", "items": [], "sources": []}

    # 1) fatwa / rulings: refuse to issue them
    if FATWA.search(n) and not re.search(r"\d+\s*[:/]\s*\d+", m):
        return {"answer": "لا أُصدر فتاوى ولا أحكاماً شرعية، فهذا يرجع فيه إلى عالم أو جهة إفتاء موثوقة (مثل دار الإفتاء المصرية). "
                          "إن أردت، أبحث لك في المصادر المتاحة داخل التطبيق عن آيات أو أذكار في الموضوع نفسه، بشرط أن تكتب الموضوع دون صيغة السؤال عن الحكم.",
                "items": [], "sources": [], "refused": "fatwa"}

    # 2) explicit ayah reference -> ayah + tafsir
    ref = None
    for k, v in SPECIAL.items():
        if k in n: ref = v; break
    if not ref:
        mm = re.search(r"(\d{1,3})\s*[:/]\s*(\d{1,3})", m)
        if mm: ref = (int(mm.group(1)), int(mm.group(2)))
    if not ref:
        sn = C.surah_by_name(m)
        am = re.search(r"(?:اي[هة]|آي[هة]|رقم)\s*(\d{1,3})", m) or re.search(r"(?:اي[هة])\s*(\d{1,3})", n)
        if sn and am: ref = (sn, int(am.group(1)))
        elif sn and ("تفسير" in n or "اقرا" in n or "اعرض" in n):
            s = C.surahs()[sn - 1]
            return {"answer": f"سورة {s['name']} ({s['type'] == 'Meccan' and 'مكية' or 'مدنية'}) وعدد آياتها {s['count']}. اكتب رقم الآية لأعرض تفسيرها، مثل: تفسير {s['name']} آية 1، أو افتحها من المصحف.",
                    "items": [], "sources": _sources(C.QURAN_SOURCE), "open_surah": sn}
    if ref:
        a = C.ayah_by_ref(*ref)
        if not a:
            return {"answer": "لم أجد هذه الآية، تأكد من رقم السورة والآية.", "items": [], "sources": []}
        return {"answer": f"الآية {a['n']} من سورة {C.surahs()[a['s']-1]['name']} وتفسيرها كما ورد في المصدر:",
                "items": [_ayah_item(a)], "sources": _sources(C.QURAN_SOURCE, C.TAFSIR_SOURCES["muyassar"])}

    # 3) plans
    if re.search(r"(ختم|ختمه|ختمة)", n) or "ورد" in n:
        days = re.search(r"(\d{1,3})\s*(?:يوم|ايام|يوما)", n)
        mins = re.search(r"(\d{1,3})\s*(?:دقيقه|دقايق|دقائق)", n)
        pages = re.search(r"(\d{1,3})\s*(?:صفحه|صفحات|وجه)", n)
        if days:
            d = max(1, min(int(days.group(1)), 1000))
            ppd = math.ceil(604 / d)
            return {"answer": f"لختم القرآن في {d} يوماً تحتاج قراءة نحو {ppd} صفحة يومياً من مصحف المدينة (604 صفحة)، أي ما يقارب {round(ppd / 20, 1)} جزء في اليوم. يمكنك إنشاء الخطة بضغطة واحدة.",
                    "items": [], "sources": [], "action": {"type": "khatma", "days": d, "pages_per_day": ppd}}
        if pages or mins:
            ppd = int(pages.group(1)) if pages else max(1, int(mins.group(1)) // 5)
            d = math.ceil(604 / ppd)
            note = "" if pages else " (قدّرت 5 دقائق للصفحة تقريباً، وهذا تقدير يختلف من قارئ لآخر)"
            return {"answer": f"بقراءة {ppd} صفحات يومياً تختم القرآن في نحو {d} يوماً{note}.",
                    "items": [], "sources": [], "action": {"type": "khatma", "days": d, "pages_per_day": ppd}}
        return {"answer": "اذكر المدة أو الوقت المتاح، مثل: أريد ختمة في 60 يوماً، أو: عندي 20 دقيقة يومياً للورد.", "items": [], "sources": []}
    if ("حفظ" in n or "مراجعه" in n) and (C.surah_by_name(m)):
        sn = C.surah_by_name(m); s = C.surahs()[sn - 1]
        days = re.search(r"(\d{1,3})\s*(?:يوم|ايام|يوما)", n)
        d = int(days.group(1)) if days else None
        if d:
            per = math.ceil(s["count"] / d)
            unit = "يوماً" if d > 10 else "أيام"
            return {"answer": f"لحفظ سورة {s['name']} ({s['count']} آية) في {d} {unit} احفظ نحو {per} آيات يومياً، وراجع ما حفظته في اليوم السابق قبل البدء بالجديد. أضفها إلى قائمة الحفظ لتتابع تقدمك.",
                    "items": [], "sources": [], "action": {"type": "memorize", "surah": sn}}
        return {"answer": f"سورة {s['name']} فيها {s['count']} آية. اذكر عدد الأيام لأحسب لك الورد اليومي، مثل: خطة حفظ سورة {s['name']} في 10 أيام.",
                "items": [], "sources": [], "action": {"type": "memorize", "surah": sn}}

    # 4) app help
    if re.search(r"(كيف|ازاي|طريقه|اين|وين).*(استخدم|اضيف|افتح|اغير|اسجل|احفظ|اعمل)|مساعده|التطبيق", n):
        for keys, txt in HELP:
            if any(k in n for k in keys):
                return {"answer": txt, "items": [], "sources": []}

    # 5) hadith
    if "حديث" in n or "حديث" in n.split():
        toks = [t for t in C.tokens(m) if t != C.stem("حديث")]
        res = [(i, s) for i, s in C.hadith_index().search(toks, 3) if s > 4]
        if res:
            items = [{"type": "hadith", "number": C.nawawi()[i]["n"], "text": C.nawawi()[i]["text"], "book": "الأربعون النووية"} for i, _ in res[:2]]
            return {"answer": "وجدت في الأربعين النووية (وهي المجموعة الوحيدة من الأحاديث المتاحة حالياً في التطبيق):", "items": items,
                    "sources": _sources(C.HADITH_SOURCE), "note": "مكتبة الحديث الكاملة والتخريج التفصيلي غير مدمجة بعد."}
        return {"answer": "لم أجد حديثاً مطابقاً في المصادر المتاحة لي (الأربعون النووية فقط حالياً)، ولن أنقل حديثاً من غير مصدر موثق.", "items": [], "sources": []}

    # 6) adhkar / duas
    if re.search(r"(ذكر|اذكار|دعاء|ادعيه|دعاء)", n):
        toks = [t for t in C.tokens(m) if t not in (C.stem("اذكار"), C.stem("دعاء"), C.stem("ادعيه"), C.stem("ذكر"))]
        res = [(i, s) for i, s in C.adhkar_index().search(toks, 3) if s > 3.5] if toks else []
        if res:
            fl = C.adhkar_flat()
            items = [{"type": "dhikr", "category": fl[i]["category"], "text": fl[i]["text"], "count": fl[i]["count"], "cat_id": fl[i]["cat_id"]} for i, _ in res[:2]]
            return {"answer": "من حصن المسلم:", "items": items, "sources": _sources(C.ADHKAR_SOURCE),
                    "note": "تخريج الأحاديث التفصيلي غير مضمّن في هذه النسخة من البيانات."}

    # 7) topic search in the Quran (+ tafsir al-Muyassar)
    toks = C.tokens(m)
    toks = [t for t in toks if t not in {C.stem(x) for x in ("اية", "ايات", "قران", "القران", "سوره", "عن", "اريد", "ابحث", "اعطني", "اقترح", "موضوع")}]
    if toks:
        idx = C.ayah_index()
        known = [t for t in toks if t in idx.idf]
        if (len(toks) <= 3 and len(known) < len(toks)) or len(known) / len(toks) < 0.6:
            toks = []
        res = idx.search(toks, 8) if toks else []
        top = [(i, s) for i, s in res if s > 5][:5]
        # prefer ayahs whose own text contains a query term
        def cov(i):
            if not toks: return 0
            have = set(C.tokens(C.ayahs()[i]["c"])) | set(C.tokens(C.ayahs()[i]["ty"]))
            return len(set(toks) & have) / len(set(toks))
        own = [(i, s) for i, s in top if set(toks) & set(C.tokens(C.ayahs()[i]["c"])) and cov(i) >= 0.5]
        top = own[:5]
        if top:
            return {"answer": f"هذه آيات ذات صلة بما طلبت (بحث في نص القرآن وفي التفسير الميسر)، وليست حصراً لكل ما ورد في الموضوع:",
                    "items": [_ayah_item(C.ayahs()[i]) for i, _ in top],
                    "sources": _sources(C.QURAN_SOURCE, C.TAFSIR_SOURCES["muyassar"])}
    return {"answer": "لم أجد معلومة موثوقة في المصادر المتاحة لي عن هذا السؤال، ولن أخمّن. جرّب كلمة أو موضوعاً أوضح (مثل الصبر أو الرزق)، أو اسأل أهل العلم.",
            "items": [], "sources": [], "not_found": True}
