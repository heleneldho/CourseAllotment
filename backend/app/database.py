import urllib.parse  # 1. Add this import at the top
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import get_env

# 2. Separate your raw password and URL-encode it cleanly
raw_password = "Heleneldho@123"
encoded_password = urllib.parse.quote_plus(raw_password)

# 3. Construct your fallback string using the encoded version
fallback_url = f"postgresql://postgres:{encoded_password}@localhost:5432/course_allocator"

# 4. Pull from the environment variable or fall back to local
DATABASE_URL = get_env("DATABASE_URL", fallback_url)

# 🚀 PRODUCTION FIX: Ensure Render's string format always uses 'postgresql://'
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session in endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()