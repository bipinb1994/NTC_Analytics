from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite for POC — change this URL to PostgreSQL later if needed:
# "postgresql://user:password@localhost:5432/ntc_analytics"
SQLALCHEMY_DATABASE_URL = "sqlite:///./ntc_analytics.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite-specific
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
