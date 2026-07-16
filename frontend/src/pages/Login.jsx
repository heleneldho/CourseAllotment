import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "290347264256-4qhafkfuo4kfrjgd4721gjab3nj2ibnj.apps.googleusercontent.com";

/* ─── Design Tokens ─── */
const T = {
  pageBg:       'linear-gradient(145deg, #c5e0d8 0%, #daeee8 35%, #eaf2ef 65%, #f2f6f4 100%)',
  cardBg:       '#ffffff',
  teal:         '#006D64',
  tealDark:     '#004d46',
  tealLight:    '#e6f4ea',
  border:       '#e2e8f0',
  textHead:     '#0F2926',
  textBody:     '#334155',
  textMuted:    '#64748b',
  shadow:       '0 8px 40px rgba(0,0,0,0.10)',
  radius:       '24px',
  font:         "'Inter', 'Segoe UI', system-ui, sans-serif",
};

const css = {
  page: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: T.pageBg,
    fontFamily: T.font, padding: '24px',
  },
  card: {
    backgroundColor: T.cardBg, padding: '48px 40px 40px',
    borderRadius: T.radius, boxShadow: T.shadow,
    textAlign: 'center', width: '100%', maxWidth: '380px',
    border: `1px solid ${T.border}`,
  },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: '20px' },
  logo: {
    width: '56px', height: '56px', borderRadius: '16px',
    background: `linear-gradient(145deg, #2a9e85, ${T.teal})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoInner: {
    width: '26px', height: '26px', borderRadius: '8px',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  badge: {
    display: 'inline-block', backgroundColor: T.tealLight,
    color: T.teal, border: `1px solid #b2ddd6`,
    borderRadius: '999px', padding: '4px 14px',
    fontSize: '0.72rem', fontWeight: '700',
    letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: '14px',
  },
  heading: {
    color: T.textHead, margin: '0 0 8px', fontSize: '1.7rem',
    fontWeight: '800', letterSpacing: '-0.4px', lineHeight: 1.2,
  },
  subtext: { color: T.textMuted, marginBottom: '28px', fontSize: '0.88rem', lineHeight: 1.6 },
  btnPrimary: {
    padding: '15px 20px',
    background: `linear-gradient(145deg, #2a9e85, ${T.teal})`,
    color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.97rem', width: '100%',
    boxShadow: `0 4px 16px rgba(0,109,100,0.28)`, marginBottom: '12px',
    letterSpacing: '0.1px',
  },
  btnSecondary: {
    padding: '15px 20px', backgroundColor: T.cardBg,
    color: T.textHead, border: `1.5px solid ${T.border}`,
    borderRadius: '14px', cursor: 'pointer',
    fontWeight: '700', fontSize: '0.97rem', width: '100%',
    letterSpacing: '0.1px',
  },
  divider: { height: '1px', backgroundColor: T.border, margin: '24px 0' },
  footerNote: { color: T.textMuted, fontSize: '0.78rem' },
  signingAsRow: {
    color: T.textBody, marginBottom: '6px', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap',
  },
  roleTagFaculty: {
    display: 'inline-block', backgroundColor: '#eff6ff', color: '#1e40af',
    border: '1px solid #bfdbfe', borderRadius: '999px',
    padding: '4px 12px', fontSize: '0.78rem', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.8px',
  },
  roleTagAdmin: {
    display: 'inline-block', backgroundColor: T.tealLight, color: T.teal,
    border: '1px solid #9fd5c9', borderRadius: '999px',
    padding: '4px 12px', fontSize: '0.78rem', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.8px',
  },
  verifyText: { color: T.textMuted, fontSize: '0.83rem', marginBottom: '24px', lineHeight: 1.5 },
  googleWrap: { display: 'flex', justifyContent: 'center', marginBottom: '20px' },
  authError: {
    color: '#b42318',
    backgroundColor: '#fff1f0',
    border: '1px solid #ffccc7',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '0.82rem',
    lineHeight: 1.45,
    marginBottom: '18px',
  },
  btnChangeRole: {
    backgroundColor: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: '0.88rem', padding: '6px 10px', borderRadius: '8px',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [authError, setAuthError] = useState('');
  const googleSetupError = selectedRole && !GOOGLE_CLIENT_ID
    ? "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in the frontend environment."
    : selectedRole && !window.google
      ? "Google sign-in could not load. Check your network connection and try again."
      : "";

  const chooseRole = (role) => {
    setAuthError('');
    setSelectedRole(role);
  };

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      const res = await api.post("/auth/google-login", {
        credential_token: response.credential,
        chosen_role: selectedRole
      });
      localStorage.setItem("token", "true");
      localStorage.setItem("userRole", res.data.role);
      localStorage.setItem("userName", res.data.name);
      localStorage.setItem("userEmail", res.data.email);
      localStorage.setItem("userId", res.data.user_id);
      if (res.data.role === "admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/faculty-dashboard");
      }
    } catch (err) {
      console.error("Authentication failed:", err);
      setAuthError(err.response?.data?.detail || "Sign-In verification failed.");
      setSelectedRole(null);
    }
  }, [navigate, selectedRole]);

  useEffect(() => {
    /* global google */
    if (!selectedRole) return;
    if (googleSetupError) return;

    const targetDiv = document.getElementById("googleSignInBtn");
    if (targetDiv) targetDiv.innerHTML = "";
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById("googleSignInBtn"),
      { theme: "outline", size: "large", width: "300" }
    );
  }, [googleSetupError, handleCredentialResponse, selectedRole]);

  return (
    <div style={css.page}>
      <div style={css.card}>
        <div style={css.logoWrap}>
          <div style={css.logo}><div style={css.logoInner} /></div>
        </div>
        <div style={css.badge}>Academic System</div>
        <h1 style={css.heading}>Course Allotment Portal</h1>

        {!selectedRole ? (
          <>
            <p style={css.subtext}>Please select your target interface destination to sign in:</p>
            {authError && <p style={css.authError}>{authError}</p>}
            <button onClick={() => chooseRole("faculty")} style={css.btnPrimary}>
              Login as Faculty Member
            </button>
            <button onClick={() => chooseRole("admin")} style={css.btnSecondary}>
              Login as System Administrator
            </button>
            <div style={css.divider} />
            <p style={css.footerNote}>Secure Enterprise Authentication via Google Identity</p>
          </>
        ) : (
          <>
            <div style={css.divider} />
            <p style={css.signingAsRow}>
              Signing in as:&nbsp;
              <span style={selectedRole === 'admin' ? css.roleTagAdmin : css.roleTagFaculty}>
                {selectedRole.toUpperCase()}
              </span>
            </p>
            <p style={css.verifyText}>Please complete your official Google identity verification below.</p>
            {(authError || googleSetupError) && <p style={css.authError}>{authError || googleSetupError}</p>}
            <div style={css.googleWrap} id="googleSignInBtn" />
            <div style={css.divider} />
            <button onClick={() => setSelectedRole(null)} style={css.btnChangeRole}>
              &larr; Change selected role
            </button>
          </>
        )}
      </div>
    </div>
  );
}
