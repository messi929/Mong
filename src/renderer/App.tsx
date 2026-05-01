import React, { useState, useEffect, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import ConsultingPage from './pages/ConsultingPage';
import ClientsPage from './pages/ClientsPage';
import DashboardPage from './pages/DashboardPage';
import ImportModal from './components/ImportModal';
import type { Client } from '../shared/types';

type Page = 'consulting' | 'clients' | 'dashboard';

export interface NavigationContext {
  goToClients: (clientId?: number) => void;
  goToConsulting: (clientId?: number, consultingId?: number) => void;
}

interface User {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('consulting');
  const [showImport, setShowImport] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [selectedConsultingId, setSelectedConsultingId] = useState<number | undefined>();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    (window as any).api.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const data = await window.api.getClients();
      setClients(data);
    } catch { /* 로그인 전에는 무시 */ }
  }, []);

  useEffect(() => {
    if (user) loadClients();
  }, [user, loadClients]);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    setUser(null);
    setClients([]);
    setCurrentPage('consulting');
  };

  const nav: NavigationContext = {
    goToClients: (clientId?: number) => {
      setSelectedClientId(clientId);
      setCurrentPage('clients');
    },
    goToConsulting: (clientId?: number, consultingId?: number) => {
      setSelectedClientId(clientId);
      setSelectedConsultingId(consultingId);
      setCurrentPage('consulting');
    },
  };

  // 로그인 전
  if (!user) {
    return <LoginScreen onLogin={handleLogin} appVersion={appVersion} />;
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">Mong</div>
        <div className="nav-tabs">
          <button className={`nav-tab ${currentPage === 'consulting' ? 'active' : ''}`}
            onClick={() => setCurrentPage('consulting')}>첨삭하기</button>
          <button className={`nav-tab ${currentPage === 'clients' ? 'active' : ''}`}
            onClick={() => setCurrentPage('clients')}>고객관리</button>
          <button className={`nav-tab ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}>대시보드</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {appVersion && (
            <span style={{ fontSize: '12px', color: 'var(--gray-400)', fontVariantNumeric: 'tabular-nums' }}>
              v{appVersion}
            </span>
          )}
          <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{user.displayName}</span>
          <button className="nav-settings" onClick={() => setShowImport(true)}>Import</button>
          <button className="nav-settings" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="nav-settings" onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>

      <main className="main-content">
        <div style={{ display: currentPage === 'consulting' ? 'contents' : 'none' }}>
          <ConsultingPage nav={nav} clients={clients} onClientsChange={loadClients}
            initialClientId={selectedClientId} initialConsultingId={selectedConsultingId} />
        </div>
        {currentPage === 'clients' && <ClientsPage nav={nav} initialClientId={selectedClientId} />}
        {currentPage === 'dashboard' && <DashboardPage nav={nav} />}
      </main>

      {showImport && (
        <ImportModal clients={clients} onClose={() => setShowImport(false)} onComplete={loadClients} />
      )}
    </div>
  );
}
