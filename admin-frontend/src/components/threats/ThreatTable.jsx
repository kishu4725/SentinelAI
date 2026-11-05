export default function ThreatTable({ threats, onSelectThreat }) {
  if (!threats || threats.length === 0) {
    return <div style={{ color: '#64748b', padding: '0.75rem', fontSize: '0.775rem' }}>No threat events recorded.</div>;
  }

  const getStatusBadge = (status, severity) => {
    let color = '#38bdf8';
    let icon = '●';
    if (severity === 'High' || status === 'Alert') {
      color = '#ef4444';
      icon = '◆';
    } else if (severity === 'Medium' || status === 'Review' || status === 'Investigating') {
      color = '#f59e0b';
      icon = '◆';
    } else if (status === 'Normal') {
      color = '#4ade80';
      icon = '●';
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color, fontWeight: 600, fontSize: '0.725rem' }}>
        <span>{icon}</span>
        {status}
      </span>
    );
  };

  const getRiskScoreBadge = (score, severity) => {
    let bg = 'rgba(56, 189, 248, 0.12)';
    let color = '#38bdf8';
    let border = 'rgba(56, 189, 248, 0.3)';

    if (severity === 'High' || score >= 80) {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = 'rgba(239, 68, 68, 0.3)';
    } else if (severity === 'Medium' || score >= 60) {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
    }

    return (
      <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: bg, color, border: `1px solid ${border}`, fontWeight: 700, fontSize: '0.725rem' }}>
        {score}
      </span>
    );
  };

  return (
    <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
      <table className="threat-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.775rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.15)', background: 'rgba(30, 41, 59, 0.5)' }}>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Time</th>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>IP Address</th>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Protocol</th>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Event</th>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Risk Score</th>
            <th style={{ padding: '0.5rem 0.65rem', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((threat) => (
            <tr
              key={threat.id}
              style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)', cursor: onSelectThreat ? 'pointer' : 'default' }}
              onClick={() => onSelectThreat && onSelectThreat(threat.id)}
            >
              <td style={{ padding: '0.45rem 0.65rem', color: '#64748b', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.725rem' }}>
                {threat.time}
              </td>
              <td style={{ padding: '0.45rem 0.65rem', color: '#38bdf8', fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>
                {threat.ipAddress}
              </td>
              <td style={{ padding: '0.45rem 0.65rem', color: '#cbd5e1' }}>
                <span style={{ padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(51, 65, 85, 0.8)', fontSize: '0.7rem' }}>
                  {threat.protocol}
                </span>
              </td>
              <td style={{ padding: '0.45rem 0.65rem', color: '#e2e8f0' }}>{threat.event}</td>
              <td style={{ padding: '0.45rem 0.65rem' }}>{getRiskScoreBadge(threat.riskScore, threat.severity)}</td>
              <td style={{ padding: '0.45rem 0.65rem' }}>{getStatusBadge(threat.status, threat.severity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
