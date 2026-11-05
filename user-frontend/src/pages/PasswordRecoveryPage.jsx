import { useState } from 'react';
import { ROUTES } from '../constants/routes';
import { requestPasswordRecovery, resetPassword } from '../services/apiService';
import './PasswordRecoveryPage.css';

export default function PasswordRecoveryPage({ onNavigate }) {
  const [step, setStep] = useState('REQUEST'); // 'REQUEST' | 'RESET'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const validateRequestForm = () => {
    if (!email.trim()) {
      setError('Email address is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }
    setError(null);
    return true;
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setError(null);

    if (!validateRequestForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await requestPasswordRecovery(email.trim());
      setStep('RESET');
      setStatusMessage({
        type: 'success',
        text: res.message || `Recovery verification code dispatched to ${email.trim()}. Please enter your code below.`
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No registered user account found with this email address.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setError(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter a 6-digit recovery code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPassword(email.trim(), otpCode.trim(), newPassword);
      setStatusMessage({
        type: 'success',
        text: res.message || 'Password updated successfully! Redirecting to Sign In...'
      });
      setTimeout(() => {
        if (onNavigate) onNavigate(ROUTES.LOGIN);
      }, 1500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Password reset failed. Invalid or expired recovery code.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="recovery-container">
      <div className="recovery-card">
        <div className="recovery-header">
          <div className="brand-badge">
            <span className="pulse-dot"></span>
            USER RECOVERY PORTAL
          </div>
          <div className="brand-logo-container">
            <svg className="brand-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="url(#logo-grad-rec)" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 7L16 11H13V17H11V11H8L12 7Z" fill="#ffffff"/>
              <defs>
                <linearGradient id="logo-grad-rec" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0284c7" />
                  <stop offset="1" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="brand-title">Recover Account Password</h1>
          <p className="brand-subtitle">
            {step === 'RESET'
              ? 'Enter the 6-digit OTP code and your new password'
              : 'Enter your registered email address to receive a secure password recovery code.'}
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

        {step === 'REQUEST' ? (
          <form className="recovery-form" onSubmit={handleRequestSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="recovery-email">
                Registered Email Address
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  id="recovery-email"
                  type="email"
                  className={`form-input ${error ? 'input-error' : ''}`}
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isLoading}
                />
              </div>
              {error && <span className="field-error">{error}</span>}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  CHECKING DATABASE...
                </>
              ) : (
                <>
                  SEND RECOVERY LINK
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        ) : (
          <form className="recovery-form" onSubmit={handleResetSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="otp-code">
                6-Digit Recovery OTP
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="otp-code"
                  type="text"
                  maxLength={6}
                  className={`form-input ${error ? 'input-error' : ''}`}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={isLoading}
                  style={{ letterSpacing: '0.25em', fontSize: '1.2rem', textAlign: 'center' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                New Password
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="new-password"
                  type="password"
                  className={`form-input ${error ? 'input-error' : ''}`}
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <input
                  id="confirm-password"
                  type="password"
                  className={`form-input ${error ? 'input-error' : ''}`}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error && <span className="field-error">{error}</span>}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  RESETTING PASSWORD...
                </>
              ) : (
                <>
                  UPDATE & RESET PASSWORD
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        <div className="recovery-footer">
          <a
            href={ROUTES.LOGIN}
            className="back-link"
            onClick={(e) => {
              e.preventDefault();
              if (onNavigate) onNavigate(ROUTES.LOGIN);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Sign In
          </a>
          <div className="sec-disclaimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Secured with AI-Driven Threat Telemetry & Zero-Trust Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}

