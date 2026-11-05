import { useState } from 'react';
import { ROUTES } from '../constants/routes';
import { loginAdmin } from '../services/apiService';
import './LoginPage.css';

export default function AdminLoginPage({ onNavigate }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  const validateForm = () => {
    const newErrors = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'SOC Admin Email or Username is required';
    }
    if (!password) {
      newErrors.password = 'Security key/password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await loginAdmin(identifier.trim(), password);
      setStatusMessage({
        type: 'success',
        text: 'SOC Admin credentials authenticated! Entering Command Center...'
      });
      setTimeout(() => {
        if (onNavigate) onNavigate(ROUTES.SOC_DASHBOARD);
      }, 500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'SOC Admin authentication failed. Invalid security key or username.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card" style={{ borderColor: 'rgba(79, 70, 229, 0.4)' }}>
        <div className="login-header">
          <div className="brand-badge" style={{ background: 'rgba(79, 70, 229, 0.15)', color: '#818cf8', borderColor: 'rgba(79, 70, 229, 0.4)' }}>
            <span className="pulse-dot" style={{ background: '#818cf8' }}></span>
            AUTHORIZED PERSONNEL ONLY • SOC NODE
          </div>
          <div className="brand-logo-container">
            <svg className="brand-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="url(#admin-logo-grad)" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 7L16 11H13V17H11V11H8L12 7Z" fill="#ffffff"/>
              <defs>
                <linearGradient id="admin-logo-grad" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4f46e5" />
                  <stop offset="1" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="brand-title">SOC Command Center</h1>
          <p className="brand-subtitle">
            Security Operations Center • Analyst & System Administration Node
          </p>
        </div>

        {statusMessage && (
          <div className={`alert-banner ${statusMessage.type}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-identifier">
              SOC Admin Email / Username
            </label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="admin-identifier"
                type="text"
                className={`form-input ${errors.identifier ? 'input-error' : ''}`}
                placeholder="analyst@sentinel.ai"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: null }));
                }}
                disabled={isLoading}
              />
            </div>
            {errors.identifier && <span className="field-error">{errors.identifier}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Security Key / Password
            </label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div style={{ background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.25)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.7rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0.85rem 0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>AUTHORIZED PERSONNEL ONLY • CLASSIFIED SYSTEM • ALL ACCESS LOGGED</span>
          </div>

          <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }} disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                AUTHENTICATING SOC NODE...
              </>
            ) : (
              <>
                SIGN IN TO SOC NODE
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="sec-disclaimer" style={{ marginTop: '0.2rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Protected by AI Anomaly Detection & End-to-End Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
}
