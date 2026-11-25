import datetime as dt, math, time, re
from collections import defaultdict
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from . import config, content as C
from .assistant import answer as assistant_answer
from .db import (init_db, get_db, User, ResetToken, Bookmark, ReadingState, KhatmaPlan, ReadingLog, MemItem,
                 TasbeehTotal, DhikrFav, DhikrDone, Deceased, Notification)
from .security import hash_password, verify_password, make_token, current_user, optional_user, sha, new_reset_token

APP_NAME = "أُنس | ONS"
TAGLINE = "بالقرب من القرآن تحيا القلوب"
app = FastAPI(title="ONS API", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
init_db()
today = lambda: dt.date.today()

# ---------- tiny in-memory rate limiter (per process) ----------
_hits = defaultdict(list)
def limit(key: str, n: int, per: int = 60):
    t = time.time()
    _hits[key] = [x for x in _hits[key] if t - x < per]
    if len(_hits[key]) >= n:
        raise HTTPException(429, "محاولات كثيرة، حاول بعد قليل")
    _hits[key].append(t)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    r = await call_next(request)
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["X-Frame-Options"] = "DENY"
    r.headers["Referrer-Policy"] = "same-origin"
    return r

@app.get("/api/health")
def health(): return {"ok": True, "name": APP_NAME, "ayahs": len(C.ayahs())}

@app.get("/api/meta")
def meta():
    return {"name": APP_NAME, "tagline": TAGLINE, "quran_source": C.QURAN_SOURCE, "tafsir_sources": C.TAFSIR_SOURCES,
            "adhkar_source": C.ADHKAR_SOURCE, "hadith_source": C.HADITH_SOURCE, "reciters": C.RECITERS, "audio_base": C.AUDIO_BASE}

# ================= AUTH =================
PW = Field(min_length=8, max_length=128)
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = PW
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
class ForgotIn(BaseModel):
    email: EmailStr
class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = PW
class ProfileIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    settings: Optional[dict] = None
class ChangePwIn(BaseModel):
    old_password: str = Field(max_length=128)
    new_password: str = PW

def user_out(u: User): return {"id": u.id, "name": u.name, "email": u.email, "settings": u.settings or {}, "created_at": u.created_at.isoformat()}

@app.post("/api/auth/register")
def register(b: RegisterIn, request: Request, db: Session = Depends(get_db)):
    limit("reg:" + (request.client.host if request.client else "?"), 10)
    email = b.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "هذا البريد مسجل من قبل")
    u = User(email=email, name=b.name.strip(), password_hash=hash_password(b.password), settings={})
    db.add(u); db.commit()
    notify(db, u.id, "أهلاً بك في أُنس", "بالقرب من القرآن تحيا القلوب. ابدأ بإنشاء ختمتك أو ورد يومي.", "welcome")
    return {"token": make_token(u.id), "user": user_out(u)}

@app.post("/api/auth/login")
def login(b: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = b.email.lower()
    limit(f"login:{request.client.host if request.client else '?'}:{email}", 8)
    u = db.scalar(select(User).where(User.email == email))
    if not u or not verify_password(b.password, u.password_hash):
        raise HTTPException(401, "البريد أو كلمة المرور غير صحيحة")
    return {"token": make_token(u.id), "user": user_out(u)}

@app.post("/api/auth/forgot")
def forgot(b: ForgotIn, request: Request, db: Session = Depends(get_db)):
    limit("forgot:" + (request.client.host if request.client else "?"), 5)
    u = db.scalar(select(User).where(User.email == b.email.lower()))
    out = {"ok": True, "message": "إن كان البريد مسجلاً فستصلك تعليمات الاستعادة."}
    if u:
        tok = new_reset_token()
        db.add(ResetToken(user_id=u.id, token_hash=sha(tok), expires_at=dt.datetime.utcnow() + dt.timedelta(hours=1)))
        db.commit()
        # No SMTP provider is wired in this build. Dev mode returns the token so the flow is testable.
        if config.DEV_RESET:
            out["dev_token"] = tok
    return out

@app.post("/api/auth/reset")
def reset(b: ResetIn, db: Session = Depends(get_db)):
    rt = db.scalar(select(ResetToken).where(ResetToken.token_hash == sha(b.token)))
    if not rt or rt.used or rt.expires_at < dt.datetime.utcnow():
        raise HTTPException(400, "رابط الاستعادة غير صالح أو منتهي")
    u = db.get(User, rt.user_id)
    u.password_hash = hash_password(b.password); rt.used = True
    db.commit()
    return {"ok": True}

@app.get("/api/me")
def me(u: User = Depends(current_user)): return user_out(u)

@app.patch("/api/me")
def update_me(b: ProfileIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if b.name: u.name = b.name.strip()
    if b.settings is not None:
        if len(str(b.settings)) > 2000: raise HTTPException(422, "الإعدادات كبيرة")
        u.settings = {**(u.settings or {}), **b.settings}
    db.commit(); return user_out(u)

@app.post("/api/me/password")
def change_pw(b: ChangePwIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(b.old_password, u.password_hash): raise HTTPException(400, "كلمة المرور الحالية غير صحيحة")
    u.password_hash = hash_password(b.new_password); db.commit(); return {"ok": True}

@app.delete("/api/me")
def delete_me(u: User = Depends(current_user), db: Session = Depends(get_db)):
    for M in (Bookmark, ReadingLog, KhatmaPlan, MemItem, TasbeehTotal, DhikrFav, DhikrDone, Deceased, Notification, ResetToken):
        db.query(M).filter(M.user_id == u.id).delete()
    db.query(ReadingState).filter(ReadingState.user_id == u.id).delete()
    db.delete(u); db.commit(); return {"ok": True}

# ================= QURAN =================
@app.get("/api/surahs")
def list_surahs():
    st = C.surah_start()
    out = []
    for s in C.surahs():
        a = C.ayahs()[st[s["n"]] - 1]
        out.append({**s, "juz": a["j"], "page": a["p"], "first_g": st[s["n"]]})
    return out

def _tafsir_param(t):
    if t not in (None, "", "none", "muyassar", "jalalayn"): raise HTTPException(422, "تفسير غير معروف")
    return t if t in ("muyassar", "jalalayn") else None

@app.get("/api/surahs/{n}")
def get_surah(n: int, tafsir: Optional[str] = None):
    if not 1 <= n <= 114: raise HTTPException(404, "سورة غير موجودة")
    t = _tafsir_param(tafsir)
    s = C.surahs()[n - 1]; st = C.surah_start()[n]
    items = [C.ayah_view(a, t) for a in C.ayahs()[st - 1: st - 1 + s["count"]]]
    return {**s, "bismillah": n not in (1, 9), "ayahs": items, "sources": {"quran": C.QURAN_SOURCE, **({"tafsir": C.TAFSIR_SOURCES[t]} if t else {})}}

@app.get("/api/page/{p}")
def get_page(p: int):
    if not 1 <= p <= 604: raise HTTPException(404, "صفحة غير موجودة")
    return {"page": p, "ayahs": [C.ayah_view(C.ayahs()[g - 1]) for g in C.pages_index()[p]]}

@app.get("/api/juz/{j}")
def get_juz(j: int):
    if not 1 <= j <= 30: raise HTTPException(404, "جزء غير موجود")
    a = [x for x in C.ayahs() if x["j"] == j]
    return {"juz": j, "first": C.ayah_view(a[0]), "page_start": a[0]["p"], "page_end": a[-1]["p"]}

@app.get("/api/ayah/{g}")
def get_ayah(g: int, tafsir: Optional[str] = "muyassar"):
    if not 1 <= g <= 6236: raise HTTPException(404, "آية غير موجودة")
    t = _tafsir_param(tafsir)
    d = C.ayah_view(C.ayahs()[g - 1], t)
    d["source"] = C.TAFSIR_SOURCES[t] if t else C.QURAN_SOURCE
    return d

@app.get("/api/tafsir/{g}")
def get_tafsir(g: int):
    if not 1 <= g <= 6236: raise HTTPException(404, "آية غير موجودة")
    a = C.ayahs()[g - 1]
    return {"ayah": C.ayah_view(a), "tafsirs": [
        {"id": "muyassar", "name": "التفسير الميسر", "text": a["ty"], "source": C.TAFSIR_SOURCES["muyassar"]},
        {"id": "jalalayn", "name": "تفسير الجلالين", "text": a["tj"], "source": C.TAFSIR_SOURCES["jalalayn"]}]}

@app.get("/api/search")
def search(q: str = Query(min_length=2, max_length=80), limit_: int = Query(30, alias="limit", ge=1, le=100)):
    qs = q.strip()
    res, kind = [], "word"
    m = re.fullmatch(r"\s*(\d{1,3})\s*[:/]\s*(\d{1,3})\s*", qs.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
    surah_hits = [s for s in C.surahs() if C.norm(qs) and C.norm(qs) in C.norm(s["name"])]
    if m:
        a = C.ayah_by_ref(int(m.group(1)), int(m.group(2)))
        res = [C.ayah_view(a)] if a else []; kind = "ref"
    else:
        res = [C.ayah_view(a) for a in C.search_quran(qs, limit_)]
    return {"query": qs, "kind": kind, "surahs": surah_hits[:10], "ayahs": res}

@app.get("/api/reciters")
def reciters(): return {"reciters": C.RECITERS, "base": C.AUDIO_BASE, "pattern": "{base}/{reciter}/{g}.mp3"}

@app.get("/api/audio/{reciter}/{g}")
def audio(reciter: str, g: int):
    if reciter not in {r["id"] for r in C.RECITERS}: raise HTTPException(404, "قارئ غير موجود")
    if not 1 <= g <= 6236: raise HTTPException(404, "آية غير موجودة")
    return {"url": C.audio_url(reciter, g)}

@app.get("/api/audio/playlist")
def playlist(reciter: str, surah: int = Query(ge=1, le=114), start: int = 1, end: Optional[int] = None):
    if reciter not in {r["id"] for r in C.RECITERS}: raise HTTPException(404, "قارئ غير موجود")
    cnt = C.surahs()[surah - 1]["count"]
    end = end or cnt
    if not 1 <= start <= end <= cnt: raise HTTPException(422, "نطاق آيات غير صحيح")
    return {"tracks": [{"g": C.gid(surah, n), "n": n, "url": C.audio_url(reciter, C.gid(surah, n))} for n in range(start, end + 1)]}

# ================= BOOKMARKS & READING STATE =================
class BookmarkIn(BaseModel):
    ayah: int = Field(ge=1, le=6236)
    note: str = Field(default="", max_length=300)

@app.get("/api/bookmarks")
def bookmarks(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Bookmark).where(Bookmark.user_id == u.id).order_by(Bookmark.created_at.desc())).all()
    return [{"id": b.id, "note": b.note, **C.ayah_view(C.ayahs()[b.ayah - 1])} for b in rows]

@app.post("/api/bookmarks")
def add_bookmark(b: BookmarkIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    ex = db.scalar(select(Bookmark).where(Bookmark.user_id == u.id, Bookmark.ayah == b.ayah))
    if ex: ex.note = b.note
    else: db.add(Bookmark(user_id=u.id, ayah=b.ayah, note=b.note))
    db.commit(); return {"ok": True}

@app.delete("/api/bookmarks/{ayah}")
def del_bookmark(ayah: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Bookmark).filter(Bookmark.user_id == u.id, Bookmark.ayah == ayah).delete(); db.commit(); return {"ok": True}

class LastIn(BaseModel):
    ayah: int = Field(ge=1, le=6236)

@app.get("/api/reading/last")
def get_last(u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(ReadingState, u.id)
    return C.ayah_view(C.ayahs()[(r.last_ayah if r else 1) - 1]) if r else None

@app.put("/api/reading/last")
def set_last(b: LastIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(ReadingState, u.id)
    if not r: db.add(ReadingState(user_id=u.id, last_ayah=b.ayah))
    else: r.last_ayah = b.ayah; r.updated_at = dt.datetime.utcnow()
    db.commit(); return {"ok": True}

# ================= KHATMA / WIRD =================
TOTAL_PAGES = 604
class PlanIn(BaseModel):
    days: int = Field(ge=1, le=1000)
    start_date: Optional[dt.date] = None
    reminder_time: str = Field(default="", pattern=r"^$|^([01]\d|2[0-3]):[0-5]\d$")
class LogIn(BaseModel):
    pages: int = Field(ge=1, le=604)
class ReachIn(BaseModel):
    page: int = Field(ge=1, le=604)

def active_plan(db, uid):
    return db.scalar(select(KhatmaPlan).where(KhatmaPlan.user_id == uid, KhatmaPlan.active == True).order_by(KhatmaPlan.id.desc()))

def plan_logs(db, uid, plan):
    return db.scalars(select(ReadingLog).where(ReadingLog.user_id == uid, ReadingLog.day >= plan.start_date).order_by(ReadingLog.day)).all()

def streak(db, uid):
    days = {r.day for r in db.scalars(select(ReadingLog).where(ReadingLog.user_id == uid, ReadingLog.pages > 0)).all()}
    d, n = today(), 0
    if d not in days: d -= dt.timedelta(days=1)
    while d in days: n += 1; d -= dt.timedelta(days=1)
    return n

def khatma_status(db, u):
    p = active_plan(db, u.id)
    if not p: return {"plan": None, "streak": streak(db, u.id)}
    logs = plan_logs(db, u.id, p)
    done = min(TOTAL_PAGES, sum(l.pages for l in logs))
    tday = next((l.pages for l in logs if l.day == today()), 0)
    elapsed = max(0, (today() - p.start_date).days) + 1
    expected = min(TOTAL_PAGES, elapsed * p.pages_per_day)
    nxt = min(TOTAL_PAGES, done + 1)
    first = C.ayahs()[C.pages_index()[nxt][0] - 1]
    return {"plan": {"id": p.id, "days": p.days, "start_date": p.start_date.isoformat(), "pages_per_day": p.pages_per_day, "reminder_time": p.reminder_time,
                     "end_date": (p.start_date + dt.timedelta(days=p.days - 1)).isoformat()},
            "pages_done": done, "percent": round(done * 100 / TOTAL_PAGES, 1), "today_pages": tday, "today_target": p.pages_per_day,
            "today_remaining": max(0, p.pages_per_day - tday), "expected_pages": expected, "behind_by": max(0, expected - done) if elapsed <= p.days else TOTAL_PAGES - done,
            "ahead_by": max(0, done - expected), "completed": done >= TOTAL_PAGES, "next_page": nxt, "next_ayah": C.ayah_view(first),
            "juz_done": done // 20, "streak": streak(db, u.id)}

@app.get("/api/khatma")
def khatma_get(u: User = Depends(current_user), db: Session = Depends(get_db)): return khatma_status(db, u)

@app.post("/api/khatma/plan")
def khatma_plan(b: PlanIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    for p in db.scalars(select(KhatmaPlan).where(KhatmaPlan.user_id == u.id, KhatmaPlan.active == True)).all(): p.active = False
    db.add(KhatmaPlan(user_id=u.id, days=b.days, start_date=b.start_date or today(), pages_per_day=math.ceil(TOTAL_PAGES / b.days), reminder_time=b.reminder_time))
    db.commit()
    notify(db, u.id, "بدأت ختمة جديدة", f"ختمة في {b.days} يوماً، وردك اليومي {math.ceil(TOTAL_PAGES / b.days)} صفحة.", "khatma")
    return khatma_status(db, u)

@app.delete("/api/khatma/plan")
def khatma_stop(u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = active_plan(db, u.id)
    if p: p.active = False; db.commit()
    return {"ok": True}

def add_pages(db, uid, pages):
    r = db.scalar(select(ReadingLog).where(ReadingLog.user_id == uid, ReadingLog.day == today()))
    if not r: r = ReadingLog(user_id=uid, day=today(), pages=0); db.add(r)
    r.pages = (r.pages or 0) + pages; db.commit()

@app.post("/api/khatma/log")
def khatma_log(b: LogIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = active_plan(db, u.id)
    if not p: raise HTTPException(400, "أنشئ خطة ختمة أولاً")
    done = sum(l.pages for l in plan_logs(db, u.id, p))
    add_pages(db, u.id, min(b.pages, max(0, TOTAL_PAGES - done)))
    check_achievements(db, u); return khatma_status(db, u)

@app.post("/api/khatma/reach")
def khatma_reach(b: ReachIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    """'I reached page N': logs the difference to today's reading."""
    p = active_plan(db, u.id)
    if not p: raise HTTPException(400, "أنشئ خطة ختمة أولاً")
    done = sum(l.pages for l in plan_logs(db, u.id, p))
    if b.page > done: add_pages(db, u.id, b.page - done)
    check_achievements(db, u); return khatma_status(db, u)

@app.get("/api/khatma/history")
def khatma_history(days: int = Query(30, ge=1, le=365), u: User = Depends(current_user), db: Session = Depends(get_db)):
    since = today() - dt.timedelta(days=days - 1)
    rows = {r.day: r.pages for r in db.scalars(select(ReadingLog).where(ReadingLog.user_id == u.id, ReadingLog.day >= since)).all()}
    return [{"day": (since + dt.timedelta(days=i)).isoformat(), "pages": rows.get(since + dt.timedelta(days=i), 0)} for i in range(days)]

# ================= MEMORIZATION =================
INTERVALS = {0: 1, 1: 1, 2: 2, 3: 4, 4: 7, 5: 14}
class MemAdd(BaseModel):
    surah: int = Field(ge=1, le=114)
    start: int = Field(default=1, ge=1)
    end: Optional[int] = Field(default=None, ge=1)
class MemUpdate(BaseModel):
    memorized: Optional[bool] = None
    mastery: Optional[int] = Field(default=None, ge=1, le=5)
class MemReview(BaseModel):
    mastery: int = Field(ge=1, le=5)

def mem_out(m: MemItem):
    return {"ayah": m.ayah, "memorized": m.memorized, "mastery": m.mastery, "reviews": m.reviews,
            "last_review": m.last_review.isoformat() if m.last_review else None,
            "next_review": m.next_review.isoformat() if m.next_review else None, **C.ayah_view(C.ayahs()[m.ayah - 1])}

@app.post("/api/memorization")
def mem_add(b: MemAdd, u: User = Depends(current_user), db: Session = Depends(get_db)):
    cnt = C.surahs()[b.surah - 1]["count"]; end = b.end or cnt
    if b.start > end or end > cnt: raise HTTPException(422, "نطاق آيات غير صحيح")
    have = {m.ayah for m in db.scalars(select(MemItem).where(MemItem.user_id == u.id)).all()}
    added = 0
    for n in range(b.start, end + 1):
        g = C.gid(b.surah, n)
        if g not in have: db.add(MemItem(user_id=u.id, ayah=g)); added += 1
    db.commit(); return {"added": added}

@app.get("/api/memorization")
def mem_list(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MemItem).where(MemItem.user_id == u.id).order_by(MemItem.ayah)).all()
    by = defaultdict(list)
    for m in rows: by[C.ayahs()[m.ayah - 1]["s"]].append(m)
    out = []
    for s, items in by.items():
        out.append({"surah": s, "surah_name": C.surahs()[s - 1]["name"], "total": len(items), "memorized": sum(1 for i in items if i.memorized),
                    "ayahs": [mem_out(i) for i in items]})
    total = len(rows); mem = sum(1 for m in rows if m.memorized)
    return {"surahs": out, "total": total, "memorized": mem, "percent": round(mem * 100 / total, 1) if total else 0,
            "due": sum(1 for m in rows if m.memorized and m.next_review and m.next_review <= today())}

@app.patch("/api/memorization/{ayah}")
def mem_patch(ayah: int, b: MemUpdate, u: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.scalar(select(MemItem).where(MemItem.user_id == u.id, MemItem.ayah == ayah))
    if not m: raise HTTPException(404, "الآية ليست في قائمة الحفظ")
    if b.memorized is not None:
        m.memorized = b.memorized
        if b.memorized:
            if not m.mastery: m.mastery = 3
            m.last_review = today(); m.next_review = today() + dt.timedelta(days=INTERVALS[m.mastery])
        else: m.next_review = None
    if b.mastery is not None:
        m.mastery = b.mastery
        if m.memorized: m.next_review = (m.last_review or today()) + dt.timedelta(days=INTERVALS[m.mastery])
    db.commit(); check_achievements(db, u); return mem_out(m)

@app.delete("/api/memorization/{ayah}")
def mem_del(ayah: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(MemItem).filter(MemItem.user_id == u.id, MemItem.ayah == ayah).delete(); db.commit(); return {"ok": True}

@app.get("/api/memorization/due")
def mem_due(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MemItem).where(MemItem.user_id == u.id, MemItem.memorized == True, MemItem.next_review <= today()).order_by(MemItem.next_review, MemItem.ayah)).all()
    return [mem_out(m) for m in rows]

@app.post("/api/memorization/{ayah}/review")
def mem_review(ayah: int, b: MemReview, u: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.scalar(select(MemItem).where(MemItem.user_id == u.id, MemItem.ayah == ayah, MemItem.memorized == True))
    if not m: raise HTTPException(404, "آية محفوظة غير موجودة")
    m.mastery = b.mastery; m.reviews += 1; m.last_review = today(); m.next_review = today() + dt.timedelta(days=INTERVALS[b.mastery])
    db.commit(); return mem_out(m)

@app.get("/api/memorization/schedule")
def mem_schedule(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MemItem).where(MemItem.user_id == u.id, MemItem.memorized == True)).all()
    by = defaultdict(int)
    for m in rows: by[(m.next_review or today()).isoformat()] += 1
    return [{"day": d, "count": c} for d, c in sorted(by.items())]

# ================= ADHKAR / TASBEEH / DUAS =================
@app.get("/api/adhkar")
def adhkar_cats():
    return {"source": C.ADHKAR_SOURCE, "categories": [{"id": c["id"], "category": c["category"], "count": len(c["items"])} for c in C.adhkar()],
            "groups": [{"name": n, "ids": ids} for n, ids in C.OCCASION_GROUPS],
            "featured": [{"key": "morning", "id": 1, "name": "أذكار الصباح والمساء"}, {"key": "sleep", "id": 2, "name": "أذكار النوم"},
                         {"key": "wake", "id": 3, "name": "أذكار الاستيقاظ"}, {"key": "after_prayer", "id": 27, "name": "الأذكار بعد السلام من الصلاة"}]}

@app.get("/api/adhkar/{cid}")
def adhkar_cat(cid: int, u: Optional[User] = Depends(optional_user), db: Session = Depends(get_db)):
    c = next((x for x in C.adhkar() if x["id"] == cid), None)
    if not c: raise HTTPException(404, "قسم غير موجود")
    favs = set()
    if u:
        favs = {f.item_id for f in db.scalars(select(DhikrFav).where(DhikrFav.user_id == u.id, DhikrFav.cat_id == cid)).all()}
    return {"id": c["id"], "category": c["category"], "source": C.ADHKAR_SOURCE,
            "note": "التخريج التفصيلي للأحاديث غير مضمّن في هذه البيانات؛ المرجع: كتاب حصن المسلم.",
            "items": [{**i, "favorite": i["id"] in favs} for i in c["items"]]}

class FavIn(BaseModel):
    cat_id: int
    item_id: int

def _find_item(cat_id, item_id):
    c = next((x for x in C.adhkar() if x["id"] == cat_id), None)
    return c and next((i for i in c["items"] if i["id"] == item_id), None)

@app.get("/api/adhkar-favorites")
def favs_list(u: User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for f in db.scalars(select(DhikrFav).where(DhikrFav.user_id == u.id)).all():
        it = _find_item(f.cat_id, f.item_id)
        c = next((x for x in C.adhkar() if x["id"] == f.cat_id), None)
        if it: out.append({**it, "cat_id": f.cat_id, "category": c["category"], "favorite": True})
    return out

@app.post("/api/adhkar-favorites")
def fav_add(b: FavIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not _find_item(b.cat_id, b.item_id): raise HTTPException(404, "ذكر غير موجود")
    if not db.scalar(select(DhikrFav).where(DhikrFav.user_id == u.id, DhikrFav.cat_id == b.cat_id, DhikrFav.item_id == b.item_id)):
        db.add(DhikrFav(user_id=u.id, cat_id=b.cat_id, item_id=b.item_id)); db.commit()
    return {"ok": True}

@app.delete("/api/adhkar-favorites/{cat_id}/{item_id}")
def fav_del(cat_id: int, item_id: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(DhikrFav).filter(DhikrFav.user_id == u.id, DhikrFav.cat_id == cat_id, DhikrFav.item_id == item_id).delete(); db.commit(); return {"ok": True}

@app.post("/api/adhkar-done/{cat_id}")
def dhikr_done(cat_id: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not any(x["id"] == cat_id for x in C.adhkar()): raise HTTPException(404, "قسم غير موجود")
    if not db.scalar(select(DhikrDone).where(DhikrDone.user_id == u.id, DhikrDone.day == today(), DhikrDone.cat_id == cat_id)):
        db.add(DhikrDone(user_id=u.id, day=today(), cat_id=cat_id)); db.commit()
    return {"ok": True}

@app.get("/api/adhkar-done")
def dhikr_done_today(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [d.cat_id for d in db.scalars(select(DhikrDone).where(DhikrDone.user_id == u.id, DhikrDone.day == today())).all()]

class TasbeehIn(BaseModel):
    phrase: str = Field(min_length=1, max_length=80)
    count: int = Field(ge=1, le=100000)

@app.post("/api/tasbeeh")
def tasbeeh_add(b: TasbeehIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.scalar(select(TasbeehTotal).where(TasbeehTotal.user_id == u.id, TasbeehTotal.day == today(), TasbeehTotal.phrase == b.phrase))
    if not r: r = TasbeehTotal(user_id=u.id, day=today(), phrase=b.phrase, count=0); db.add(r)
    r.count += b.count; db.commit(); check_achievements(db, u); return {"ok": True, "today": r.count}

@app.get("/api/tasbeeh")
def tasbeeh_stats(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(TasbeehTotal).where(TasbeehTotal.user_id == u.id)).all()
    return {"today": sum(r.count for r in rows if r.day == today()), "total": sum(r.count for r in rows),
            "by_phrase": [{"phrase": k, "count": v} for k, v in sorted(_sum_by(rows).items(), key=lambda x: -x[1])]}
def _sum_by(rows):
    d = defaultdict(int)
    for r in rows: d[r.phrase] += r.count
    return d

@app.get("/api/duas")
def duas():
    quranic = []
    for cat, refs in C.QURAN_DUAS:
        items = []
        for s, n in refs:
            a = C.ayah_by_ref(s, n)
            items.append({"ref": f"{C.surahs()[s-1]['name']} : {n}", "surah": s, "ayah": n, "g": a["g"], "text": a["t"]})
        quranic.append({"category": cat, "items": items})
    sunnah = []
    for name, ids in C.OCCASION_GROUPS:
        its = []
        for cid in ids:
            c = next((x for x in C.adhkar() if x["id"] == cid), None)
            if c:
                for i in c["items"]: its.append({"cat_id": cid, "item_id": i["id"], "title": c["category"], "text": i["text"], "count": i["count"]})
        sunnah.append({"category": name, "items": its})
    return {"quranic": quranic, "sunnah": sunnah, "sources": {"quran": C.QURAN_SOURCE, "sunnah": C.ADHKAR_SOURCE}}

# ================= DECEASED & SADAQAH =================
class DeceasedIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=300)

@app.get("/api/deceased")
def deceased_list(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": d.id, "name": d.name, "note": d.note} for d in db.scalars(select(Deceased).where(Deceased.user_id == u.id).order_by(Deceased.id)).all()]

@app.post("/api/deceased")
def deceased_add(b: DeceasedIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    d = Deceased(user_id=u.id, name=b.name.strip(), note=b.note.strip()); db.add(d); db.commit(); return {"id": d.id, "name": d.name, "note": d.note}

@app.delete("/api/deceased/{did}")
def deceased_del(did: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Deceased).filter(Deceased.user_id == u.id, Deceased.id == did).delete(); db.commit(); return {"ok": True}

@app.get("/api/deceased-duas")
def deceased_duas():
    items = []
    for s, n in [(59, 10), (14, 41), (71, 28)]:
        a = C.ayah_by_ref(s, n)
        items.append({"kind": "quran", "ref": f"{C.surahs()[s-1]['name']} : {n}", "text": a["t"], "source": C.QURAN_SOURCE})
    for cid in C.DECEASED_CATS:
        c = next(x for x in C.adhkar() if x["id"] == cid)
        for i in c["items"]:
            if cid in (55, 56, 58, 59, 60, 57, 54):
                items.append({"kind": "sunnah", "title": c["category"], "text": i["text"], "source": C.ADHKAR_SOURCE})
    return {"items": items}

SADAQAH = {
    "intro": "الصدقة الجارية هي ما يستمر نفعه وأجره بعد موت صاحبه، ومن صورها: سقيا الماء، وبناء المساجد والمدارس، وكفالة طالب علم، ونشر علم نافع، وغرس الشجر. "
             "أُنس لا يجري أي معاملة مالية، وهذه روابط للمواقع الرسمية لجهات معروفة لتتبرع من خلالها مباشرة بعد تأكدك بنفسك.",
    "orgs": [
        {"name": "بنك الطعام المصري", "url": "https://egyptianfoodbank.com/", "about": "منظمة أهلية مصرية لمكافحة الجوع"},
        {"name": "جمعية رسالة", "url": "https://resala.org/", "about": "جمعية أهلية مصرية للعمل الخيري والتطوعي"},
        {"name": "الإغاثة الإسلامية حول العالم", "url": "https://www.islamic-relief.org/", "about": "منظمة إغاثة وتنمية دولية"},
    ],
    "note": "تحقق دائماً من الموقع الرسمي ومن طرق الدفع قبل التبرع، ولا تعطِ بيانات بطاقتك لأي جهة غير موثوقة. أُنس لا يملك أي علاقة مالية مع هذه الجهات.",
}
@app.get("/api/sadaqah")
def sadaqah(): return SADAQAH

# ================= NOTIFICATIONS / ACHIEVEMENTS / DASHBOARD =================
def notify(db, uid, title, body="", kind="info", dedupe=False):
    if dedupe and db.scalar(select(Notification).where(Notification.user_id == uid, Notification.title == title)): return
    db.add(Notification(user_id=uid, title=title, body=body, kind=kind)); db.commit()

def achievements(db, u):
    pages = db.scalar(select(func.coalesce(func.sum(ReadingLog.pages), 0)).where(ReadingLog.user_id == u.id)) or 0
    st = streak(db, u.id)
    tas = db.scalar(select(func.coalesce(func.sum(TasbeehTotal.count), 0)).where(TasbeehTotal.user_id == u.id)) or 0
    mem = db.scalar(select(func.count()).select_from(MemItem).where(MemItem.user_id == u.id, MemItem.memorized == True)) or 0
    ks = [("first_read", "أول قراءة", "سجّلت أول ورد لك", pages >= 1), ("pages_100", "100 صفحة", "قرأت 100 صفحة", pages >= 100),
          ("streak_7", "أسبوع متواصل", "7 أيام متتالية من القراءة", st >= 7), ("streak_30", "شهر متواصل", "30 يوماً متتالية", st >= 30),
          ("khatma", "ختمة كاملة", "أتممت 604 صفحة", pages >= 604), ("tasbeeh_1000", "ألف تسبيحة", "سبّحت 1000 مرة", tas >= 1000),
          ("mem_10", "عشر آيات محفوظة", "حفظت 10 آيات", mem >= 10)]
    return [{"key": k, "title": t, "desc": d, "unlocked": bool(ok)} for k, t, d, ok in ks]

def check_achievements(db, u):
    for a in achievements(db, u):
        if a["unlocked"]: notify(db, u.id, f"إنجاز جديد: {a['title']}", a["desc"], "achievement", dedupe=True)

@app.get("/api/notifications")
def notifications(u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = active_plan(db, u.id)
    if p:
        st = khatma_status(db, u)
        if st["today_remaining"] > 0 and not st["completed"]:
            notify(db, u.id, f"ورد اليوم {today().isoformat()}", f"بقي {st['today_remaining']} صفحة من وردك اليوم.", "wird", dedupe=True)
    due = db.scalar(select(func.count()).select_from(MemItem).where(MemItem.user_id == u.id, MemItem.memorized == True, MemItem.next_review <= today())) or 0
    if due: notify(db, u.id, f"مراجعة الحفظ {today().isoformat()}", f"عندك {due} آية تحتاج مراجعة اليوم.", "review", dedupe=True)
    rows = db.scalars(select(Notification).where(Notification.user_id == u.id).order_by(Notification.id.desc()).limit(50)).all()
    return {"unread": sum(1 for r in rows if not r.read), "items": [{"id": r.id, "title": r.title, "body": r.body, "kind": r.kind, "read": r.read, "created_at": r.created_at.isoformat()} for r in rows]}

@app.post("/api/notifications/read")
def notifications_read(u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == u.id).update({"read": True}); db.commit(); return {"ok": True}

@app.get("/api/dashboard")
def dashboard(u: User = Depends(current_user), db: Session = Depends(get_db)):
    last = db.get(ReadingState, u.id)
    done_cats = {d.cat_id for d in db.scalars(select(DhikrDone).where(DhikrDone.user_id == u.id, DhikrDone.day == today())).all()}
    mem = db.scalars(select(MemItem).where(MemItem.user_id == u.id)).all()
    week = [{"day": (today() - dt.timedelta(days=6 - i)).isoformat()} for i in range(7)]
    logs = {r.day.isoformat(): r.pages for r in db.scalars(select(ReadingLog).where(ReadingLog.user_id == u.id, ReadingLog.day >= today() - dt.timedelta(days=6))).all()}
    for w in week: w["pages"] = logs.get(w["day"], 0)
    tas = db.scalar(select(func.coalesce(func.sum(TasbeehTotal.count), 0)).where(TasbeehTotal.user_id == u.id, TasbeehTotal.day == today())) or 0
    total_pages = db.scalar(select(func.coalesce(func.sum(ReadingLog.pages), 0)).where(ReadingLog.user_id == u.id)) or 0
    return {"name": u.name, "today": today().isoformat(), "khatma": khatma_status(db, u),
            "last_read": C.ayah_view(C.ayahs()[last.last_ayah - 1]) if last else None,
            "adhkar": {"morning_done": 1 in done_cats, "sleep_done": 2 in done_cats, "after_prayer_done": 27 in done_cats},
            "memorization": {"total": len(mem), "memorized": sum(1 for m in mem if m.memorized), "due": sum(1 for m in mem if m.memorized and m.next_review and m.next_review <= today())},
            "tasbeeh_today": tas, "week": week, "total_pages": total_pages, "streak": streak(db, u.id), "achievements": achievements(db, u)}

# ================= ASSISTANT =================
class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)

@app.post("/api/assistant")
def ask(b: AskIn, request: Request):
    limit("ask:" + (request.client.host if request.client else "?"), 40)
    return assistant_answer(b.message)

# ================= FRONTEND (built SPA) =================
if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")
    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"): raise HTTPException(404)
        f = (config.FRONTEND_DIST / path).resolve()
        if path and f.is_file() and config.FRONTEND_DIST.resolve() in f.parents:
            # the service worker file must never be served stale, or installed apps would not update
            return FileResponse(f, headers={"Cache-Control": "no-cache"} if path == "sw.js" else None)
        return FileResponse(config.FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})
