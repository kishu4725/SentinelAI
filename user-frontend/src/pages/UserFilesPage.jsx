import { useState, useEffect, useRef } from 'react';
import UserAppShell from '../components/layout/UserAppShell';
import {
  uploadUserFile,
  fetchUserFiles,
  fetchFileActivity,
  deleteUserFile,
  downloadUserFile,
} from '../services/apiService';

const card = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '1rem',
  marginBottom: '1rem',
};

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function riskBadge(level) {
  let bg = '#dcfce7';
  let color = '#15803d';
  if (level === 'High' || level === 'Critical') {
    bg = '#fee2e2';
    color = '#b91c1c';
  } else if (level === 'Medium') {
    bg = '#fef3c7';
    color = '#b45309';
  }
  return (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: bg, color, fontSize: '0.7rem', fontWeight: 700 }}>
      {level}
    </span>
  );
}

export default function UserFilesPage({ onNavigate }) {
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);

  const loadAll = async () => {
    try {
      const [f, a] = await Promise.all([fetchUserFiles(), fetchFileActivity()]);
      setFiles(f);
      setActivity(a);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadUserFile(file);
      setNotice(`"${file.name}" was encrypted and stored securely.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      await loadAll();
    }
  };

  const handleDownload = async (f) => {
    setError('');
    try {
      await downloadUserFile(f.id, f.name);
    } catch (err) {
      setError(err.message);
    }
    await loadAll();
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Delete "${f.name}"? This cannot be undone.`)) return;
    setError('');
    try {
      await deleteUserFile(f.id);
      setNotice(`"${f.name}" was deleted.`);
    } catch (err) {
      setError(err.message);
    }
    await loadAll();
  };

  const btn = (bg, color) => ({
    padding: '0.3rem 0.7rem',
    marginRight: '0.4rem',
    border: 'none',
    borderRadius: '6px',
    background: bg,
    color,
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  });

  return (
    <UserAppShell onNavigate={onNavigate} activeTab="files">
      <div className="user-dashboard-container">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>My Files</h2>
        <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 1rem 0' }}>
          Files are scanned, hashed and encrypted before they are stored.
        </p>

        {error && (
          <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontSize: '0.85rem' }}>
            {notice}
          </div>
        )}

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Upload a file</div>
          <input ref={inputRef} type="file" onChange={handleUpload} disabled={uploading} />
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
            Allowed: PDF, PNG, JPG, GIF, TXT, CSV, DOCX, XLSX. Maximum 10 MB.
          </div>
          {uploading && <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '0.4rem' }}>Scanning and encrypting...</div>}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Your files ({files.length})</div>
          {loading ? (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading...</div>
          ) : files.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>No files uploaded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.4rem' }}>Name</th>
                    <th style={{ padding: '0.4rem' }}>Size</th>
                    <th style={{ padding: '0.4rem' }}>Status</th>
                    <th style={{ padding: '0.4rem' }}>SHA-256</th>
                    <th style={{ padding: '0.4rem' }}>Uploaded</th>
                    <th style={{ padding: '0.4rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                      <td style={{ padding: '0.4rem' }}>{f.name}</td>
                      <td style={{ padding: '0.4rem' }}>{fmtSize(f.size_bytes)}</td>
                      <td style={{ padding: '0.4rem' }}>
                        {f.status === 'quarantined' ? riskBadge('High') : riskBadge('Normal')}{' '}
                        <span style={{ fontSize: '0.7rem' }}>{f.status}</span>
                      </td>
                      <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.7rem' }} title={f.sha256}>
                        {f.sha256.slice(0, 12)}...
                      </td>
                      <td style={{ padding: '0.4rem' }}>{f.created_at ? new Date(f.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</td>
                      <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                        <button type="button" style={btn('#e0f2fe', '#0369a1')} onClick={() => handleDownload(f)}>
                          Download
                        </button>
                        <button type="button" style={btn('#fee2e2', '#b91c1c')} onClick={() => handleDelete(f)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>My Security Activity</div>
          {activity && (
            <>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#334155', marginBottom: '0.75rem' }}>
                <div>Security score: <strong>{activity.security_score}</strong></div>
                <div>Blocked attempts: <strong>{activity.blocked_count}</strong></div>
                <div>Highest risk: <strong>{Math.round(activity.highest_risk)}</strong></div>
              </div>
              {activity.events.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>No file activity yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.35rem' }}>Event</th>
                        <th style={{ padding: '0.35rem' }}>Status</th>
                        <th style={{ padding: '0.35rem' }}>Risk</th>
                        <th style={{ padding: '0.35rem' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.events.map((ev) => (
                        <tr key={ev.event_id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                          <td style={{ padding: '0.35rem' }}>{ev.event_type.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '0.35rem' }}>{ev.status}</td>
                          <td style={{ padding: '0.35rem' }}>{riskBadge(ev.risk_level)} {Math.round(ev.risk_score)}</td>
                          <td style={{ padding: '0.35rem' }}>{ev.timestamp ? new Date(ev.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </UserAppShell>
  );
}