import AppShell from '../components/layout/AppShell';
import HoneypotSparkline from '../components/visualizations/HoneypotSparkline';
import { MOCK_DASHBOARD_DATA } from '../services/mockDashboardData';
import { ROUTES } from '../constants/routes';

export default function HoneypotMonitoringPage({ onNavigate }) {
  const hp = MOCK_DASHBOARD_DATA.honeypotMonitoring;

  return (
    <AppShell onNavigate={onNavigate} activeTab="honeypot">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">Cloud Honeypot Monitoring</h2>
            <p className="section-main-subtext">Active decoy telemetry nodes capturing brute force, exploitation, and malware payloads</p>
          </div>
          <div
            className="demo-disclaimer-bar"
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              borderColor: 'rgba(34, 197, 94, 0.3)',
            }}
          >
            LIVE BACKEND FEED
          </div>
        </div>

        <div className="dashboard-row-2col">
          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <polyline points="4 17 10 11 4 5"/>
                  <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                Cowrie SSH Honeypot (Node-01)
              </h3>
              <span className="status-pill active">Online • Port 22</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Login Attempts</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#818cf8' }}>{hp.sshHoneypot.loginAttempts}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Successful Logins</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4ade80' }}>{hp.sshHoneypot.successfulLogins}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Commands Executed</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>{hp.sshHoneypot.commandsExecuted}</div>
              </div>
            </div>

            <HoneypotSparkline points={hp.sshHoneypot.sparkline} color="#818cf8" />
          </div>

          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                Glastopf HTTP Trap (Node-02)
              </h3>
              <span className="status-pill active">Online • Port 80/443</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Requests Captured</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>{hp.httpHoneypot.requestsCaptured}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Unique IPs</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>{hp.httpHoneypot.uniqueIps}</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.65rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Suspicious Endpoints</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444' }}>{hp.httpHoneypot.suspiciousEndpoints}</div>
              </div>
            </div>

            <HoneypotSparkline points={hp.httpHoneypot.sparkline} color="#38bdf8" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
