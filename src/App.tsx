import React, { useState, useEffect } from 'react';
import { appStore, AppState } from './services/store';
import { authService, AuthUser } from './services/auth';
import { UserRole } from './types';
import { Language } from './i18n/translations';
import { LandingPage } from './components/LandingPage';
import { PortalLoginPage, PortalType } from './components/auth/PortalLoginPage';
import { HospitalPortalLayout } from './components/layout/HospitalPortalLayout';
import { PatientPortal } from './components/portals/PatientPortal';
import { DoctorPortal } from './components/portals/DoctorPortal';
import { HospitalAdminPortal } from './components/portals/HospitalAdminPortal';
import { EmergencyResponsePortal } from './components/portals/EmergencyResponsePortal';
import { HospitalAssistantModal } from './components/HospitalAssistantModal';
import { SimulationModal } from './components/SimulationModal';
import { OneTapSOSModal } from './components/OneTapSOSModal';
import { CivilianHelperExperience } from './components/emergency/CivilianHelperExperience';
import { AlertTriangle, LogOut, ArrowLeft, Bot, Sparkles, Ambulance } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(appStore.getState());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [lang, setLang] = useState<Language>('en');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Google Maps Demo Key Quota Defense listener
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Navigation State
  // view: 'gateway' | 'portal_login' | 'portal'
  const [currentView, setCurrentView] = useState<'gateway' | 'portal_login' | 'portal'>(() => {
    return authService.isAuthenticated() ? 'portal' : 'gateway';
  });

  // Selected login portal or active portal
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(() => {
    const user = authService.getCurrentUser();
    return user ? user.portal : 'patient';
  });

  // Sub-page state for current active portal
  const [activePage, setActivePage] = useState<string>('dashboard');

  // Modals
  const [showAssistantModal, setShowAssistantModal] = useState<boolean>(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState<boolean>(false);
  const [showOneTapSOSModal, setShowOneTapSOSModal] = useState<boolean>(false);

  // Subscribe to real-time store changes
  useEffect(() => {
    const unsubscribeStore = appStore.subscribe((updatedState) => {
      setAppState({ ...updatedState });
    });
    return () => unsubscribeStore();
  }, []);

  // Subscribe to auth session changes
  useEffect(() => {
    const unsubscribeAuth = authService.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        setSelectedPortal(user.portal);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Handlers
  const handleOpenPortalLogin = (portal: PortalType) => {
    setSelectedPortal(portal);
    setCurrentView('portal_login');
  };

  const handleBackToGateway = () => {
    setCurrentView('gateway');
  };

  const handleLoginSuccess = (portal: PortalType) => {
    setSelectedPortal(portal);
    setActivePage('dashboard');
    setCurrentView('portal');
  };

  const handleBystanderReport = () => {
    authService.loginBystander();
    setSelectedPortal('hospital');
    setActivePage('report-incident');
    setCurrentView('portal');
  };

  const handleLogout = () => {
    authService.logout();
    setActivePage('dashboard');
    setCurrentView('gateway');
  };

  const handleOpenEmergency = () => {
    setShowOneTapSOSModal(true);
  };

  // Check Role-Access Guard
  // If user is authenticated for portal X but tries to access portal Y, block access
  const isRoleMismatch =
    currentUser &&
    currentView === 'portal' &&
    currentUser.portal !== selectedPortal &&
    !(
      (currentUser.portal === 'hospital' || currentUser.portal === 'emergency') &&
      (selectedPortal === 'hospital' || selectedPortal === 'emergency')
    );

  return (
    <div className="min-h-screen bg-[#F4F7F8] text-slate-800 font-sans selection:bg-teal-500 selection:text-white relative">
      {/* Google Maps Platform Quota Defense Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* 1. GATEWAY LANDING PAGE */}
      {currentView === 'gateway' ? (
        <LandingPage
          onSelectRole={(role, userId) => {
            const portalMap: Record<UserRole, PortalType> = {
              patient: 'patient',
              doctor: 'doctor',
              hospital: 'hospital',
              receptionist: 'hospital',
              admin: 'hospital',
              dispatcher: 'hospital',
              paramedic: 'hospital',
              responder: 'hospital',
              guest: 'patient',
            };
            handleOpenPortalLogin(portalMap[role] || 'patient');
          }}
          onOpenPortalLogin={handleOpenPortalLogin}
          onOpenEmergency={handleOpenEmergency}
          onOpenSimulator={() => setShowSimulatorModal(true)}
          onOpenAssistant={() => setShowAssistantModal(true)}
          lang={lang}
        />
      ) : currentView === 'portal_login' ? (
        /* 2. PORTAL SPECIFIC LOGIN PAGE */
        <PortalLoginPage
          portal={selectedPortal}
          onBackToGateway={handleBackToGateway}
          onLoginSuccess={handleLoginSuccess}
          onBystanderReport={handleBystanderReport}
        />
      ) : (
        /* 3. MULTI-PAGE PORTAL WITH LIGHT SIDEBAR */
        <HospitalPortalLayout
          portal={selectedPortal}
          activePage={activePage}
          onNavigate={(pageId) => setActivePage(pageId)}
          onLogout={handleLogout}
          onOpenEmergency={handleOpenEmergency}
          onOpenAssistant={() => setShowAssistantModal(true)}
          appState={appState}
          currentUser={currentUser}
        >
          {/* ROLE GUARD BLOCK */}
          {isRoleMismatch ? (
            <div className="max-w-lg mx-auto my-12 bg-white rounded-lg border border-red-200 p-6 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-red-100 text-[#D32F2F] mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Access Denied: Role Mismatch</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are currently signed in as <strong>{currentUser?.name}</strong> with the{' '}
                <strong className="uppercase">{currentUser?.role}</strong> role. This portal requires{' '}
                <strong className="uppercase">{selectedPortal}</strong> credentials.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    if (currentUser) {
                      setSelectedPortal(currentUser.portal);
                      setActivePage('dashboard');
                    }
                  }}
                  className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Return to My Authorized Portal
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-[#E3E8EB] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out & Switch</span>
                </button>
              </div>
            </div>
          ) : (
            /* PORTAL ROUTER */
            <>
              {selectedPortal === 'patient' && (
                <PatientPortal
                  appState={appState}
                  currentUser={currentUser}
                  activePage={activePage}
                  onNavigate={(p) => setActivePage(p)}
                  onOpenEmergency={handleOpenEmergency}
                />
              )}

              {selectedPortal === 'doctor' && (
                <DoctorPortal
                  appState={appState}
                  currentUser={currentUser}
                  activePage={activePage}
                  onNavigate={(p) => setActivePage(p)}
                  onOpenEmergency={handleOpenEmergency}
                />
              )}

              {selectedPortal === 'hospital' && (
                <>
                  {(currentUser?.staffRole === 'dispatcher' || currentUser?.staffRole === 'paramedic') ? (
                    <EmergencyResponsePortal
                      appState={appState}
                      currentUser={currentUser}
                      activePage={activePage}
                      onNavigate={(p) => setActivePage(p)}
                      onOpenEmergency={handleOpenEmergency}
                    />
                  ) : (
                    <HospitalAdminPortal
                      appState={appState}
                      currentUser={currentUser}
                      activePage={activePage}
                      onNavigate={(p) => setActivePage(p)}
                      onOpenEmergency={handleOpenEmergency}
                    />
                  )}
                </>
              )}

              {selectedPortal === 'emergency' && (
                <EmergencyResponsePortal
                  appState={appState}
                  currentUser={currentUser}
                  activePage={activePage}
                  onNavigate={(p) => setActivePage(p)}
                  onOpenEmergency={handleOpenEmergency}
                />
              )}
            </>
          )}
        </HospitalPortalLayout>
      )}

      {/* Floating AI Assistant launcher FAB - accessible from anywhere */}
      <button
        onClick={() => setShowAssistantModal(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer group border border-teal-400/30 ring-4 ring-teal-500/10 active:scale-95"
        title="Open AI Operations Assistant"
        aria-label="Open AI Operations Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-teal-700 animate-pulse"></span>
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-xs font-bold leading-none flex items-center gap-1">
            <span>AI Operations</span>
            <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
          </div>
          <div className="text-[10px] text-teal-100 font-medium leading-none mt-1">Gemini 3.8 Flash • Real actions</div>
        </div>
      </button>

      {/* Reusable One-Tap SOS Modal */}
      <OneTapSOSModal
        isOpen={showOneTapSOSModal}
        onClose={() => setShowOneTapSOSModal(false)}
        onNavigateToIncident={(caseId) => {
          setShowOneTapSOSModal(false);
          if (currentUser?.portal === 'hospital') {
            setActivePage('active-incidents');
          }
        }}
      />

      {/* AI Clinical Assistant Modal */}
      <HospitalAssistantModal
        isOpen={showAssistantModal}
        appState={appState}
        onClose={() => setShowAssistantModal(false)}
        onNavigate={(pageId) => {
          setActivePage(pageId);
          if (currentView !== 'portal') {
            if (!currentUser) {
              setSelectedPortal('hospital');
              setCurrentView('portal_login');
            } else {
              setCurrentView('portal');
            }
          }
        }}
      />

      {/* Real-Time Multi-Role Simulation Modal */}
      <SimulationModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
        onNavigateToEmergency={handleOpenEmergency}
      />

      {/* Civilian Helper Notification, Role Choice, and Live Mission Experience */}
      <CivilianHelperExperience
        appState={appState}
        currentUser={currentUser}
        onOpenOneTapSOS={handleOpenEmergency}
      />
    </div>
  );
}
