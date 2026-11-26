import datetime as dt
from sqlalchemy import (create_engine, Column, Integer, String, Boolean, DateTime, Date, Text, ForeignKey,
                        UniqueConstraint, JSON, Float)
from sqlalchemy.orm import declarative_base, sessionmaker
from . import config

kw = {"connect_args": {"check_same_thread": False}} if config.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(config.DATABASE_URL, **kw)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()
now = lambda: dt.datetime.utcnow()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)

class ResetToken(Base):
    __tablename__ = "reset_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash = Column(String(64), unique=True)
    expires_at = Column(DateTime)
    used = Column(Boolean, default=False)

class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "ayah"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ayah = Column(Integer, nullable=False)  # global ayah number 1..6236
    note = Column(String(300), default="")
    created_at = Column(DateTime, default=now)

class ReadingState(Base):
    __tablename__ = "reading_state"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_ayah = Column(Integer, default=1)
    updated_at = Column(DateTime, default=now)

class KhatmaPlan(Base):
    __tablename__ = "khatma_plans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    days = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    pages_per_day = Column(Integer, nullable=False)
    reminder_time = Column(String(5), default="")  # "HH:MM" or ""
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)

class ReadingLog(Base):
    """One row per day: pages read that day (mushaf pages 1..604)."""
    __tablename__ = "reading_logs"
    __table_args__ = (UniqueConstraint("user_id", "day"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day = Column(Date, nullable=False)
    pages = Column(Integer, default=0)
    last_page = Column(Integer, default=0)

class MemItem(Base):
    __tablename__ = "mem_items"
    __table_args__ = (UniqueConstraint("user_id", "ayah"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ayah = Column(Integer, nullable=False)
    memorized = Column(Boolean, default=False)
    mastery = Column(Integer, default=0)  # 0 not rated, 1..5 self-rating
    reviews = Column(Integer, default=0)
    last_review = Column(Date)
    next_review = Column(Date)

class TasbeehTotal(Base):
    __tablename__ = "tasbeeh_totals"
    __table_args__ = (UniqueConstraint("user_id", "day", "phrase"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day = Column(Date, nullable=False)
    phrase = Column(String(80), nullable=False)
    count = Column(Integer, default=0)

class DhikrFav(Base):
    __tablename__ = "dhikr_favs"
    __table_args__ = (UniqueConstraint("user_id", "cat_id", "item_id"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cat_id = Column(Integer, nullable=False)
    item_id = Column(Integer, nullable=False)

class DhikrDone(Base):
    __tablename__ = "dhikr_done"
    __table_args__ = (UniqueConstraint("user_id", "day", "cat_id"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day = Column(Date, nullable=False)
    cat_id = Column(Integer, nullable=False)

class Deceased(Base):
    __tablename__ = "deceased"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String(120), nullable=False)
    note = Column(String(300), default="")
    created_at = Column(DateTime, default=now)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(200))
    body = Column(String(500), default="")
    kind = Column(String(30), default="info")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)

class Circle(Base):
    """Friends reading challenge: a named group joined by a short code."""
    __tablename__ = "circles"
    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    code = Column(String(12), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=now)

class CircleMember(Base):
    __tablename__ = "circle_members"
    __table_args__ = (UniqueConstraint("circle_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    circle_id = Column(Integer, ForeignKey("circles.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    joined_at = Column(DateTime, default=now)

def init_db():
    Base.metadata.create_all(engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
