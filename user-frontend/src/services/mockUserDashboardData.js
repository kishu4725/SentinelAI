/**
 * SentinelAI Normal User Dashboard Mock Data Layer
 * Isolated data layer structured for ordinary end-user security portal endpoints.
 * Structured to map easily to future FastAPI response payloads.
 */

export const MOCK_USER_PROFILE = {
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  username: 'alex_sentinel',
  role: 'Standard User',
  memberSince: '2025-11-14',
  lastLogin: '2026-09-25 10:42:18',
  activeSessionsCount: 2,
  accountStatus: 'Secure',
  securityScore: 98,
  securityStatusText: 'Safe',
};

export const MOCK_USER_DASHBOARD_METRICS = {
  securityStatus: {
    statusText: 'Secure',
    subtext: 'Account protection active',
    score: 98,
    level: 'Safe',
  },
  totalEvents: {
    value: 142,
    changeText: '+12 this week',
    label: 'Total Security Verification Checks',
  },
  activeAlerts: {
    value: 2,
    statusText: 'Normal',
    subtext: '1 Medium, 1 Low priority',
  },
};

export const MOCK_SECURITY_ACTIVITY_CHART = [
  { day: 'Mon', events: 14, risk: 2 },
  { day: 'Tue', events: 22, risk: 1 },
  { day: 'Wed', events: 18, risk: 4 },
  { day: 'Thu', events: 35, risk: 8 },
  { day: 'Fri', events: 28, risk: 3 },
  { day: 'Sat', events: 12, risk: 1 },
  { day: 'Sun', events: 15, risk: 2 },
];

export const MOCK_RECENT_SECURITY_EVENTS = [
  {
    id: 'EVT-501',
    time: '2026-09-25 10:42',
    timestamp: '2026-09-25 10:42',
    activity: 'Successful Login',
    event: 'Successful Login',
    status: 'Success',
    risk: 'Normal',
    device: 'Chrome 128 on macOS',
    ip: '192.0.2.45',
    ipAddress: '192.0.2.45',
  },
  {
    id: 'EVT-502',
    time: '2026-09-24 15:15',
    timestamp: '2026-09-24 15:15',
    activity: 'Password Update',
    event: 'Password Update',
    status: 'Completed',
    risk: 'Secure',
    device: 'Chrome 128 on macOS',
    ip: '192.0.2.45',
    ipAddress: '192.0.2.45',
  },
  {
    id: 'EVT-503',
    time: '2026-09-23 20:12',
    timestamp: '2026-09-23 20:12',
    activity: 'New Session Authorized',
    event: 'New Session Authorized',
    status: 'Success',
    risk: 'Normal',
    device: 'Safari Mobile on iOS',
    ip: '198.51.100.12',
    ipAddress: '198.51.100.12',
  },
  {
    id: 'EVT-504',
    time: '2026-09-21 02:04',
    timestamp: '2026-09-21 02:04',
    activity: 'Suspicious Login Attempt',
    event: 'Suspicious Login Attempt',
    status: 'Blocked',
    risk: 'High',
    device: 'Firefox 125 on Linux',
    ip: '198.51.100.99',
    ipAddress: '198.51.100.99',
  },
  {
    id: 'EVT-505',
    time: '2026-09-20 18:30',
    timestamp: '2026-09-20 18:30',
    activity: 'User Sign Out',
    event: 'User Sign Out',
    status: 'Success',
    risk: 'Normal',
    device: 'Chrome 128 on macOS',
    ip: '192.0.2.45',
    ipAddress: '192.0.2.45',
  },
];

export const MOCK_RECENT_LOGINS = MOCK_RECENT_SECURITY_EVENTS;
export const MOCK_USER_SECURITY_ACTIVITY = MOCK_RECENT_SECURITY_EVENTS;

export const MOCK_USER_ALERTS = [
  {
    id: 'UALERT-01',
    title: 'Suspicious Login Attempt Blocked',
    message: 'An unauthorized login attempt from Frankfurt, DE (198.51.100.99) was blocked by SentinelAI protection.',
    severity: 'High',
    time: '2 hours ago',
    unread: true,
  },
  {
    id: 'UALERT-02',
    title: 'New Session Authorized',
    message: 'New session signed in on Safari (iPhone 15 Pro) in San Francisco, CA.',
    severity: 'Medium',
    time: '2 days ago',
    unread: true,
  },
  {
    id: 'UALERT-03',
    title: 'Security Score Updated',
    message: 'Your account security rating is optimal. No leaked credentials detected.',
    severity: 'Normal',
    time: '1 week ago',
    unread: false,
  },
];

export const MOCK_ACTIVE_SESSIONS = [
  {
    id: 'SESS-01',
    device: 'MacBook Pro 16" (Chrome 128.0)',
    location: 'San Francisco, CA, US',
    ip: '192.0.2.45',
    current: true,
    lastActive: 'Active Now',
  },
  {
    id: 'SESS-02',
    device: 'iPhone 15 Pro (SentinelAI Mobile App)',
    location: 'San Francisco, CA, US',
    ip: '198.51.100.12',
    current: false,
    lastActive: '2 hours ago',
  },
];

export const MOCK_USER_REPORTS = [
  {
    id: 'REP-2026-09',
    title: 'Monthly Security Audit Report - September 2026',
    date: '2026-09-25',
    summary: '0 breaches detected, 1 suspicious login blocked, 2FA enabled.',
    type: 'Monthly Audit',
    status: 'Available',
  },
  {
    id: 'REP-2026-08',
    title: 'Monthly Security Audit Report - August 2026',
    date: '2026-08-31',
    summary: '100% account uptime, 0 password compromises detected.',
    type: 'Monthly Audit',
    status: 'Available',
  },
  {
    id: 'REP-SESS-01',
    title: 'Authorized Devices & Session Audit',
    date: '2026-09-20',
    summary: 'Detailed footprint of active Mac and iOS sessions.',
    type: 'Session Audit',
    status: 'Available',
  },
];
