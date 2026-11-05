/**
 * ThreatDistributionDonut — Risk Level Distribution Chart
 * Shows CRITICAL / HIGH / MEDIUM / LOW breakdown from real threat data.
 * Accepts either risk-level-based breakdown (new) or protocol-based (legacy fallback).
 */
export default function ThreatDistributionDonut({ data }) {
  if (!data) return null;

  const total = data.totalEvents || 0;
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // Normalise percentages to always sum to 100 to avoid SVG rendering gaps
  const rawBreakdown = data.breakdown || [];
  const totalPct = rawBreakdown.reduce((s, i) => s + (i.percentage || 0), 0);
  const breakdown = rawBreakdown.map((item) => ({
    ...item,
    percentage: totalPct > 0 ? Math.round((item.percentage / totalPct) * 100) : 0,
  }));

  let cumulative = 0;
  const slices = breakdown.map((item) => {
    const dashArray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const dashOffset = -((cumulative / 100) * circumference);
    cumulative += item.percentage;
    return { ...item, dashArray, dashOffset };
  });

  // Determine display key — support both 'label' (risk level) and 'protocol' (legacy)
  const getLabel = (item) => item.label || item.protocol || '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
      {/* Donut SVG */}
      <div style={{ position: 'relative', width: 135, height: 135, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 135 135" width="135" height="135" style={{ transform: 'rotate(-90deg)' }}>
          {total === 0 ? (
            <circle cx="67.5" cy="67.5" r={radius} fill="transparent"
              stroke="rgba(100,116,139,0.3)" strokeWidth={strokeWidth} />
          ) : (
            slices.map((slice) => (
              <circle
                key={getLabel(slice)}
                cx="67.5"
                cy="67.5"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={slice.dashArray}
                strokeDashoffset={slice.dashOffset}
                strokeLinecap="round"
              />
            ))
          )}
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {data.chartLabel || 'Total Events'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
        {breakdown.map((item) => (
          <div key={getLabel(item)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{getLabel(item)}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {item.count !== undefined && (
                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{item.count}</span>
              )}
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>{item.percentage}%</span>
            </div>
          </div>
        ))}
        {total === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', paddingTop: '0.25rem' }}>
            No threat data for this period
          </div>
        )}
      </div>
    </div>
  );
}
