export default function HoneypotSparkline({ points = [5, 10, 8, 15, 12, 20], color = '#818cf8' }) {
  const width = 120;
  const height = 26;
  const maxVal = Math.max(...points, 1);
  const minVal = Math.min(...points, 0);
  const range = maxVal - minVal || 1;

  const svgPoints = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - minVal) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ width: '100%', marginTop: '0.35rem' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '26px', overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          points={svgPoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
