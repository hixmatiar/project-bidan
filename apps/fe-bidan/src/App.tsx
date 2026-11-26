import { useState, useEffect } from 'react';
import { PublicHomePage } from './pages/PublicHomePage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { session } from './api/client';
import './styles.css';

type AppView = 'home' | 'login' | 'dashboard';

export function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [activeRole, setActiveRole] = useState<'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN'>('ADMIN_LOKAL');
  const [initialLoginRole, setInitialLoginRole] = useState<'superadmin' | 'admin' | 'bidan' | 'pasien'>('admin');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(session.bacaToken()));
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('bidan_user_nama') || '');

  useEffect(() => {
    const syncRouteAndSession = () => {
      const token = session.bacaToken();
      const savedRole = localStorage.getItem('bidan_user_role') as 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN';
      setIsAuthenticated(Boolean(token));
      setUserName(localStorage.getItem('bidan_user_nama') || '');

      if (token && savedRole) {
        setActiveRole(savedRole);
      }

      const path = window.location.pathname;
      if (path === '/login') {
        if (token && savedRole) {
          setCurrentView('dashboard');
          window.history.replaceState({}, '', '/app/dashboard');
        } else {
          setCurrentView('login');
        }
      } else if (path === '/app' || path.startsWith('/app/')) {
        if (token) {
          setCurrentView('dashboard');
        } else {
          setCurrentView('login');
        }
      } else {
        setCurrentView('home');
      }
    };

    syncRouteAndSession();
    window.addEventListener('popstate', syncRouteAndSession);
    return () => window.removeEventListener('popstate', syncRouteAndSession);
  }, []);

  const handleLoginSuccess = (role: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN') => {
    setActiveRole(role);
    setIsAuthenticated(true);
    setUserName(localStorage.getItem('bidan_user_nama') || '');
    setCurrentView('dashboard');
    window.history.pushState({}, '', '/app/dashboard');
  };

  const handleLogout = async () => {
    await session.logout();
    setIsAuthenticated(false);
    setUserName('');
    setCurrentView('home');
    window.history.pushState({}, '', '/');
  };

  const handleGoToDashboard = () => {
    const token = session.bacaToken();
    const savedRole = localStorage.getItem('bidan_user_role') as 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN';
    if (token) {
      if (savedRole) setActiveRole(savedRole);
      setIsAuthenticated(true);
      setCurrentView('dashboard');
      window.history.pushState({}, '', '/app/dashboard');
    } else {
      setCurrentView('login');
      window.history.pushState({}, '', '/login');
    }
  };

  const handleGoToLogin = (role: 'superadmin' | 'admin' | 'bidan' | 'pasien' = 'admin') => {
    if (session.bacaToken()) {
      handleGoToDashboard();
      return;
    }
    setInitialLoginRole(role);
    setCurrentView('login');
    window.history.pushState({}, '', '/login');
  };

  const handleGoToHome = () => {
    setIsAuthenticated(Boolean(session.bacaToken()));
    setCurrentView('home');
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="app-root">
      {currentView === 'home' && (
        <PublicHomePage
          onOpenLogin={handleGoToLogin}
          isAuthenticated={isAuthenticated}
          userName={userName}
          onGoToDashboard={handleGoToDashboard}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'login' && (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBackToHome={handleGoToHome}
          initialRole={initialLoginRole}
        />
      )}

      {currentView === 'dashboard' && (
        <DashboardPage
          onLogout={handleLogout}
          onGoToHome={handleGoToHome}
          initialRole={activeRole}
        />
      )}
    </div>
  );
}

export default App;
