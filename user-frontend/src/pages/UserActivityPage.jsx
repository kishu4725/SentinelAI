import { useState } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import { NORMAL_SECURITY_STATE, SUSPICIOUS_SECURITY_STATE, EVENT_TYPE_LABELS } from '../data/mockUserSecurityActivity';

export default function UserActivityPage({ onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [showSuspiciousLog, setShowSuspiciousLog] = useState(false);

  const activeEvents = showSuspiciousLog
    ? SUSPICIOUS_SECURITY_STATE.events
    : NORMAL_SECURITY_STATE.events;

  const filteredEvents = activeEvents.filter((evt) => {
    const label = EVENT_TYPE_LABELS[evt.eventType] || evt.eventType;
    const matchesSearch =
      label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.browser.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.ip.includes(searchTerm);
    const matchesRisk = riskFilter === 'ALL' || evt.riskLevel.toLowerCase() === riskFilter.toLowerCase();
    return matchesSearch && matchesRisk;
  });

  const getRiskBadge = (risk) => {
    let bg = 'rgba(74, 222, 128, 0.15)';
    let color = '#4ade80';
    let border = 'rgba(74, 222, 128, 0.3)';

    if (risk === 'High' || risk === 'Critical') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = 'rgba(239, 68, 68, 0.3)';
    } else if (risk === 'Medium') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
    } else if (risk === 'Normal' || risk === 'Secure') {
      bg = 'rgba(56, 189, 248, 0.15)';
      color = '#38bdf8';
      border = 'rgba(56, 189, 248, 0.3)';
    }

    return (
      <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: bg, color, border: `1px solid ${border}`, fontSize: '0.675rem', fontWeight: 700 }}>
        {risk}
      </span>
    );
  };

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="activity">
      <div className="user-dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Security Activity Log</h2>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Audit trail of your account verification checks, logins, and resource interactions</p>
          </div>


          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', fontWeight: 600 }}>Dataset View:</span>
            <button
              type="button"
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.675rem',
                borderRadius: '4px',
                fontWeight: 700,
                cursor: 'pointer',
                border: !showSuspiciousLog ? '1px solid #4ade80' : '1px solid transparent',
                background: !showSuspiciousLog ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                color: !showSuspiciousLog ? '#4ade80' : '#64748b'
              }}
              onClick={() => setShowSuspiciousLog(false)}
            >
              Standard Activity
            </button>
            <button
              type="button"
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.675rem',
                borderRadius: '4px',
                fontWeight: 700,
                cursor: 'pointer',
                border: showSuspiciousLog ? '1px solid #f87171' : '1px solid transparent',
                background: showSuspiciousLog ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: showSuspiciousLog ? '#f87171' : '#64748b'
              }}
              onClick={() => setShowSuspiciousLog(true)}
            >
              Flagged Anomalies
            </button>
          </div>
        </div>

        <div className="user-card" style={{ padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.2rem', padding: '0.35rem 0.65rem 0.35rem 2.2rem', fontSize: '0.775rem' }}
                placeholder="Search activity by event, device, location, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748b' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>

            <select
              className="time-filter-select"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="Secure">Secure</option>
              <option value="Normal">Normal</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div className="user-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="user-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Activity Event</th>
                  <th>Device / Browser</th>
                  <th>IP Address</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Risk Rating</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No activity events match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ color: '#94a3b8', fontSize: '0.725rem', fontFamily: 'ui-monospace, Consolas, monospace' }}>{evt.timestamp}</td>
                      <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {EVENT_TYPE_LABELS[evt.eventType] || evt.eventType}
                      </td>
                      <td style={{ color: '#cbd5e1' }}>{evt.device} ({evt.browser})</td>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#38bdf8' }}>{evt.ip}</td>
                      <td style={{ color: '#94a3b8' }}>{evt.location}</td>
                      <td>
                        <span className={`status-tag ${evt.status.toLowerCase()}`}>
                          {evt.status}
                        </span>
                      </td>
                      <td>{getRiskBadge(evt.riskLevel)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </UserAppShell>
  );
}

