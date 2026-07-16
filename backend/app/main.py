from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.config import get_env
from app.database import engine, Base
from .routers import auth, admin, faculty

# Automatically generate database tables in PostgreSQL if they don't exist yet
Base.metadata.create_all(bind=engine)

def ensure_schema_updates():
    inspector = inspect(engine)
    if "courses" not in inspector.get_table_names():
        return

    course_columns = {column["name"] for column in inspector.get_columns("courses")}
    if "credits" not in course_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE courses ADD COLUMN credits FLOAT DEFAULT 0.0"))
    with engine.begin() as connection:
        if "academic_year" not in course_columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN academic_year VARCHAR"))
        if "department" not in course_columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN department VARCHAR"))
        if engine.dialect.name == "postgresql":
            course_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("courses")}
            if "_course_semester_uc" in course_constraints:
                connection.execute(text("ALTER TABLE courses DROP CONSTRAINT IF EXISTS _course_semester_uc"))
            if "_course_context_uc" not in course_constraints:
                connection.execute(text("ALTER TABLE courses ADD CONSTRAINT _course_context_uc UNIQUE (code, semester_name, academic_year, department)"))

    if "allocations" in inspector.get_table_names():
        allocation_columns = {column["name"] for column in inspector.get_columns("allocations")}
        with engine.begin() as connection:
            if "is_manually_edited" not in allocation_columns:
                connection.execute(text("ALTER TABLE allocations ADD COLUMN is_manually_edited BOOLEAN DEFAULT FALSE"))
            if "manual_edit_type" not in allocation_columns:
                connection.execute(text("ALTER TABLE allocations ADD COLUMN manual_edit_type VARCHAR"))
            if "academic_year" not in allocation_columns:
                connection.execute(text("ALTER TABLE allocations ADD COLUMN academic_year VARCHAR"))
            if "department" not in allocation_columns:
                connection.execute(text("ALTER TABLE allocations ADD COLUMN department VARCHAR"))

    if "faculty_capacities" in inspector.get_table_names():
        capacity_columns = {column["name"] for column in inspector.get_columns("faculty_capacities")}
        with engine.begin() as connection:
            if "academic_year" not in capacity_columns:
                connection.execute(text("ALTER TABLE faculty_capacities ADD COLUMN academic_year VARCHAR"))
            if "department" not in capacity_columns:
                connection.execute(text("ALTER TABLE faculty_capacities ADD COLUMN department VARCHAR"))
            if engine.dialect.name == "postgresql":
                capacity_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("faculty_capacities")}
                if "_faculty_capacity_semester_uc" in capacity_constraints:
                    connection.execute(text("ALTER TABLE faculty_capacities DROP CONSTRAINT IF EXISTS _faculty_capacity_semester_uc"))
                if "_faculty_capacity_context_uc" not in capacity_constraints:
                    connection.execute(text("ALTER TABLE faculty_capacities ADD CONSTRAINT _faculty_capacity_context_uc UNIQUE (faculty_email, semester_name, academic_year, department)"))

    if "faculty_roster" in inspector.get_table_names():
        roster_columns = {column["name"] for column in inspector.get_columns("faculty_roster")}
        with engine.begin() as connection:
            if "semester_name" not in roster_columns:
                connection.execute(text("ALTER TABLE faculty_roster ADD COLUMN semester_name VARCHAR DEFAULT 'Semester 1'"))
            if "academic_year" not in roster_columns:
                connection.execute(text("ALTER TABLE faculty_roster ADD COLUMN academic_year VARCHAR"))
            if "department" not in roster_columns:
                connection.execute(text("ALTER TABLE faculty_roster ADD COLUMN department VARCHAR"))
            if engine.dialect.name == "postgresql":
                roster_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("faculty_roster")}
                if "faculty_roster_email_key" in roster_constraints:
                    connection.execute(text("ALTER TABLE faculty_roster DROP CONSTRAINT IF EXISTS faculty_roster_email_key"))
                if "_faculty_roster_context_uc" not in roster_constraints:
                    connection.execute(text("ALTER TABLE faculty_roster ADD CONSTRAINT _faculty_roster_context_uc UNIQUE (email, semester_name, academic_year, department)"))

    if "semester_config" in inspector.get_table_names():
        semester_columns = {column["name"] for column in inspector.get_columns("semester_config")}
        with engine.begin() as connection:
            if "academic_year" not in semester_columns:
                connection.execute(text("ALTER TABLE semester_config ADD COLUMN academic_year VARCHAR"))
            if "department" not in semester_columns:
                connection.execute(text("ALTER TABLE semester_config ADD COLUMN department VARCHAR"))

ensure_schema_updates()

app = FastAPI(title="Course Allocation Portal API")

def parse_allowed_origins():
    # Keep local development working, while allowing the deployed frontend
    # origin to be set without a code change (for production and preview URLs).
    defaults = [
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175",
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:5174", 
        "http://127.0.0.1:5175",
        "https://course-allotment.vercel.app"
    ]
    configured = get_env("ALLOWED_ORIGINS", "")
    extra_origins = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    return list(dict.fromkeys(defaults + extra_origins))

# Configure CORS rules to permit secure frontend network traffic
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach endpoint routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(faculty.router)

@app.get("/")
def root_health_check():
    return {"status": "online", "message": "Course Allocation API is running smoothly."}
