import { useState } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import { NORMAL_SECURITY_STATE, SUSPICIOUS_SECURITY_STATE } from '../data/mockUserSecurityActivity';

export default function UserAlertsPage({ onNavigate }) {
  const [isSuspiciousState, setIsSuspiciousState] = useState(false);
  const [alerts, setAlerts] = useState(() =>
    isSuspiciousState ? SUSPICIOUS_SECURITY_STATE.alerts : NORMAL_SECURITY_STATE.alerts
  );
  const [filter, setFilter] = useState('ALL');

  const handleToggleState = (suspicious) => {
    setIsSuspiciousState(suspicious);
    setAlerts(suspicious ? SUSPICIOUS_SECURITY_STATE.alerts : NORMAL_SECURITY_STATE.alerts);
  };

  const filteredAlerts = alerts.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return item.unread;
    return item.severity.toLowerCase() === filter.toLowerCase();
  });

  const toggleRead = (id) => {
    setAlerts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: !item.unread } : item))
    );
  };

  const getSeverityPill = (sev) => {
    let bg = 'rgba(56, 189, 248, 0.15)';
    let color = '#38bdf8';
    let border = 'rgba(56, 189, 248, 0.3)';

    if (sev === 'High' || sev === 'Critical') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = 'rgba(239, 68, 68, 0.3)';
    } else if (sev === 'Medium') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
    }

    return (
      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: bg, color, border: `1px solid ${border}`, fontSize: '0.675rem', fontWeight: 700 }}>
        {sev}
      </span>
    );
  };

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="alerts">
      <div className="user-dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Account Security Alerts</h2>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Notifications regarding account sign-ins, device changes, and security verifications</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.2rem 0.4rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>Simulate State:</span>
              <button
                type="button"
                style={{
                  padding: '0.15rem 0.45rem',
                  fontSize: '0.65rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: !isSuspiciousState ? '1px solid #16a34a' : '1px solid transparent',
                  background: !isSuspiciousState ? '#dcfce7' : 'transparent',
                  color: !isSuspiciousState ? '#16a34a' : '#64748b'
                }}
                onClick={() => handleToggleState(false)}
              >
                Normal
              </button>
              <button
                type="button"
                style={{
                  padding: '0.15rem 0.45rem',
                  fontSize: '0.65rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSuspiciousState ? '1px solid #dc2626' : '1px solid transparent',
                  background: isSuspiciousState ? '#fef2f2' : 'transparent',
                  color: isSuspiciousState ? '#dc2626' : '#64748b'
                }}
                onClick={() => handleToggleState(true)}
              >
                Suspicious State
              </button>
            </div>

            <button
              type="button"
              className="quick-action-btn"
              onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })))}
            >
              Mark All Read
            </button>
          </div>
        </div>

        <div className="user-card" style={{ padding: '0.5rem 0.85rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['ALL', 'UNREAD', 'HIGH', 'MEDIUM', 'NORMAL'].map((f) => (
              <button
                key={f}
                type="button"
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  background: filter === f ? '#e0f2fe' : 'transparent',
                  color: filter === f ? '#0284c7' : '#64748b',
                  border: filter === f ? '1px solid #7dd3fc' : '1px solid transparent',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="user-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  No active security alerts
                </div>
                <div style={{ fontSize: '0.775rem', color: '#475569' }}>
                  Your account is fully protected. SentinelAI will notify you immediately if any suspicious activity is detected.
                </div>
              </div>

            ) : (
              filteredAlerts.map((al) => (
                <div
                  key={al.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.85rem 1rem',
                    background: al.unread ? 'rgba(30, 41, 59, 0.6)' : 'rgba(15, 23, 42, 0.4)',
                    border: al.unread ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(30, 41, 59, 0.5)',
                    borderLeft: al.unread ? '3px solid #f87171' : '3px solid #475569',
                    borderRadius: '6px',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '0.15rem' }}>{getSeverityPill(al.severity)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: al.unread ? '#ffffff' : '#cbd5e1' }}>
                          {al.title}
                        </h4>
                        {al.unread && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171' }} />}
                      </div>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#94a3b8', lineHeight: 1.45 }}>
                        {al.message}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                        {al.device && <span>Device: <strong style={{ color: '#cbd5e1' }}>{al.device}</strong></span>}
                        {al.location && <span>Location: <strong style={{ color: '#38bdf8' }}>{al.location}</strong></span>}
                        {al.ip && <span>IP: <strong style={{ color: '#94a3b8' }}>{al.ip}</strong></span>}
                        <span>Time: {al.time}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="quick-action-btn"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                    onClick={() => toggleRead(al.id)}
                  >
                    {al.unread ? 'Dismiss' : 'Mark Unread'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </UserAppShell>
  );
}

