import { useState } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import { MOCK_USER_REPORTS } from '../services/mockUserDashboardData';

export default function UserReportsPage({ onNavigate }) {
  const [reports] = useState(MOCK_USER_REPORTS);
  const [downloadMsg, setDownloadMsg] = useState(null);

  const handleDownload = (repTitle) => {
    setDownloadMsg(`Simulating download for "${repTitle}"...`);
    setTimeout(() => setDownloadMsg(null), 3000);
  };

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="reports">
      <div className="user-dashboard-container">
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Security & Audit Reports</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>Downloadable monthly account audits and session summaries</p>
        </div>

        {downloadMsg && (
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.775rem', marginBottom: '1rem' }}>
            ✓ {downloadMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {reports.map((rep) => (
            <div key={rep.id} className="user-card" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.675rem', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                    {rep.type}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{rep.date}</span>
                </div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.35rem 0', lineHeight: 1.35 }}>
                  {rep.title}
                </h3>
                <p style={{ fontSize: '0.775rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                  {rep.summary}
                </p>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 600 }}>{rep.status}</span>
                <button
                  type="button"
                  className="quick-action-btn"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem' }}
                  onClick={() => handleDownload(rep.title)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Report PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </UserAppShell>
  );
}
