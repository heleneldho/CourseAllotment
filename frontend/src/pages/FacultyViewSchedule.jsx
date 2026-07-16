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

const formatCredits = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const css = {
  page: { minHeight: '100vh', backgroundColor: T.pageBg, fontFamily: T.font },

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

  body: { maxWidth: '880px', margin: '0 auto', padding: '36px 24px' },
  btnBack: {
    marginBottom: '24px', background: T.cardBg,
    border: `1.5px solid ${T.border}`, color: T.teal,
    cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
    padding: '8px 18px', borderRadius: '10px',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  },
  pageTitle: {
    color: T.textHead, fontSize: '1.5rem', fontWeight: '800',
    marginBottom: '24px', letterSpacing: '-0.3px',
  },

  emptyCard: {
    padding: '56px 32px', textAlign: 'center',
    backgroundColor: T.cardBg, borderRadius: '22px',
    border: `1px solid ${T.border}`, boxShadow: T.shadow,
  },
  emptyTitle: { margin: '0 0 10px', color: T.textHead, fontSize: '1.1rem', fontWeight: '800' },
  emptyText: {
    margin: '0 auto', fontSize: '0.88rem', color: T.textMuted,
    lineHeight: 1.6, maxWidth: '380px',
  },

  tableCard: {
    backgroundColor: T.cardBg, borderRadius: '22px',
    boxShadow: T.shadow, border: `1px solid ${T.border}`, overflow: 'hidden',
  },
  tableCardHeader: { padding: '20px 24px', borderBottom: `1px solid ${T.border}` },
  tableCardTitle: { fontWeight: '800', fontSize: '1rem', color: T.textHead, margin: 0 },
  tableIntro: { padding: '14px 24px 0', color: T.textMuted, fontSize: '0.86rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '11px 20px', textAlign: 'left',
    fontSize: '0.70rem', fontWeight: '700',
    color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px',
    backgroundColor: '#f8faf9', borderBottom: `1px solid ${T.border}`,
  },
  tdRow: { borderBottom: '1px solid #f5f8f7' },
  td: { padding: '15px 20px', fontSize: '0.9rem', color: T.textBody, verticalAlign: 'middle' },
  tdBold: { padding: '15px 20px', fontSize: '0.9rem', color: T.textHead, fontWeight: '700', verticalAlign: 'middle' },

  loadingWrap: {
    minHeight: '100vh', backgroundColor: T.pageBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.teal, fontFamily: T.font, fontSize: '1rem', fontWeight: '600',
  },
};

export default function FacultyViewSchedule() {
  const navigate = useNavigate();
  const [myAllocations, setMyAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const facultyId = localStorage.getItem("userId") || 1;
  const facultyContext = () => new URLSearchParams({
    academic_year: localStorage.getItem("facultyAcademicYear") || "",
    department: localStorage.getItem("facultyDepartment") || "",
    semester_name: localStorage.getItem("facultySemester") || "Semester 1",
  }).toString();

  useEffect(() => {
    api.get(`/faculty/my-allocations?faculty_id=${facultyId}&${facultyContext()}`)
      .then(res => { setMyAllocations(res.data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  if (loading) return <div style={css.loadingWrap}>Validating Allocation Servers...</div>;

  return (
    <div style={css.page}>
      <nav style={css.nav}>
        <div style={css.navBrand}>
          <div style={css.navLogo}><div style={css.navLogoInner} /></div>
          <span style={css.navTitle}>AcademiaPro</span>
        </div>
        <span style={css.navPageLabel}>Your Final Course Allotment View</span>
        <div style={css.navRight}>
          <div>
            <span style={css.navUserName}>{localStorage.getItem("userName") || "Faculty"}</span>
            <span style={css.navUserSub}>Schedule View</span>
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
        <h2 style={css.pageTitle}>Your Final Course Allotment View</h2>

        {myAllocations.length === 0 ? (
          <div style={css.emptyCard}>
            <h3 style={css.emptyTitle}>No Allotments Released Yet</h3>
            <p style={css.emptyText}>
              The administration has not yet published the finalized schedule draft for this semester. Please check back later.
            </p>
          </div>
        ) : (
          <div style={css.tableCard}>
            <div style={css.tableCardHeader}>
              <h3 style={css.tableCardTitle}>Your Final Course Allotment View</h3>
            </div>
            <p style={css.tableIntro}>Your officially released course assignments are detailed below:</p>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>Course Code</th>
                  <th style={css.th}>Course Title</th>
                  <th style={css.th}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {myAllocations.map((alloc, index) => (
                  <tr key={index} style={css.tdRow}>
                    <td style={css.tdBold}>{alloc.course_code}</td>
                    <td style={css.td}>{alloc.course_name}</td>
                    <td style={css.td}>{formatCredits(alloc.credits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
