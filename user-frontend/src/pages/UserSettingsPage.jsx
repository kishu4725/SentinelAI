import { useState } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import { getStoredUserInfo } from '../services/apiService';
import { MOCK_ACTIVE_SESSIONS } from '../services/mockUserDashboardData';

export default function UserSettingsPage({ onNavigate }) {
  const storedUser = getStoredUserInfo();
  const [profile] = useState({
    name: storedUser?.name || storedUser?.username || 'Account User',
    email: storedUser?.email || storedUser?.username || 'user@sentinelai.io',
    username: storedUser?.username || 'user',
    role: storedUser?.role || 'Website Owner',
  });

  const [activeSessions, setActiveSessions] = useState(MOCK_ACTIVE_SESSIONS);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);


  const handleRevokeSession = (id) => {
    setActiveSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'All password fields are required' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPasswordStatus({ type: 'success', text: 'Password changed successfully! (Mock Mode)' });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordStatus(null), 3000);
  };

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="settings">
      <div className="user-dashboard-container">
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Account Security & Preferences</h2>
          <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Manage password, active devices, 2FA, and profile credentials</p>
        </div>

        <div className="user-grid-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="user-card">
              <div className="card-section-header">
                <h3 className="card-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Account Profile Information
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Full Name</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{profile.name}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Email Address</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{profile.email}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Username</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.15rem', fontFamily: 'ui-monospace, Consolas, monospace' }}>{profile.username}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Account Role</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4ade80', marginTop: '0.15rem' }}>{profile.role}</div>
                </div>
              </div>
            </div>

            <div className="user-card">
              <div className="card-section-header">
                <h3 className="card-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Change Account Password
                </h3>
              </div>

              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {passwordStatus && (
                  <div style={{ fontSize: '0.75rem', color: passwordStatus.type === 'success' ? '#4ade80' : '#f87171', padding: '0.4rem 0.6rem', background: 'rgba(30,41,59,0.5)', borderRadius: '4px' }}>
                    {passwordStatus.text}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Current Password</label>
                  <input
                    type="password"
                    className="form-input"
                    style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.775rem' }}
                    placeholder="••••••••••••"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.775rem' }}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Confirm New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.775rem' }}
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="quick-action-btn"
                  style={{ marginTop: '0.3rem', width: 'fit-content', padding: '0.4rem 0.85rem' }}
                >
                  Update Password
                </button>
              </form>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="user-card">
              <div className="card-section-header">
                <h3 className="card-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Active Authorized Devices
                </h3>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{activeSessions.length} Devices</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {activeSessions.map((sess) => (
                  <div
                    key={sess.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(51, 65, 85, 0.5)',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {sess.device}
                        {sess.current && (
                          <span style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', fontSize: '0.625rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                            Current
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {sess.location} • IP: {sess.ip} ({sess.lastActive})
                      </div>
                    </div>

                    {!sess.current && (
                      <button
                        type="button"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          fontSize: '0.675rem',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                        onClick={() => handleRevokeSession(sess.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="user-card">
              <div className="card-section-header">
                <h3 className="card-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Authentication & Notification Shield
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: '#f8fafc', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Two-Factor Authentication (2FA)</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Require authenticator app prompt on new logins</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={twoFactorAuth}
                    onChange={(e) => setTwoFactorAuth(e.target.checked)}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: '#f8fafc', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Security Email Alerts</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Receive immediate email notifications on blocked logins</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                  />
                </label>

                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.775rem', color: '#f8fafc', marginBottom: '0.25rem' }}>Security Alerts</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    🛡️ Security threat alerts and alarm sounds are managed exclusively by the SOC Admin Dashboard. You will be notified via email for critical events based on your notification preferences above.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserAppShell>
  );
}
