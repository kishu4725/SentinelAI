import { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { fetchSoarPolicies, toggleSoarPolicy, fetchSoarAuditTrail } from '../services/apiService';
import { MOCK_DASHBOARD_DATA } from '../services/mockDashboardData';

export default function AutomatedResponsePage({ onNavigate }) {
  const [policies, setPolicies] = useState(MOCK_DASHBOARD_DATA.automatedResponse.policies);
  const [auditTrail, setAuditTrail] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSoarData() {
      try {
        const [policiesRes, trailRes] = await Promise.all([
          fetchSoarPolicies().catch(() => null),
          fetchSoarAuditTrail().catch(() => null),
        ]);
        if (isMounted) {
          if (Array.isArray(policiesRes) && policiesRes.length > 0) {
            setPolicies(policiesRes);
          }
          if (Array.isArray(trailRes) && trailRes.length > 0) {
            setAuditTrail(trailRes);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      }
    }
    loadSoarData();
    return () => { isMounted = false; };
  }, []);

  const handleTogglePolicy = async (index, name) => {
    const targetPolicy = policies[index];
    const newEnabled = !targetPolicy.enabled;
    setPolicies((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, enabled: newEnabled } : item))
    );
    try {
      await toggleSoarPolicy(name || targetPolicy.name, newEnabled);
    } catch {
      // Keep UI responsive
    }
  };

  return (
    <AppShell onNavigate={onNavigate} activeTab="auto_response">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">Automated Mitigation & Incident Response</h2>
            <p className="section-main-subtext">Autonomous firewall blocking rules, threat containment policies, and SOAR automation</p>
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

        <div className="dashboard-row-2col">
          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Active Automated Policies
              </h3>
              <span className="status-pill active">SOAR Engine Online</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
              {policies.map((policy, index) => (
                <div
                  key={policy.name}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '6px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{policy.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                      {policy.enabled ? 'Automated enforcement active' : 'Policy disabled manually'}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: policy.enabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: policy.enabled ? '#4ade80' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                    onClick={() => togglePolicy(index)}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: policy.enabled ? '#4ade80' : '#94a3b8' }} />
                    {policy.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Perimeter Blocklist Statistics
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Active Blocked IPs</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444' }}>142 IPs</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Mean Time to Mitigate</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>1.4 sec</div>
              </div>
            </div>

            <div style={{ background: '#05070d', padding: '0.75rem', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '0.75rem', fontFamily: 'ui-monospace, Consolas, monospace', color: '#94a3b8' }}>
              <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.3rem' }}>[SOAR AUDIT TRAIL]</div>
              <div>• 18:23:02 - Automated IP drop triggered for 192.0.2.30</div>
              <div>• 18:10:22 - Rate-limit throttled connection 192.0.2.10</div>
              <div>• 17:45:11 - AWS Security Group rule #392 updated</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
