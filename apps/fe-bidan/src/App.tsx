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

  useEffect(() => {
    const token = session.bacaToken();
    const savedRole = localStorage.getItem('bidan_user_role') as 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN';
    if (token && savedRole) {
      setActiveRole(savedRole);
    }

    const path = window.location.pathname;
    if (path === '/login') {
      setCurrentView('login');
    } else if (path === '/app' || path.startsWith('/app/')) {
      if (token) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('login');
      }
    } else {
      setCurrentView('home');
    }
  }, []);

  const handleLoginSuccess = (role: 'SUPERADMIN' | 'ADMIN_LOKAL' | 'DOKTER' | 'PASIEN') => {
    setActiveRole(role);
    setCurrentView('dashboard');
    window.history.pushState({}, '', '/app/dashboard');
  };

  const handleLogout = async () => {
    await session.logout();
    setCurrentView('home');
    window.history.pushState({}, '', '/');
  };

  const handleGoToLogin = (role: 'superadmin' | 'admin' | 'bidan' | 'pasien' = 'admin') => {
    setInitialLoginRole(role);
    setCurrentView('login');
    window.history.pushState({}, '', '/login');
  };

  const handleGoToHome = () => {
    setCurrentView('home');
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="app-root">
      {currentView === 'home' && (
        <PublicHomePage onOpenLogin={handleGoToLogin} />
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
