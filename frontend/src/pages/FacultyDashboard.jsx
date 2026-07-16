import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const T = {
  pageBg:    '#EDF2F1',
  cardBg:    '#ffffff',
  teal:      '#006D64',
  tealDark:  '#004d46',
  tealGrad:  'linear-gradient(140deg, #1a7a65 0%, #006D64 100%)',
  tealLight: '#e6f4ea',
  border:    '#e2e8f0',
  textHead:  '#0F2926',
  textBody:  '#334155',
  textMuted: '#64748b',
  shadow:    '0 2px 12px rgba(0,0,0,0.06)',
  font:      "'Inter', 'Segoe UI', system-ui, sans-serif",
};

const css = {
  page:    { minHeight: '100vh', backgroundColor: T.pageBg, fontFamily: T.font },

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
  navLinks: { display: 'flex', gap: '28px', alignItems: 'center' },
  navLinkActive: {
    color: T.teal, fontWeight: '700', fontSize: '0.9rem',
    borderBottom: `2px solid ${T.teal}`, paddingBottom: '2px', cursor: 'default',
  },
  navLink: { color: T.textMuted, fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  navUserName: { fontSize: '0.88rem', fontWeight: '700', color: T.textHead, display: 'block', textAlign: 'right' },
  navUserRole: { fontSize: '0.75rem', color: T.textMuted, display: 'block', textAlign: 'right' },
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
  body: { maxWidth: '1100px', margin: '0 auto', padding: '36px 32px' },

  /* Hero */
  hero: {
    background: T.tealGrad, borderRadius: '22px',
    padding: '48px 52px', marginBottom: '32px', position: 'relative', overflow: 'hidden',
  },
  heroBadge: {
    display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff',
    borderRadius: '999px', padding: '5px 14px', fontSize: '0.72rem',
    fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px',
  },
  heroTitle: {
    color: '#fff', fontSize: '2.5rem', fontWeight: '900',
    letterSpacing: '-0.6px', margin: '0 0 14px', lineHeight: 1.15, maxWidth: '540px',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.78)', fontSize: '0.95rem',
    lineHeight: 1.65, maxWidth: '480px', margin: 0,
  },
  contextCard: { backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: '18px', padding: '18px 22px', marginBottom: '24px', boxShadow: T.shadow },
  contextTitle: { margin: '0 0 14px', color: T.textHead, fontSize: '0.95rem', fontWeight: '800' },
  contextControls: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  contextGroup: { display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 200px' },
  contextLabel: { color: T.textMuted, fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px' },
  select: { padding: '10px 12px', border: `1.5px solid ${T.border}`, borderRadius: '10px', backgroundColor: '#f8faf9', color: T.textBody, fontSize: '0.88rem' },

  /* Cards */
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  card: {
    backgroundColor: T.cardBg, borderRadius: '22px',
    padding: '36px 32px 32px', boxShadow: T.shadow,
    border: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'space-between', minHeight: '290px',
  },
  cardIconBox: {
    width: '64px', height: '64px', borderRadius: '18px',
    backgroundColor: '#f0f7f5', marginBottom: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardIconInner: { width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#c5ddd8' },
  cardTitle: { margin: '0 0 10px', color: T.textHead, fontSize: '1.1rem', fontWeight: '800', textAlign: 'center' },
  cardDesc: { color: T.textMuted, fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px', textAlign: 'center' },
  btnTeal: {
    padding: '13px 20px', background: T.tealGrad, color: '#fff',
    border: 'none', borderRadius: '14px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.94rem', width: '100%',
    boxShadow: '0 4px 14px rgba(0,109,100,0.22)',
  },
  btnOutline: {
    padding: '13px 20px', backgroundColor: T.cardBg, color: T.textHead,
    border: `1.5px solid ${T.border}`, borderRadius: '14px',
    cursor: 'pointer', fontWeight: '700', fontSize: '0.94rem', width: '100%',
  },
};

const toPdfSafeText = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\x20-\x7E]/g, "?");

const escapePdfText = (value) => toPdfSafeText(value)
  .replace(/\\/g, "\\\\")
  .replace(/\(/g, "\\(")
  .replace(/\)/g, "\\)");

const truncateText = (value, limit) => {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
};

const getSemesterReportLabel = (semesterName) => {
  const semesterNumber = Number(String(semesterName).match(/\d+/)?.[0]);
  if ([1, 3, 5].includes(semesterNumber)) return `Monsoon Semester - Semester ${semesterNumber}`;
  if ([2, 4, 6].includes(semesterNumber)) return `Winter Semester - Semester ${semesterNumber}`;
  return semesterName || "Semester";
};

const formatCredits = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const getCurrentAcademicYearStart = () => new Date().getFullYear();

const formatAcademicYear = (startYear) => `${startYear}-${startYear + 1}`;

const downloadFacultyAllocationPdf = ({ allocations, facultyName, activeSemester, academicYear, department }) => {
  const rowsPerPage = 24;
  const pages = [];
  const reportRows = allocations.map((alloc, index) => ({
    serial: index + 1,
    courseCode: alloc.course_code,
    courseName: alloc.course_name,
    credits: formatCredits(alloc.credits),
  }));

  for (let i = 0; i < Math.max(reportRows.length, 1); i += rowsPerPage) {
    pages.push(reportRows.slice(i, i + rowsPerPage));
  }

  const line = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rect = (x, y, width, height) => `${x} ${y} ${width} ${height} re S`;
  const fillRect = (x, y, width, height, gray = "0.94") => `q ${gray} g ${x} ${y} ${width} ${height} re f Q`;
  const text = (x, y, size, value, font = "F1") => `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
  const estimateWidth = (value, size, font = "F1") => toPdfSafeText(value).length * size * (font === "F2" ? 0.52 : 0.48);
  const centerText = (x, y, width, size, value, font = "F1") =>
    text(x + (width - estimateWidth(value, size, font)) / 2, y, size, value, font);
  const rightText = (x, y, width, size, value, font = "F1") =>
    text(x + width - estimateWidth(value, size, font), y, size, value, font);

  const table = {
    x: 40,
    y: 628,
    width: 515,
    headerHeight: 24,
    rowHeight: 22,
    columns: {
      serial: { x: 46, width: 29 },
      code: { x: 88, width: 58 },
      name: { x: 163, width: 170 },
      credits: { x: 344, width: 38 },
    },
    dividers: [82, 155, 337],
  };

  const pageStreams = pages.map((pageRows, pageIndex) => {
    const commands = [
      "0.7 w",
      centerText(0, 795, 595, 15, "NATIONAL INSTITUTE OF TECHNOLOGY CALICUT", "F2"),
      centerText(0, 774, 595, 13, "Course Allotment Report", "F2"),
      centerText(0, 755, 595, 11, `Faculty: ${facultyName}`, "F2"),
      line(210, 746, 385, 746),
      text(46, 718, 10, "Department", "F2"),
      text(132, 718, 10, `: ${department}`),
      text(340, 718, 10, "Academic Year", "F2"),
      text(428, 718, 10, `: ${academicYear}`),
      text(46, 698, 10, "Semester", "F2"),
      text(132, 698, 10, `: ${getSemesterReportLabel(activeSemester)}`),
      text(340, 698, 10, "Report Type", "F2"),
      text(428, 698, 10, ": Faculty Allocation"),
      line(40, 672, 555, 672),
      fillRect(table.x, table.y, table.width, table.headerHeight, "0.92"),
      rect(table.x, table.y - (pageRows.length || 1) * table.rowHeight, table.width, table.headerHeight + (pageRows.length || 1) * table.rowHeight),
      line(table.x, table.y, table.x + table.width, table.y),
      line(table.x, table.y + table.headerHeight, table.x + table.width, table.y + table.headerHeight),
      ...table.dividers.map((x) => line(x, table.y - (pageRows.length || 1) * table.rowHeight, x, table.y + table.headerHeight)),
      centerText(table.columns.serial.x, 635, table.columns.serial.width, 9, "Sl.", "F2"),
      centerText(table.columns.code.x, 635, table.columns.code.width, 9, "Course Code", "F2"),
      text(table.columns.name.x, 635, 9, "Course Name", "F2"),
      centerText(table.columns.credits.x, 635, table.columns.credits.width, 9, "Credits", "F2"),
    ];

    let y = 613;
    if (pageRows.length === 0) {
      commands.push(text(52, y, 9, "No published allocations available."));
    } else {
      pageRows.forEach((row) => {
        commands.push(line(table.x, y - 7, table.x + table.width, y - 7));
        commands.push(centerText(table.columns.serial.x, y, table.columns.serial.width, 9, row.serial));
        commands.push(text(table.columns.code.x, y, 9, truncateText(row.courseCode, 12)));
        commands.push(text(table.columns.name.x, y, 9, truncateText(row.courseName, 32)));
        commands.push(centerText(table.columns.credits.x, y, table.columns.credits.width, 9, row.credits));
        y -= table.rowHeight;
      });
    }

    commands.push(line(40, 44, 555, 44));
    commands.push(text(40, 28, 8, "Generated by Course Allocation Portal"));
    commands.push(rightText(486, 28, 69, 8, `Page ${pageIndex + 1} of ${pages.length}`));
    return commands.join("\n");
  });

  const objects = [];
  const pageObjectIds = [];
  const contentObjectIds = [];
  pageStreams.forEach((_, index) => {
    pageObjectIds.push(5 + index * 2);
    contentObjectIds.push(6 + index * 2);
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>";

  pageStreams.forEach((stream, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `faculty-allocation-${String(facultyName || "faculty").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const facultyId = localStorage.getItem("userId") || 1;
  const facultyName = localStorage.getItem("userName") || "Faculty";
  const currentAcademicYear = formatAcademicYear(getCurrentAcademicYearStart());
  const [academicYear, setAcademicYear] = useState(localStorage.getItem('facultyAcademicYear') || currentAcademicYear);
  const [department, setDepartment] = useState(localStorage.getItem('facultyDepartment') || '');
  const [semesterName, setSemesterName] = useState(localStorage.getItem('facultySemester') || 'Semester 1');
  const academicYears = useMemo(() => Array.from({ length: 10 }, (_, i) => formatAcademicYear(getCurrentAcademicYearStart() + i)), []);
  const departments = ['Computer Science & Engineering', 'Electronics and Communication Engineering', 'Electrical & Electronics Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Biotechnology Engineering', 'Production Engineering', 'Material Science and Engineering', 'Engineering Physics'];

  useEffect(() => {
    api.get('/admin/active-semester').then(({ data }) => {
      if (!localStorage.getItem('facultyAcademicYear')) setAcademicYear(data.academic_year || currentAcademicYear);
      if (!localStorage.getItem('facultyDepartment')) setDepartment(data.department || '');
      if (!localStorage.getItem('facultySemester')) setSemesterName(data.active_semester || 'Semester 1');
    }).catch(() => {});
  }, [currentAcademicYear]);

  useEffect(() => {
    localStorage.setItem('facultyAcademicYear', academicYear);
    localStorage.setItem('facultyDepartment', department);
    localStorage.setItem('facultySemester', semesterName);
  }, [academicYear, department, semesterName]);

  const contextParams = () => new URLSearchParams({ academic_year: academicYear, department, semester_name: semesterName }).toString();

  const handleDownloadAllocationReport = async () => {
    try {
      const [allocRes] = await Promise.all([
        api.get(`/faculty/my-allocations?faculty_id=${facultyId}&${contextParams()}`),
      ]);
      if (!allocRes.data.length) {
        alert("No published allocations are available for your account yet.");
        return;
      }
      downloadFacultyAllocationPdf({
        allocations: allocRes.data,
        facultyName,
        activeSemester: semesterName,
        academicYear,
        department: department || "Department not selected",
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Report download failed.";
      alert(detail);
    }
  };

  return (
    <div style={css.page}>
      {/* Navigation */}
      <nav style={css.nav}>
        <div style={css.navBrand}>
          <div style={css.navLogo}><div style={css.navLogoInner} /></div>
          <span style={css.navTitle}>AcademiaPro</span>
        </div>
        <div style={css.navLinks}>
          <span style={css.navLinkActive}>Workspace</span>
        </div>
        <div style={css.navRight}>
          <div>
            <span style={css.navUserName}>{localStorage.getItem("userName") || "Faculty"}</span>
            <span style={css.navUserRole}>Assistant Professor</span>
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

      {/* Page body */}
      <div style={css.body}>
        {/* Hero Banner */}
        <div style={css.hero}>
          <div style={css.heroBadge}>Faculty Portal</div>
          <h2 style={css.heroTitle}>Welcome to your Course Allotment Hub</h2>
          <p style={css.heroSub}>
            Please select an operational portal below to configure choices or inspect matching results.
          </p>
        </div>

        <div style={css.contextCard}>
          <h3 style={css.contextTitle}>Allocation Workspace</h3>
          <div style={css.contextControls}>
            <label style={css.contextGroup}><span style={css.contextLabel}>Academic Year</span><select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} style={css.select}>{academicYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
            <label style={css.contextGroup}><span style={css.contextLabel}>Department</span><select value={department} onChange={(e) => setDepartment(e.target.value)} style={css.select}><option value="">-- Select Department --</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label style={css.contextGroup}>
              <span style={css.contextLabel}>Semester</span>
              <select value={semesterName} onChange={(e) => setSemesterName(e.target.value)} style={css.select}>
                <optgroup label="Monsoon Semester">
                  {[1, 3, 5].map((item) => <option key={item} value={`Semester ${item}`}>{`Semester ${item}`}</option>)}
                </optgroup>
                <optgroup label="Winter Semester">
                  {[2, 4, 6].map((item) => <option key={item} value={`Semester ${item}`}>{`Semester ${item}`}</option>)}
                </optgroup>
              </select>
            </label>
          </div>
        </div>

        {/* Action Cards */}
        <div style={css.cardGrid}>
          <div style={css.card}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={css.cardIconBox}><div style={css.cardIconInner} /></div>
              <h3 style={css.cardTitle}>Configure Course Preferences</h3>
              <p style={css.cardDesc}>
                Set your semester workload limits and rank available course codes by preference value.
              </p>
            </div>
            <button onClick={() => navigate("/faculty-preferences")} style={css.btnTeal}>
              Open Preferences Form
            </button>
          </div>

          <div style={css.card}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={css.cardIconBox}><div style={css.cardIconInner} /></div>
              <h3 style={css.cardTitle}>View Final Schedule</h3>
              <p style={css.cardDesc}>
                Access your specific published allocation records once released by the department administration.
              </p>
            </div>
            <button onClick={() => navigate("/faculty-schedule")} style={css.btnOutline}>
              Open Schedule Board
            </button>
            <button
              onClick={handleDownloadAllocationReport}
              style={{ ...css.btnTeal, marginTop: '12px' }}
            >
              Download Allocation Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
