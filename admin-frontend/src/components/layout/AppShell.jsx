import { useState, useRef, useEffect } from 'react';
import { ROUTES } from '../../constants/routes';
import { MOCK_DASHBOARD_DATA } from '../../services/mockDashboardData';
import {
  connectSOCWebSocket,
  subscribeWebSocketStatus,
  subscribeThreatEvents,
} from '../../services/socWebSocket';
import {
  initAudioContext,
  playSeveritySound,
  isAudioMuted,
  toggleAudioMute,
  testAlertSound,
} from '../../services/audioAlerts';
import './AppShell.css';

const ALERTS_STORAGE_KEY = 'sentinel_soc_alerts';

function loadStoredAlerts() {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
  } catch {
    return [];
  }
}

function storeAndBroadcastAlerts(alerts, source = 'app-shell') {
  const limited = Array.isArray(alerts) ? alerts.slice(0, 200) : [];
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // Keep the UI working if browser storage is unavailable.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sentinel_soc_alerts_changed', {
      detail: { source, alerts: limited },
    }));
  }
  return limited;
}

function buildStoredAlert(payload, riskScore, eventType, riskLevel, responseStatus, sourceIp, location) {
  const now = new Date();
  const username = payload.username || payload.user || payload.user_id || null;
  return {
    id: payload.event_id,
    title: `${riskScore >= 75 ? '🚨 CRITICAL' : riskScore >= 55 ? '⚠️ HIGH RISK' : riskScore >= 35 ? '🔶 MEDIUM RISK' : 'ℹ️ LOW RISK'}: ${String(eventType).replace(/_/g, ' ')}`,
    message: `Suspicious activity detected from IP ${sourceIp} (${location}).${username ? ` User: ${username}.` : ''} Risk Score: ${riskScore.toFixed(1)} | SOAR Action: ${responseStatus}`,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString(),
    unread: true,
    severity: String(riskLevel || 'LOW').toLowerCase(),
    riskScore,
    eventType,
    sourceIp,
    location,
    responseStatus,
    threatId: payload.threat_id || null,
  };
}


export default function AppShell({ children, onNavigate, activeTab = 'dashboard' }) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => loadStoredAlerts());
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [muted, setMuted] = useState(isAudioMuted());
  const [activeToasts, setActiveToasts] = useState([]);

  const sysStatus = MOCK_DASHBOARD_DATA.systemStatus;

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const seenEventIds = useRef(new Set());

  // Keep the header dropdown and sidebar badge synchronized with the Alerts page.
  useEffect(() => {
    const handleAlertChanges = (event) => {
      const detail = event.detail;
      if (!detail || !Array.isArray(detail.alerts) || detail.source === 'app-shell') return;
      setNotifications(detail.alerts.slice(0, 200));
    };
    const handleStorage = (event) => {
      if (event.key === ALERTS_STORAGE_KEY) setNotifications(loadStoredAlerts());
    };
    window.addEventListener('sentinel_soc_alerts_changed', handleAlertChanges);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('sentinel_soc_alerts_changed', handleAlertChanges);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Initialize WebSocket connection and Web Audio API listener
  useEffect(() => {
    connectSOCWebSocket();

    const unsubStatus = subscribeWebSocketStatus((status) => {
      setWsStatus(status);
    });

    const unsubThreat = subscribeThreatEvents((payload) => {
      if (!payload || !payload.event_id) return;

      // Event Deduplication
      if (seenEventIds.current.has(payload.event_id)) {
        return;
      }
      seenEventIds.current.add(payload.event_id);

      const riskScore = typeof payload.risk_score === 'number' ? payload.risk_score : 0;
      const eventType = payload.event_type || 'SECURITY_EVENT';
      const riskLevel = payload.risk_level || (riskScore >= 75 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : 'LOW');
      const responseStatus = payload.response_status || 'MONITOR';
      const sourceIp = payload.source_ip || '0.0.0.0';
      const location = payload.location || 'Unknown Location';

      // 1. Play Severity-Based Sound + Web Speech Announcement (if not muted & non-normal activity)
      playSeveritySound(riskScore, riskLevel, eventType, payload);

      // 2. Dispatch custom DOM event so active views auto-update threat feed and charts
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sentinel_soc_new_threat', {
            detail: payload,
          })
        );
      }

      // 3. Store one shared alert so the sidebar, dropdown and Alerts page agree.
      const newNotif = buildStoredAlert(
        payload, riskScore, eventType, riskLevel, responseStatus, sourceIp, location
      );
      const existingAlerts = loadStoredAlerts();
      const nextAlerts = existingAlerts.some((item) => item.id === newNotif.id)
        ? existingAlerts
        : [newNotif, ...existingAlerts].slice(0, 200);
      storeAndBroadcastAlerts(nextAlerts, 'app-shell');
      setNotifications(nextAlerts);

      // 4. Trigger sliding Toast notification banner for ALERT / HIGH / CRITICAL events
      if (eventType !== 'LOGIN_SUCCESS' && (riskScore >= 40 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH')) {
        const toastId = `${payload.event_id}-${Date.now()}`;
        const toastItem = {
          id: toastId,
          eventId: payload.event_id,
          title: riskScore >= 75 ? '🚨 CRITICAL SECURITY ALERT' : '⚠️ SECURITY ALERT',
          eventType: eventType,
          msg: `Suspicious activity detected from IP ${sourceIp} (${location})`,
          riskScore: riskScore,
          riskLevel: riskLevel,
          responseStatus: responseStatus,
          time: new Date().toLocaleTimeString(),
          isCritical: riskScore >= 75 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH',
        };

        setActiveToasts((prev) => [toastItem, ...prev.slice(0, 2)]); // Keep max 3 toasts

        // Auto dismiss toast after 6 seconds
        setTimeout(() => {
          setActiveToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 6000);
      }
    });

    // Capture first user gesture to unlock Web Audio API Context safely
    const unlockAudio = () => {
      initAudioContext();
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);

    return () => {
      unsubStatus();
      unsubThreat();
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMuteToggle = () => {
    const nextState = toggleAudioMute();
    setMuted(nextState);
  };

  const removeToast = (id) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navItems = [
    {
      id: 'dashboard',
      route: ROUTES.SOC_DASHBOARD,
      label: 'Dashboard',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'threats',
      route: ROUTES.THREATS,
      label: 'Threats',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z"/>
        </svg>
      ),
    },
    {
      id: 'honeypot',
      route: ROUTES.HONEYPOT_MONITORING,
      label: 'Honeypot Monitoring',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
    {
      id: 'ml_analysis',
      route: ROUTES.AI_ML_ANALYSIS,
      label: 'AI/ML Analysis',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      ),
    },
    {
      id: 'alerts',
      route: ROUTES.ALERTS,
      label: 'Alerts',
      badge: notifications.filter((n) => n.unread).length || null,
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'file_security',
      route: ROUTES.FILE_SECURITY,
      label: 'File Security',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
    },
    {
      id: 'logs',
      route: ROUTES.LOGS,
      label: 'Logs',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 2 2h12a2 2 0 0 2 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'auto_response',
      route: ROUTES.AUTOMATED_RESPONSE,
      label: 'Automated Response',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    },
    {
      id: 'settings',
      route: ROUTES.SETTINGS,
      label: 'Settings',
      icon: (
        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ];

  const handleNavClick = (item) => {
    if (onNavigate) {
      onNavigate(item.route);
    }
  };

  const handleLogout = () => {
    if (onNavigate) {
      onNavigate(ROUTES.ADMIN_LOGIN);
    }
  };

  const markAllRead = () => {
    const updatedAlerts = notifications.map((n) => ({ ...n, unread: false }));
    setNotifications(updatedAlerts);
    storeAndBroadcastAlerts(updatedAlerts, 'app-shell');
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="app-shell" onClick={initAudioContext}>
      {/* Real-Time Toast Banners Overlay */}
      {activeToasts.length > 0 && (
        <div className="soc-toast-container">
          {activeToasts.map((toast) => (
            <div key={toast.id} className={`soc-toast-card ${toast.isCritical ? 'critical' : 'alert'}`}>
              <div className="soc-toast-content">
                <div className="soc-toast-header">
                  <span className="soc-toast-title">{toast.title}</span>
                  <span className="soc-toast-time">{toast.time}</span>
                </div>
                <div className="soc-toast-msg">{toast.msg}</div>
                <div className="soc-toast-meta">
                  <span className="soc-toast-badge">{toast.eventType}</span>
                  <span className="soc-toast-badge" style={{ color: toast.isCritical ? '#f87171' : '#fbbf24' }}>
                    Risk: {toast.riskScore.toFixed(1)}
                  </span>
                  <span className="soc-toast-badge" style={{ color: '#4ade80' }}>
                    SOAR: {toast.responseStatus}
                  </span>
                </div>
              </div>
              <button type="button" className="soc-toast-close" onClick={() => removeToast(toast.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <header className="shell-header">
        <div className="header-left">
          <div className="header-brand" onClick={() => onNavigate && onNavigate(ROUTES.SOC_DASHBOARD)}>
            <svg className="header-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="url(#header-logo-grad)" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 7L16 11H13V17H11V11H8L12 7Z" fill="#ffffff"/>
              <defs>
                <linearGradient id="header-logo-grad" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0284c7" />
                  <stop offset="1" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </svg>
            <div className="header-brand-info">
              <h1 className="header-brand-title">AI-Driven Cloud Threat Intelligence</h1>
              <p className="header-brand-subtitle">Detect • Analyze • Respond</p>
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* WebSocket Real-time Status Badge */}
          <div
            className="status-badge"
            style={{
              background: wsStatus === 'ONLINE' ? 'rgba(34, 197, 94, 0.12)' : wsStatus === 'RECONNECTING' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              borderColor: wsStatus === 'ONLINE' ? 'rgba(34, 197, 94, 0.3)' : wsStatus === 'RECONNECTING' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              color: wsStatus === 'ONLINE' ? '#4ade80' : wsStatus === 'RECONNECTING' ? '#fbbf24' : '#f87171',
            }}
          >
            <span
              className="status-dot"
              style={{
                backgroundColor: wsStatus === 'ONLINE' ? '#22c55e' : wsStatus === 'RECONNECTING' ? '#f59e0b' : '#ef4444',
              }}
            ></span>
            <span>{wsStatus === 'ONLINE' ? 'WS LIVE' : wsStatus === 'RECONNECTING' ? 'RECONNECTING' : 'OFFLINE'}</span>
          </div>

          {/* Web Audio Mute / Unmute Toggle Button */}
          <button
            type="button"
            className={`sound-toggle-btn ${!muted ? 'active' : ''}`}
            onClick={handleMuteToggle}
            title={muted ? 'Unmute alert sounds' : 'Mute alert sounds'}
          >
            {muted ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0a7 7 0 0 1-.11 1.23"/>
                </svg>
                <span>MUTED</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
                <span>SOUND ON</span>
              </>
            )}
          </button>



          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`notification-btn ${isNotifOpen ? 'active' : ''}`}
              title="Unread Notifications"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsProfileOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div className="header-dropdown">
                <div className="dropdown-header">
                  <span>Security Alerts ({unreadCount} unread)</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="dropdown-list">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="dropdown-item"
                      onClick={() => {
                        setIsNotifOpen(false);
                        if (onNavigate) onNavigate(ROUTES.ALERTS);
                      }}
                    >
                      <div className="dropdown-item-content">
                        <div className="dropdown-item-title">{notif.title}</div>
                        <div className="dropdown-item-msg">{notif.message}</div>
                        <div className="dropdown-item-time">{notif.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="user-profile-wrapper">
            <div
              className={`user-profile-badge ${isProfileOpen ? 'active' : ''}`}
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotifOpen(false);
              }}
            >
              <div className="user-avatar">A</div>
              <span>Admin</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {isProfileOpen && (
              <div className="header-dropdown profile-menu-dropdown">
                <div className="dropdown-header">
                  <span>Admin Session</span>
                </div>
                <div
                  className="profile-menu-item"
                  onClick={() => {
                    setIsProfileOpen(false);
                    if (onNavigate) onNavigate(ROUTES.SETTINGS);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Admin Profile
                </div>
                <div
                  className="profile-menu-item"
                  onClick={() => {
                    setIsProfileOpen(false);
                    if (onNavigate) onNavigate(ROUTES.SETTINGS);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  SOC Settings
                </div>
                <div
                  className="profile-menu-item logout"
                  onClick={handleLogout}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out / Logout
                </div>
              </div>
            )}
          </div>

          <button type="button" className="logout-btn" onClick={handleLogout} title="Sign Out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-sidebar">
          <div className="sidebar-nav-group">
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
              >
                <div className="sidebar-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="sidebar-item-badge">{item.badge}</span>}
              </div>
            ))}
          </div>

          <div className="sidebar-bottom-panel">
            <div className="sys-status-card">
              <div className="sys-status-title">
                <span className="status-dot"></span>
                System Status
              </div>
              <div className="sys-component-list">
                {sysStatus.components.map((comp) => (
                  <div key={comp.name} className="sys-component-item">
                    <span>{comp.name}</span>
                    <span className="sys-status-val">{comp.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="sidebar-version-footer">
              AI-Cloud Threat Intelligence v1.0
            </div>
          </div>
        </aside>

        <main className="shell-content">
          {children}
        </main>
      </div>
    </div>
  );
}
