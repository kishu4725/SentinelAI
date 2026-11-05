export default function RecentLogsTable({ logs }) {
  if (!logs || logs.length === 0) {
    return <div style={{ color: '#64748b', padding: '1rem', fontSize: '0.85rem' }}>No recent logs recorded.</div>;
  }

  const getRiskBadge = (risk) => {
    let color = '#38bdf8';
    if (risk === 'High') color = '#ef4444';
    else if (risk === 'Medium') color = '#f59e0b';

    return (
      <span style={{ color, fontWeight: 600, fontSize: '0.775rem' }}>
        {risk}
      </span>
    );
  };

  return (
    <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.15)', background: 'rgba(30, 41, 59, 0.5)' }}>
            <th style={{ padding: '0.55rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Time</th>
            <th style={{ padding: '0.55rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>IP Address</th>
            <th style={{ padding: '0.55rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Event</th>
            <th style={{ padding: '0.55rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <td style={{ padding: '0.6rem 0.65rem', color: '#64748b', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.75rem' }}>
                {log.time}
              </td>
              <td style={{ padding: '0.6rem 0.65rem', color: '#cbd5e1', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                {log.ipAddress}
              </td>
              <td style={{ padding: '0.6rem 0.65rem', color: '#94a3b8', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                {log.event}
              </td>
              <td style={{ padding: '0.6rem 0.65rem' }}>{getRiskBadge(log.risk)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
