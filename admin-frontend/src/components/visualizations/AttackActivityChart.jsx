
import { useId, useMemo } from 'react';

export default function AttackActivityChart({ data }) {
  const gradientId = useId().replace(/:/g, '');

  const width = 600;
  const height = 150;
  const paddingLeft = 30;
  const paddingBottom = 22;
  const paddingTop = 10;
  const paddingRight = 10;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data.labels)) {
      return null;
    }

    const labels = data.labels;
    const length = labels.length;

    if (length === 0) {
      return null;
    }

    const normalizeArray = (values) =>
      Array.from({ length }, (_, index) => {
        const value = Array.isArray(values) ? Number(values[index]) : 0;
        return Number.isFinite(value) ? Math.max(0, value) : 0;
      });

    const httpRequests = normalizeArray(data.httpRequests);
    const sshAttempts = normalizeArray(data.sshAttempts);
    const anomalies = normalizeArray(data.anomalies);

    // Anomalies are displayed as scaled bars, matching the original design.
    const maxValue = Math.max(
      10,
      ...httpRequests,
      ...sshAttempts,
      ...anomalies.map((value) => value * 4)
    );

    // Round the Y-axis maximum up to a readable interval.
    const maxVal = Math.ceil(maxValue / 10) * 10;
    const tickStep = maxVal / 4;
    const yTicks = Array.from(
      { length: 5 },
      (_, index) => index * tickStep
    );

    return {
      labels,
      httpRequests,
      sshAttempts,
      anomalies,
      maxVal,
      yTicks,
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="attack-chart-container" style={{ width: '100%' }}>
        <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem' }}>
          No attack activity data available.
        </p>
      </div>
    );
  }

  const {
    labels,
    httpRequests,
    sshAttempts,
    anomalies,
    maxVal,
    yTicks,
  } = chartData;

  const getX = (index) => {
    if (labels.length <= 1) {
      return paddingLeft + chartWidth / 2;
    }

    return paddingLeft + (index / (labels.length - 1)) * chartWidth;
  };

  const getY = (value) => {
    const safeValue = Math.max(0, Math.min(value, maxVal));

    return paddingTop + chartHeight - (safeValue / maxVal) * chartHeight;
  };

  const createPoints = (values) =>
    values
      .map((value, index) => `${getX(index)},${getY(value)}`)
      .join(' ');

  const createAreaPath = (values) => {
    const baseline = getY(0);

    if (values.length === 1) {
      return `M ${getX(0)},${baseline} L ${getX(0)},${getY(values[0])} L ${getX(0)},${baseline} Z`;
    }

    return (
      `M ${getX(0)},${baseline} ` +
      values
        .map((value, index) => `L ${getX(index)},${getY(value)}`)
        .join(' ') +
      ` L ${getX(values.length - 1)},${baseline} Z`
    );
  };

  const httpPoints = createPoints(httpRequests);
  const sshPoints = createPoints(sshAttempts);

  const httpAreaPath = createAreaPath(httpRequests);
  const sshAreaPath = createAreaPath(sshAttempts);

  const httpGradientId = `httpGrad-${gradientId}`;
  const sshGradientId = `sshGrad-${gradientId}`;

  return (
    <div className="attack-chart-container" style={{ width: '100%' }}>
      <div
        className="chart-legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'flex-end',
          fontSize: '0.725rem',
          fontWeight: 600,
          marginBottom: '0.35rem',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#38bdf8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
          HTTP Requests
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#818cf8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8' }} />
          SSH Attempts
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
          Anomalies
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Attack activity chart showing HTTP requests, SSH attempts, and anomalies"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          maxHeight: '160px',
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient id={httpGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={sshGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid and labels */}
        {yTicks.map((value) => {
          const y = getY(value);

          return (
            <g key={`tick-${value}`}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="rgba(255, 255, 255, 0.07)"
                strokeDasharray="3 3"
              />

              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="9"
                fontFamily="sans-serif"
              >
                {Number.isInteger(value) ? value : value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {labels.map((label, index) => (
          <text
            key={`label-${index}`}
            x={getX(index)}
            y={height - 4}
            textAnchor="middle"
            fill="#64748b"
            fontSize="9"
            fontFamily="sans-serif"
          >
            {label}
          </text>
        ))}

        {/* Filled activity areas */}
        <path d={httpAreaPath} fill={`url(#${httpGradientId})`} />
        <path d={sshAreaPath} fill={`url(#${sshGradientId})`} />

        {/* Anomaly bars */}
        {anomalies.map((value, index) => {
          if (value === 0) {
            return null;
          }

          const x = getX(index);
          const scaledValue = Math.min(value * 4, maxVal);
          const y = getY(scaledValue);
          const baseline = getY(0);

          return (
            <rect
              key={`anomaly-${index}`}
              x={x - 2}
              y={y}
              width={4}
              height={Math.max(0, baseline - y)}
              fill="#ef4444"
              rx={1}
            >
              <title>{`Anomalies: ${value}`}</title>
            </rect>
          );
        })}

        {/* Activity lines */}
        <polyline
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          points={sshPoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          points={httpPoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* HTTP data points */}
        {httpRequests.map((value, index) => (
          <circle
            key={`http-dot-${index}`}
            cx={getX(index)}
            cy={getY(value)}
            r="2.5"
            fill="#070a12"
            stroke="#38bdf8"
            strokeWidth="1.5"
          >
            <title>{`HTTP Requests: ${value}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
