import { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { fetchSocLogs, fetchSocThreats } from '../services/apiService';

export default function LogsPage({ onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      setIsLoading(true);
      setError(null);
      try {
        const [auditLogs, threatFeed] = await Promise.all([
          fetchSocLogs().catch(() => []),
          fetchSocThreats({ limit: 50 }).catch(() => ({ adapted: [] })),
        ]);

        if (isMounted) {
          let combinedLogs = [];

          if (Array.isArray(auditLogs) && auditLogs.length > 0) {
            combinedLogs = auditLogs.map((log) => ({
              id: log.log_id || `LOG-${log.id}`,
              time: log.timestamp || new Date().toISOString(),
              ipAddress: log.source_ip || '0.0.0.0',
              event: log.action || log.summary || 'SOAR_POLICY_AUDIT',
              risk: log.risk_score >= 75 ? 'HIGH' : log.risk_score >= 40 ? 'MEDIUM' : 'LOW',
              severityClass: log.risk_score >= 75 ? 'high' : log.risk_score >= 40 ? 'medium' : 'low',
            }));
          }

          const threatLogs = (threatFeed.adapted || []).map((t) => ({
            id: t.eventId || t.id,
            time: t.time || new Date().toISOString(),
            ipAddress: t.ipAddress || '0.0.0.0',
            event: t.event || t.attackType || 'SECURITY_EVENT',
            risk: (t.severity || 'LOW').toUpperCase(),
            severityClass: (t.severity || 'low').toLowerCase(),
          }));

          const logMap = new Map();
          [...combinedLogs, ...threatLogs].forEach((item) => {
            if (!logMap.has(item.id)) {
              logMap.set(item.id, item);
            }
          });

          setLogs(Array.from(logMap.values()));
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to connect to live SOC backend logs API');
          setIsLoading(false);
        }
      }
    }

    loadLogs();

    const handleNewThreatEvent = (evt) => {
      if (evt && evt.detail) {
        const payload = evt.detail;
        const newLog = {
          id: payload.event_id,
          time: payload.timestamp || new Date().toISOString(),
          ipAddress: payload.source_ip || '0.0.0.0',
          event: payload.event_type || 'SECURITY_EVENT',
          risk: (payload.risk_level || 'LOW').toUpperCase(),
          severityClass: (payload.risk_level || 'low').toLowerCase(),
        };
        setLogs((prev) => [newLog, ...prev.filter((l) => l.id !== newLog.id)]);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sentinel_soc_new_threat', handleNewThreatEvent);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('sentinel_soc_new_threat', handleNewThreatEvent);
      }
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (log.id && log.id.toLowerCase().includes(searchLower)) ||
      (log.ipAddress && log.ipAddress.includes(searchTerm)) ||
      (log.event && log.event.toLowerCase().includes(searchLower));
    const matchesRisk = riskFilter === 'ALL' || log.risk.toLowerCase() === riskFilter.toLowerCase();
    return matchesSearch && matchesRisk;
  });

  return (
    <AppShell onNavigate={onNavigate} activeTab="logs">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">System Telemetry & Audit Logs</h2>
            <p className="section-main-subtext">Raw network packet events, honeypot access attempts, and audit trail stream</p>
          </div>
          <div
            className="demo-disclaimer-bar"
            style={{
              background: error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: error ? '#f87171' : '#4ade80',
              borderColor: error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
            }}
          >
            {error ? 'API FAILURE' : 'LIVE BACKEND FEED'}
          </div>
        </div>

        <div className="soc-card" style={{ padding: '0.65rem 0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.2rem', padding: '0.35rem 0.65rem 0.35rem 2.2rem', fontSize: '0.775rem' }}
                placeholder="Filter logs by ID, IP, or Event Name..."
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
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
        </div>

        <div className="soc-card">
          <div className="table-responsive">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Timestamp</th>
                  <th>Source IP</th>
                  <th>Event Name</th>
                  <th>Risk Rating</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                      Connecting to live backend telemetry log stream...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                      No telemetry logs matching query.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#38bdf8', fontWeight: 600 }}>
                        {log.id}
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{log.time}</td>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#f8fafc' }}>{log.ipAddress}</td>
                      <td>
                        <span style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(51, 65, 85, 0.5)', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.725rem' }}>
                          {log.event}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-badge ${log.severityClass}`}>
                          {log.risk}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

