import math
from sqlalchemy.orm import Session
from .models import Course, User, FacultyRoster, FacultyCapacity, Preference, Allocation

def is_valid_pref(p):
    """Helper function to validate preference values."""
    return p is not None and p in [1, 2, 3, 4, 5]


# =========================================================================
# 🧮 CORE MATH ENGINE (Preserving Your Exact Optimization Logic)
# =========================================================================
def allocate_courses(courses, faculty, pref_matrix, counts, caps, prev_pd=None, prev_taught=None):
    """
    Main algorithm for Faculty-Course Assignment with Dynamic Forced Allocation 
    safety nets for un-opted or starved courses.
    """
    faculty = [f for f in faculty if caps.get(f, 0) > 0]
    if any(counts.get(c, 0) > 0 for c in courses) and not faculty:
        raise ValueError("Infeasible Problem: No faculty members have positive capacity for this semester.")

    assigned_courses = {f: 0 for f in faculty} # A_i
    total_dissatisfaction = {f: 0 for f in faculty} # D_i
    
    assignments = {c: [] for c in courses}
    remaining_counts = {c: counts[c] for c in courses}
    
    # Handle historical data for Tie-Break 0
    if not prev_pd: prev_pd = {f: 0 for f in faculty}
    if not prev_taught: prev_taught = {f: 1 for f in faculty}
    
    avg_pd = {}
    for f in faculty:
        avg_pd[f] = prev_pd[f] / (prev_taught[f] if prev_taught[f] > 0 else 1)
    
    max_avg_pd = max(avg_pd.values()) if max(avg_pd.values()) > 0 else 1
    lambda_i = {f: avg_pd[f] / max_avg_pd for f in faculty}

    # Identify courses that ABSOLUTELY NO FACULTY OPTED FOR
    unopted_courses = set()
    for c in courses:
        has_opted = any(is_valid_pref(pref_matrix.get(f, {}).get(c)) for f in faculty)
        if not has_opted and remaining_counts[c] >= 1:
            unopted_courses.add(c)

    # Compute Dissatisfaction Matrix (d_ij)
    d_ij = {f: {} for f in faculty}
    for f in faculty:
        for c in courses:
            pref = pref_matrix.get(f, {}).get(c)
            if is_valid_pref(pref):
                d_ij[f][c] = pref - 1
            else:
                d_ij[f][c] = math.inf 

    # Helper to calculate dynamic eligible faculty based on voluntary choices
    def get_eligible_faculty(course):
        eligible = []
        for f in faculty:
            if caps[f] > 0 and d_ij[f][course] != math.inf and assigned_courses[f] < caps[f]:
                eligible.append(f)
        return eligible

    # STEP 1: GLOBAL CAPACITY FEASIBILITY CHECK
    if sum(counts.values()) > sum(caps.values()):
        raise ValueError(f"Infeasible Problem: Department total capacity ({sum(caps.values())}) "
                         f"is less than total required slots ({sum(counts.values())}).")

    # MAIN ASSIGNMENT LOOP (Dynamic Reordering & Allocation)
    while any(remaining_counts[c] > 0 for c in courses):
        active_courses = [c for c in courses if remaining_counts[c] > 0]
        
        course_metrics = {}
        for c in active_courses:
            eligible_fac = get_eligible_faculty(c)
            slack = len(eligible_fac) - remaining_counts[c]
            
            valid_prefs = [pref_matrix[f][c] for f in eligible_fac if is_valid_pref(pref_matrix.get(f, {}).get(c))]
            avg_pref = sum(valid_prefs) / len(eligible_fac) if eligible_fac else 5.0 
            
            course_metrics[c] = {'slack': slack, 'avg_pref': avg_pref}
        
        # STEP 2: COURSE ORDERING — Three-bucket approach (critical, normal, forced)
        critical = []
        normal = []
        forced = []

        for c in active_courses:
            slack = course_metrics[c]['slack']
            
            if slack in [0, 1]:
                # Critical: tightest slack — highest priority
                critical.append(c)
            elif slack > 1:
                # Normal: enough slack to be comfortable
                normal.append(c)
            else:
                # Forced: slack < 0 — no opted faculty available, must force
                forced.append(c)

        # Critical and Normal: sort by (avg_pref ascending, slack ascending)
        # Best avg_pref (lowest number = most preferred) handled first
        critical.sort(key=lambda c: (course_metrics[c]['avg_pref'], course_metrics[c]['slack']))
        normal.sort(key=lambda c: (course_metrics[c]['avg_pref'], course_metrics[c]['slack']))
        
        # Forced: sort by (slack ascending, avg_pref ascending)
        # Closer-to-zero slack (least severe shortage) handled first
        forced.sort(key=lambda c: (course_metrics[c]['slack'], course_metrics[c]['avg_pref']))

        ordered_courses = critical + normal + forced
        target_course = ordered_courses[0]
        
        # STEP 3: FACULTY SELECTION (With Dynamic Forced Fallback)
        pool = get_eligible_faculty(target_course)
        pool = [f for f in pool if f not in assignments[target_course]]
        
        is_forced_allocation = False
        
        if not pool:
            pool = [f for f in faculty if caps[f] > 0 and assigned_courses[f] < caps[f] and f not in assignments[target_course]]
            is_forced_allocation = True
            
        if not pool:
            raise ValueError(f"Allocation failed: Absolute structural capacity limit reached. "
                             f"No faculty left with open capacity for {target_course}.")

        current_dissatisfaction = {}
        average_dissatisfaction = {}
        for f in pool:
            d = 10 if (is_forced_allocation or d_ij[f][target_course] == math.inf) else d_ij[f][target_course]
            a = assigned_courses[f]
            ad = 0 if a == 0 else (total_dissatisfaction[f] / a)
            current_dissatisfaction[f] = d
            average_dissatisfaction[f] = ad

        min_d = min(current_dissatisfaction.values())
        candidates = [f for f in pool if current_dissatisfaction[f] == min_d]

        if len(candidates) > 1:
            max_ad = max(average_dissatisfaction[f] for f in candidates)
            candidates = [f for f in candidates if average_dissatisfaction[f] == max_ad]
        
        # --- TIE BREAKING RULES ---
        # Rule 0: Historical Dissatisfaction
        if len(candidates) > 1:
            max_lambda = max(lambda_i[f] for f in candidates)
            candidates = [f for f in candidates if lambda_i[f] == max_lambda]
            
        # Rule 1: Fairness Gap
        if len(candidates) > 1:
            best_gap = math.inf
            gap_candidates = []
            for f in candidates:
                d_value = 10 if (is_forced_allocation or d_ij[f][target_course] == math.inf) else d_ij[f][target_course]
                sim_D = total_dissatisfaction.copy()
                sim_D[f] += d_value
                gap = max(sim_D.values()) - min(sim_D.values())
                if gap < best_gap:
                    best_gap = gap
                    gap_candidates = [f]
                elif gap == best_gap:
                    gap_candidates.append(f)
            candidates = gap_candidates

        # Rule 2: Workload Balance
        if len(candidates) > 1:
            max_rem_cap = max(caps[f] - assigned_courses[f] for f in candidates)
            candidates = [f for f in candidates if (caps[f] - assigned_courses[f]) == max_rem_cap]
            
        # Rule 3: Remaining Preference Sum
        if len(candidates) > 1:
            rem_courses = [c for c in courses if remaining_counts[c] > 0 and c != target_course]
            max_r_i = -math.inf
            pref_candidates = []
            for f in candidates:
                pref_sum = sum(pref_matrix.get(f, {}).get(c, 0) for c in rem_courses if is_valid_pref(pref_matrix.get(f, {}).get(c)))
                denom = caps[f] - assigned_courses[f]
                r_i = pref_sum / denom if denom > 0 else 0
                if r_i > max_r_i:
                    max_r_i = r_i
                    pref_candidates = [f]
                elif r_i == max_r_i:
                    pref_candidates.append(f)
            candidates = pref_candidates

        selected_faculty = candidates[0]
        
        # COMMIT ASSIGNMENT
        assignments[target_course].append(selected_faculty)
        remaining_counts[target_course] -= 1
        
        final_d = 10 if (is_forced_allocation or d_ij[selected_faculty][target_course] == math.inf) else d_ij[selected_faculty][target_course]
        total_dissatisfaction[selected_faculty] += final_d
        assigned_courses[selected_faculty] += 1
        
        if is_forced_allocation:
            if target_course in unopted_courses:
                print(f"[FORCED ALLOCATION] {selected_faculty} was forced to teach {target_course} (No faculty members opted for this course).")
            else:
                print(f"[FORCED ALLOCATION] {selected_faculty} was forced to teach {target_course} (Opted faculty capacity exhausted).")

    return assignments, total_dissatisfaction


# =========================================================================
# 📡 DATABASE BRIDGE (Converts SQLAlchemy Records for the Math Engine)
# =========================================================================
def run_allocation_logic(db: Session, semester_name: str, academic_year: str | None = None, department: str | None = None):
    """
    FastAPI Router Gateway: Fetches active schema variables out of PostgreSQL,
    maps them to your math engine arrays, and commits computed allocation records.
    """
    # 1. Clear previous drafts for this semester safely first
    db.query(Allocation).filter(
        Allocation.semester_name == semester_name,
        Allocation.academic_year == academic_year,
        Allocation.department == department,
        Allocation.is_published == False
    ).delete(synchronize_session=False)
    db.commit()

    # 2. Fetch data rows from PostgreSQL safely — restricted to active semester only
    db_courses = db.query(Course).filter(
        Course.semester_name == semester_name,
        Course.academic_year == academic_year,
        Course.department == department,
    ).all()
    roster = db.query(FacultyRoster).filter(
        FacultyRoster.semester_name == semester_name,
        FacultyRoster.academic_year == academic_year,
        FacultyRoster.department == department,
    ).all()
    roster_emails = [row.email for row in roster]
    db_faculty = db.query(User).filter(
        User.role == "faculty",
        User.email.in_(roster_emails),
    ).all()
    db_preferences = db.query(Preference).all()

    # 3. Translate DB structures to unique string-identifier lookups matching your math signatures
    course_codes = [c.code for c in db_courses]
    faculty_emails = [f.email for f in db_faculty]

    # Map dictionaries
    counts = {c.code: c.slots_required for c in db_courses}
    capacity_rows = db.query(FacultyCapacity).filter(
        FacultyCapacity.semester_name == semester_name,
        FacultyCapacity.academic_year == academic_year,
        FacultyCapacity.department == department,
        FacultyCapacity.faculty_email.in_(roster_emails),
    ).all()
    capacity_by_email = {row.faculty_email: row.capacity for row in capacity_rows}
    caps = {f.email: capacity_by_email.get(f.email, 0) for f in db_faculty}
    
    # Extract historic tracking metrics for Tie-Breaker Rule 0
    prev_pd = {f.email: f.total_historical_dissatisfaction for f in db_faculty}
    prev_taught = {f.email: f.total_courses_taught_previously for f in db_faculty}

    # Map preference values matrix: preferences[email][course_code] = value
    preferences_matrix = {f.email: {} for f in db_faculty}
    
    # Create fast maps to resolve IDs to strings
    course_id_to_code = {c.id: c.code for c in db_courses}
    faculty_id_to_email = {f.id: f.email for f in db_faculty}

    for p in db_preferences:
        email = faculty_id_to_email.get(p.faculty_id)
        code = course_id_to_code.get(p.course_id)
        if email and code:
            preferences_matrix[email][code] = p.preference_value

    # 4. Fire your mathematical optimization engine script
    schedule_results, dissatisfaction_results = allocate_courses(
        courses=course_codes,
        faculty=faculty_emails,
        pref_matrix=preferences_matrix,
        counts=counts,
        caps=caps,
        prev_pd=prev_pd,
        prev_taught=prev_taught
    )

    # 5. Save calculations back to PostgreSQL
    course_code_to_id = {c.code: c.id for c in db_courses}
    faculty_email_to_id = {f.email: f.id for f in db_faculty}

    for code, emails in schedule_results.items():
        course_id = course_code_to_id.get(code)
        if not course_id:
            continue
            
        for email in emails:
            faculty_id = faculty_email_to_id.get(email)
            if not faculty_id:
                continue
            
            # Determine if this specific assignment line was a forced allocation choice
            pref_val = preferences_matrix[email].get(code)
            is_forced = not is_valid_pref(pref_val)
            
            score = 10.0 if is_forced else float(pref_val - 1)

            new_allocation = Allocation(
                course_id=course_id,
                faculty_id=faculty_id,
                is_published=False,
                is_forced=is_forced,
                dissatisfaction_score=score,
                semester_name=semester_name,
                academic_year=academic_year,
                department=department,
            )
            db.add(new_allocation)

    db.commit()
