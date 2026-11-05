import { useState, useEffect, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import { subscribeThreatEvents } from '../services/socWebSocket';
import { ROUTES } from '../constants/routes';
import { stopAlertSound } from '../services/soundService';

const STORAGE_KEY = 'sentinel_soc_alerts';

function loadAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  try {
    // Keep only the latest 200 alerts to avoid storage bloat
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, 200)));
  } catch {
    // Ignore storage quota errors
  }
}

export default function AlertsPage({ onNavigate }) {
  const [alerts, setAlerts] = useState(() => loadAlerts());
  const [filter, setFilter] = useState('ALL');
  const seenEventIds = useRef(new Set(loadAlerts().map((a) => a.id)));

  // Persist alerts and notify the shared header/sidebar store.
  useEffect(() => {
    saveAlerts(alerts);
    window.dispatchEvent(new CustomEvent('sentinel_soc_alerts_changed', {
      detail: { source: 'alerts-page', alerts: alerts.slice(0, 200) },
    }));
  }, [alerts]);

  // Apply changes made from the header notification dropdown (e.g. Mark all read).
  useEffect(() => {
    const handleSharedAlertChanges = (event) => {
      const detail = event.detail;
      if (!detail || detail.source !== 'app-shell' || !Array.isArray(detail.alerts)) return;
      const nextAlerts = detail.alerts.slice(0, 200);
      seenEventIds.current = new Set(nextAlerts.map((alert) => alert.id));
      setAlerts(nextAlerts);
    };
    window.addEventListener('sentinel_soc_alerts_changed', handleSharedAlertChanges);
    return () => window.removeEventListener('sentinel_soc_alerts_changed', handleSharedAlertChanges);
  }, []);

  // Subscribe to live WebSocket threat events
  useEffect(() => {
    const unsub = subscribeThreatEvents((payload) => {
      if (!payload || !payload.event_id) return;
      if (seenEventIds.current.has(payload.event_id)) return;
      seenEventIds.current.add(payload.event_id);

      const riskScore = typeof payload.risk_score === 'number' ? payload.risk_score : 0;
      const eventType = payload.event_type || 'SECURITY_EVENT';
      const riskLevel = payload.risk_level || (riskScore >= 75 ? 'CRITICAL' : riskScore >= 55 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW');
      const sourceIp = payload.source_ip || 'Unknown IP';
      const location = payload.location || 'Unknown Location';
      const responseStatus = payload.response_status || 'MONITOR';
      const username = payload.username || payload.user || null;

      // Only log meaningful alerts (skip benign LOGIN_SUCCESS with low risk)
      if (eventType === 'LOGIN_SUCCESS' && riskScore < 40) return;

      const newAlert = {
        id: payload.event_id,
        title: `${riskScore >= 75 ? '🚨 CRITICAL' : riskScore >= 55 ? '⚠️ HIGH RISK' : riskScore >= 35 ? '🔶 MEDIUM RISK' : 'ℹ️ LOW RISK'}: ${eventType.replace(/_/g, ' ')}`,
        message: `Suspicious activity detected from IP ${sourceIp} (${location}).${username ? ` User: ${username}.` : ''} Risk Score: ${riskScore.toFixed(1)} | SOAR Action: ${responseStatus}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString(),
        unread: true,
        severity: riskLevel.toLowerCase(),
        riskScore,
        eventType,
        sourceIp,
        location,
        responseStatus,
        threatId: payload.threat_id || null,
      };

      setAlerts((prev) => prev.some((item) => item.id === newAlert.id) ? prev : [newAlert, ...prev].slice(0, 200));
    });

    return () => unsub();
  }, []);

  // Listen for new threat events dispatched from AppShell (for cross-component sync)
  useEffect(() => {
    const handler = (e) => {
      const payload = e.detail;
      if (!payload || !payload.event_id) return;
      if (seenEventIds.current.has(payload.event_id)) return;
      // Already handled by subscribeThreatEvents above — no double entry needed
    };
    window.addEventListener('sentinel_soc_new_threat', handler);
    return () => window.removeEventListener('sentinel_soc_new_threat', handler);
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return alert.unread;
    return alert.severity.toLowerCase() === filter.toLowerCase();
  });

  const toggleRead = (id) => {
    stopAlertSound();
    setAlerts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: !item.unread } : item))
    );
  };

  const markAllRead = () => {
    stopAlertSound();
    setAlerts((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const clearAll = () => {
    // Clear only the alert inbox. Threat and audit history in the backend is untouched.
    setAlerts([]);
    saveAlerts([]);
    window.dispatchEvent(new CustomEvent('sentinel_soc_alerts_changed', {
      detail: { source: 'alerts-page', alerts: [] },
    }));
  };

  const getSeverityStyle = (severity) => {
    if (severity === 'critical') return { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.35)', left: '#ef4444' };
    if (severity === 'high')     return { bg: 'rgba(249,115,22,0.15)', color: '#fb923c', border: 'rgba(249,115,22,0.35)', left: '#f97316' };
    if (severity === 'medium')   return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)', left: '#f59e0b' };
    return                              { bg: 'rgba(56,189,248,0.10)', color: '#38bdf8', border: 'rgba(56,189,248,0.25)', left: '#0ea5e9' };
  };

  const unreadCount = alerts.filter((a) => a.unread).length;

  return (
    <AppShell onNavigate={onNavigate} activeTab="alerts">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">Security Incident Alerts</h2>
            <p className="section-main-subtext">
              Live threat event stream — real-time alerts from user activity &amp; WebSocket telemetry
              {unreadCount > 0 && (
                <span style={{ marginLeft: '0.6rem', padding: '0.1rem 0.45rem', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.7rem', fontWeight: 700 }}>
                  {unreadCount} UNREAD
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="action-btn"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem' }}
              onClick={markAllRead}
            >
              Mark All as Read
            </button>
            <button
              type="button"
              className="action-btn"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
              onClick={clearAll}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="soc-card" style={{ padding: '0.5rem 0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['ALL', 'UNREAD', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  background: filter === f ? 'rgba(56,189,248,0.2)' : 'transparent',
                  color: filter === f ? '#38bdf8' : '#94a3b8',
                  border: filter === f ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {f}
                {f === 'UNREAD' && unreadCount > 0 && (
                  <span style={{ marginLeft: '0.3rem', background: '#ef4444', color: '#fff', borderRadius: '8px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 800 }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Alert List */}
        <div className="soc-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
                {alerts.length === 0
                  ? 'No alerts yet. Real alerts will appear here when users trigger security events.'
                  : 'No alerts match the selected filter.'}
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const s = getSeverityStyle(alert.severity);
                return (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      background: alert.unread ? 'rgba(30,41,59,0.7)' : 'rgba(15,23,42,0.4)',
                      border: `1px solid ${s.border}`,
                      borderLeft: `4px solid ${s.left}`,
                      borderRadius: '8px',
                      gap: '1rem',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                      {/* Severity Badge */}
                      <div style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          background: s.bg,
                          color: s.color,
                          border: `1px solid ${s.border}`,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {alert.severity}
                        </span>
                      </div>

                      {/* Alert Content */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: alert.unread ? '#f1f5f9' : '#cbd5e1' }}>
                            {alert.title}
                          </h4>
                          {alert.unread && (
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0, boxShadow: '0 0 6px #38bdf8' }} />
                          )}
                        </div>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          {alert.message}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.67rem', color: '#64748b' }}>
                            🕐 {alert.date} {alert.time}
                          </span>
                          <span style={{ fontSize: '0.67rem', color: '#64748b' }}>
                            🌐 {alert.sourceIp}
                          </span>
                          <span style={{ fontSize: '0.67rem', color: s.color, fontWeight: 700 }}>
                            Risk: {alert.riskScore?.toFixed(1)}
                          </span>
                          <span style={{ fontSize: '0.67rem', color: '#64748b' }}>
                            ID: {String(alert.id).substring(0, 16)}…
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="table-action-link"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }}
                        onClick={() => toggleRead(alert.id)}
                      >
                        {alert.unread ? 'Mark Read' : 'Mark Unread'}
                      </button>
                      {alert.threatId && (
                        <button
                          type="button"
                          className="table-action-link"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem', color: '#38bdf8' }}
                          onClick={() => onNavigate && onNavigate(ROUTES.THREAT_DETAILS + alert.threatId)}
                        >
                          Inspect →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
