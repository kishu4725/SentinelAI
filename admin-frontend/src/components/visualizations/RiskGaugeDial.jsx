export default function RiskGaugeDial({ score = 64, riskLevel = 'Moderate Risk' }) {
  const radius = 45;
  const circumference = Math.PI * radius;
  const fillArc = (score / 100) * circumference;

  let arcColor = '#38bdf8';
  if (score >= 75) arcColor = '#ef4444';
  else if (score >= 50) arcColor = '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 115, height: 62, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
        <svg viewBox="0 0 115 62" width="115" height="62">
          <path
            d="M 12.5 58 A 45 45 0 0 1 102.5 58"
            fill="none"
            stroke="rgba(30, 41, 59, 0.8)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 12.5 58 A 45 45 0 0 1 102.5 58"
            fill="none"
            stroke={arcColor}
            strokeWidth="10"
            strokeDasharray={`${fillArc} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, textAlign: 'center' }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{score}</span>
        </div>
      </div>
      <div style={{ marginTop: '0.25rem', fontSize: '0.725rem', fontWeight: 700, color: arcColor }}>
        {riskLevel}
      </div>
    </div>
  );
}
