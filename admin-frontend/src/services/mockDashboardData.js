/**
 * SentinelAI SOC Dashboard Mock Data Store
 * Isolated data layer structured to match future FastAPI backend response schemas.
 */

export const MOCK_NOTIFICATIONS = [
  {
    id: 'NOTIF-01',
    title: 'High Risk SSH Brute Force Detected',
    message: 'IP 192.0.2.30 exceeded 15 failed password attempts on SSH Cowrie Node.',
    severity: 'critical',
    time: '4 mins ago',
    unread: true,
  },
  {
    id: 'NOTIF-02',
    title: 'Isolation Forest Anomaly Alert',
    message: 'Unusual outbound network surge flagged with anomaly confidence score 0.94.',
    severity: 'high',
    time: '12 mins ago',
    unread: true,
  },
  {
    id: 'NOTIF-03',
    title: 'AWS CloudTrail IAM Policy Change',
    message: 'IAM administrator policy updated outside normal business hours.',
    severity: 'medium',
    time: '35 mins ago',
    unread: true,
  },
  {
    id: 'NOTIF-04',
    title: 'Automated Response IP Block',
    message: 'IP 45.33.21.9 successfully added to perimeter firewall blocklist.',
    severity: 'low',
    time: '1 hour ago',
    unread: false,
  },
];

export const MOCK_THREAT_DETAILS = {
  'TH-9021': {
    id: 'TH-9021',
    time: '2026-09-24 18:23:01',
    ipAddress: '192.0.2.30',
    protocol: 'SSH',
    event: 'SSH Brute Force Attack',
    riskScore: 92,
    severity: 'High',
    status: 'Alert',
    location: 'Frankfurt, Germany (AS14061 DigitalOcean)',
    targetComponent: 'SSH Honeypot Node-01',
    payloadSnippet: 'USER root PASS admin123; USER root PASS 123456; USER admin PASS admin',
    isolationForestScore: 0.94,
    recommendedAction: 'Automated IP Quarantine & Rate Limiting Enabled',
    historicalAttemptsCount: 48,
  },
  'TH-9020': {
    id: 'TH-9020',
    time: '2026-09-24 18:22:59',
    ipAddress: '192.0.2.40',
    protocol: 'SSH',
    event: 'Credential Stuffing',
    riskScore: 78,
    severity: 'Medium',
    status: 'Review',
    location: 'Singapore (AS45102 Alibaba Cloud)',
    targetComponent: 'SSH Honeypot Node-02',
    payloadSnippet: 'USER oracle PASS oracle123; USER postgres PASS postgres',
    isolationForestScore: 0.82,
    recommendedAction: 'Flagged for Analyst Verification',
    historicalAttemptsCount: 19,
  },
  'TH-9019': {
    id: 'TH-9019',
    time: '2026-09-24 18:15:06',
    ipAddress: '192.0.2.50',
    protocol: 'HTTP',
    event: 'SQL Injection Payload',
    riskScore: 65,
    severity: 'Medium',
    status: 'Investigating',
    location: 'Virginia, US (AS16509 Amazon Web Services)',
    targetComponent: 'HTTP Trap Node-01',
    payloadSnippet: "GET /api/v1/auth?user=admin' UNION SELECT 1,version(),user()--",
    isolationForestScore: 0.76,
    recommendedAction: 'Inspect Web Application Firewall Rule Match',
    historicalAttemptsCount: 7,
  },
  'TH-9018': {
    id: 'TH-9018',
    time: '2026-09-24 18:10:21',
    ipAddress: '192.0.2.10',
    protocol: 'SSH',
    event: 'Dictionary Attack Attempt',
    riskScore: 88,
    severity: 'High',
    status: 'Alert',
    location: 'Amsterdam, Netherlands (AS20473 Choopa LLC)',
    targetComponent: 'SSH Honeypot Node-01',
    payloadSnippet: 'USER support PASS support; USER service PASS service2026',
    isolationForestScore: 0.89,
    recommendedAction: 'Automated IP Quarantine Enabled',
    historicalAttemptsCount: 33,
  },
  'TH-9017': {
    id: 'TH-9017',
    time: '2026-09-24 18:06:21',
    ipAddress: '127.0.0.1',
    protocol: 'HTTP',
    event: 'Internal Admin Access',
    riskScore: 42,
    severity: 'Low',
    status: 'Normal',
    location: 'Internal Security Operations Subnet',
    targetComponent: 'SOC Monitoring Portal',
    payloadSnippet: 'GET /dashboard HTTP/1.1 User-Agent: Sentinel-Analyst-Session',
    isolationForestScore: 0.12,
    recommendedAction: 'Routine Whitelisted Access Logged',
    historicalAttemptsCount: 1,
  },
};

export const getThreatDetailsById = (id) => {
  if (MOCK_THREAT_DETAILS[id]) {
    return MOCK_THREAT_DETAILS[id];
  }
  return {
    id: id || 'TH-UNKNOWN',
    time: '2026-09-24 18:00:00',
    ipAddress: '192.0.2.254',
    protocol: 'HTTP',
    event: 'Anomalous Network Probe',
    riskScore: 70,
    severity: 'Medium',
    status: 'Investigating',
    location: 'External Telemetry Probe',
    targetComponent: 'Cloud Perimeter Sensor',
    payloadSnippet: 'HEAD /api/v1/telemetry HTTP/1.1 Host: honeypot.sentinel.ai',
    isolationForestScore: 0.79,
    recommendedAction: 'Automated Observation & Session Capture',
    historicalAttemptsCount: 12,
  };
};

const DATA_24H = {
  systemStatus: {
    cloudConnected: true,
    statusText: 'Cloud Connected',
    unreadAlertsCount: 3,
    version: 'v1.0',
    components: [
      { name: 'Honeypots', status: 'Online', isOperational: true },
      { name: 'Backend API', status: 'Online', isOperational: true },
      { name: 'Database', status: 'Online', isOperational: true },
      { name: 'Cloud Storage', status: 'Online', isOperational: true },
    ],
  },
  overviewMetrics: {
    totalEvents: { value: 156, changePercent: '+12%', label: 'vs. previous 24h', isIncrease: true },
    anomaliesDetected: { value: 23, changePercent: '+28%', label: 'vs. previous 24h', isIncrease: true },
    highRiskEvents: { value: 8, changePercent: '+60%', label: 'vs. previous 24h', isIncrease: true },
    blockedAttacks: { value: 15, changePercent: '+25%', label: 'vs. previous 24h', isIncrease: true },
  },
  attackActivityTimeSeries: {
    labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    httpRequests: [10, 22, 12, 18, 34, 15, 26, 17],
    sshAttempts: [4, 9, 3, 5, 14, 7, 12, 8],
    anomalies: [0, 2, 0, 1, 6, 1, 4, 1],
  },
  threatDistribution: {
    totalEvents: 156,
    breakdown: [
      { protocol: 'HTTP', percentage: 52, color: '#38bdf8' },
      { protocol: 'SSH', percentage: 36, color: '#818cf8' },
      { protocol: 'Other', percentage: 12, color: '#64748b' },
    ],
  },
  recentThreats: Object.values(MOCK_THREAT_DETAILS),
  honeypotMonitoring: {
    sshHoneypot: {
      title: 'SSH Honeypot',
      loginAttempts: 18,
      successfulLogins: 0,
      commandsExecuted: 12,
      sparkline: [3, 8, 4, 12, 6, 18, 10],
    },
    httpHoneypot: {
      title: 'HTTP Honeypot',
      requestsCaptured: 42,
      uniqueIps: 11,
      suspiciousEndpoints: 6,
      sparkline: [5, 12, 8, 25, 14, 42, 28],
    },
  },
  aiMlAnalysis: {
    modelName: 'Isolation Forest',
    modelDescription: 'Anomaly Detection Model',
    normalActivityPercentage: 77,
    anomalousActivityPercentage: 23,
    averageRiskScore: 64,
    riskLevel: 'Moderate Risk',
  },
  recentLogs: [
    { id: 'LOG-401', time: '2026-09-24 18:23:01', ipAddress: '192.0.2.30', event: 'login_attempt', risk: 'High', severityClass: 'high' },
    { id: 'LOG-402', time: '2026-09-24 18:22:58', ipAddress: '192.0.2.20', event: 'login_attempt', risk: 'Medium', severityClass: 'medium' },
    { id: 'LOG-403', time: '2026-09-24 18:15:05', ipAddress: '192.0.2.30', event: 'http_request', risk: 'Medium', severityClass: 'medium' },
    { id: 'LOG-404', time: '2026-09-24 18:10:21', ipAddress: '192.0.2.10', event: 'login_attempt', risk: 'High', severityClass: 'high' },
  ],
  automatedResponse: {
    status: 'Active',
    policies: [
      { name: 'Block malicious IPs', enabled: true },
      { name: 'Rate limiting', enabled: true },
      { name: 'Alert notifications', enabled: true },
      { name: 'Log to database', enabled: true },
      { name: 'Cloud storage backup', enabled: true },
    ],
  },
};

const DATA_7D = {
  ...DATA_24H,
  overviewMetrics: {
    totalEvents: { value: 1240, changePercent: '+18%', label: 'vs. previous 7d', isIncrease: true },
    anomaliesDetected: { value: 185, changePercent: '+34%', label: 'vs. previous 7d', isIncrease: true },
    highRiskEvents: { value: 64, changePercent: '+45%', label: 'vs. previous 7d', isIncrease: true },
    blockedAttacks: { value: 110, changePercent: '+30%', label: 'vs. previous 7d', isIncrease: true },
  },
  attackActivityTimeSeries: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    httpRequests: [120, 180, 210, 195, 240, 160, 135],
    sshAttempts: [45, 65, 80, 72, 95, 50, 43],
    anomalies: [12, 18, 25, 22, 34, 15, 10],
  },
  threatDistribution: {
    totalEvents: 1240,
    breakdown: [
      { protocol: 'HTTP', percentage: 58, color: '#38bdf8' },
      { protocol: 'SSH', percentage: 31, color: '#818cf8' },
      { protocol: 'Other', percentage: 11, color: '#64748b' },
    ],
  },
  honeypotMonitoring: {
    sshHoneypot: {
      title: 'SSH Honeypot',
      loginAttempts: 450,
      successfulLogins: 0,
      commandsExecuted: 280,
      sparkline: [45, 65, 80, 72, 95, 50, 43],
    },
    httpHoneypot: {
      title: 'HTTP Honeypot',
      requestsCaptured: 790,
      uniqueIps: 184,
      suspiciousEndpoints: 42,
      sparkline: [120, 180, 210, 195, 240, 160, 135],
    },
  }
};

const DATA_30D = {
  ...DATA_24H,
  overviewMetrics: {
    totalEvents: { value: 5820, changePercent: '+22%', label: 'vs. previous 30d', isIncrease: true },
    anomaliesDetected: { value: 790, changePercent: '+40%', label: 'vs. previous 30d', isIncrease: true },
    highRiskEvents: { value: 280, changePercent: '+52%', label: 'vs. previous 30d', isIncrease: true },
    blockedAttacks: { value: 490, changePercent: '+38%', label: 'vs. previous 30d', isIncrease: true },
  },
  attackActivityTimeSeries: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    httpRequests: [1100, 1450, 1800, 1470],
    sshAttempts: [420, 580, 710, 560],
    anomalies: [140, 210, 260, 180],
  },
  threatDistribution: {
    totalEvents: 5820,
    breakdown: [
      { protocol: 'HTTP', percentage: 61, color: '#38bdf8' },
      { protocol: 'SSH', percentage: 28, color: '#818cf8' },
      { protocol: 'Other', percentage: 11, color: '#64748b' },
    ],
  },
  honeypotMonitoring: {
    sshHoneypot: {
      title: 'SSH Honeypot',
      loginAttempts: 2270,
      successfulLogins: 0,
      commandsExecuted: 1350,
      sparkline: [420, 580, 710, 560],
    },
    httpHoneypot: {
      title: 'HTTP Honeypot',
      requestsCaptured: 3550,
      uniqueIps: 620,
      suspiciousEndpoints: 185,
      sparkline: [1100, 1450, 1800, 1470],
    },
  }
};

export function getMockDashboardData(timeframe = '24h') {
  if (timeframe === '7d') return DATA_7D;
  if (timeframe === '30d') return DATA_30D;
  return DATA_24H;
}

export const MOCK_DASHBOARD_DATA = DATA_24H;
