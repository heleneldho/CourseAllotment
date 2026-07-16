from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class SemesterConfig(Base):
    __tablename__ = "semester_config"
    id = Column(Integer, primary_key=True, index=True)
    active_semester = Column(String, default="Semester 1", nullable=False)
    academic_year = Column(String, nullable=True)
    department = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="faculty")
    total_historical_dissatisfaction = Column(Float, default=0.0)
    total_courses_taught_previously = Column(Integer, default=0)
    current_capacity = Column(Integer, default=0)
    preferences_submitted = Column(Boolean, default=False)
    preferences = relationship("Preference", back_populates="faculty")

class FacultyRoster(Base):
    __tablename__ = "faculty_roster"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    semester_name = Column(String, nullable=False, default="Semester 1")
    academic_year = Column(String, nullable=True)
    department = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint('email', 'semester_name', 'academic_year', 'department', name='_faculty_roster_context_uc'),
    )

class FacultyCapacity(Base):
    __tablename__ = "faculty_capacities"
    id = Column(Integer, primary_key=True, index=True)
    faculty_email = Column(String, index=True, nullable=False)
    semester_name = Column(String, nullable=False)
    academic_year = Column(String, nullable=True)
    department = Column(String, nullable=True)
    capacity = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint('faculty_email', 'semester_name', 'academic_year', 'department', name='_faculty_capacity_context_uc'),
    )

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, index=True, nullable=False) # ⚡ Removed unique=True
    name = Column(String, nullable=False)
    credits = Column(Float, default=0.0)
    slots_required = Column(Integer, default=1)
    semester_name = Column(String, nullable=False, default="Semester 1")
    academic_year = Column(String, nullable=True)
    department = Column(String, nullable=True)

    # ⚡ Enforces that a course code is unique ONLY within the same semester
    __table_args__ = (
        UniqueConstraint('code', 'semester_name', 'academic_year', 'department', name='_course_context_uc'),
    )

class Preference(Base):
    __tablename__ = "preferences"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    preference_value = Column(Integer, nullable=True)
    faculty = relationship("User", back_populates="preferences")
    course = relationship("Course")

class Allocation(Base):
    __tablename__ = "allocations"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_published = Column(Boolean, default=False)
    is_forced = Column(Boolean, default=False)
    is_manually_edited = Column(Boolean, default=False)
    manual_edit_type = Column(String, nullable=True)
    dissatisfaction_score = Column(Float, default=0.0)
    semester_name = Column(String, nullable=False, default="Semester 1")
    academic_year = Column(String, nullable=True)
    department = Column(String, nullable=True)
    course = relationship("Course")
    faculty = relationship("User")
