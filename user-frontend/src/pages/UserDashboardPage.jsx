import { useState } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import { simulateUserSecurityEvent } from '../services/apiService';
import { ROUTES } from '../constants/routes';

export default function UserDashboardPage({ onNavigate }) {
  const [simType, setSimType] = useState('BRUTE_FORCE');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimResult(null);
    setSimError(null);
    try {
      const res = await simulateUserSecurityEvent(simType);
      setSimResult(res);
      // Alert sound plays on SOC Admin Dashboard only — not here
    } catch (err) {
      setSimError(err.message || 'Simulation execution failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        
        {/* Header Row */}
        <div className="dash-header-row">
          <div>
            <h1 className="dash-header-title">Dashboard</h1>
            <p className="dash-header-subtitle">Overview of your website's security status</p>
          </div>
          <div>
            <select className="dash-time-select" defaultValue="24h">
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* 1. Hero SAFE Banner Card */}
        <div className="hero-safe-card">
          <div className="hero-safe-left">
            <div className="hero-safe-icon-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <div>
              <div className="hero-safe-text-label">Your Website is</div>
              <div className="hero-safe-status-title">SAFE</div>
              <div className="hero-safe-status-sub">No critical threats detected</div>
            </div>
          </div>

          <div className="hero-safe-right">
            <div className="scan-info-box">
              <div className="scan-info-label">Last Scan</div>
              <div className="scan-info-time">Oct 6, 2026 10:30 AM</div>
            </div>
            <button type="button" className="scan-now-btn">
              Scan Now
            </button>
          </div>
        </div>

        {/* 2. 4 Summary Metrics Cards */}
        <div className="metrics-four-grid">
          {/* Total Requests */}
          <div className="metric-white-card">
            <div className="metric-card-top">
              <div className="metric-icon-circle blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
            </div>
            <span className="metric-card-label">Total Requests</span>
            <div className="metric-card-val-row">
              <span className="metric-card-value">1,254</span>
              <span className="growth-badge green">↑ 12%</span>
            </div>
          </div>

          {/* Blocked Attacks */}
          <div className="metric-white-card">
            <div className="metric-card-top">
              <div className="metric-icon-circle red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            </div>
            <span className="metric-card-label">Blocked Attacks</span>
            <div className="metric-card-val-row">
              <span className="metric-card-value">8</span>
              <span className="growth-badge green">↑ 60%</span>
            </div>
          </div>

          {/* Suspicious Activities */}
          <div className="metric-white-card">
            <div className="metric-card-top">
              <div className="metric-icon-circle orange">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <span className="metric-card-label">Suspicious Activities</span>
            <div className="metric-card-val-row">
              <span className="metric-card-value">2</span>
              <span className="growth-badge orange">↑ 0%</span>
            </div>
          </div>

          {/* Uptime */}
          <div className="metric-white-card">
            <div className="metric-card-top">
              <div className="metric-icon-circle green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
            </div>
            <span className="metric-card-label">Uptime</span>
            <div className="metric-card-val-row">
              <span className="metric-card-value">99.9%</span>
              <span className="growth-badge green">↑ 0.1%</span>
            </div>
          </div>
        </div>

        {/* 3. Website Traffic Overview Chart */}
        <div className="white-card">
          <div className="card-title-header">
            <h2 className="card-title-text">Website Traffic Overview</h2>
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />
                Normal Traffic
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                Blocked Traffic
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            <svg viewBox="0 0 650 200" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y Axis Grid lines */}
              <line x1="40" y1="20" x2="630" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <text x="30" y="24" fill="#94a3b8" fontSize="10" textAnchor="end">200</text>

              <line x1="40" y1="60" x2="630" y2="60" stroke="#f1f5f9" strokeWidth="1" />
              <text x="30" y="64" fill="#94a3b8" fontSize="10" textAnchor="end">150</text>

              <line x1="40" y1="100" x2="630" y2="100" stroke="#f1f5f9" strokeWidth="1" />
              <text x="30" y="104" fill="#94a3b8" fontSize="10" textAnchor="end">100</text>

              <line x1="40" y1="140" x2="630" y2="140" stroke="#f1f5f9" strokeWidth="1" />
              <text x="30" y="144" fill="#94a3b8" fontSize="10" textAnchor="end">50</text>

              <line x1="40" y1="180" x2="630" y2="180" stroke="#e2e8f0" strokeWidth="1" />
              <text x="30" y="184" fill="#94a3b8" fontSize="10" textAnchor="end">0</text>

              {/* Blue Area / Line (Normal Traffic) */}
              <path
                d="M 50 140 C 90 80, 130 110, 170 70 C 210 100, 250 120, 290 60 C 330 90, 370 110, 410 80 C 450 100, 490 60, 530 110 C 570 90, 610 120, 630 115 L 630 180 L 50 180 Z"
                fill="url(#normalGrad)"
              />
              <path
                d="M 50 140 C 90 80, 130 110, 170 70 C 210 100, 250 120, 290 60 C 330 90, 370 110, 410 80 C 450 100, 490 60, 530 110 C 570 90, 610 120, 630 115"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {/* Red Line (Blocked Traffic) */}
              <path
                d="M 50 170 C 90 160, 130 172, 170 165 C 210 168, 250 160, 290 170 C 330 162, 370 168, 410 160 C 450 165, 490 170, 530 162 C 570 168, 610 170, 630 165"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
              />

              {/* Time Points */}
              <text x="50" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">12 AM</text>
              <text x="166" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">4 AM</text>
              <text x="282" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">8 AM</text>
              <text x="398" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">12 PM</text>
              <text x="514" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">4 PM</text>
              <text x="630" y="196" fill="#94a3b8" fontSize="10" textAnchor="middle">8 PM</text>
            </svg>
          </div>
        </div>

        {/* 4. 2-Column Split Section */}
        <div className="two-col-grid">
          {/* Recent Activities */}
          <div className="white-card" style={{ marginBottom: 0 }}>
            <div className="card-title-header">
              <h3 className="card-title-text">Recent Activities</h3>
              <a href={ROUTES.USER_ACTIVITY} onClick={(e) => { e.preventDefault(); if (onNavigate) onNavigate(ROUTES.USER_ACTIVITY); }} className="card-header-link">
                View All
              </a>
            </div>

            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon-badge green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="activity-title">Login successful</div>
                  <div className="activity-time">2 minutes ago</div>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-icon-badge red">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="activity-title">Suspicious request blocked</div>
                  <div className="activity-time">5 minutes ago</div>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-icon-badge orange">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <polyline points="12 18 12 12 15 15"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="activity-title">File upload attempted</div>
                  <div className="activity-time">12 minutes ago</div>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-icon-badge blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="activity-title">Normal page visit</div>
                  <div className="activity-time">15 minutes ago</div>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-icon-badge green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="activity-title">Scan completed</div>
                  <div className="activity-time">30 minutes ago</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Threats Blocked */}
          <div className="white-card" style={{ marginBottom: 0 }}>
            <div className="card-title-header">
              <h3 className="card-title-text">Top Threats Blocked</h3>
              <a href={ROUTES.USER_ALERTS} onClick={(e) => { e.preventDefault(); if (onNavigate) onNavigate(ROUTES.USER_ALERTS); }} className="card-header-link">
                View All
              </a>
            </div>

            <div className="threat-donut-container">
              {/* Donut graphic */}
              <div className="donut-graphic-box">
                <svg width="130" height="130" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e2e8f0" strokeWidth="5.5" />
                  
                  {/* SQL Injection (50% = 50 50, stroke-dashoffset 25) */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="5.5" strokeDasharray="50 50" strokeDashoffset="25" />
                  
                  {/* Brute Force (25% = 25 75, stroke-dashoffset 75) */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f97316" strokeWidth="5.5" strokeDasharray="25 75" strokeDashoffset="75" />
                  
                  {/* XSS Attack (12.5% = 12.5 87.5) */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#eab308" strokeWidth="5.5" strokeDasharray="13 87" strokeDashoffset="100" />
                  
                  {/* Other (12.5%) */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#94a3b8" strokeWidth="5.5" strokeDasharray="12 88" strokeDashoffset="113" />
                </svg>
                <div className="donut-center-label">
                  <div className="donut-center-number">8</div>
                  <div className="donut-center-sub">Blocked</div>
                </div>
              </div>

              {/* Threat legend list */}
              <div className="threat-legend-list">
                <div className="threat-legend-item">
                  <div className="threat-legend-left">
                    <span className="legend-dot" style={{ background: '#ef4444' }} />
                    SQL Injection
                  </div>
                  <span className="threat-count-val">4</span>
                </div>

                <div className="threat-legend-item">
                  <div className="threat-legend-left">
                    <span className="legend-dot" style={{ background: '#f97316' }} />
                    Brute Force
                  </div>
                  <span className="threat-count-val">2</span>
                </div>

                <div className="threat-legend-item">
                  <div className="threat-legend-left">
                    <span className="legend-dot" style={{ background: '#eab308' }} />
                    XSS Attack
                  </div>
                  <span className="threat-count-val">1</span>
                </div>

                <div className="threat-legend-item">
                  <div className="threat-legend-left">
                    <span className="legend-dot" style={{ background: '#94a3b8' }} />
                    Other
                  </div>
                  <span className="threat-count-val">1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Live AI Threat Telemetry Simulator (Testbed) */}
        <div className="white-card" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
          <div className="card-title-header">
            <h3 className="card-title-text" style={{ color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Live AI Threat Telemetry Simulator
            </h3>
            <span style={{ fontSize: '0.725rem', color: '#7e22ce', fontWeight: 700, padding: '0.2rem 0.6rem', background: '#f3e8ff', borderRadius: '6px' }}>
              Interactive Testbed
            </span>
          </div>

          <p style={{ fontSize: '0.825rem', color: '#6b21a8', marginBottom: '1rem' }}>
            Dispatch synthetic security events directly to the SentinelAI ML Anomaly Detection engine and automated SOAR response framework.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <select
              value={simType}
              onChange={(e) => setSimType(e.target.value)}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="BRUTE_FORCE">Brute Force Login Attack (25 failed logins)</option>
              <option value="SIMULATED_MALWARE_UPLOAD">Simulated Malicious Upload (simulated_malware.exe)</option>
              <option value="DATA_EXFILTRATION">Unauthorized Data Exfiltration (50 MB payload)</option>
              <option value="BENIGN">Benign Activity (Normal User Login)</option>
            </select>



            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7e22ce, #4f46e5)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(126, 34, 206, 0.25)',
              }}
            >
              {isSimulating ? 'EVALUATING IN BACKEND ML...' : 'DISPATCH SIMULATION EVENT'}
            </button>
          </div>

          {simError && (
            <div style={{ color: '#dc2626', fontSize: '0.825rem', padding: '0.65rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              {simError}
            </div>
          )}

          {simResult && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.775rem', color: '#475569', fontFamily: 'monospace' }}>
                  EVENT ID: <strong style={{ color: '#0284c7' }}>{simResult.event_id}</strong>
                </span>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: simResult.ml_result.risk_score >= 50 ? '#fef2f2' : '#f0fdf4', color: simResult.ml_result.risk_score >= 50 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                  {simResult.ml_result.risk_level} RISK
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>DYNAMIC ML RISK SCORE</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: simResult.ml_result.risk_score >= 50 ? '#dc2626' : '#16a34a', marginTop: '0.2rem' }}>
                    {simResult.ml_result.risk_score} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Anomaly Score: {simResult.ml_result.anomaly_score}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>SOAR RESPONSE STATUS</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7e22ce', marginTop: '0.2rem' }}>
                    {simResult.soar_response.response_status}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Policy: {simResult.soar_response.policy_applied}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>AUTOMATED ACTION TAKEN</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7', marginTop: '0.2rem' }}>
                    {simResult.soar_response.action}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Dry Run: {simResult.soar_response.dry_run ? 'True (Simulated)' : 'False'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Security Recommendation Card */}
        <div className="recommendation-card">
          <div className="recommendation-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <div>
            <div className="recommendation-title">Security Recommendation</div>
            <div className="recommendation-text">Keep your website and plugins updated to stay protected.</div>
          </div>
        </div>

      </div>
    </UserAppShell>
  );
}
