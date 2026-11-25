import hashlib, hmac, os, secrets, datetime as dt
import jwt
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from . import config
from .db import get_db, User

ITER = 200_000

def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER)
    return f"pbkdf2${ITER}${salt.hex()}${h.hex()}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except Exception:
        return False

def make_token(user_id: int) -> str:
    exp = dt.datetime.utcnow() + dt.timedelta(days=config.TOKEN_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, config.SECRET_KEY, algorithm="HS256")

def sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def new_reset_token() -> str:
    return secrets.token_urlsafe(32)

def _user_from(authorization, db):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        data = jwt.decode(authorization.split(" ", 1)[1], config.SECRET_KEY, algorithms=["HS256"])
        return db.get(User, int(data["sub"]))
    except Exception:
        return None

def current_user(authorization: str = Header(default=None), db: Session = Depends(get_db)) -> User:
    u = _user_from(authorization, db)
    if not u:
        raise HTTPException(401, "يلزم تسجيل الدخول")
    return u

def optional_user(authorization: str = Header(default=None), db: Session = Depends(get_db)):
    return _user_from(authorization, db)
