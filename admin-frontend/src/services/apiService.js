
/**
 * SentinelAI SOC Admin API Service
 * Centralized API client connecting the React Admin Frontend (Port 5174)
 * to the FastAPI Backend (http://127.0.0.1:8000/api).
 */

import { ROUTES } from '../constants/routes';

const API_BASE_URL = (
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_API_BASE_URL
)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : 'http://127.0.0.1:8000/api';

const TOKEN_STORAGE_KEY = 'sentinel_admin_token';

/**
 * Retrieves the stored JWT authentication token from localStorage.
 */
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the JWT authentication token in localStorage.
 */
export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage access restrictions.
  }
}

/**
 * Removes the stored JWT token and logs out the admin user.
 */
export function logoutAdmin() {
  setStoredToken(null);
}

/**
 * Core HTTP request wrapper.
 * Automatically attaches the Authorization Bearer token if present.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    ...(options.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {}),
  };

  const token = getStoredToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;

  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new Error(
      `Network failure connecting to SentinelAI backend at ${url}: ${err.message}`,
      { cause: err }
    );
  }

  let data = null;
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else if (response.status !== 204) {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const isAuthLogin = endpoint.includes('/auth/login');

    if (response.status === 401 && !isAuthLogin) {
      logoutAdmin();

      if (
        typeof window !== 'undefined' &&
        window.location.hash !== ROUTES.ADMIN_LOGIN
      ) {
        window.location.hash = ROUTES.ADMIN_LOGIN;
      }

      throw new Error('Your session has expired. Please log in again.');
    }

    const errorMsg =
      (data && typeof data === 'object' && (data.detail || data.message)) ||
      `HTTP Error ${response.status}: ${response.statusText}`;

    throw new Error(
      typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)
    );
  }

  return data;
}

// ==========================================
// RESPONSE ADAPTERS
// ==========================================

/**
 * Converts a backend UTC timestamp to IST, formatted as YYYY-MM-DD HH:MM:SS.
 */
export function toIST(ts) {
  if (!ts) return null;
  let s = String(ts);
  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
  const d = new Date(s);
  if (isNaN(d.getTime())) return ts;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const g = (type) => parts.find((x) => x.type === type).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

/**
 * Normalizes backend ThreatRecord data to the React UI format.
 */
export function adaptThreatRecord(threat) {
  if (!threat) return null;

  const attackType = String(threat.attack_type || '');
  const explicitProtocol = String(threat.protocol || '').toUpperCase();

  let protocol = explicitProtocol;

  // Infer protocol only when the backend hasn't provided one.
  if (!protocol) {
    if (/\bSSH\b/i.test(attackType)) {
      protocol = 'SSH';
    } else if (/\bHTTP\b/i.test(attackType)) {
      protocol = 'HTTP';
    } else {
      protocol = 'OTHER';
    }
  }

  const numericRiskScore = Number(threat.risk_score);

  return {
    id: threat.event_id || `TH-${threat.id ?? 'unknown'}`,
    backendId: threat.id,
    eventId: threat.event_id,

    ipAddress: threat.source_ip || '0.0.0.0',
    event: attackType || 'ANOMALOUS_ACTIVITY',
    attackType,
    protocol,

    riskScore: Number.isFinite(numericRiskScore)
      ? numericRiskScore
      : 0,

    severity: threat.risk_level || 'Low',
    status: threat.response_status || 'MONITOR',
    responseStatus: threat.response_status,

    location: [
      threat.source_city,
      threat.source_region,
      threat.source_country,
    ]
      .filter(Boolean)
      .join(', ') || 'Unknown Location',

    sourceCountry: threat.source_country,
    sourceCity: threat.source_city,
    sourceLat: threat.source_lat,
    sourceLng: threat.source_lng,
    targetCity: threat.target_city || 'Bengaluru',

    isAnomalous:
      threat.is_anomalous ?? (threat.prediction === -1),

    prediction: threat.prediction,
    anomalyScore: threat.anomaly_score,

    // Preserve the backend timestamp instead of inventing one.
    time: toIST(threat.timestamp),
    timestamp: threat.timestamp || null,
  };
}

/**
 * Normalizes backend SOC metrics to the React dashboard format.
 */
export function adaptSocMetrics(metrics) {
  if (!metrics) return null;

  const activeCount =
    metrics.activeCount ?? metrics.events_24h ?? 0;

  const highRiskCount =
    metrics.highRiskCount ?? metrics.active_threats ?? 0;

  const blockedCount =
    metrics.blockedCount ?? metrics.blocked_ips ?? 0;

  return {
    activeThreats: highRiskCount,
    events24h: activeCount,
    blockedIps: blockedCount,
    systemHealth: metrics.system_health || 'OPTIMAL',

    overviewMetrics: {
      totalEvents: {
        value: activeCount,
        changePercent: 'Live',
        label: 'past 24h',
        isIncrease: true,
      },

      anomaliesDetected: {
        value: highRiskCount,
        changePercent: 'Live',
        label: 'active threats',
        isIncrease: true,
      },

      highRiskEvents: {
        value: highRiskCount,
        changePercent: 'Live',
        label: 'high severity',
        isIncrease: true,
      },

      blockedAttacks: {
        value: blockedCount,
        changePercent: 'Live',
        label: 'reported mitigations',
        isIncrease: true,
      },
    },
  };
}

// ==========================================
// API FUNCTIONS
// ==========================================

/**
 * Authenticates SOC Admin credentials.
 * POST /api/auth/login
 */
export async function loginAdmin(username, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (data && data.role !== 'admin') {
    throw new Error('Access denied: SOC Admin authorization required');
  }

  if (data && data.access_token) {
    setStoredToken(data.access_token);
  }

  return data;
}

/**
 * Fetches SOC telemetry summary metrics.
 * GET /api/soc/metrics
 */
export async function fetchSocMetrics() {
  const rawMetrics = await request('/soc/metrics');

  return {
    raw: rawMetrics,
    adapted: adaptSocMetrics(rawMetrics),
  };
}

/**
 * Fetches filterable threat feed records.
 * GET /api/soc/threats
 *
 * Supported parameters depend on the backend endpoint.
 */
export async function fetchSocThreats(params = {}) {
  const query = new URLSearchParams();

  if (params.timeframe) {
    query.append('timeframe', params.timeframe);
  }

  if (params.severity && params.severity !== 'ALL') {
    query.append('severity', params.severity);
  }

  if (params.limit != null) {
    query.append('limit', String(params.limit));
  }

  const queryString = query.toString();
  const endpoint = `/soc/threats${queryString ? `?${queryString}` : ''}`;

  const rawThreats = await request(endpoint);

  const adaptedThreats = (
    Array.isArray(rawThreats) ? rawThreats : []
  )
    .map(adaptThreatRecord)
    .filter(Boolean);

  return {
    raw: rawThreats,
    adapted: adaptedThreats,
  };
}

/**
 * Fetches attack map nodes and telemetry vectors.
 * GET /api/soc/attack-map
 */
export async function fetchAttackMap() {
  return await request('/soc/attack-map');
}

/**
 * Fetches system security audit logs.
 * GET /api/soc/logs
 */
export async function fetchSocLogs() {
  return await request('/soc/logs');
}

/**
 * Fetches active SOAR mitigation policies.
 * GET /api/mitigation/policies
 */
export async function fetchSoarPolicies() {
  return await request('/mitigation/policies');
}

/**
 * Enables or disables a SOAR mitigation policy.
 * PATCH /api/mitigation/policies/{policy_name}
 */
export async function toggleSoarPolicy(policyName, enabled) {
  const encodedName = encodeURIComponent(policyName);

  return await request(`/mitigation/policies/${encodedName}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Fetches the SOAR audit trail.
 * GET /api/mitigation/audit-trail
 */
export async function fetchSoarAuditTrail() {
  return await request('/mitigation/audit-trail');
}

// ---------------- Secure files (admin) ----------------
/**
 * GET /api/files/admin/all
 */
export async function fetchAdminFiles() {
  return await request('/files/admin/all');
}

/**
 * GET /api/files/admin/flagged
 * Returns { flagged_events: [...], user_patterns: [...] }
 */
export async function fetchAdminFlagged() {
  return await request('/files/admin/flagged');
}