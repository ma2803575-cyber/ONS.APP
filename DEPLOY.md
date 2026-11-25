# نشر أُنس | Deploying ONS

> Not deployed yet. These steps were prepared, not executed. What was actually tested is listed at the bottom.

## 1) محلياً بدون Docker (SQLite)
`./run.sh` ثم افتح http://localhost:8000

## 2) Docker + PostgreSQL
```
export ONS_SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_hex(32))')
docker compose up --build
```
افتح http://localhost:8000 . البيانات محفوظة في volume اسمه pgdata.

## 3) Render (free tier). See also DEPLOY_AR.md
1. ارفع المشروع على GitHub (repo خاص).
2. Render > New > Blueprint > اختر الـ repo. ملف `render.yaml` يجهّز خدمة الويب وقاعدة Postgres مجانية.
3. `ONS_SECRET_KEY` يتولّد تلقائياً. بعد أول تشغيل افتح الرابط.
- ملاحظة: الخطة المجانية تنام بعد فترة خمول (أول طلب بطيء). قاعدة Render المجانية مؤقتة (تنتهي بعد فترة)، للاستخدام الفعلي اختر خطة مدفوعة أو Neon/Supabase مجاناً وحط الرابط في `DATABASE_URL` بصيغة `postgresql+psycopg2://...`.

## 4) بدائل
- **Fly.io / Railway**: يقرأوا الـ Dockerfile مباشرة. اضبط `ONS_SECRET_KEY` و`DATABASE_URL`، والمنفذ 8000.
- **VPS رخيص (Hetzner/Contabo)**: `docker compose up -d` خلف Caddy أو nginx للـ HTTPS.

## متغيرات البيئة
| الاسم | المعنى |
|---|---|
| ONS_SECRET_KEY | إجباري في الإنتاج، نص عشوائي طويل |
| DATABASE_URL | SQLite افتراضياً، أو `postgresql+psycopg2://user:pass@host/db` |
| ONS_DEV_RESET | اتركه 0 في الإنتاج (لا يوجد SMTP لإرسال إيميل الاستعادة) |
| ONS_CORS | origins مسموحة، فاضي لو الواجهة والـ API على نفس الدومين |

## قبل الإطلاق العام
- لازم HTTPS (كل المنصات أعلاه توفره).
- استعادة كلمة السر بالإيميل تحتاج مزود SMTP (غير مربوط حالياً).
- النسخ الاحتياطي لقاعدة البيانات مسؤوليتك (pg_dump).

## ما تم اختباره فعلاً
- pytest 25/25 على SQLite، و25/25 على PostgreSQL 16.2 حقيقي.
- Vitest 9/9، وe2e بمتصفح Chrome headless على النسخة المبنية.
- **لم يُختبر**: بناء صورة Docker (لا يوجد Docker في بيئة التطوير)، ولا نشر Render فعلي.
