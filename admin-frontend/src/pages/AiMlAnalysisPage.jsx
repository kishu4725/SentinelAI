import AppShell from '../components/layout/AppShell';
import RiskGaugeDial from '../components/visualizations/RiskGaugeDial';
import { MOCK_DASHBOARD_DATA } from '../services/mockDashboardData';

export default function AiMlAnalysisPage({ onNavigate }) {
  const ml = MOCK_DASHBOARD_DATA.aiMlAnalysis;

  return (
    <AppShell onNavigate={onNavigate} activeTab="ml_analysis">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">AI/ML Threat Analysis & Anomaly Detection</h2>
            <p className="section-main-subtext">Unsupervised Machine Learning model monitoring and anomaly classification engine</p>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                {ml.modelName} Engine
              </h3>
              <span className="status-pill active">{ml.riskLevel}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
              <RiskGaugeDial score={ml.averageRiskScore} riskLevel={ml.riskLevel} />

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.775rem', color: '#94a3b8', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                  {ml.modelDescription} calculating real-time anomaly scores across cloud telemetry, honeypot access rates, and HTTP/SSH request payloads.
                </p>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.675rem', color: '#64748b', textTransform: 'uppercase' }}>Normal Behavior</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>{ml.normalActivityPercentage}%</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.675rem', color: '#64748b', textTransform: 'uppercase' }}>Anomalous Telemetry</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>{ml.anomalousActivityPercentage}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                Model Hyperparameters & Performance
              </h3>
              <span className="status-pill active">Model Active</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Contamination Rate</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>0.15</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Estimators (Trees)</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>100 Trees</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Detection Accuracy</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>94.8%</div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>False Positive Rate</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>1.2%</div>
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Feature Importances:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: '0.15rem' }}>
                    <span>Payload Entropy & Size</span>
                    <span>42%</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '42%', background: '#38bdf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: '0.15rem' }}>
                    <span>Burst Request Velocity</span>
                    <span>31%</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '31%', background: '#818cf8' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: '0.15rem' }}>
                    <span>Geographic Anomaly Index</span>
                    <span>27%</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '27%', background: '#a855f7' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
