import { useState, useRef, useEffect } from 'react';
import { ROUTES } from '../../constants/routes';
import { getStoredUserInfo, logoutUser } from '../../services/apiService';
import '../../pages/UserDashboardPage.css';

export default function UserAppShell({ children, onNavigate, activeTab = 'dashboard' }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const currentUser = getStoredUserInfo() || {
    name: 'Account User',
    email: 'user@sentinelai.io',
    username: 'user',
    role: 'Website Owner',
  };

  const displayName = currentUser.name || currentUser.username || 'Account User';
  const displayEmail = currentUser.email || currentUser.username || 'user@sentinelai.io';
  const avatarChar = displayName.charAt(0).toUpperCase();

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      route: ROUTES.USER_DASHBOARD,
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: 'files',
      route: ROUTES.USER_FILES,
      label: 'My Files',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'activity',
      route: ROUTES.USER_ACTIVITY,
      label: 'Website Security',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      ),
    },
    {
      id: 'scan',
      route: ROUTES.USER_ACTIVITY,
      label: 'Scan Website',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
    },
    {
      id: 'reports',
      route: ROUTES.USER_REPORTS,
      label: 'Reports',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'alerts',
      route: ROUTES.USER_ALERTS,
      label: 'Notifications',
      badge: 5,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      id: 'profile',
      route: ROUTES.USER_SETTINGS,
      label: 'Profile',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      id: 'settings',
      route: ROUTES.USER_SETTINGS,
      label: 'Settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ];

  const handleLogout = () => {
    logoutUser();
    if (onNavigate) {
      onNavigate(ROUTES.LOGIN);
    }
  };

  const handleNavClick = (item) => {
    if (onNavigate) {
      onNavigate(item.route);
    }
  };

  return (
    <div className="user-portal-shell">
      {/* Header */}
      <header className="user-portal-header">
        <div className="user-header-left">
          <div className="user-brand" onClick={() => onNavigate && onNavigate(ROUTES.USER_DASHBOARD)}>
            <svg className="user-brand-logo" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="#0284c7" stroke="#0284c7" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 7L16 11H13V17H11V11H8L12 7Z" fill="#ffffff"/>
            </svg>
            <span className="user-brand-title">SentinelAI</span>
          </div>
        </div>

        <div className="user-header-right">
          {/* Notifications Icon Button */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              type="button"
              className="user-icon-btn"
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                setShowProfileMenu(false);
              }}
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="notif-badge-count">5</span>
            </button>

            {showNotifMenu && (
              <div className="user-header-dropdown">
                <div className="user-dropdown-header">
                  <span>Notifications (5 unread)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '0.75rem', color: '#334155', padding: '0.4rem' }}>
                    <strong>Security Alert:</strong> 8 malicious attacks blocked today.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu Pill */}
          <div className="user-profile-menu-container" ref={profileRef}>
            <div className="user-profile-pill" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <div className="user-avatar">{avatarChar}</div>
              <div className="user-profile-info">
                <span className="user-name-text">{displayName}</span>
                <span className="user-role-subtitle">{currentUser.role || 'Website Owner'}</span>
              </div>
            </div>

            {showProfileMenu && (
              <div className="user-header-dropdown profile-dropdown">
                <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.3rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{displayName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{displayEmail}</div>
                </div>

                <div className="user-dropdown-item logout" onClick={handleLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}

      <div className="user-portal-body">
        {/* Sidebar */}
        <aside className="user-portal-sidebar">
          <nav className="user-sidebar-nav">
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`user-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="user-sidebar-badge">{item.badge}</span>}
              </div>
            ))}
          </nav>

          <div className="user-sidebar-bottom">
            <div className="user-sys-card">
              <div className="user-sys-title">
                <span className="pulse-green-light" />
                Website Protection
              </div>
              <div style={{ fontSize: '0.725rem', color: '#16a34a', fontWeight: 700, marginTop: '0.2rem' }}>
                Active & Monitoring
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="user-portal-content">
          {children}
        </main>
      </div>
    </div>
  );
}
