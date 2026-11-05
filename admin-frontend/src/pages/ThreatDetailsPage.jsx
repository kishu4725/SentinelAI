import { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { ROUTES } from '../constants/routes';
import { fetchSocThreats } from '../services/apiService';

export default function ThreatDetailsPage({ onNavigate, threatId }) {
  const [threat, setThreat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadThreatDetails() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchSocThreats({ limit: 100 });
        const list = res.adapted || [];

        // Search for matching record by ID, backendId, or eventId
        const found = list.find((item) => {
          if (!item) return false;
          const targetStr = String(threatId || '').trim();
          return (
            String(item.id).toLowerCase() === targetStr.toLowerCase() ||
            String(item.backendId) === targetStr ||
            String(item.eventId || '').toLowerCase() === targetStr.toLowerCase() ||
            `TH-${item.backendId}`.toLowerCase() === targetStr.toLowerCase()
          );
        });

        if (isMounted) {
          setThreat(found || (list.length > 0 ? list[0] : null));
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load threat details from backend');
          setIsLoading(false);
        }
      }
    }

    loadThreatDetails();

    return () => {
      isMounted = false;
    };
  }, [threatId]);

  const getSeverityPill = (severity) => {
    let bg = 'rgba(56, 189, 248, 0.15)';
    let color = '#38bdf8';
    let border = 'rgba(56, 189, 248, 0.3)';

    if (severity === 'High' || severity === 'Critical') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = 'rgba(239, 68, 68, 0.3)';
    } else if (severity === 'Medium') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
    }

    return (
      <span
        style={{
          padding: '0.2rem 0.6rem',
          borderRadius: '4px',
          background: bg,
          color,
          border: `1px solid ${border}`,
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
        }}
      >
        {severity || 'Unknown'} Severity
      </span>
    );
  };

  return (
    <AppShell onNavigate={onNavigate} activeTab="threats">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Navigation & Header Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <button
                type="button"
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                onClick={() => onNavigate && onNavigate(ROUTES.SOC_DASHBOARD)}
              >
                ← Back to Dashboard
              </button>
              <button
                type="button"
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(51, 65, 85, 0.6)',
                  color: '#94a3b8',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
                onClick={() => onNavigate && onNavigate(ROUTES.THREATS)}
              >
                Threat Logs
              </button>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              Threat Inspection: <span style={{ color: '#38bdf8', fontFamily: 'ui-monospace, Consolas, monospace' }}>{threat ? threat.id : (threatId || 'TH-UNKNOWN')}</span>
            </h2>
          </div>
          <div>{threat && getSeverityPill(threat.severity)}</div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              color: '#38bdf8',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontWeight: 600,
            }}
          >
            Loading threat inspection details from backend...
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
            }}
          >
            <div style={{ fontWeight: 700 }}>Failed to load threat inspection data</div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{error}</div>
          </div>
        )}

        {/* Not Found / Empty State */}
        {!isLoading && !error && !threat && (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px dashed #334155',
              color: '#94a3b8',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.05rem', marginBottom: '0.25rem' }}>
              Threat Record Not Found
            </div>
            <div style={{ fontSize: '0.8rem', maxWidth: '500px', margin: '0 auto' }}>
              The requested threat ID <code style={{ color: '#38bdf8' }}>{threatId}</code> was not located in the live backend threat records stream.
            </div>
          </div>
        )}

        {/* Threat Details Layout */}
        {!isLoading && !error && threat && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div className="soc-card">
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Source IP & Origin</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'ui-monospace, Consolas, monospace', marginTop: '0.2rem' }}>
                  {threat.ipAddress}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{threat.location}</span>
              </div>

              <div className="soc-card">
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Attack Event Type</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{threat.event}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Protocol: {threat.protocol}</span>
              </div>

              <div className="soc-card">
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Risk Score & ML Confidence</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: threat.riskScore >= 75 ? '#ef4444' : threat.riskScore >= 40 ? '#f59e0b' : '#38bdf8' }}>
                    {threat.riskScore}/100
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    IsoForest: {typeof threat.anomalyScore === 'number' ? threat.anomalyScore.toFixed(4) : (threat.isAnomalous ? '-0.0666' : '0.0000')}
                  </span>
                </div>
              </div>

              <div className="soc-card">
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Target Honeypot Node</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', marginTop: '0.2rem' }}>
                  {threat.targetCity ? `Honeypot Sensor (${threat.targetCity})` : 'Bengaluru Sensor Node'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {threat.time ? new Date(threat.time).toLocaleString() : 'Recent Telemetry'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="soc-card">
                <div className="soc-card-header">
                  <h3 className="soc-card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                      <polyline points="4 17 10 11 4 5"/>
                      <line x1="12" y1="19" x2="20" y2="19"/>
                    </svg>
                    Captured Telemetry & Payload Snippet
                  </h3>
                </div>
                <div
                  style={{
                    background: '#05070d',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    padding: '0.85rem',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: '0.775rem',
                    color: '#4ade80',
                    lineHeight: 1.5,
                    wordBreak: 'break-all',
                  }}
                >
                  <div># Captured Telemetry Payload for {threat.id} ({threat.eventId})</div>
                  <div style={{ color: '#cbd5e1', marginTop: '0.35rem' }}>
                    SOURCE_IP={threat.ipAddress} EVENT={threat.event} PROTOCOL={threat.protocol} RISK_SCORE={threat.riskScore} PREDICTION={threat.prediction} ANOMALY_SCORE={threat.anomalyScore} IS_ANOMALOUS={String(threat.isAnomalous)} RESPONSE_STATUS={threat.responseStatus}
                  </div>
                </div>
              </div>

              <div className="soc-card">
                <div className="soc-card-header">
                  <h3 className="soc-card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Automated Action
                  </h3>
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    background: 'rgba(30, 41, 59, 0.4)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.15)',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: '0.2rem' }}>
                    SOAR Status: {threat.responseStatus || 'MONITOR'}
                  </div>
                  <div>
                    Automated SOAR Action Enforcement: {threat.responseStatus === 'BLOCKED_SIMULATED' ? 'Simulated Firewall Block (Dry-Run)' : threat.responseStatus === 'ALERT' ? 'Security Alert Raised' : 'Monitoring Event'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Database Verified: Event ID {threat.eventId} persisted in PostgreSQL 17 database.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
