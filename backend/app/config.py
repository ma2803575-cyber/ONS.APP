import os, pathlib
BASE = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = BASE / "data"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'ons.db'}")
# Hosts (Neon, Render, Heroku-style) hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver name.
for _p in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_p): DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len(_p):]
SECRET_KEY = os.getenv("ONS_SECRET_KEY", "dev-only-change-me-please-0123456789")
TOKEN_DAYS = int(os.getenv("ONS_TOKEN_DAYS", "30"))
# When "1", /auth/forgot returns the reset token in the response (dev only, no SMTP in this build).
DEV_RESET = os.getenv("ONS_DEV_RESET", "0") == "1"
FRONTEND_DIST = pathlib.Path(os.getenv("ONS_FRONTEND_DIST", str(BASE.parent / "frontend" / "dist")))
CORS_ORIGINS = [o for o in os.getenv("ONS_CORS", "http://localhost:5173").split(",") if o]
