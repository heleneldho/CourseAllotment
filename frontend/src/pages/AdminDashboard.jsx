import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  green:     '#16a34a',
  red:       '#dc2626',
  shadow:    '0 2px 12px rgba(0,0,0,0.06)',
  font:      "'Inter', 'Segoe UI', system-ui, sans-serif",
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

const getCurrentAcademicYearStart = () => new Date().getFullYear();

const formatAcademicYear = (startYear) => `${startYear}-${startYear + 1}`;

const formatCost = (value) => {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
};

const formatCredits = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const sortAllocationsByCourse = (rows) => [...(rows || [])].sort((a, b) => {
  const codeCompare = String(a.course_code || "").localeCompare(String(b.course_code || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (codeCompare !== 0) return codeCompare;
  return String(a.course_name || "").localeCompare(String(b.course_name || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
});

const downloadAllocationPdf = ({ allocations, department, academicYear, activeSemester }) => {
  const rowsPerPage = 24;
  const pages = [];
  const semesterLabel = getSemesterReportLabel(activeSemester);
  const reportRows = allocations.map((alloc, index) => ({
    serial: index + 1,
    courseCode: alloc.course_code,
    courseName: alloc.course_name,
    credits: formatCredits(alloc.credits),
    facultyName: alloc.faculty_name,
  }));

  for (let i = 0; i < Math.max(reportRows.length, 1); i += rowsPerPage) {
    pages.push(reportRows.slice(i, i + rowsPerPage));
  }

  const line = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rect = (x, y, width, height) => `${x} ${y} ${width} ${height} re S`;
  const fillRect = (x, y, width, height, gray = "0.94") => `q ${gray} g ${x} ${y} ${width} ${height} re f Q`;
  const text = (x, y, size, value, font = "F1") => `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
  const estimateWidth = (value, size, font = "F1") => {
    const fontFactor = font === "F2" ? 0.52 : 0.48;
    return toPdfSafeText(value).length * size * fontFactor;
  };
  const centerText = (x, y, width, size, value, font = "F1") =>
    text(x + (width - estimateWidth(value, size, font)) / 2, y, size, value, font);
  const rightText = (x, y, width, size, value, font = "F1") =>
    text(x + width - estimateWidth(value, size, font), y, size, value, font);
  const table = {
    x: 40,
    y: 650,
    width: 515,
    headerHeight: 24,
    rowHeight: 22,
    columns: {
      serial: { x: 46, width: 29 },
      code: { x: 88, width: 58 },
      name: { x: 163, width: 170 },
      credits: { x: 344, width: 38 },
      faculty: { x: 396, width: 142 },
    },
    dividers: [82, 155, 337, 388],
  };

  const pageStreams = pages.map((pageRows, pageIndex) => {
    const commands = [
      "0.7 w",
      centerText(0, 795, 595, 15, "NATIONAL INSTITUTE OF TECHNOLOGY CALICUT", "F2"),
      centerText(0, 774, 595, 13, "Course Allotment Report", "F2"),
      line(210, 765, 385, 765),
      text(46, 735, 10, "Department", "F2"),
      text(132, 735, 10, `: ${department}`),
      text(340, 735, 10, "Academic Year", "F2"),
      text(428, 735, 10, `: ${academicYear}`),
      text(46, 715, 10, "Semester", "F2"),
      text(132, 715, 10, `: ${semesterLabel}`),
      text(340, 715, 10, "Report Type", "F2"),
      text(428, 715, 10, ": Draft Allocation"),
      line(40, 690, 555, 690),
      fillRect(table.x, table.y, table.width, table.headerHeight, "0.92"),
      rect(table.x, table.y - (pageRows.length || 1) * table.rowHeight, table.width, table.headerHeight + (pageRows.length || 1) * table.rowHeight),
      line(table.x, table.y, table.x + table.width, table.y),
      line(table.x, table.y + table.headerHeight, table.x + table.width, table.y + table.headerHeight),
      ...table.dividers.map((x) => line(x, table.y - (pageRows.length || 1) * table.rowHeight, x, table.y + table.headerHeight)),
      centerText(table.columns.serial.x, 657, table.columns.serial.width, 9, "Sl.", "F2"),
      centerText(table.columns.code.x, 657, table.columns.code.width, 9, "Course Code", "F2"),
      text(table.columns.name.x, 657, 9, "Course Name", "F2"),
      centerText(table.columns.credits.x, 657, table.columns.credits.width, 9, "Credits", "F2"),
      text(table.columns.faculty.x, 657, 9, "Faculty", "F2"),
    ];

    let y = 635;
    if (pageRows.length === 0) {
      commands.push(text(52, y, 9, "No draft allocations available."));
    } else {
      pageRows.forEach((row) => {
        commands.push(line(table.x, y - 7, table.x + table.width, y - 7));
        commands.push(centerText(table.columns.serial.x, y, table.columns.serial.width, 9, row.serial));
        commands.push(text(table.columns.code.x, y, 9, truncateText(row.courseCode, 12)));
        commands.push(text(table.columns.name.x, y, 9, truncateText(row.courseName, 32)));
        commands.push(centerText(table.columns.credits.x, y, table.columns.credits.width, 9, row.credits));
        commands.push(text(table.columns.faculty.x, y, 9, truncateText(row.facultyName, 24)));
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
  link.download = `course-allotment-${String(activeSemester || "semester").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const css = {
  page: { minHeight: '100vh', backgroundColor: T.pageBg, fontFamily: T.font, display: 'flex' },

  /* ── Sidebar ── */
  sidebar: {
    width: '220px', flexShrink: 0,
    backgroundColor: T.cardBg, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', padding: '20px 0', minHeight: '100vh',
  },
  sidebarBrand: { display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 20px 28px' },
  sidebarLogo: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: `linear-gradient(145deg, #2a9e85, ${T.teal})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sidebarLogoInner: { width: '16px', height: '16px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.35)' },
  sidebarTitle: { fontWeight: '800', fontSize: '1rem', color: T.textHead },
  sidebarNav: { flex: 1, padding: '0 12px' },
  sidebarItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '10px', marginBottom: '2px',
    cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none',
    backgroundColor: active ? T.tealLight : 'transparent',
    color: active ? T.teal : T.textMuted,
    fontWeight: active ? '700' : '500', fontSize: '0.9rem',
    fontFamily: T.font,
  }),
  sidebarFooter: {
    margin: '16px 12px 0', padding: '18px',
    background: T.tealGrad, borderRadius: '16px', color: '#fff',
  },
  sidebarFooterLabel: {
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.72)',
    fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: '0.8px', display: 'block', marginBottom: '4px',
  },
  sidebarFooterTitle: { fontWeight: '800', fontSize: '1rem', display: 'block', marginBottom: '14px' },
  sidebarFooterNote: {
    fontSize: '0.74rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.4, display: 'block',
  },

  /* ── Main ── */
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' },

  /* Top nav (themed consistently with the rest of the app) */
  nav: {
    backgroundColor: T.cardBg, borderBottom: `1px solid ${T.border}`,
    padding: '0 32px', height: '62px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
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
  content: { padding: '28px 32px', flex: 1 },

  pageHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '24px',
  },
  headerBtns: { display: 'flex', gap: '12px' },
  btnTealSmall: {
    padding: '9px 18px', background: T.tealGrad, color: '#fff',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.85rem', fontFamily: T.font,
    boxShadow: '0 2px 10px rgba(0,109,100,0.2)',
  },

  /* Term card */
  termCard: {
    backgroundColor: T.cardBg, borderRadius: '20px',
    border: `1px solid ${T.border}`, padding: '24px 28px',
    marginBottom: '24px', boxShadow: T.shadow,
  },
  termTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' },
  termLabel: {
    fontSize: '0.70rem', fontWeight: '700', color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px',
  },
  termValueRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  termDot: { width: '40px', height: '40px', borderRadius: '12px', backgroundColor: T.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  termDotInner: { width: '18px', height: '18px', borderRadius: '5px', backgroundColor: '#9fd5c9' },
  termValue: { fontWeight: '900', fontSize: '1.5rem', color: T.textHead, letterSpacing: '-0.3px' },
  termWelcome: {
    marginTop: '28px', padding: '18px 20px',
    borderRadius: '16px', backgroundColor: '#f0f7f5',
    border: '1px solid #cfe7df',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '18px', flexWrap: 'wrap',
  },
  termWelcomeTitle: { margin: 0, color: T.textHead, fontWeight: '800', fontSize: '1.02rem' },
  termWelcomeText: { margin: '5px 0 0', color: T.textMuted, fontSize: '0.86rem', lineHeight: 1.5 },
  termWelcomeBadge: {
    padding: '8px 14px', borderRadius: '999px',
    backgroundColor: '#d9f2ea', color: T.teal,
    fontWeight: '800', fontSize: '0.78rem', whiteSpace: 'nowrap',
    border: '1px solid #b5ded2',
  },
  termControls: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  termSelectGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  termControlLabel: {
    fontSize: '0.68rem', fontWeight: '800', color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.8px',
  },
  select: {
    padding: '9px 14px', borderRadius: '10px',
    border: `1.5px solid ${T.border}`, backgroundColor: '#f8faf9',
    color: T.textBody, fontSize: '0.88rem', cursor: 'pointer', outline: 'none', fontFamily: T.font,
    maxWidth: '260px',
  },
  btnTransition: {
    padding: '9px 20px', background: T.tealGrad, color: '#fff',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.88rem', fontFamily: T.font,
    boxShadow: '0 2px 10px rgba(0,109,100,0.2)',
  },

  /* Two-column layout */
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', marginBottom: '24px' },
  statCol: { display: 'flex', flexDirection: 'column', gap: '16px' },
  statCard: {
    background: 'linear-gradient(145deg, #0b7a67 0%, #006D64 100%)',
    borderRadius: '18px',
    border: '1px solid rgba(0,109,100,0.18)', padding: '20px 22px',
    display: 'flex', alignItems: 'center', gap: '14px', boxShadow: T.shadow,
  },
  statIconBox: {
    width: '44px', height: '44px', borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.18)', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statIconInner: {
    width: '20px', height: '20px', borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  statLabel: { color: 'rgba(255,255,255,0.76)', fontSize: '0.8rem', display: 'block', marginBottom: '4px' },
  statValue: { fontWeight: '900', fontSize: '1.7rem', color: '#fff', display: 'block', letterSpacing: '-0.5px' },

  /* Action cards */
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  actionCard: (active) => ({
    background: active ? T.tealGrad : T.cardBg,
    borderRadius: '18px',
    border: active ? 'none' : `1px solid ${T.border}`,
    padding: '22px 20px',
    boxShadow: active ? '0 8px 24px rgba(0,109,100,0.25)' : T.shadow,
    display: 'flex', flexDirection: 'column', gap: '8px',
  }),
  actionIconBox: (active) => ({
    width: '44px', height: '44px', borderRadius: '12px',
    backgroundColor: active ? 'rgba(255,255,255,0.18)' : T.tealLight,
    marginBottom: '4px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  actionIconInner: (active) => ({
    width: '20px', height: '20px', borderRadius: '6px',
    backgroundColor: active ? 'rgba(255,255,255,0.35)' : '#9fd5c9',
  }),
  actionTitle: (active) => ({
    fontWeight: '800', fontSize: '0.94rem', margin: 0,
    color: active ? '#fff' : T.textHead,
  }),
  actionDesc: (active) => ({
    color: active ? 'rgba(255,255,255,0.72)' : T.textMuted,
    fontSize: '0.82rem', lineHeight: 1.5,
  }),
  actionLink: (active) => ({
    color: active ? '#fff' : T.teal,
    fontWeight: '700', fontSize: '0.84rem',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', padding: 0, fontFamily: T.font,
    marginTop: '4px',
  }),
  fileInput: { display: 'block', fontSize: '0.78rem', color: T.textMuted, marginBottom: '6px', cursor: 'pointer' },
  hiddenFileInput: { display: 'none' },
  filePickerRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  fileName: {
    color: T.textMuted,
    fontSize: '0.78rem',
    fontWeight: '700',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  /* Table card */
  tableCard: {
    backgroundColor: T.cardBg, borderRadius: '20px',
    border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: T.shadow,
  },
  tableCardHeader: {
    padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '16px', flexWrap: 'wrap',
  },
  tableCardTitle: { fontWeight: '800', fontSize: '1rem', color: T.textHead, margin: 0 },
  costCard: {
    backgroundColor: T.cardBg, borderRadius: '20px',
    border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: T.shadow,
    marginTop: '24px',
  },
  btnCost: {
    padding: '9px 16px', backgroundColor: '#f0f7f5', color: T.teal,
    border: '1px solid #b5ded2', borderRadius: '10px', cursor: 'pointer',
    fontWeight: '800', fontSize: '0.82rem', fontFamily: T.font,
  },
  actionButtonRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' },
  facultyUploadTools: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
    marginTop: '2px',
  },
  uploadStatus: (ready) => ({
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '5px 10px',
    borderRadius: '999px',
    backgroundColor: ready ? '#dcfce7' : '#f8fafc',
    color: ready ? '#166534' : T.textMuted,
    border: ready ? '1px solid #bbf7d0' : `1px solid ${T.border}`,
    fontSize: '0.74rem',
    fontWeight: '800',
  }),
  facultyFileRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: '8px',
  },
  facultyActionRow: {
    display: 'grid',
    gridTemplateColumns: '0.85fr 0.85fr 1.3fr',
    gap: '8px',
    alignItems: 'center',
  },
  actionButton: (active) => ({
    color: active ? '#fff' : T.teal,
    fontWeight: '700', fontSize: '0.82rem',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: active ? 'rgba(255,255,255,0.12)' : '#f0f7f5',
    border: active ? '1px solid rgba(255,255,255,0.22)' : '1px solid #b5ded2',
    borderRadius: '10px', padding: '7px 12px', fontFamily: T.font,
    justifyContent: 'center',
    minHeight: '34px',
    whiteSpace: 'nowrap',
  }),
  actionButtonPrimary: {
    color: '#fff',
    fontWeight: '800', fontSize: '0.82rem',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
    background: T.tealGrad,
    border: 'none',
    borderRadius: '10px', padding: '7px 14px', fontFamily: T.font,
    minHeight: '34px',
    boxShadow: '0 2px 10px rgba(0,109,100,0.18)',
  },
  capacityCard: {
    backgroundColor: T.cardBg, borderRadius: '20px',
    border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: T.shadow,
    marginBottom: '24px',
  },
  capacityInput: {
    width: '62px', padding: '8px 10px', borderRadius: '10px',
    border: `1.5px solid ${T.border}`, backgroundColor: '#f8faf9',
    color: T.textBody, fontSize: '0.88rem', outline: 'none', fontFamily: T.font,
    textAlign: 'center',
  },
  capacityStepper: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  stepperButtons: { display: 'flex', flexDirection: 'column', gap: '3px' },
  stepperButton: {
    width: '24px', height: '18px', borderRadius: '6px',
    border: '1px solid #b5ded2', backgroundColor: '#f0f7f5',
    color: T.teal,
    fontSize: '0.62rem',
    lineHeight: 1,
    fontWeight: '900',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  editControls: {
    display: 'inline-flex',
    gap: '8px',
    alignItems: 'center',
  },
  facultyEditCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  inlineSelect: {
    padding: '8px 10px',
    borderRadius: '10px',
    border: `1.5px solid ${T.border}`,
    backgroundColor: '#f8faf9',
    color: T.textBody,
    fontSize: '0.82rem',
    outline: 'none',
    fontFamily: T.font,
    minWidth: 0,
  },
  btnSaveSmall: {
    color: '#fff',
    fontWeight: '800',
    fontSize: '0.78rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.tealGrad,
    border: 'none',
    borderRadius: '10px',
    padding: '8px 12px',
    fontFamily: T.font,
    whiteSpace: 'nowrap',
  },
  btnSecondarySmall: {
    color: T.teal,
    fontWeight: '800',
    fontSize: '0.78rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f7f5',
    border: '1px solid #b5ded2',
    borderRadius: '10px',
    padding: '8px 12px',
    fontFamily: T.font,
    whiteSpace: 'nowrap',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 18px', textAlign: 'left',
    fontSize: '0.70rem', fontWeight: '700',
    color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px',
    backgroundColor: '#f8faf9', borderBottom: `1px solid ${T.border}`,
  },
  tdRow: { borderBottom: '1px solid #f5f8f7' },
  td: { padding: '14px 18px', fontSize: '0.88rem', color: T.textBody, verticalAlign: 'middle' },
  tdBold: { padding: '14px 18px', fontSize: '0.88rem', color: T.textHead, fontWeight: '700', verticalAlign: 'middle' },
  emptyCell: { padding: '40px', textAlign: 'center', color: T.textMuted, fontStyle: 'italic', fontSize: '0.88rem' },

  pillOpted: {
    backgroundColor: '#dcfce7', color: '#166534',
    padding: '4px 12px', borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: '700', display: 'inline-block',
  },
  pillForced: {
    backgroundColor: '#ffedd5', color: '#9a3412',
    padding: '4px 12px', borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: '700', display: 'inline-block',
  },
  pillLive: {
    backgroundColor: '#dbeafe', color: '#1e40af',
    padding: '4px 12px', borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: '600', display: 'inline-block', marginLeft: '6px',
  },
  pillDraft: {
    backgroundColor: '#f3f4f6', color: T.textMuted,
    padding: '4px 12px', borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: '600', display: 'inline-block', marginLeft: '6px',
  },
  pillModified: {
    backgroundColor: '#fef9c3', color: '#854d0e',
    padding: '4px 12px', borderRadius: '999px',
    fontSize: '0.74rem', fontWeight: '700', display: 'inline-block', marginLeft: '6px',
  },
};

export default function AdminDashboard() {
  const [courseFile, setCourseFile] = useState(null);
  const [facultyFile, setFacultyFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [showFinalCost, setShowFinalCost] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({ total_courses: 0, active_faculty: 0 });
  const [activeSemester, setActiveSemester] = useState("Semester 1");
  const [newSemesterInput, setNewSemesterInput] = useState("");
  const [capacityPanelOpen, setCapacityPanelOpen] = useState(false);
  const [facultyCapacities, setFacultyCapacities] = useState([]);
  const [capacitiesSaved, setCapacitiesSaved] = useState(false);
  const [courseCatalogUploaded, setCourseCatalogUploaded] = useState(false);
  const [facultyRosterUploaded, setFacultyRosterUploaded] = useState(false);
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [editingAllocationKey, setEditingAllocationKey] = useState(null);
  const [editFacultyText, setEditFacultyText] = useState("");
  const currentAcademicYear = formatAcademicYear(getCurrentAcademicYearStart());
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [department, setDepartment] = useState("");
  
  const courseFileRef = useRef(null);
  const facultyFileRef = useRef(null);
  const finalCostRef = useRef(null);
  const academicYears = useMemo(() => {
    const startYear = getCurrentAcademicYearStart();
    return Array.from({ length: 10 }, (_, i) => formatAcademicYear(startYear + i));
  }, []);
  const departments = [
    "Computer Science & Engineering",
    "Electronics and Communication Engineering",
    "Electrical & Electronics Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Biotechnology Engineering",
    "Production Engineering",
    "Material Science and Engineering",
    "Engineering Physics",
  ];
  const hasDraftAllocations = allocations.some((alloc) => !alloc.is_published);
  const finalCostRows = useMemo(() => {
    const totals = new Map();

    allocations.forEach((alloc) => {
      const key = alloc.faculty_email || alloc.faculty_name;
      const current = totals.get(key) || {
        faculty: alloc.faculty_name,
        totalCost: 0,
      };

      current.totalCost += Number(alloc.dissatisfaction_score || 0);
      totals.set(key, current);
    });

    return Array.from(totals.values()).sort((a, b) => a.faculty.localeCompare(b.faculty));
  }, [allocations]);

  const clearUploadInputs = () => {
    setCourseFile(null);
    setFacultyFile(null);
    if (courseFileRef.current) courseFileRef.current.value = "";
    if (facultyFileRef.current) facultyFileRef.current.value = "";
  };

  const fetchAllocations = async () => {
    try {
      const res = await api.get("/admin/current-allocations");
      const sortedRows = sortAllocationsByCourse(res.data);
      setAllocations(sortedRows);
      return sortedRows;
    } catch (err) { console.error(err); }
    return [];
  };

  const fetchActiveSemester = async () => {
    try {
      const res = await api.get("/admin/active-semester");
      setActiveSemester(res.data.active_semester);
      setAcademicYear(res.data.academic_year || currentAcademicYear);
      setDepartment(res.data.department || "");
    } catch (err) { console.error(err); }
  };

  const fetchDashboardStats = async (updateCounts = true) => {
    try {
      const res = await api.get("/admin/dashboard-stats");
      if (updateCounts) {
        setDashboardStats({
          total_courses: res.data.total_courses ?? 0,
          active_faculty: res.data.active_faculty ?? 0,
        });
        setCourseCatalogUploaded(Number(res.data.total_courses || 0) > 0);
      }
      setActiveSemester(res.data.active_semester);
      setAcademicYear(res.data.academic_year || currentAcademicYear);
      setDepartment(res.data.department || "");
    } catch (err) { console.error(err); }
  };

  const fetchFacultyCapacities = async () => {
    try {
      const res = await api.get("/admin/faculty-capacities");
      const facultyRows = res.data.faculty || [];
      setFacultyCapacities(facultyRows);
      setFacultyRosterUploaded(facultyRows.length > 0);
      setCapacitiesSaved(Boolean(res.data.saved));
    } catch (err) { console.error(err); }
  };

  const fetchFacultyOptions = async () => {
    try {
      const res = await api.get("/admin/allocation-faculty-options");
      setFacultyOptions(res.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchActiveSemester();
    fetchAllocations();
    fetchDashboardStats();
    fetchFacultyCapacities();
    fetchFacultyOptions();
  }, []);

  const getAllocationRowKey = (alloc, index) => (
    alloc.allocation_id ? `allocation-${alloc.allocation_id}` : `row-${index}`
  );

  const startAllocationEdit = (alloc, index) => {
    setEditingAllocationKey(getAllocationRowKey(alloc, index));
    setEditFacultyText(alloc.faculty_name || "");
  };

  const cancelAllocationEdit = () => {
    setEditingAllocationKey(null);
    setEditFacultyText("");
  };

  const downloadExcel = async (endpoint, filename) => {
    try {
      const res = await api.get(`/admin/${endpoint}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Download failed.";
      alert(`Download error: ${detail}`);
    }
  };

  const saveReportContext = async () => {
    const year = String(academicYear || "").trim();
    const dept = String(department || "").trim();
    if (!year || !dept) {
      alert("Please select academic year and department first.");
      return false;
    }

    await api.put("/admin/report-context", {
      academic_year: year,
      department: dept,
    });
    return true;
  };

  const changeReportContext = async (nextAcademicYear, nextDepartment) => {
    setAcademicYear(nextAcademicYear);
    setDepartment(nextDepartment);
    if (!nextAcademicYear || !nextDepartment) return;
    try {
      await api.put("/admin/report-context", {
        academic_year: nextAcademicYear,
        department: nextDepartment,
      });
      clearUploadInputs();
      setShowFinalCost(false);
      await Promise.all([fetchAllocations(), fetchDashboardStats(), fetchFacultyCapacities(), fetchFacultyOptions()]);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Could not switch workspace.";
      alert(detail);
    }
  };

  const handleCapacityChange = (email, value) => {
    const parsed = parseInt(value, 10);
    setFacultyCapacities((rows) => rows.map((row) => (
      row.email === email
        ? { ...row, capacity: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) }
        : row
    )));
    setCapacitiesSaved(false);
  };

  const stepFacultyCapacity = (email, delta) => {
    setFacultyCapacities((rows) => rows.map((row) => (
      row.email === email
        ? { ...row, capacity: Math.max(0, Number(row.capacity || 0) + delta) }
        : row
    )));
    setCapacitiesSaved(false);
  };

  const saveFacultyCapacities = async () => {
    if (facultyCapacities.length === 0) {
      alert("Upload the faculty list before setting capacities.");
      return;
    }
    try {
      const res = await api.put("/admin/faculty-capacities", {
        capacities: facultyCapacities.map((row) => ({
          faculty_email: row.email,
          capacity: Number(row.capacity || 0),
        })),
      });
      alert(res.data.message);
      setCapacitiesSaved(true);
      await fetchFacultyCapacities();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Capacity save failed.";
      alert(detail);
    }
  };

  const handleSemesterTransition = async () => {
    if (!newSemesterInput) { alert("Please select a target semester!"); return; }
    const confirmRun = window.confirm(`Switch to ${newSemesterInput}? Current temporary preferences and courses will clear, but historical profile scores remain safe.`);
    if (!confirmRun) return;
    try {
      const res = await api.post("/admin/start-new-semester", { new_semester_name: newSemesterInput });
      alert(res.data.message);
      setActiveSemester(newSemesterInput);
      setDashboardStats((stats) => ({ ...stats, total_courses: 0 }));
      setShowFinalCost(false);
      setNewSemesterInput("");
      clearUploadInputs();
      await fetchAllocations();
      await fetchDashboardStats();
      await fetchFacultyCapacities();
      await fetchFacultyOptions();
    } catch (err) { alert("Transition failed."); }
  };

  const handleUpload = async (endpoint, file) => {
    if (!file) { alert("Select a file first!"); return; }
    const contextSaved = await saveReportContext();
    if (!contextSaved) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post(`/admin/${endpoint}`, formData);
      alert(res.data.message);
      await fetchAllocations();
      await fetchDashboardStats();
      if (endpoint === "upload-faculty") {
        await fetchFacultyCapacities();
        await fetchFacultyOptions();
        setFacultyFile(null);
        if (facultyFileRef.current) facultyFileRef.current.value = "";
      }
      if (endpoint === "upload-courses") {
        setCourseCatalogUploaded(true);
        setCourseFile(null);
        if (courseFileRef.current) courseFileRef.current.value = "";
      }
      setShowFinalCost(false);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Upload failed.";
      alert(`Upload error: ${detail}`);
    }
  };

  const runEngine = async () => {
    setLoading(true);
    try {
      const contextSaved = await saveReportContext();
      if (!contextSaved) return;
      const res = await api.post("/admin/run-allocation");
      alert(res.data.message);
      await fetchAllocations();
      await fetchDashboardStats();
      setShowFinalCost(false);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Allocation Error";
      alert(detail);
    } finally { setLoading(false); }
  };

  const publishSchedule = async () => {
    try {
      const contextSaved = await saveReportContext();
      if (!contextSaved) return;
      const res = await api.post("/admin/publish-allocation");
      alert(res.data.message);
      await fetchAllocations();
      await fetchDashboardStats();
      setShowFinalCost(false);
    } catch (err) { alert("Publish failed."); }
  };

  const saveAllocationEdit = async (alloc) => {
    const typedFaculty = editFacultyText.trim();
    if (!typedFaculty) {
      alert("Type a faculty name before saving.");
      return;
    }
    try {
      const selectedFaculty = facultyOptions.find(
        (faculty) => (
          String(faculty.name || "").trim().toLowerCase() === typedFaculty.toLowerCase()
          || String(faculty.email || "").trim().toLowerCase() === typedFaculty.toLowerCase()
        )
      );
      const payload = {
        allocation_id: alloc.allocation_id || null,
        course_id: alloc.course_id || null,
        current_faculty_id: alloc.faculty_id || null,
        current_faculty_name: alloc.faculty_name || null,
        faculty_id: selectedFaculty?.id || null,
        faculty_name: typedFaculty,
      };
      const res = alloc.allocation_id
        ? await api.put(`/admin/draft-allocations/${alloc.allocation_id}`, payload)
        : await api.post("/admin/manual-allocation-edit", payload);
      await fetchAllocations();
      alert(res.data.message);
      cancelAllocationEdit();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Allocation update failed.";
      alert(detail);
    }
  };

  const handleFinalCostToggle = () => {
    if (showFinalCost) {
      setShowFinalCost(false);
      return;
    }

    setShowFinalCost(true);
    setTimeout(() => {
      finalCostRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleDownloadReport = async () => {
    if (allocations.length === 0) {
      alert("Run the engine first to generate draft allocations.");
      return;
    }
    if (!department || !academicYear) {
      alert("Please select academic year and department before downloading the report.");
      return;
    }
    const contextSaved = await saveReportContext();
    if (!contextSaved) return;

    downloadAllocationPdf({ allocations, department, academicYear, activeSemester });
  };

  return (
    <div style={css.page}>
      {/* Sidebar */}
      <aside style={css.sidebar}>
        <div style={css.sidebarBrand}>
          <div style={css.sidebarLogo}><div style={css.sidebarLogoInner} /></div>
          <span style={css.sidebarTitle}>AcademiaPro</span>
        </div>
        <nav style={css.sidebarNav}>
          <button style={css.sidebarItem(true)}>Dashboard</button>
        </nav>
        <div style={css.sidebarFooter}>
          <span style={css.sidebarFooterLabel}>Current Term</span>
          <span style={css.sidebarFooterTitle}>{activeSemester}</span>
          <span style={css.sidebarFooterNote}>
            Use the term switcher on the dashboard to transition semesters.
          </span>
        </div>
      </aside>

      {/* Main */}
      <div style={css.main}>
        {/* Top nav (themed consistently with the rest of the app) */}
        <nav style={css.nav}>
          <div style={css.navBrand}>
            <div style={css.navLogo}><div style={css.navLogoInner} /></div>
            <span style={css.navTitle}>AcademiaPro</span>
          </div>
          <span style={css.navPageLabel}>System Administration Panel</span>
          <div style={css.navRight}>
            <div>
              <span style={css.navUserName}>{localStorage.getItem("userName") || "Admin"}</span>
              <span style={css.navUserSub}>Administrator</span>
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

        {/* Content */}
        <div style={css.content}>
          <div style={css.pageHeader}>
            <div style={css.headerBtns}>
              <button style={css.btnTealSmall}>New Term</button>
            </div>
          </div>

          {/* Term card + stat cards */}
          <div style={css.twoCol}>
            <div style={css.termCard}>
              <div style={css.termTopRow}>
                <div>
                  <span style={css.termLabel}>Active Academic Term:</span>
                  <div style={css.termValueRow}>
                    <div style={css.termDot}><div style={css.termDotInner} /></div>
                    <span style={css.termValue}>{activeSemester}</span>
                  </div>
                </div>
                <div style={css.termControls}>
                  <div style={css.termSelectGroup}>
                    <span style={css.termControlLabel}>Academic Year</span>
                    <select
                      value={academicYear}
                      onChange={(e) => changeReportContext(e.target.value, department)}
                      style={css.select}
                    >
                      <option value="">-- Select Academic Year --</option>
                      {academicYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div style={css.termSelectGroup}>
                    <span style={css.termControlLabel}>Department</span>
                    <select
                      value={department}
                      onChange={(e) => changeReportContext(academicYear, e.target.value)}
                      style={css.select}
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div style={css.termSelectGroup}>
                    <span style={css.termControlLabel}>Semester</span>
                    <select
                      value={newSemesterInput}
                      onChange={(e) => setNewSemesterInput(e.target.value)}
                      style={css.select}
                    >
                      <option value="">-- Switch Term --</option>
                      <optgroup label="Monsoon Semester">
                        {[1, 3, 5].map((semester) => (
                          <option key={semester} value={`Semester ${semester}`}>{`Semester ${semester}`}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Winter Semester">
                        {[2, 4, 6].map((semester) => (
                          <option key={semester} value={`Semester ${semester}`}>{`Semester ${semester}`}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <button
                    onClick={handleSemesterTransition}
                    style={css.btnTransition}
                  >
                    Transition
                  </button>
                </div>
              </div>
              <div style={css.termWelcome}>
                <div>
                  <p style={css.termWelcomeTitle}>Welcome back, {localStorage.getItem("userName") || "Admin"}</p>
                  <p style={css.termWelcomeText}>
                    {activeSemester} workspace is ready for course uploads, reusable faculty roster updates, allocation runs, and schedule publishing.
                  </p>
                </div>
                <span style={css.termWelcomeBadge}>Administration Ready</span>
              </div>
            </div>
            <div style={css.statCol}>
              <div style={css.statCard}>
                <div style={css.statIconBox}><div style={css.statIconInner} /></div>
                <div>
                  <span style={css.statLabel}>Total Courses</span>
                  <span style={css.statValue}>{dashboardStats.total_courses}</span>
                </div>
              </div>
              <div style={css.statCard}>
                <div style={css.statIconBox}><div style={css.statIconInner} /></div>
                <div>
                  <span style={css.statLabel}>Active Faculty</span>
                  <span style={css.statValue}>{dashboardStats.active_faculty}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div style={css.actionGrid}>
            {/* Upload Courses */}
            <div style={css.actionCard(false)}>
              <div style={css.actionIconBox(false)}><div style={css.actionIconInner(false)} /></div>
              <p style={css.actionTitle(false)}>Upload {activeSemester} Courses</p>
              <p style={css.actionDesc(false)}>Load semester curriculum</p>
              <span style={css.uploadStatus(courseCatalogUploaded)}>
                {courseCatalogUploaded ? "Course file uploaded" : "No course file uploaded"}
              </span>
              <input
                ref={courseFileRef}
                type="file"
                accept=".xlsx,.xls"
                onClick={(e) => {
                  e.target.value = "";
                  setCourseFile(null);
                }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  setCourseFile(file);
                }}
                style={css.fileInput}
              />
              <div style={css.actionButtonRow}>
                <button style={css.actionButton(false)} onClick={() => handleUpload("upload-courses", courseFile)}>
                  Upload
                </button>
                <button
                  type="button"
                  style={css.actionButton(false)}
                  onClick={() => downloadExcel("template/courses", "course_upload_template.xlsx")}
                >
                  Template
                </button>
              </div>
            </div>

            {/* Sync Faculty */}
            <div style={css.actionCard(false)}>
              <div style={css.actionIconBox(false)}><div style={css.actionIconInner(false)} /></div>
              <p style={css.actionTitle(false)}>Sync Faculty Directory</p>
              <p style={css.actionDesc(false)}>Update faculty roster records.</p>
              <div style={css.facultyUploadTools}>
                <span style={css.uploadStatus(facultyRosterUploaded)}>
                  {facultyRosterUploaded
                    ? "File uploaded"
                    : "No faculty file uploaded"}
                </span>
                <div style={css.facultyFileRow}>
                  <input
                    ref={facultyFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onClick={(e) => {
                      e.target.value = "";
                      setFacultyFile(null);
                    }}
                    onChange={(e) => setFacultyFile(e.target.files[0])}
                    style={css.fileInput}
                  />
                  <button style={css.actionButtonPrimary} onClick={() => handleUpload("upload-faculty", facultyFile)}>
                    Sync
                  </button>
                </div>
                <div style={css.facultyActionRow}>
                  <button
                    type="button"
                    style={css.actionButton(false)}
                    onClick={() => downloadExcel("template/faculty", "faculty_upload_template.xlsx")}
                  >
                    Template
                  </button>
                  <button
                    type="button"
                    style={css.actionButton(false)}
                    onClick={() => downloadExcel("faculty-roster/download", "current_faculty_roster.xlsx")}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    style={css.actionButton(false)}
                    onClick={async () => {
                      await fetchFacultyCapacities();
                      setCapacityPanelOpen((open) => !open);
                    }}
                  >
                    {capacityPanelOpen ? "Hide Capacity" : capacitiesSaved ? "Edit Capacity" : "Add Capacity"}
                  </button>
                </div>
              </div>
            </div>

            {/* Run Engine */}
            <div style={css.actionCard(true)}>
              <div style={css.actionIconBox(true)}><div style={css.actionIconInner(true)} /></div>
              <p style={css.actionTitle(true)}>Run Engine ({activeSemester})</p>
              <p style={css.actionDesc(true)}>Process allotment algorithms.</p>
              <button style={css.actionLink(true)} onClick={runEngine} disabled={loading}>
                {loading ? "Calculating..." : hasDraftAllocations ? "Re-run Engine" : "Run Engine"}
              </button>
            </div>

            {/* Publish */}
            <div style={css.actionCard(false)}>
              <div style={css.actionIconBox(false)}><div style={css.actionIconInner(false)} /></div>
              <p style={css.actionTitle(false)}>Publish Schedule</p>
              <p style={css.actionDesc(false)}>Release results to faculty.</p>
              <button style={css.actionLink(false)} onClick={publishSchedule}>
                Publish Schedule &rarr;
              </button>
            </div>
          </div>

          {capacityPanelOpen && (
            <div style={css.capacityCard}>
              <div style={css.tableCardHeader}>
                <h3 style={css.tableCardTitle}>Faculty Capacity for {activeSemester}</h3>
                <button type="button" style={css.btnCost} onClick={saveFacultyCapacities}>
                  Save Capacities
                </button>
              </div>
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.th}>Faculty</th>
                    <th style={css.th}>Email</th>
                    <th style={css.th}>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyCapacities.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={css.emptyCell}>
                        Upload the faculty Excel file first.
                      </td>
                    </tr>
                  ) : (
                    facultyCapacities.map((faculty) => (
                      <tr key={faculty.email} style={css.tdRow}>
                        <td style={css.tdBold}>{faculty.name}</td>
                        <td style={css.td}>{faculty.email}</td>
                        <td style={css.td}>
                          <div style={css.capacityStepper}>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={faculty.capacity}
                              onChange={(e) => handleCapacityChange(faculty.email, e.target.value.replace(/\D/g, ""))}
                              style={css.capacityInput}
                            />
                            <div style={css.stepperButtons}>
                              <button
                                type="button"
                                style={css.stepperButton}
                                onClick={() => stepFacultyCapacity(faculty.email, 1)}
                              aria-label={`Increase capacity for ${faculty.name}`}
                            >
                              ▲
                            </button>
                              <button
                                type="button"
                                style={css.stepperButton}
                                onClick={() => stepFacultyCapacity(faculty.email, -1)}
                              aria-label={`Decrease capacity for ${faculty.name}`}
                            >
                              ▼
                            </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Results Table */}
          <div style={css.tableCard}>
            <div style={css.tableCardHeader}>
              <h3 style={css.tableCardTitle}>Schedule Results for {activeSemester}</h3>
              {allocations.length > 0 && (
                <div style={css.headerBtns}>
                  <button
                    type="button"
                    style={css.btnCost}
                    onClick={handleDownloadReport}
                  >
                    Download Report
                  </button>
                  <button
                    type="button"
                    style={css.btnCost}
                    onClick={handleFinalCostToggle}
                  >
                    {showFinalCost ? "Hide Final Cost" : "View Final Cost"}
                  </button>
                </div>
              )}
            </div>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>Course</th>
                  <th style={css.th}>Credits</th>
                  <th style={css.th}>Assigned Faculty</th>
                  <th style={css.th}>Status</th>
                  <th style={css.th}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr><td colSpan="5" style={css.emptyCell}>No data computed yet for {activeSemester}.</td></tr>
                ) : (
                  allocations.map((alloc, idx) => {
                    const rowKey = getAllocationRowKey(alloc, idx);
                    return (
                    <tr key={rowKey} style={css.tdRow}>
                      <td style={css.tdBold}>{alloc.course_code} - {alloc.course_name}</td>
                      <td style={css.td}>{formatCredits(alloc.credits)}</td>
                      <td style={css.td}>
                        {editingAllocationKey === rowKey ? (
                          <div style={css.facultyEditCell}>
                            <input
                              type="text"
                              list="faculty-edit-options"
                              value={editFacultyText}
                              onChange={(e) => setEditFacultyText(e.target.value)}
                              style={css.inlineSelect}
                              autoFocus
                            />
                            <div style={css.editControls}>
                              <button
                                type="button"
                                style={css.btnSaveSmall}
                                onClick={() => saveAllocationEdit(alloc)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={css.btnSecondarySmall}
                                onClick={cancelAllocationEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={css.facultyEditCell}>
                            <span>{alloc.faculty_name}</span>
                            <button
                              type="button"
                              style={css.btnSecondarySmall}
                              onClick={() => startAllocationEdit(alloc, idx)}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={css.td}>
                        {alloc.is_manually_edited ? (
                          <span style={css.pillModified}>MODIFIED</span>
                        ) : (
                          <>
                            <span style={alloc.is_forced ? css.pillForced : css.pillOpted}>
                              {alloc.is_forced ? "FORCED" : "OPTED"}
                            </span>
                            <span style={alloc.is_published ? css.pillLive : css.pillDraft}>
                              {alloc.is_published ? "LIVE" : "DRAFT"}
                            </span>
                          </>
                        )}
                      </td>
                      <td style={css.td}>{formatCost(alloc.dissatisfaction_score)} pts</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <datalist id="faculty-edit-options">
              {facultyOptions.map((faculty) => (
                <option
                  key={faculty.id}
                  value={faculty.name}
                />
              ))}
            </datalist>
          </div>

          {allocations.length > 0 && showFinalCost && (
            <div ref={finalCostRef} style={css.costCard}>
              <div style={css.tableCardHeader}>
                <h3 style={css.tableCardTitle}>Final Cost by Faculty</h3>
              </div>
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.th}>Faculty</th>
                    <th style={css.th}>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {finalCostRows.map((row) => (
                    <tr key={row.faculty} style={css.tdRow}>
                      <td style={css.tdBold}>{row.faculty}</td>
                      <td style={css.td}>{formatCost(row.totalCost)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
