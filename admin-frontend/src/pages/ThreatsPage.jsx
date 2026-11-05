import { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import ThreatTable from '../components/threats/ThreatTable';
import { ROUTES } from '../constants/routes';
import { fetchSocThreats } from '../services/apiService';

export default function ThreatsPage({ onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [timeframe, setTimeframe] = useState('24h');

  const [threats, setThreats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadThreats() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchSocThreats({ timeframe, severity: severityFilter, limit: 100 });
        if (isMounted) {
          setThreats(res.adapted || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load live threat intelligence feed from backend');
          setIsLoading(false);
        }
      }
    }

    loadThreats();

    const handleNewThreatEvent = (evt) => {
      if (evt && evt.detail) {
        const payload = evt.detail;
        const newRecord = {
          id: payload.event_id,
          backendId: payload.event_id,
          eventId: payload.event_id,
          ipAddress: payload.source_ip || '0.0.0.0',
          event: payload.event_type || 'SECURITY_EVENT',
          attackType: payload.event_type,
          protocol: payload.event_type && payload.event_type.includes('SSH') ? 'SSH' : 'HTTP',
          riskScore: typeof payload.risk_score === 'number' ? payload.risk_score : 0,
          severity: payload.risk_level || 'Low',
          status: payload.response_status || 'MONITOR',
          responseStatus: payload.response_status,
          location: payload.location || 'Unknown Location',
          isAnomalous: payload.prediction === -1,
          prediction: payload.prediction,
          anomalyScore: payload.anomaly_score,
          time: payload.timestamp || new Date().toISOString(),
          timestamp: payload.timestamp,
        };

        setThreats((prev) => [newRecord, ...prev.filter((t) => t.id !== newRecord.id)]);
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
  }, [timeframe, severityFilter, reloadTrigger]);

  const filteredThreats = threats.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (item.ipAddress && item.ipAddress.includes(searchTerm)) ||
      (item.event && item.event.toLowerCase().includes(searchLower)) ||
      (item.id && item.id.toLowerCase().includes(searchLower));

    const matchesProtocol = protocolFilter === 'ALL' || item.protocol === protocolFilter;
    return matchesSearch && matchesProtocol;
  });

  const handleSelectThreat = (id) => {
    if (onNavigate) {
      onNavigate(ROUTES.THREAT_DETAILS + id);
    }
  };

  return (
    <AppShell onNavigate={onNavigate} activeTab="threats">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">Threat Intelligence Logs</h2>
            <p className="section-main-subtext">Live FastAPI backend threat telemetry records</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            <select
              className="time-filter-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="5m">Last 5 Minutes</option>
              <option value="15m">Last 15 Minutes</option>
              <option value="1h">Last 1 Hour</option>
              <option value="24h">Last 24 Hours</option>
            </select>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="soc-card" style={{ padding: '0.65rem 0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.2rem', padding: '0.35rem 0.65rem 0.35rem 2.2rem', fontSize: '0.775rem' }}
                placeholder="Search by IP, Threat ID, or Event..."
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
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
            >
              <option value="ALL">All Protocols</option>
              <option value="SSH">SSH</option>
              <option value="HTTP">HTTP</option>
            </select>

            <select
              className="time-filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#38bdf8',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              margin: '1rem 0',
              fontWeight: 600,
            }}
          >
            Fetching real-time threat records from backend...
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              margin: '1rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Failed to fetch threats</div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{error}</div>
            </div>
            <button
              type="button"
              onClick={() => setReloadTrigger((prev) => prev + 1)}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredThreats.length === 0 && (
          <div
            style={{
              padding: '3rem 1rem',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px dashed #334155',
              color: '#94a3b8',
              margin: '1rem 0',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem' }}>No Threat Records Found</div>
            <div style={{ fontSize: '0.8rem' }}>No active security threat records match the selected filter criteria in the live backend.</div>
          </div>
        )}

        {/* Threat Table */}
        {!isLoading && !error && filteredThreats.length > 0 && (
          <div className="soc-card">
            <ThreatTable threats={filteredThreats} onSelectThreat={handleSelectThreat} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
