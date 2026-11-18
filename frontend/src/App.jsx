import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { api } from './services/api';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';
import DashboardPage from './pages/DashboardPage';
import ReportAnalysisPage from './pages/ReportAnalysisPage';
import ChatPage from './pages/ChatPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import ComparisonPage from './pages/ComparisonPage';
import LifestylePage from './pages/LifestylePage';
import DictionaryPage from './pages/DictionaryPage';
import DoctorPrepPage from './pages/DoctorPrepPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

function MedAiShell() {
  const { user, loading, demoLogin } = useAuth();
  const [publicView, setPublicView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [demoBusy, setDemoBusy] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [lifestylePlans, setLifestylePlans] = useState([]);
  const [doctorPreps, setDoctorPreps] = useState([]);

  const [selectedReport, setSelectedReport] = useState(null);
  const [chatReportId, setChatReportId] = useState('');
  const [chatSessionId, setChatSessionId] = useState(null);
  const [quickPrompt, setQuickPrompt] = useState('');

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const [repRes, chatRes, rxRes, compRes, lifeRes, prepRes] = await Promise.all([
        api.listReports(),
        api.listChatSessions(),
        api.listPrescriptions(),
        api.listComparisons(),
        api.listLifestylePlans(),
        api.listDoctorPreps(),
      ]);
      setReports(repRes.reports || []);
      setSessions(chatRes.sessions || []);
      setPrescriptions(rxRes.prescriptions || []);
      setComparisons(compRes.comparisons || []);
      setLifestylePlans(lifeRes.plans || []);
      setDoctorPreps(prepRes.preps || []);
    } catch {
      // Handled gracefully
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshData();
    } else {
      setReports([]);
      setSessions([]);
      setPrescriptions([]);
      setComparisons([]);
      setLifestylePlans([]);
      setDoctorPreps([]);
      setSelectedReport(null);
      setPublicView('landing');
    }
  }, [user, refreshData]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <Loader2 className="h-8 w-8 text-teal-700 animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (publicView === 'landing') {
      return (
        <LandingPage
          onOpenLogin={() => setPublicView('login')}
          onOpenSignup={() => setPublicView('register')}
          demoBusy={demoBusy}
          onDemoLogin={async () => {
            setDemoBusy(true);
            try {
              await demoLogin();
            } finally {
              setDemoBusy(false);
            }
          }}
        />
      );
    }
    return (
      <AuthScreen
        initialMode={publicView === 'register' ? 'register' : 'login'}
        onBack={() => setPublicView('landing')}
      />
    );
  }

  const handleOpenReport = (report) => {
    setSelectedReport(report);
    setActivePage('reports');
  };

  const handleAskDrSehat = (reportId) => {
    setChatReportId(reportId);
    setChatSessionId(null);
    setActivePage('chat');
  };

  const handleOpenSession = (sessionId) => {
    setChatSessionId(sessionId);
    setChatReportId('');
    setActivePage('chat');
  };

  const handleQuickAsk = (questionText) => {
    setQuickPrompt(questionText);
    setChatSessionId(null);
    setChatReportId(reports?.[0]?.id || '');
    setActivePage('chat');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            reports={reports}
            sessions={sessions}
            prescriptions={prescriptions}
            onNavigate={setActivePage}
            onOpenReport={handleOpenReport}
            onQuickAsk={handleQuickAsk}
            onRefreshData={refreshData}
          />
        );
      case 'reports':
        return (
          <ReportAnalysisPage
            selectedReport={selectedReport}
            onReportSelected={setSelectedReport}
            onRefreshData={refreshData}
            onAskDrSehat={handleAskDrSehat}
          />
        );
      case 'chat':
        return (
          <ChatPage
            reports={reports}
            sessions={sessions}
            initialReportId={chatReportId}
            initialSessionId={chatSessionId}
            initialPrompt={quickPrompt}
            onConsumeInitialPrompt={() => setQuickPrompt('')}
            onRefreshData={refreshData}
          />
        );
      case 'prescriptions':
        return (
          <PrescriptionsPage
            prescriptions={prescriptions}
            onRefreshData={refreshData}
          />
        );
      case 'comparison':
        return (
          <ComparisonPage
            reports={reports}
            comparisons={comparisons}
            onRefreshData={refreshData}
          />
        );
      case 'lifestyle':
        return (
          <LifestylePage
            reports={reports}
            lifestylePlans={lifestylePlans}
            onRefreshData={refreshData}
          />
        );
      case 'dictionary':
        return (
          <DictionaryPage
            reports={reports}
            onOpenReport={handleOpenReport}
          />
        );
      case 'doctorPrep':
        return (
          <DoctorPrepPage
            reports={reports}
            doctorPreps={doctorPreps}
            onRefreshData={refreshData}
          />
        );
      case 'history':
        return (
          <HistoryPage
            reports={reports}
            sessions={sessions}
            prescriptions={prescriptions}
            onOpenReport={handleOpenReport}
            onOpenSession={handleOpenSession}
            onNavigate={setActivePage}
            onRefreshData={refreshData}
          />
        );
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            reports={reports}
            sessions={sessions}
            prescriptions={prescriptions}
            onNavigate={setActivePage}
            onOpenReport={handleOpenReport}
            onRefreshData={refreshData}
          />
        );
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <MedAiShell />
      </AuthProvider>
    </SettingsProvider>
  );
}
