import { useState, useEffect } from 'react';
import { ROUTES } from './constants/routes';
import { getStoredUserToken } from './services/apiService';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import UserDashboardPage from './pages/UserDashboardPage';
import UserActivityPage from './pages/UserActivityPage';
import UserAlertsPage from './pages/UserAlertsPage';
import UserReportsPage from './pages/UserReportsPage';
import UserSettingsPage from './pages/UserSettingsPage';
import UserFilesPage from './pages/UserFilesPage';

function parseHashRoute() {
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    return ROUTES.LOGIN;
  }
  return hash;
}

const PUBLIC_ROUTES = [ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.PASSWORD_RECOVERY];

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(parseHashRoute);

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute();
      // Route Guard: Redirect unauthenticated visitors trying to access protected routes
      if (!PUBLIC_ROUTES.includes(route) && !getStoredUserToken()) {
        window.location.hash = ROUTES.LOGIN;
        setCurrentRoute(ROUTES.LOGIN);
        return;
      }
      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route) => {
    // Route Guard check before navigation
    if (!PUBLIC_ROUTES.includes(route) && !getStoredUserToken()) {
      window.location.hash = ROUTES.LOGIN;
      setCurrentRoute(ROUTES.LOGIN);
      return;
    }
    window.location.hash = route;
    setCurrentRoute(route);
  };

  const renderCurrentRoute = () => {
    const isPublic = PUBLIC_ROUTES.includes(currentRoute);
    const hasToken = !!getStoredUserToken();

    // Strict Enforcement: If not logged in and requesting a protected route, force Login view
    if (!isPublic && !hasToken) {
      return <LoginPage onNavigate={navigateTo} />;
    }

    switch (currentRoute) {
      case ROUTES.LOGIN:
        return <LoginPage onNavigate={navigateTo} />;
      case ROUTES.REGISTER:
        return <RegisterPage onNavigate={navigateTo} />;
      case ROUTES.PASSWORD_RECOVERY:
        return <PasswordRecoveryPage onNavigate={navigateTo} />;
      case ROUTES.USER_DASHBOARD:
        return <UserDashboardPage onNavigate={navigateTo} />;
      case ROUTES.USER_ACTIVITY:
        return <UserActivityPage onNavigate={navigateTo} />;
      case ROUTES.USER_ALERTS:
        return <UserAlertsPage onNavigate={navigateTo} />;
      case ROUTES.USER_REPORTS:
        return <UserReportsPage onNavigate={navigateTo} />;
      case ROUTES.USER_FILES:
        return <UserFilesPage onNavigate={navigateTo} />;
      case ROUTES.USER_SETTINGS:
        return <UserSettingsPage onNavigate={navigateTo} />;
      default:
        return <LoginPage onNavigate={navigateTo} />;
    }
  };

  return <div className="user-app-container">{renderCurrentRoute()}</div>;
}
