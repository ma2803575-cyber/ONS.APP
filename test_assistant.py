import re
from app.assistant import answer
from app import content as C

def refs(r): return [(i["surah"], i["n"]) for i in r["items"] if i["type"] == "ayah"]

def test_ayah_text_comes_from_data_not_generated():
    for q in ["آيات عن الصبر", "آيات عن الرزق", "تفسير 2:255", "آيات عن الرحمة"]:
        r = answer(q)
        assert r["items"] and r["sources"], q
        for i in r["items"]:
            assert i["text"] == C.ayah_by_ref(i["surah"], i["n"])["t"]
            assert i["tafsir"] == C.ayah_by_ref(i["surah"], i["n"])["ty"]

def test_every_religious_answer_has_sources():
    for q in ["آيات عن الصبر", "أذكار الصباح", "دعاء الكرب", "تفسير آية الكرسي", "حديث عن الأعمال بالنيات"]:
        r = answer(q)
        if r["items"]: assert r["sources"], q

def test_fatwa_refused():
    for q in ["ما حكم الموسيقى؟", "هل يجوز الجمع بين الصلاتين", "هذا حرام؟"]:
        r = answer(q)
        assert r.get("refused") == "fatwa" and not r["items"]

def test_unknown_says_not_found():
    for q in ["ما عاصمة فرنسا", "كيف اطبخ الرز", "سعر الدولار اليوم"]:
        r = answer(q)
        assert r.get("not_found") and not r["items"], q

def test_reference_parsing():
    assert refs(answer("تفسير آية الكرسي")) == [(2, 255)]
    assert refs(answer("تفسير ٢:٢٥٥")) == [(2, 255)]
    assert refs(answer("تفسير سورة الإخلاص آية 2")) == [(112, 2)]
    assert "لم أجد" in answer("تفسير 2:999")["answer"]

def test_plans():
    r = answer("أريد ختمة في 60 يوم")
    assert r["action"] == {"type": "khatma", "days": 60, "pages_per_day": 11}
    r = answer("أريد أقرأ 4 صفحات في اليوم ورد")
    assert r["action"]["pages_per_day"] == 4 and r["action"]["days"] == 151
    r = answer("خطة حفظ سورة الملك في 10 أيام")
    assert r["action"] == {"type": "memorize", "surah": 67} and "3 آيات" in r["answer"]

def test_adhkar_and_hadith_sources():
    r = answer("أذكار الصباح")
    assert r["items"][0]["type"] == "dhikr" and "حصن المسلم" in r["sources"][0]
    r = answer("حديث إنما الأعمال بالنيات")
    assert r["items"] and r["items"][0]["number"] == 1 and "النووية" in r["items"][0]["book"]

def test_endpoint(client):
    r = client.post("/api/assistant", json={"message": "آيات عن الصبر"})
    assert r.status_code == 200 and r.json()["items"]
    assert client.post("/api/assistant", json={"message": ""}).status_code == 422
    assert client.post("/api/assistant", json={"message": "x" * 501}).status_code == 422
