import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import { fetchAdminFiles, fetchAdminFlagged } from '../services/apiService';

const card = {
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(56, 189, 248, 0.2)',
  borderRadius: '10px',
  padding: '1rem',
  marginBottom: '1rem',
  color: '#e2e8f0',
};
const th = { padding: '0.4rem', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.2)' };
const td = { padding: '0.4rem', borderBottom: '1px solid rgba(148,163,184,0.1)' };

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function badge(level) {
  let bg = 'rgba(74,222,128,0.15)';
  let color = '#4ade80';
  if (level === 'High' || level === 'Critical') {
    bg = 'rgba(239,68,68,0.15)';
    color = '#f87171';
  } else if (level === 'Medium') {
    bg = 'rgba(245,158,11,0.15)';
    color = '#fbbf24';
  }
  return (
    <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: bg, color, fontSize: '0.7rem', fontWeight: 700 }}>
      {level}
    </span>
  );
}

export default function FileSecurityPage({ onNavigate }) {
  const [files, setFiles] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const [f, fl] = await Promise.all([fetchAdminFiles(), fetchAdminFlagged()]);
      setFiles(Array.isArray(f) ? f : []);
      setFlagged(fl && fl.flagged_events ? fl.flagged_events : []);
      setPatterns(fl && fl.user_patterns ? fl.user_patterns : []);
      setUpdated(new Date());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    const onThreat = (e) => {
      const t = e.detail && e.detail.event_type;
      if (t && String(t).startsWith('FILE_')) load();
    };
    window.addEventListener('sentinel_soc_new_threat', onThreat);
    return () => {
      clearInterval(timer);
      window.removeEventListener('sentinel_soc_new_threat', onThreat);
    };
  }, [load]);

  const quarantined = files.filter((f) => f.status === 'quarantined').length;
  const sortedPatterns = [...patterns].sort((a, b) => b.max_risk - a.max_risk);

  const stat = (label, value, color) => (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 160px' }}>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );

  return (
    <AppShell onNavigate={onNavigate} activeTab="file_security">
      <div style={{ padding: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>File Security</h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 1rem 0' }}>
              User uploads, flagged file activity and attack patterns per user
            </p>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {updated ? 'Updated ' + updated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}{' '}
            <button
              type="button"
              onClick={load}
              style={{ marginLeft: '0.5rem', padding: '0.3rem 0.7rem', border: 'none', borderRadius: '6px', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {stat('Stored files', files.length, '#38bdf8')}
          {stat('Quarantined', quarantined, quarantined ? '#f87171' : '#4ade80')}
          {stat('Flagged events', flagged.length, flagged.length ? '#fbbf24' : '#4ade80')}
          {stat('Users flagged', patterns.length, patterns.length ? '#fbbf24' : '#4ade80')}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Attack patterns by user</div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading...</div>
          ) : sortedPatterns.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No suspicious file activity.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Flagged events</th>
                  <th style={th}>Highest risk</th>
                </tr>
              </thead>
              <tbody>
                {sortedPatterns.map((p) => (
                  <tr key={p.user}>
                    <td style={td}>{p.user}</td>
                    <td style={td}>{p.flagged_events}</td>
                    <td style={td}>
                      {badge(p.max_risk >= 90 ? 'Critical' : p.max_risk >= 75 ? 'High' : 'Medium')} {Math.round(p.max_risk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Flagged file events</div>
          {flagged.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nothing flagged.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th style={th}>Time</th>
                    <th style={th}>User</th>
                    <th style={th}>Event</th>
                    <th style={th}>Status</th>
                    <th style={th}>Risk</th>
                    <th style={th}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((e) => (
                    <tr key={e.event_id}>
                      <td style={td}>{e.timestamp ? new Date(e.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</td>
                      <td style={td}>{e.user}</td>
                      <td style={td}>{String(e.event_type).replace(/_/g, ' ')}</td>
                      <td style={td}>{e.status}</td>
                      <td style={td}>{badge(e.risk_level)} {Math.round(e.risk_score)}</td>
                      <td style={td}>{e.source_ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>All stored files ({files.length})</div>
          {files.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No files uploaded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th style={th}>Owner</th>
                    <th style={th}>Name</th>
                    <th style={th}>Size</th>
                    <th style={th}>Status</th>
                    <th style={th}>SHA-256</th>
                    <th style={th}>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td style={td}>{f.owner}</td>
                      <td style={td}>{f.name}</td>
                      <td style={td}>{fmtSize(f.size_bytes)}</td>
                      <td style={td}>{badge(f.status === 'quarantined' ? 'High' : f.status === 'deleted' ? 'Medium' : 'Normal')} {f.status}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.7rem' }} title={f.sha256}>{f.sha256.slice(0, 12)}...</td>
                      <td style={td}>{f.created_at ? new Date(f.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}