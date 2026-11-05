import { MOCK_SECURITY_ACTIVITY_CHART } from '../../services/mockUserDashboardData';

export default function UserSecurityActivityChart() {
  const data = MOCK_SECURITY_ACTIVITY_CHART;
  const maxEvents = Math.max(...data.map((d) => d.events), 40);

  const width = 600;
  const height = 160;
  const paddingX = 40;
  const paddingY = 25;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y = height - paddingY - (d.events / maxEvents) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Security Verification Trend</span>
          <div style={{ fontSize: '0.925rem', fontWeight: 700, color: '#f8fafc' }}>Weekly Account Activity Flow</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#94a3b8' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Account Verification Checks
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="userActivityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(51, 65, 85, 0.6)" />

          {/* Fill area */}
          <path d={areaD} fill="url(#userActivityGrad)" />

          {/* Line stroke */}
          <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
              <text x={pt.x} y={height - 5} fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="600">
                {pt.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
