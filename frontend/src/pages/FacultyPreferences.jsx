import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const T = {
  pageBg:    '#EDF2F1',
  cardBg:    '#ffffff',
  teal:      '#006D64',
  tealGrad:  'linear-gradient(140deg, #1a7a65 0%, #006D64 100%)',
  tealLight: '#e6f4ea',
  border:    '#e2e8f0',
  textHead:  '#0F2926',
  textBody:  '#334155',
  textMuted: '#64748b',
  shadow:    '0 2px 12px rgba(0,0,0,0.06)',
  font:      "'Inter', 'Segoe UI', system-ui, sans-serif",
};

const AVATAR_COLORS = [
  { bg: '#e6f4ea', fg: '#006D64' },
  { bg: '#eff6ff', fg: '#1d4ed8' },
  { bg: '#f3e8ff', fg: '#7c3aed' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fee2e2', fg: '#b91c1c' },
];

const css = {
  page: { minHeight: '100vh', backgroundColor: T.pageBg, fontFamily: T.font },

  /* Nav */
  nav: {
    backgroundColor: T.cardBg, borderBottom: `1px solid ${T.border}`,
    padding: '0 40px', height: '62px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: '10px' },
  navLogo: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: `linear-gradient(145deg, #2a9e85, ${T.teal})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  navLogoInner: { width: '16px', height: '16px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.35)' },
  navTitle: { fontWeight: '800', fontSize: '1rem', color: T.textHead },
  navPageLabel: { fontWeight: '700', color: T.textHead, fontSize: '0.95rem' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  navUserName: { fontSize: '0.88rem', fontWeight: '700', color: T.textHead, display: 'block', textAlign: 'right' },
  navUserSub: { fontSize: '0.75rem', color: T.textMuted, display: 'block', textAlign: 'right' },
  navAvatar: {
    width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#c5ddd8',
    border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarIcon: {
    width: '25px', height: '25px', borderRadius: '50%', border: '2px solid #0f172a',
    backgroundColor: '#fff', position: 'relative', overflow: 'hidden',
  },
  avatarHead: {
    width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#000',
    position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)',
  },
  avatarBody: {
    width: '19px', height: '13px', borderRadius: '50% 50% 0 0', backgroundColor: '#000',
    position: 'absolute', left: '50%', bottom: '-2px', transform: 'translateX(-50%)',
  },
  btnLogout: {
    padding: '8px 16px', backgroundColor: '#fef2f2', color: '#dc2626',
    border: '1px solid #fecaca', borderRadius: '10px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.82rem', fontFamily: T.font,
  },

  /* Body */
  body: { maxWidth: '880px', margin: '0 auto', padding: '36px 24px' },
  btnBack: {
    marginBottom: '28px', background: T.cardBg,
    border: `1.5px solid ${T.border}`, color: T.teal,
    cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
    padding: '8px 18px', borderRadius: '10px',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  },

  /* Workload banner */
  workloadBanner: {
    background: T.tealGrad, borderRadius: '22px',
    padding: '28px 36px', marginBottom: '24px',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '20px',
  },
  workloadTitle: { color: '#fff', fontSize: '1.3rem', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.2px' },
  workloadSub: { color: 'rgba(255,255,255,0.72)', fontSize: '0.87rem', margin: 0 },
  workloadControl: {
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: '16px',
    padding: '14px 22px', display: 'flex', alignItems: 'center', gap: '14px',
    backdropFilter: 'blur(4px)',
  },
  workloadLabel: { color: 'rgba(255,255,255,0.82)', fontSize: '0.82rem', fontWeight: '600', whiteSpace: 'nowrap' },
  workloadStepBtn: {
    width: '30px', height: '30px', borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.22)', border: 'none',
    color: '#fff', fontSize: '1.1rem', fontWeight: '700',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  workloadInput: {
    width: '52px', textAlign: 'center', padding: '7px 0',
    borderRadius: '10px', border: 'none',
    backgroundColor: 'rgba(255,255,255,0.90)',
    color: T.teal, fontSize: '1.2rem', fontWeight: '800', outline: 'none',
  },

  /* Table card */
  tableCard: {
    backgroundColor: T.cardBg, borderRadius: '22px',
    boxShadow: T.shadow, border: `1px solid ${T.border}`,
    overflow: 'hidden', marginBottom: '24px',
  },
  tableCardHeader: {
    padding: '20px 24px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: `1px solid ${T.border}`,
  },
  tableCardTitle: { fontWeight: '800', fontSize: '1rem', color: T.textHead, margin: 0 },
  filterInput: {
    padding: '8px 16px', borderRadius: '999px',
    border: `1.5px solid ${T.border}`, backgroundColor: '#f8faf9',
    color: T.textBody, fontSize: '0.84rem', outline: 'none', width: '180px',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '11px 20px', textAlign: 'left',
    fontSize: '0.70rem', fontWeight: '700',
    color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px',
    backgroundColor: '#f8faf9', borderBottom: `1px solid ${T.border}`,
  },
  tdRow: { borderBottom: `1px solid #f5f8f7` },
  td: { padding: '15px 20px', fontSize: '0.9rem', color: T.textBody, verticalAlign: 'middle' },

  /* Course cell */
  courseCell: { display: 'flex', alignItems: 'center', gap: '14px' },
  courseAvatar: (c) => ({
    width: '40px', height: '40px', borderRadius: '11px',
    backgroundColor: c.bg, color: c.fg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '800', fontSize: '0.75rem', flexShrink: 0,
  }),
  courseName: { fontWeight: '700', color: T.textHead, fontSize: '0.92rem', display: 'block' },
  courseCode: { color: T.textMuted, fontSize: '0.78rem', display: 'block', marginTop: '2px' },

  slotPill: {
    display: 'inline-block', backgroundColor: T.tealLight,
    color: T.teal, padding: '4px 14px', borderRadius: '999px',
    fontSize: '0.8rem', fontWeight: '600', border: `1px solid #b2ddd6`,
  },
  select: {
    padding: '8px 12px', width: '100%', maxWidth: '210px',
    borderRadius: '10px', border: `1.5px solid ${T.border}`,
    backgroundColor: '#f8faf9', color: T.textBody,
    fontSize: '0.87rem', cursor: 'pointer', outline: 'none',
  },

  /* Footer row */
  tableFooter: {
    padding: '18px 24px', borderTop: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
  },
  footerNote: { color: T.textMuted, fontSize: '0.82rem' },
  footerBtns: { display: 'flex', gap: '12px' },
  btnDiscard: {
    padding: '11px 22px', backgroundColor: T.cardBg, color: T.textBody,
    border: `1.5px solid ${T.border}`, borderRadius: '12px',
    cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
  },
  btnSave: {
    padding: '11px 28px', background: T.tealGrad,
    color: '#fff', border: 'none', borderRadius: '12px',
    cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem',
    boxShadow: '0 4px 14px rgba(0,109,100,0.25)',
  },

  loadingWrap: {
    minHeight: '100vh', backgroundColor: T.pageBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.teal, fontFamily: T.font, fontSize: '1rem', fontWeight: '600',
  },
};

function initials(name) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function FacultyPreferences() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [filterText, setFilterText] = useState("");
  const [loading, setLoading] = useState(true);
  const facultyId = localStorage.getItem("userId") || 1;
  const facultyContext = () => new URLSearchParams({
    academic_year: localStorage.getItem("facultyAcademicYear") || "",
    department: localStorage.getItem("facultyDepartment") || "",
    semester_name: localStorage.getItem("facultySemester") || "Semester 1",
  }).toString();

  useEffect(() => {
    api.get(`/faculty/courses?${facultyContext()}`)
      .then(res => { setCourses(res.data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  const handlePrefChange = (courseId, val) => {
    setPreferences(prev => ({ ...prev, [courseId]: val === "" ? null : parseInt(val, 10) }));
  };

  const handleDiscard = () => {
    const confirmDiscard = window.confirm("Discard all unsaved changes to your preferences?");
    if (!confirmDiscard) return;
    setPreferences({});
    setFilterText("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedPrefs = courses.map(c => ({ course_id: c.id, preference_value: preferences[c.id] || null }));
    const scores = formattedPrefs.map(p => p.preference_value).filter(v => v !== null);
    if (scores.length !== new Set(scores).size) { alert("Error: Duplicate rankings found."); return; }
    try {
      const res = await api.post(`/faculty/submit-preferences?faculty_id=${facultyId}&${facultyContext()}`, formattedPrefs);
      alert(res.data.message);
      navigate("/faculty-dashboard");
    } catch (err) { alert("Submission failed."); }
  };

  if (loading) return <div style={css.loadingWrap}>Loading Forms...</div>;

  const filteredCourses = courses.filter(course => {
    const term = filterText.trim().toLowerCase();
    if (!term) return true;
    return course.name.toLowerCase().includes(term) || course.code.toLowerCase().includes(term);
  });

  return (
    <div style={css.page}>
      {/* Nav */}
      <nav style={css.nav}>
        <div style={css.navBrand}>
          <div style={css.navLogo}><div style={css.navLogoInner} /></div>
          <span style={css.navTitle}>AcademiaPro</span>
        </div>
        <span style={css.navPageLabel}>Preference Entry Form</span>
        <div style={css.navRight}>
          <div>
            <span style={css.navUserName}>{localStorage.getItem("userName") || "Faculty"}</span>
            <span style={css.navUserSub}>Preference Entry Form</span>
          </div>
          <div style={css.navAvatar}>
            <div style={css.avatarIcon}>
              <div style={css.avatarHead} />
              <div style={css.avatarBody} />
            </div>
          </div>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/"; }}
            style={css.btnLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={css.body}>
        <button onClick={() => navigate("/faculty-dashboard")} style={css.btnBack}>
          &larr; Return to Hub
        </button>

        <form onSubmit={handleSubmit}>
          {/* Table Card */}
          <div style={css.tableCard}>
            <div style={css.tableCardHeader}>
              <h3 style={css.tableCardTitle}>Available Courses</h3>
              <input
                style={css.filterInput}
                type="text"
                placeholder="Filter courses..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>Course</th>
                  <th style={css.th}>Faculty Required</th>
                  <th style={{ ...css.th, width: '220px' }}>Your Preference Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ ...css.td, textAlign: 'center', color: T.textMuted, fontStyle: 'italic' }}>
                      No courses match "{filterText}".
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course, idx) => (
                  <tr key={course.id} style={css.tdRow}>
                    <td style={css.td}>
                      <div style={css.courseCell}>
                        <div style={css.courseAvatar(AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                          {initials(course.name)}
                        </div>
                        <div>
                          <span style={css.courseName}>{course.name}</span>
                          <span style={css.courseCode}>Code: {course.code}</span>
                        </div>
                      </div>
                    </td>
                    <td style={css.td}>
                      <span style={css.slotPill}>{course.slots_required}</span>
                    </td>
                    <td style={css.td}>
                      <select
                        value={preferences[course.id] || ""}
                        onChange={(e) => handlePrefChange(course.id, e.target.value)}
                        style={css.select}
                      >
                        <option value="">-- No Selection --</option>
                        <option value="1">1 - Choice 1 (Highest)</option>
                        <option value="2">2 - Choice 2</option>
                        <option value="3">3 - Choice 3</option>
                        <option value="4">4 - Choice 4</option>
                        <option value="5">5 - Choice 5 (Lowest)</option>
                      </select>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={css.tableFooter}>
              <span style={css.footerNote}>Ensure all required slots are ranked before saving.</span>
              <div style={css.footerBtns}>
                <button type="button" onClick={handleDiscard} style={css.btnDiscard}>
                  Discard Changes
                </button>
                <button type="submit" style={css.btnSave}>
                  Save Choices to Database
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
