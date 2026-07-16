from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Course, Preference, User, Allocation, SemesterConfig
from ..schemas import CourseResponse, PreferenceSubmit

router = APIRouter(prefix="/faculty", tags=["Faculty Actions"])

def get_active_context(db: Session, academic_year: str | None = None, department: str | None = None, semester_name: str | None = None):
    config = db.query(SemesterConfig).first()
    if not config:
        return semester_name or "Semester 1", academic_year, department
    return semester_name or config.active_semester, academic_year or config.academic_year, department or config.department

@router.get("/courses", response_model=List[CourseResponse])
def get_available_courses(
    academic_year: str | None = Query(None), department: str | None = Query(None), semester_name: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Fetch ONLY the courses uploaded for the active semester so faculty can rank them."""
    try:
        # 1. Identify the targeted active semester context
        active_sem, academic_year, department = get_active_context(db, academic_year, department, semester_name)
        
        # ⚡ THE FILTER FIX: Restrict response strictly to the current active semester workspace
        return db.query(Course).filter(
            Course.semester_name == active_sem,
            Course.academic_year == academic_year,
            Course.department == department,
        ).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active courses: {str(e)}")


@router.post("/submit-preferences")
def submit_preferences(
    faculty_id: int, 
    prefs: List[PreferenceSubmit], 
    academic_year: str | None = Query(None), department: str | None = Query(None), semester_name: str | None = Query(None),
    db: Session = Depends(get_db)
):
    """Save or overwrite course preferences."""
    user = db.query(User).filter(User.id == faculty_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty record not found.")

    active_sem, academic_year, department = get_active_context(db, academic_year, department, semester_name)
    active_course_ids = {
        course.id for course in db.query(Course.id).filter(
            Course.semester_name == active_sem,
            Course.academic_year == academic_year,
            Course.department == department,
        ).all()
    }
    submitted_course_ids = {p.course_id for p in prefs}
    if submitted_course_ids - active_course_ids:
        raise HTTPException(status_code=400, detail="Preferences include courses outside the active academic year, department, and semester.")
    
    user.preferences_submitted = True
    
    # 1. Clear previous preferences only for the active context.
    db.query(Preference).filter(
        Preference.faculty_id == faculty_id,
        Preference.course_id.in_(active_course_ids),
    ).delete(synchronize_session=False)
    
    # 2. Add new preference selections
    seen_values = set()
    for p in prefs:
        if p.preference_value is not None:
            if p.preference_value in seen_values:
                db.rollback()
                raise HTTPException(
                    status_code=400, 
                    detail=f"Duplicate preference value {p.preference_value} detected. All scores must be unique."
                )
            seen_values.add(p.preference_value)
            
        new_pref = Preference(
            faculty_id=faculty_id,
            course_id=p.course_id,
            preference_value=p.preference_value
        )
        db.add(new_pref)
        
    db.commit()
    return {"message": "Preferences successfully registered!"}


@router.get("/my-allocations")
def get_my_allocations(
    faculty_id: int, academic_year: str | None = Query(None), department: str | None = Query(None), semester_name: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Fetches ONLY the published allocations assigned to this specific faculty member for the active semester."""
    # 1. Identify active semester pointer 
    active_sem, academic_year, department = get_active_context(db, academic_year, department, semester_name)

    # ⚡ Updated filter parameters to isolate historical schedules by semester tracking name
    allocations = db.query(Allocation).filter(
        Allocation.faculty_id == faculty_id,
        Allocation.semester_name == active_sem,
        Allocation.academic_year == academic_year,
        Allocation.department == department,
        Allocation.is_published == True
    ).all()
    
    my_schedule = []
    for a in allocations:
        # Utilizing your established model relationship mappings safely
        if a.course:
            my_schedule.append({
                "course_code": a.course.code,
                "course_name": a.course.name,
                "credits": a.course.credits,
                "academic_year": a.academic_year,
                "department": a.department,
                "semester_name": a.semester_name,
                "is_forced": a.is_forced,
                "dissatisfaction_score": a.dissatisfaction_score
            })
            
    return my_schedule
