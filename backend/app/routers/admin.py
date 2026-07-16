from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd
import io
from ..database import get_db
from ..models import Course, User, FacultyRoster, FacultyCapacity, Allocation, Preference, SemesterConfig
from ..core_algorithm import run_allocation_logic

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

class SemesterToggleRequest(BaseModel):
    new_semester_name: str

class ReportContextRequest(BaseModel):
    academic_year: str | None = None
    department: str | None = None

class FacultyCapacityItem(BaseModel):
    faculty_email: str
    capacity: int

class FacultyCapacityUpdate(BaseModel):
    capacities: list[FacultyCapacityItem]


class AllocationEditRequest(BaseModel):
    faculty_id: int | None = None
    faculty_name: str | None = None
    allocation_id: int | None = None
    course_id: int | None = None
    current_faculty_id: int | None = None
    current_faculty_name: str | None = None


def get_active_semester_name(db: Session):
    config = db.query(SemesterConfig).first()
    return config.active_semester if config else "Semester 1"


def get_active_context(db: Session):
    config = get_or_create_semester_config(db)
    return config.active_semester, config.academic_year, config.department


def apply_context_filter(query, model, semester_name, academic_year, department):
    return query.filter(
        model.semester_name == semester_name,
        model.academic_year == academic_year,
        model.department == department,
    )


def roster_for_context(db: Session, semester_name: str, academic_year: str | None, department: str | None):
    return db.query(FacultyRoster).filter(
        FacultyRoster.semester_name == semester_name,
        FacultyRoster.academic_year == academic_year,
        FacultyRoster.department == department,
    )


def get_or_create_semester_config(db: Session):
    config = db.query(SemesterConfig).first()
    if not config:
        config = SemesterConfig(active_semester="Semester 1")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def excel_response(df: pd.DataFrame, filename: str):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    output.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


def sync_faculty_history_from_published_allocations(db: Session):
    """Rebuild cumulative faculty history from published allocation records."""
    faculty_users = db.query(User).filter(User.role == "faculty").all()
    totals = {user.id: {"dissatisfaction": 0.0, "courses": 0} for user in faculty_users}

    published_allocations = db.query(Allocation).filter(
        Allocation.is_published == True
    ).all()

    for allocation in published_allocations:
        if allocation.faculty_id not in totals:
            continue
        totals[allocation.faculty_id]["dissatisfaction"] += float(allocation.dissatisfaction_score or 0.0)
        totals[allocation.faculty_id]["courses"] += 1

    for user in faculty_users:
        user.total_historical_dissatisfaction = totals[user.id]["dissatisfaction"]
        user.total_courses_taught_previously = totals[user.id]["courses"]


def calculate_allocation_cost(db: Session, faculty_id: int, course_id: int):
    """Return forced status and dissatisfaction cost for one faculty-course pair."""
    preference = db.query(Preference).filter(
        Preference.faculty_id == faculty_id,
        Preference.course_id == course_id,
    ).first()

    if preference and preference.preference_value in [1, 2, 3, 4, 5]:
        return False, float(preference.preference_value - 1)
    return True, 10.0


def normalize_faculty_name(value):
    return " ".join(str(value or "").split()).casefold()


def normalize_email(value):
    return str(value or "").strip().casefold()


def refresh_allocation_cost(db: Session, allocation: Allocation):
    is_forced, score = calculate_allocation_cost(
        db,
        allocation.faculty_id,
        allocation.course_id,
    )
    allocation.is_forced = is_forced
    allocation.dissatisfaction_score = score


def refresh_allocation_costs(db: Session, allocations: list[Allocation]):
    for allocation in allocations:
        refresh_allocation_cost(db, allocation)


def get_allocation_rows_for_context(db: Session, active_sem: str, academic_year: str | None, department: str | None):
    draft_query = apply_context_filter(db.query(Allocation), Allocation, active_sem, academic_year, department)
    draft_allocations = draft_query.filter(Allocation.is_published == False).all()
    published_query = apply_context_filter(db.query(Allocation), Allocation, active_sem, academic_year, department)
    allocations = draft_allocations or published_query.filter(Allocation.is_published == True).all()
    report = []
    for allocation in allocations:
        row = allocation_report_row(allocation)
        if row:
            report.append(row)
    return report


def get_allocation_rows_for_semester(db: Session, active_sem: str):
    _, academic_year, department = get_active_context(db)
    return get_allocation_rows_for_context(db, active_sem, academic_year, department)


def resolve_manual_edit_faculty(
    db: Session, 
    payload: AllocationEditRequest, 
    active_sem: str, 
    academic_year: str, 
    department: str
):
    if payload.faculty_id is not None:
        faculty = db.query(User).filter(
            User.id == payload.faculty_id,
            User.role == "faculty",
        ).first()
    elif payload.faculty_name is not None:
        typed_name = normalize_faculty_name(payload.faculty_name)
        typed_email = normalize_email(payload.faculty_name)
        if not typed_name:
            raise HTTPException(status_code=400, detail="Type a replacement faculty name.")

        # ✅ Now active_sem, academic_year, and department are cleanly defined here!
        matching_roster = [
            row for row in roster_for_context(db, active_sem, academic_year, department).all()
            if normalize_faculty_name(row.name) == typed_name or normalize_email(row.email) == typed_email
        ]
        if len(matching_roster) > 1:
            raise HTTPException(status_code=400, detail="More than one faculty member has that name.")

        if matching_roster:
            faculty = db.query(User).filter(
                User.email == matching_roster[0].email,
                User.role == "faculty",
            ).first()
        else:
            matching_users = [
                user for user in db.query(User).filter(User.role == "faculty").all()
                if normalize_faculty_name(user.name) == typed_name or normalize_email(user.email) == typed_email
            ]
            if len(matching_users) > 1:
                raise HTTPException(status_code=400, detail="More than one faculty member has that name.")
            faculty = matching_users[0] if matching_users else None
    else:
        raise HTTPException(status_code=400, detail="Type a replacement faculty name.")

    if not faculty:
        raise HTTPException(status_code=404, detail="Replacement faculty member not found.")
    return faculty


def find_manual_edit_allocation(
    db: Session,
    active_sem: str,
    payload: AllocationEditRequest,
    academic_year: str | None,
    department: str | None,
):
    query = apply_context_filter(db.query(Allocation), Allocation, active_sem, academic_year, department)
    if payload.allocation_id:
        return query.filter(Allocation.id == payload.allocation_id).first()
    if not payload.course_id:
        return None

    query = query.filter(Allocation.course_id == payload.course_id)
    if payload.current_faculty_id:
        exact = query.filter(Allocation.faculty_id == payload.current_faculty_id).first()
        if exact:
            return exact
    if payload.current_faculty_name:
        typed_name = normalize_faculty_name(payload.current_faculty_name)
        for allocation in query.all():
            if allocation.faculty and normalize_faculty_name(allocation.faculty.name) == typed_name:
                return allocation
    return query.order_by(Allocation.id).first()


def save_manual_allocation_edit(db: Session, active_sem: str, allocation: Allocation, faculty: User):
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation record not found.")
    capacity_row = db.query(FacultyCapacity).filter(
        FacultyCapacity.faculty_email == faculty.email,
        FacultyCapacity.semester_name == allocation.semester_name,
        FacultyCapacity.academic_year == allocation.academic_year,
        FacultyCapacity.department == allocation.department,
    ).first()
    if not capacity_row:
        raise HTTPException(status_code=400, detail="Replacement faculty is not configured for this academic year, department, and semester.")

    old_faculty_id = allocation.faculty_id
    old_cost = float(allocation.dissatisfaction_score or 0.0)
    allocation.faculty_id = faculty.id
    allocation.faculty = faculty
    refresh_allocation_cost(db, allocation)
    allocation.is_manually_edited = True
    allocation.manual_edit_type = "manual"
    refresh_allocation_costs(
        db,
        db.query(Allocation).filter(
            Allocation.semester_name == active_sem,
            Allocation.academic_year == allocation.academic_year,
            Allocation.department == allocation.department,
        ).all(),
    )
    new_cost = float(allocation.dissatisfaction_score or 0.0)
    db.flush()
    if allocation.is_published:
        sync_faculty_history_from_published_allocations(db)
    db.commit()
    db.expire_all()
    db.refresh(allocation)
    return {
        "message": f"Manual allocation saved. Cost updated from {old_cost:g} to {new_cost:g}.",
        "allocation": allocation_report_row(allocation),
        "allocations": get_allocation_rows_for_semester(db, active_sem),
        "cost_update": {
            "old_faculty_id": old_faculty_id,
            "new_faculty_id": faculty.id,
            "old_cost": old_cost,
            "new_cost": new_cost,
        },
    }


def allocation_report_row(allocation: Allocation):
    course = allocation.course
    faculty = allocation.faculty
    if not course or not faculty:
        return None
    return {
        "allocation_id": allocation.id,
        "course_id": course.id,
        "faculty_id": faculty.id,
        "course_code": course.code,
        "course_name": course.name,
        "credits": course.credits,
        "faculty_name": faculty.name,
        "faculty_email": faculty.email,
        "academic_year": allocation.academic_year,
        "department": allocation.department,
        "semester_name": allocation.semester_name,
        "is_forced": allocation.is_forced,
        "is_published": allocation.is_published,
        "is_manually_edited": allocation.is_manually_edited,
        "manual_edit_type": allocation.manual_edit_type,
        "dissatisfaction_score": allocation.dissatisfaction_score,
    }

@router.get("/active-semester")
def get_active_semester(db: Session = Depends(get_db)):
    config = get_or_create_semester_config(db)
    return {
        "active_semester": config.active_semester,
        "academic_year": config.academic_year,
        "department": config.department,
    }

@router.put("/report-context")
def update_report_context(payload: ReportContextRequest, db: Session = Depends(get_db)):
    config = get_or_create_semester_config(db)
    config.academic_year = (payload.academic_year or "").strip() or None
    config.department = (payload.department or "").strip() or None
    db.commit()
    db.refresh(config)
    return {
        "message": "Report context saved.",
        "active_semester": config.active_semester,
        "academic_year": config.academic_year,
        "department": config.department,
    }

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    config = get_or_create_semester_config(db)
    active_sem = config.active_semester
    total_courses = apply_context_filter(
        db.query(Course),
        Course,
        active_sem,
        config.academic_year,
        config.department,
    ).count()
    active_faculty = roster_for_context(db, active_sem, config.academic_year, config.department).count()
    return {
        "active_semester": active_sem,
        "academic_year": config.academic_year,
        "department": config.department,
        "total_courses": total_courses,
        "active_faculty": active_faculty,
    }

@router.get("/template/courses")
def download_course_template():
    df = pd.DataFrame([
        {
            "Course Code": "CS301",
            "Course Name": "Data Structures",
            "Credits": 4,
            "Required Faculty Count": 2,
        },
        {
            "Course Code": "CS302",
            "Course Name": "Operating Systems",
            "Credits": 3,
            "Required Faculty Count": 1,
        },
    ])
    return excel_response(df, "course_upload_template.xlsx")

@router.get("/template/faculty")
def download_faculty_template():
    df = pd.DataFrame([
        {"Faculty Name": "Dr. Asha Menon", "Faculty Email": "asha.menon@example.edu"},
        {"Faculty Name": "Dr. Ravi Kumar", "Faculty Email": "ravi.kumar@example.edu"},
    ])
    return excel_response(df, "faculty_upload_template.xlsx")

@router.get("/faculty-roster/download")
def download_current_faculty_roster(db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    rows = roster_for_context(db, active_sem, academic_year, department).order_by(FacultyRoster.name).all()
    if rows:
        df = pd.DataFrame([{"Faculty Name": row.name, "Faculty Email": row.email} for row in rows])
    else:
        df = pd.DataFrame(columns=["Faculty Name", "Faculty Email"])
    return excel_response(df, "current_faculty_roster.xlsx")

@router.get("/faculty-capacities")
def get_faculty_capacities(db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    roster = roster_for_context(db, active_sem, academic_year, department).order_by(FacultyRoster.name).all()
    capacity_rows = apply_context_filter(
        db.query(FacultyCapacity),
        FacultyCapacity,
        active_sem,
        academic_year,
        department,
    ).all()
    capacity_by_email = {row.faculty_email: row.capacity for row in capacity_rows}
    roster_emails = {row.email for row in roster}
    saved_count = sum(1 for email in roster_emails if email in capacity_by_email)

    return {
        "active_semester": active_sem,
        "saved": bool(roster) and saved_count == len(roster),
        "faculty": [
            {
                "name": row.name,
                "email": row.email,
                "capacity": capacity_by_email.get(row.email, 0),
            }
            for row in roster
        ],
    }


@router.get("/allocation-faculty-options")
def get_allocation_faculty_options(db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    eligible_emails = {
        row.faculty_email for row in db.query(FacultyCapacity).filter(
            FacultyCapacity.semester_name == active_sem,
            FacultyCapacity.academic_year == academic_year,
            FacultyCapacity.department == department,
        ).all()
    }
    roster = roster_for_context(db, active_sem, academic_year, department).order_by(FacultyRoster.name).all()
    roster_emails = [row.email for row in roster if row.email in eligible_emails]
    users = db.query(User).filter(
        User.role == "faculty",
        User.email.in_(roster_emails),
    ).all()
    user_by_email = {user.email: user for user in users}

    return [
        {
            "id": user_by_email[row.email].id,
            "name": row.name,
            "email": row.email,
        }
        for row in roster
        if row.email in user_by_email
    ]

@router.put("/faculty-capacities")
def update_faculty_capacities(payload: FacultyCapacityUpdate, db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    if not academic_year or not department:
        raise HTTPException(status_code=400, detail="Select academic year and department before saving capacities.")
    roster = roster_for_context(db, active_sem, academic_year, department).all()
    roster_emails = {row.email for row in roster}
    incoming = {item.faculty_email: item.capacity for item in payload.capacities}

    missing = roster_emails - incoming.keys()
    unknown = incoming.keys() - roster_emails
    if unknown:
        raise HTTPException(status_code=400, detail="Capacity list includes faculty not found in the current uploaded roster.")
    if missing:
        raise HTTPException(status_code=400, detail="Please set capacity for every faculty member in the current roster.")

    for email, capacity in incoming.items():
        if capacity < 0:
            raise HTTPException(status_code=400, detail="Capacity cannot be negative.")

        row = db.query(FacultyCapacity).filter(
            FacultyCapacity.faculty_email == email,
            FacultyCapacity.semester_name == active_sem,
            FacultyCapacity.academic_year == academic_year,
            FacultyCapacity.department == department,
        ).first()
        if not row:
            row = FacultyCapacity(
                faculty_email=email,
                semester_name=active_sem,
                academic_year=academic_year,
                department=department,
                capacity=capacity,
            )
            db.add(row)
        else:
            row.capacity = capacity

        user = db.query(User).filter(User.email == email).first()
        if user:
            user.current_capacity = capacity

    db.commit()
    return {"message": f"Faculty capacities saved for {active_sem}."}

@router.post("/upload-courses")
async def upload_courses(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel sheet.")
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # ⚡ DEFENSE 1: Normalize spreadsheet headers (lowercase and strip spaces)
        # This keeps the code immune if headers are typed differently next semester
        df.columns = [str(col).strip().lower() for col in df.columns]
        
        config = get_or_create_semester_config(db)
        active_sem = config.active_semester
        academic_year = config.academic_year
        department = config.department
        if not academic_year or not department:
            raise HTTPException(status_code=400, detail="Select academic year and department before uploading courses.")

        published_count = apply_context_filter(
            db.query(Allocation),
            Allocation,
            active_sem,
            academic_year,
            department,
        ).filter(Allocation.is_published == True).count()
        if published_count > 0:
            raise HTTPException(status_code=409, detail=f"{active_sem} allocations are already published for this academic year and department. Start a new context before replacing courses.")

        # 1. Drop allocations first to clear foreign key constraints
        apply_context_filter(
            db.query(Allocation),
            Allocation,
            active_sem,
            academic_year,
            department,
        ).delete(synchronize_session=False)
        
        # 2. Clear out previous course listings for THIS active semester only
        apply_context_filter(
            db.query(Course),
            Course,
            active_sem,
            academic_year,
            department,
        ).delete(synchronize_session=False)
        db.commit() # Flush right away to give PostgreSQL a perfectly clean canvas

        # 3. Dynamic header matching dictionary maps
        code_key = "course code" if "course code" in df.columns else "code"
        name_key = "course name" if "course name" in df.columns else "name"
        credits_key = None
        for col in df.columns:
            if "credit" in col:
                credits_key = col
                break
        if not credits_key:
            raise HTTPException(
                status_code=400,
                detail="Course spreadsheet must include a Credits column so reports can show course credits.",
            )
        slots_key = None
        for col in df.columns:
            if "faculty count" in col or "slots" in col or "faculty required" in col:
                slots_key = col
                break
        if not slots_key:
            slots_key = "required faculty count" if "required faculty count" in df.columns else df.columns[2]

        inserted_count = 0

        # 4. Stream your fresh spreadsheet variables safely
        for _, row in df.iterrows():
            raw_code = row.get(code_key)
            raw_name = row.get(name_key)
            
            # ⚡ DEFENSE 2: Skip empty ghost rows at the bottom of the spreadsheet
            if pd.isna(raw_code) or str(raw_code).strip() == "":
                continue

            # ⚡ DEFENSE 3: Safe data-type parsing with default rollbacks
            try:
                slots_val = int(row.get(slots_key, 1))
            except (ValueError, TypeError):
                slots_val = 1 # Safe default if cell is empty or corrupted

            credits_val = 0.0
            if credits_key:
                try:
                    raw_credits = row.get(credits_key, 0)
                    credits_val = 0.0 if pd.isna(raw_credits) else float(raw_credits)
                except (ValueError, TypeError):
                    credits_val = 0.0

            new_course = Course(
                code=str(raw_code).strip(),
                name=str(raw_name).strip(),
                credits=credits_val,
                slots_required=slots_val,
                semester_name=active_sem,
                academic_year=academic_year,
                department=department,
            )
            db.add(new_course)
            inserted_count += 1
            
        db.commit() 
        return {"message": f"Successfully replaced and saved {inserted_count} course definitions for {active_sem}!"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Course spreadsheet import aborted: {str(e)}")


@router.post("/upload-faculty")
async def upload_faculty(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel sheet.")
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # ⚡ DEFENSE 1: Normalize spreadsheet headers (lowercase + stripped whitespace)
        # This prevents crashes if headers are typed differently next semester
        df.columns = [str(col).strip().lower() for col in df.columns]
        
        # Dynamic lookup for column keys
        email_key = "faculty email" if "faculty email" in df.columns else "email"
        name_key = "faculty name" if "faculty name" in df.columns else "name"
        
        active_sem, academic_year, department = get_active_context(db)
        if not academic_year or not department:
            raise HTTPException(status_code=400, detail="Select academic year and department before uploading faculty.")

        synced_count = 0
        roster_emails = set()
        roster_for_context(db, active_sem, academic_year, department).delete(synchronize_session=False)

        for _, row in df.iterrows():
            raw_email = row.get(email_key)
            raw_name = row.get(name_key)
            
            # ⚡ DEFENSE 2: Strictly skip ghost/empty cells at the bottom of the Excel file
            if pd.isna(raw_email) or str(raw_email).strip() == "":
                continue
                
            email = str(raw_email).strip()
            name = str(raw_name).strip()
            if email in roster_emails:
                continue
            roster_emails.add(email)
            
            # Check if their profile row already exists across the lifetime system
            user = db.query(User).filter(User.email == email).first()
            
            if not user:
                # 🆕 BRAND NEW FACULTY: Register profile and initialize history tracking to 0
                user = User(
                    email=email, 
                    name=name, 
                    role="faculty",
                    total_historical_dissatisfaction=0.0,
                    total_courses_taught_previously=0
                )
                db.add(user)
            else:
                # 🔒 RETURNING FACULTY: Safely overwrite metadata, leaving history scores locked in!
                user.name = name
                user.role = "faculty"
                
            # Flush changes to the pipeline block on each iteration to keep tracking clean
            db.add(FacultyRoster(email=email, name=name, semester_name=active_sem, academic_year=academic_year, department=department))
            db.flush()
            synced_count += 1

        apply_context_filter(db.query(FacultyCapacity), FacultyCapacity, active_sem, academic_year, department).filter(
            FacultyCapacity.faculty_email.notin_(roster_emails)
        ).delete(synchronize_session=False)
        db.commit()
        return {"message": f"Successfully synced roster definitions for {synced_count} faculty members. Historical metrics preserved."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Faculty upload processing failed: {str(e)}")

@router.post("/start-new-semester")
def start_new_semester(payload: SemesterToggleRequest, db: Session = Depends(get_db)):
    valid_semesters = [f"Semester {i}" for i in range(1, 9)]
    if payload.new_semester_name not in valid_semesters:
        raise HTTPException(status_code=400, detail="Invalid target selection.")

    # 1. Update the universal active semester pointer
    config = db.query(SemesterConfig).first()
    if not config:
        config = SemesterConfig(active_semester=payload.new_semester_name)
        db.add(config)
    else:
        config.active_semester = payload.new_semester_name

    # ⚡ 2. WIPE PREVIOUS FLUID DATA FOR THE INCOMING SEMESTER
    # This prevents old data from duplicating if you roll back or overwrite a term workspace
    published_count = db.query(Allocation).filter(
        Allocation.semester_name == payload.new_semester_name,
        Allocation.is_published == True
    ).count()

    
    # ⚡ 3. NUCLEAR WIPE ON PREFERENCES
    # Old preferences hold no significance across changing terms

    # 🔒 HISTORICAL DATA IS RECORDED AND SAFE HERE:
    # We do NOT delete from the User table. Their historical dissatisfaction 
    # scores remain permanently saved inside the DB for your tiebreaker algorithm.

    db.commit()
    return {"message": f"Switched to {payload.new_semester_name}. Department workspaces are preserved."}
@router.post("/run-allocation")
def run_allocation(db: Session = Depends(get_db)):
    # 1. Identify active semester pointer
    config = get_or_create_semester_config(db)
    active_sem = config.active_semester
    academic_year = config.academic_year
    department = config.department
    if not academic_year or not department:
        raise HTTPException(status_code=400, detail="Select academic year and department before running allocation.")
    
    # 2. Fetch all valid course IDs uploaded for THIS active semester
    semester_course_ids = [
        c.id for c in apply_context_filter(
            db.query(Course.id),
            Course,
            active_sem,
            academic_year,
            department,
        ).all()
    ]
    
    if not semester_course_ids:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot run engine. No course catalog definitions found for {active_sem}."
        )

    # ⚡ PROBLEM 1 & 2 FIX: Gatekeeper constraint to check for new preferences this semester
    pref_count = db.query(Preference).filter(Preference.course_id.in_(semester_course_ids)).count()
    if pref_count == 0:
        raise HTTPException(
            status_code=422,
            detail=f"Execution blocked: No faculty members have submitted preferences for {active_sem} yet!"
        )

    roster = roster_for_context(db, active_sem, academic_year, department).all()
    if not roster:
        raise HTTPException(status_code=422, detail="Execution blocked: Upload the faculty roster first.")
    roster_emails = {row.email for row in roster}
    capacities = db.query(FacultyCapacity).filter(
        FacultyCapacity.semester_name == active_sem,
        FacultyCapacity.academic_year == academic_year,
        FacultyCapacity.department == department,
        FacultyCapacity.faculty_email.in_(roster_emails),
    ).all()
    capacity_map = {row.faculty_email: row.capacity for row in capacities}
    missing_capacity = [row.name for row in roster if row.email not in capacity_map]
    if missing_capacity:
        raise HTTPException(
            status_code=422,
            detail=f"Execution blocked: Set faculty capacities for {active_sem} before running allocation."
        )
    if sum(capacity_map.values()) <= 0:
        raise HTTPException(
            status_code=422,
            detail=f"Execution blocked: At least one faculty member must have positive capacity for {active_sem}."
        )

    published_count = db.query(Allocation).filter(
        Allocation.semester_name == active_sem,
        Allocation.academic_year == academic_year,
        Allocation.department == department,
        Allocation.is_published == True
    ).count()
    if published_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{active_sem} allocations are already published. Start a new semester to run a fresh engine draft."
        )

    try:
        sync_faculty_history_from_published_allocations(db)
        db.commit()

        draft_count = db.query(Allocation).filter(
            Allocation.semester_name == active_sem,
            Allocation.academic_year == academic_year,
            Allocation.department == department,
            Allocation.is_published == False
        ).count()

        # Clear out previous draft layouts for this specific term cleanly
        db.query(Allocation).filter(
            Allocation.semester_name == active_sem, 
            Allocation.academic_year == academic_year,
            Allocation.department == department,
            Allocation.is_published == False
        ).delete(synchronize_session=False)
        
        # Force a database commit so the core algorithm reads a perfectly clean table slate
        db.commit()
        
        # Trigger your mathematical matching code
        run_allocation_logic(db, active_sem, academic_year, department)
        
        # Explicitly confirm the database saves everything before sending the response message
        db.commit()
        
        action = "re-run" if draft_count else "run"
        return {"message": f"Optimization engine {action} completed for {active_sem}. Draft allocations refreshed."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Allocation logic failure: {str(e)}")

@router.post("/publish-allocation")
def publish_allocation(db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    allocations = apply_context_filter(
        db.query(Allocation),
        Allocation,
        active_sem,
        academic_year,
        department,
    ).filter(Allocation.is_published == False).all()
    if not allocations:
        return {"message": "No unpublished draft structures found."}
    for alloc in allocations:
        alloc.is_published = True
    db.flush()
    sync_faculty_history_from_published_allocations(db)
    db.commit()
    return {"message": f"Schedules successfully released live for {active_sem}!"}

@router.get("/current-allocations")
def get_current_allocations(db: Session = Depends(get_db)):
    active_sem, academic_year, department = get_active_context(db)
    return get_allocation_rows_for_context(db, active_sem, academic_year, department)


@router.put("/draft-allocations/{allocation_id}")
def update_draft_allocation(
    allocation_id: int,
    payload: AllocationEditRequest,
    db: Session = Depends(get_db),
):
    active_sem, academic_year, department = get_active_context(db)

    allocation = db.query(Allocation).filter(
        Allocation.id == allocation_id,
        Allocation.semester_name == active_sem,
        Allocation.academic_year == academic_year,
        Allocation.department == department,
    ).first()
    faculty = resolve_manual_edit_faculty(
        db=db,
        payload=payload,
        # The report context is stored on the server.  The edit payload only
        # identifies the allocation and replacement faculty, so reading
        # context from the payload raises AttributeError for draft edits.
        active_sem=active_sem,
        academic_year=academic_year,
        department=department,
    )
    return save_manual_allocation_edit(db, active_sem, allocation, faculty)


@router.post("/manual-allocation-edit")
def update_manual_allocation(
    payload: AllocationEditRequest,
    db: Session = Depends(get_db),
):
    active_sem, academic_year, department = get_active_context(db)
    allocation = find_manual_edit_allocation(db, active_sem, payload, academic_year, department)
    faculty = resolve_manual_edit_faculty(db, payload)
    return save_manual_allocation_edit(db, active_sem, allocation, faculty)
