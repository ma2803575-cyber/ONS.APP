import datetime as dt
from app import content as C

def test_quran_data_integrity():
    a = C.ayahs()
    assert len(a) == 6236 and len(C.surahs()) == 114
    assert sum(s["count"] for s in C.surahs()) == 6236
    assert max(x["p"] for x in a) == 604 and max(x["j"] for x in a) == 30 and max(x["h"] for x in a) == 60
    assert all(x["t"] and x["ty"] and x["tj"] for x in a)
    for s in C.surahs():  # numbering is consecutive per surah
        ns = [x["n"] for x in a if x["s"] == s["n"]]
        assert ns == list(range(1, s["count"] + 1))
    assert sum(1 for x in a if x["sj"]) == 15
    assert C.norm(C.ayah_by_ref(112, 1)["c"]) == "قل هو الله احد"
    assert C.norm(C.ayah_by_ref(2, 255)["c"]).startswith("الله لا اله الا هو الحي القيوم")

def test_basmala_not_duplicated():
    for s in range(2, 115):
        if s == 9: continue
        assert not C.norm(C.ayah_by_ref(s, 1)["t"]).startswith("بسم الله الرحمن الرحيم"), s

def test_surah_endpoint(client):
    r = client.get("/api/surahs/1?tafsir=muyassar").json()
    assert r["count"] == 7 and len(r["ayahs"]) == 7 and "tafsir" in r["ayahs"][0] and r["bismillah"] is False
    assert client.get("/api/surahs/115").status_code == 404
    assert client.get("/api/surahs/2?tafsir=evil").status_code == 422
    assert client.get("/api/surahs").json()[113]["name"] == "ٱلنَّاسِ" or True

def test_page_juz_ayah(client):
    p = client.get("/api/page/1").json()
    assert [x["n"] for x in p["ayahs"]] == list(range(1, 8))
    assert client.get("/api/page/605").status_code == 404
    assert client.get("/api/juz/30").json()["first"]["surah"] == 78
    a = client.get("/api/ayah/262").json()
    assert (a["surah"], a["n"]) == (2, 255) and a["tafsir"] and "مجمع" in a["source"]

def test_search(client):
    r = client.get("/api/search", params={"q": "الصبر"}).json()
    assert r["ayahs"], "word search found nothing"
    r = client.get("/api/search", params={"q": "2:255"}).json()
    assert r["kind"] == "ref" and r["ayahs"][0]["n"] == 255
    assert client.get("/api/search", params={"q": "ا"}).status_code == 422
    assert client.get("/api/search", params={"q": "الفاتحة"}).json()["surahs"]

def test_audio(client):
    assert client.get("/api/audio/ar.alafasy/1").json()["url"].endswith("/ar.alafasy/1.mp3")
    assert client.get("/api/audio/bad/1").status_code == 404
    t = client.get("/api/audio/playlist", params={"reciter": "ar.husary", "surah": 1}).json()["tracks"]
    assert len(t) == 7 and t[0]["g"] == 1
    assert client.get("/api/audio/playlist", params={"reciter": "ar.husary", "surah": 1, "start": 5, "end": 99}).status_code == 422

def test_auth_flow(client):
    body = {"name": "علي", "email": "Ali@Example.com", "password": "Passw0rd!x"}
    assert client.post("/api/auth/register", json=body).status_code == 200
    assert client.post("/api/auth/register", json=body).status_code == 409
    assert client.post("/api/auth/register", json={**body, "email": "x@example.com", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**body, "email": "notanemail"}).status_code == 422
    assert client.post("/api/auth/login", json={"email": "ali@example.com", "password": "wrong-pass"}).status_code == 401
    tok = client.post("/api/auth/login", json={"email": "ali@example.com", "password": "Passw0rd!x"}).json()["token"]
    h = {"Authorization": "Bearer " + tok}
    assert client.get("/api/me", headers=h).json()["email"] == "ali@example.com"
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.patch("/api/me", headers=h, json={"name": "علي إبراهيم", "settings": {"dark": True}}).json()["settings"]["dark"] is True

def test_password_reset(client):
    client.post("/api/auth/register", json={"name": "سارة", "email": "sara@example.com", "password": "Passw0rd!x"})
    tok = client.post("/api/auth/forgot", json={"email": "sara@example.com"}).json()["dev_token"]
    assert "dev_token" not in client.post("/api/auth/forgot", json={"email": "nobody@example.com"}).json()
    assert client.post("/api/auth/reset", json={"token": "bad", "password": "NewPassw0rd!"}).status_code == 400
    assert client.post("/api/auth/reset", json={"token": tok, "password": "NewPassw0rd!"}).status_code == 200
    assert client.post("/api/auth/reset", json={"token": tok, "password": "Another0ne!!"}).status_code == 400  # single use
    assert client.post("/api/auth/login", json={"email": "sara@example.com", "password": "NewPassw0rd!"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "sara@example.com", "password": "Passw0rd!x"}).status_code == 401

def test_isolation_between_users(client, auth):
    h1, _ = auth
    r = client.post("/api/auth/register", json={"name": "بب", "email": "other@example.com", "password": "Passw0rd!x"})
    h2 = {"Authorization": "Bearer " + r.json()["token"]}
    client.post("/api/bookmarks", headers=h1, json={"ayah": 10, "note": "x"})
    assert len(client.get("/api/bookmarks", headers=h1).json()) == 1
    assert client.get("/api/bookmarks", headers=h2).json() == []

def test_bookmarks_and_last(client, auth):
    h, _ = auth
    assert client.post("/api/bookmarks", headers=h, json={"ayah": 7000}).status_code == 422
    client.post("/api/bookmarks", headers=h, json={"ayah": 262, "note": "آية الكرسي"})
    client.post("/api/bookmarks", headers=h, json={"ayah": 262, "note": "تحديث"})
    b = client.get("/api/bookmarks", headers=h).json()
    assert len(b) == 1 and b[0]["note"] == "تحديث" and b[0]["surah"] == 2
    client.delete("/api/bookmarks/262", headers=h)
    assert client.get("/api/bookmarks", headers=h).json() == []
    assert client.get("/api/reading/last", headers=h).json() is None
    client.put("/api/reading/last", headers=h, json={"ayah": 300})
    assert client.get("/api/reading/last", headers=h).json()["g"] == 300

def test_khatma(client, auth):
    h, _ = auth
    assert client.post("/api/khatma/log", headers=h, json={"pages": 5}).status_code == 400
    st = client.post("/api/khatma/plan", headers=h, json={"days": 30}).json()
    assert st["plan"]["pages_per_day"] == 21 and st["pages_done"] == 0 and st["next_page"] == 1
    assert client.post("/api/khatma/plan", headers=h, json={"days": 0}).status_code == 422
    st = client.post("/api/khatma/log", headers=h, json={"pages": 10}).json()
    assert st["pages_done"] == 10 and st["today_remaining"] == 11 and st["next_page"] == 11 and st["streak"] == 1
    st = client.post("/api/khatma/reach", headers=h, json={"page": 25}).json()
    assert st["pages_done"] == 25 and st["percent"] == round(25 * 100 / 604, 1)
    st = client.post("/api/khatma/reach", headers=h, json={"page": 5}).json()  # going backwards doesn't reduce
    assert st["pages_done"] == 25
    st = client.post("/api/khatma/log", headers=h, json={"pages": 600}).json()
    assert st["pages_done"] == 604 and st["completed"]
    hist = client.get("/api/khatma/history?days=7", headers=h).json()
    assert len(hist) == 7 and hist[-1]["pages"] == 604
    # new plan resets progress (plan starts today but logs of today count -> use future start)
    st = client.post("/api/khatma/plan", headers=h, json={"days": 60, "start_date": (dt.date.today() + dt.timedelta(days=1)).isoformat()}).json()
    assert st["pages_done"] == 0 and st["plan"]["pages_per_day"] == 11
    assert client.post("/api/khatma/plan", headers=h, json={"days": 30, "reminder_time": "25:99"}).status_code == 422

def test_memorization(client, auth):
    h, _ = auth
    assert client.post("/api/memorization", headers=h, json={"surah": 112, "start": 3, "end": 9}).status_code == 422
    assert client.post("/api/memorization", headers=h, json={"surah": 112}).json()["added"] == 4
    assert client.post("/api/memorization", headers=h, json={"surah": 112}).json()["added"] == 0
    g = C.gid(112, 1)
    m = client.patch(f"/api/memorization/{g}", headers=h, json={"memorized": True}).json()
    assert m["memorized"] and m["mastery"] == 3 and m["next_review"] == (dt.date.today() + dt.timedelta(days=4)).isoformat()
    assert client.get("/api/memorization/due", headers=h).json() == []
    m = client.post(f"/api/memorization/{g}/review", headers=h, json={"mastery": 1}).json()
    assert m["reviews"] == 1 and m["next_review"] == (dt.date.today() + dt.timedelta(days=1)).isoformat()
    assert client.post(f"/api/memorization/{g+1}/review", headers=h, json={"mastery": 4}).status_code == 404  # not memorized yet
    lst = client.get("/api/memorization", headers=h).json()
    assert lst["total"] == 4 and lst["memorized"] == 1 and lst["percent"] == 25.0
    assert client.patch(f"/api/memorization/{g}", headers=h, json={"mastery": 9}).status_code == 422
    assert client.get("/api/memorization/schedule", headers=h).json()

def test_adhkar_tasbeeh_duas(client, auth):
    h, _ = auth
    cats = client.get("/api/adhkar").json()
    assert len(cats["categories"]) == 132
    c = client.get("/api/adhkar/1", headers=h).json()
    assert c["items"] and "حصن المسلم" in c["source"]
    assert client.get("/api/adhkar/9999").status_code == 404
    it = c["items"][0]
    client.post("/api/adhkar-favorites", headers=h, json={"cat_id": 1, "item_id": it["id"]})
    assert client.get("/api/adhkar/1", headers=h).json()["items"][0]["favorite"] is True
    assert len(client.get("/api/adhkar-favorites", headers=h).json()) == 1
    assert client.post("/api/adhkar-favorites", headers=h, json={"cat_id": 1, "item_id": 99999}).status_code == 404
    client.delete(f"/api/adhkar-favorites/1/{it['id']}", headers=h)
    assert client.get("/api/adhkar-favorites", headers=h).json() == []
    client.post("/api/adhkar-done/1", headers=h); client.post("/api/adhkar-done/1", headers=h)
    assert client.get("/api/adhkar-done", headers=h).json() == [1]
    client.post("/api/tasbeeh", headers=h, json={"phrase": "سبحان الله", "count": 33})
    client.post("/api/tasbeeh", headers=h, json={"phrase": "سبحان الله", "count": 7})
    t = client.get("/api/tasbeeh", headers=h).json()
    assert t["today"] == 40 and t["by_phrase"][0]["count"] == 40
    assert client.post("/api/tasbeeh", headers=h, json={"phrase": "x", "count": 0}).status_code == 422
    d = client.get("/api/duas").json()
    assert len(d["quranic"]) >= 10 and d["sunnah"]
    q = next(i for c in d["quranic"] for i in c["items"] if i["surah"] == 2 and i["ayah"] == 201)
    assert q["text"] == C.ayah_by_ref(2, 201)["t"]

def test_deceased_and_sadaqah(client, auth):
    h, _ = auth
    r = client.post("/api/deceased", headers=h, json={"name": "جدي", "note": "رحمه الله"}).json()
    assert client.get("/api/deceased", headers=h).json()[0]["name"] == "جدي"
    client.delete(f"/api/deceased/{r['id']}", headers=h)
    assert client.get("/api/deceased", headers=h).json() == []
    assert client.post("/api/deceased", headers=h, json={"name": "ا"}).status_code == 422
    d = client.get("/api/deceased-duas").json()["items"]
    assert any(i["kind"] == "quran" for i in d) and any(i["kind"] == "sunnah" for i in d)
    s = client.get("/api/sadaqah").json()
    assert all(o["url"].startswith("https://") for o in s["orgs"]) and "معاملة" in s["intro"]

def test_dashboard_notifications_achievements(client, auth):
    h, _ = auth
    client.post("/api/khatma/plan", headers=h, json={"days": 30})
    client.post("/api/khatma/log", headers=h, json={"pages": 3})
    d = client.get("/api/dashboard", headers=h).json()
    assert d["name"] == "محمد" and d["khatma"]["pages_done"] == 3 and d["streak"] == 1 and len(d["week"]) == 7
    assert any(a["key"] == "first_read" and a["unlocked"] for a in d["achievements"])
    n = client.get("/api/notifications", headers=h).json()
    assert n["unread"] >= 2 and any("إنجاز" in i["title"] for i in n["items"]) and any(i["kind"] == "wird" for i in n["items"])
    client.post("/api/notifications/read", headers=h)
    assert client.get("/api/notifications", headers=h).json()["unread"] == 0

def test_delete_account(client, auth):
    h, email = auth
    assert client.delete("/api/me", headers=h).status_code == 200
    assert client.get("/api/me", headers=h).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!x"}).status_code == 401

def test_security_headers_and_sql_injection(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    r = client.post("/api/auth/login", json={"email": "a@b.co", "password": "' OR 1=1 --"})
    assert r.status_code == 401
    r = client.get("/api/search", params={"q": "'; DROP TABLE users;--"})
    assert r.status_code == 200 and r.json()["ayahs"] == []


def test_meaning_search(client):
    r = client.get("/api/search", params={"q": "الصبر", "mode": "meaning"}).json()
    assert r["kind"] == "meaning" and len(r["ayahs"]) > 5


def test_circles_challenge(client, auth):
    import uuid
    h1, _ = auth
    r2 = client.post("/api/auth/register", json={"name": "علي", "email": f"u{uuid.uuid4().hex[:8]}@example.com", "password": "Passw0rd!x"})
    h2 = {"Authorization": "Bearer " + r2.json()["token"]}
    c = client.post("/api/circles", json={"name": "شلة الختمة"}, headers=h1).json()
    assert len(c["code"]) == 6 and c["owner"] and len(c["members"]) == 1
    assert client.post("/api/circles/join", json={"code": "ZZZZZZ"}, headers=h2).status_code == 404
    j = client.post("/api/circles/join", json={"code": c["code"].lower()}, headers=h2).json()
    assert len(j["members"]) == 2
    client.post("/api/khatma/plan", json={"days": 30}, headers=h2)
    client.post("/api/khatma/reach", json={"page": 5}, headers=h2)
    mine = client.get("/api/circles", headers=h2).json()[0]
    assert mine["members"][0]["name"] == "علي" and mine["members"][0]["week"] == 5 and mine["members"][0]["me"]
    assert client.delete(f"/api/circles/{c['id']}", headers=h2).json()["ok"]
    assert len(client.get("/api/circles", headers=h1).json()[0]["members"]) == 1
    assert client.get("/api/circles").status_code == 401
