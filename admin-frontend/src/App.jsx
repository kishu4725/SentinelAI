import { useState, useEffect } from 'react';
import { ROUTES } from './constants/routes';
import { getStoredToken } from './services/apiService';

import AdminLoginPage from './pages/AdminLoginPage';
import SocDashboardPage from './pages/SocDashboardPage';
import ThreatsPage from './pages/ThreatsPage';
import ThreatDetailsPage from './pages/ThreatDetailsPage';
import HoneypotMonitoringPage from './pages/HoneypotMonitoringPage';
import AiMlAnalysisPage from './pages/AiMlAnalysisPage';
import AlertsPage from './pages/AlertsPage';
import LogsPage from './pages/LogsPage';
import AutomatedResponsePage from './pages/AutomatedResponsePage';
import SettingsPage from './pages/SettingsPage';
import FileSecurityPage from './pages/FileSecurityPage';

function parseHashRoute() {
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    return ROUTES.ADMIN_LOGIN;
  }
  return hash;
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(parseHashRoute);

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute();
      if (route !== ROUTES.ADMIN_LOGIN && !getStoredToken()) {
        window.location.hash = ROUTES.ADMIN_LOGIN;
        setCurrentRoute(ROUTES.ADMIN_LOGIN);
        return;
      }
      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route) => {
    if (route !== ROUTES.ADMIN_LOGIN && !getStoredToken()) {
      window.location.hash = ROUTES.ADMIN_LOGIN;
      setCurrentRoute(ROUTES.ADMIN_LOGIN);
      return;
    }
    window.location.hash = route;
    setCurrentRoute(route);
  };

  const renderCurrentRoute = () => {
    const isPublic = currentRoute === ROUTES.ADMIN_LOGIN;
    const hasToken = !!getStoredToken();

    if (!isPublic && !hasToken) {
      return <AdminLoginPage onNavigate={navigateTo} />;
    }

    if (currentRoute.startsWith(ROUTES.THREAT_DETAILS)) {
      const threatId = currentRoute.replace(ROUTES.THREAT_DETAILS, '') || 'TH-9021';
      return <ThreatDetailsPage onNavigate={navigateTo} threatId={threatId} />;
    }

    switch (currentRoute) {
      case ROUTES.ADMIN_LOGIN:
        return <AdminLoginPage onNavigate={navigateTo} />;
      case ROUTES.SOC_DASHBOARD:
        return <SocDashboardPage onNavigate={navigateTo} />;
      case ROUTES.THREATS:
        return <ThreatsPage onNavigate={navigateTo} />;
      case ROUTES.HONEYPOT_MONITORING:
        return <HoneypotMonitoringPage onNavigate={navigateTo} />;
      case ROUTES.AI_ML_ANALYSIS:
        return <AiMlAnalysisPage onNavigate={navigateTo} />;
      case ROUTES.ALERTS:
        return <AlertsPage onNavigate={navigateTo} />;
      case ROUTES.LOGS:
        return <LogsPage onNavigate={navigateTo} />;
      case ROUTES.AUTOMATED_RESPONSE:
        return <AutomatedResponsePage onNavigate={navigateTo} />;
      case ROUTES.FILE_SECURITY:
        return <FileSecurityPage onNavigate={navigateTo} />;
      case ROUTES.SETTINGS:
        return <SettingsPage onNavigate={navigateTo} />;
      default:
        return <AdminLoginPage onNavigate={navigateTo} />;
    }
  };

  return <div className="admin-app-container">{renderCurrentRoute()}</div>;
}
