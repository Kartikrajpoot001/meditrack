import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Sun,
  Moon,
  Globe,
  Sparkles,
  ShieldAlert,
  Bot,
  User,
  Stethoscope,
  Building2,
  Ambulance,
  Radio,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import { UserRole, InAppNotification } from '../types';
import { Language, translations } from '../i18n/translations';
import { appStore } from '../services/store';

interface HeaderProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  lang: Language;
  onToggleLang: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAssistant: () => void;
  onOpenSimulator: () => void;
  onOpenEmergency: () => void;
  notifications: InAppNotification[];
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSelectRole,
  lang,
  onToggleLang,
  darkMode,
  onToggleDarkMode,
  onOpenAssistant,
  onOpenSimulator,
  onOpenEmergency,
  notifications,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const t = translations[lang];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const roleLabels = {
    patient: { label: t.roles.patient, icon: User, color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60' },
    doctor: { label: t.roles.doctor, icon: Stethoscope, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60' },
    hospital: { label: 'Hospital Command', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' },
    receptionist: { label: 'Reception & Admin', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' },
    admin: { label: 'Hospital Admin', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' },
    responder: { label: t.roles.responder, icon: Ambulance, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60' },
    dispatcher: { label: 'Dispatcher', icon: Radio, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60' },
    paramedic: { label: 'Paramedic', icon: Ambulance, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60' },
    guest: { label: 'Guest Explorer', icon: User, color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800' },
  };

  const activeRoleData = roleLabels[currentRole] || roleLabels.patient;
  const ActiveRoleIcon = activeRoleData.icon;

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Top micro-bar for Hackathon SDG 3 context */}
      <div className="bg-gradient-to-r from-sky-700 via-teal-700 to-emerald-700 text-white text-[11px] py-1 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wide uppercase bg-black/20 px-1.5 py-0.5 rounded">Zinnovatio 4.0</span>
          <span className="hidden sm:inline">Healthcare, Wellbeing & Assistive Technologies</span>
          <span className="opacity-70">|</span>
          <span className="font-semibold text-emerald-200">SDG 3: Good Health & Well-Being</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1 font-bold text-amber-200 hover:text-white transition-colors cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>60s Live Judge Demo</span>
          </button>
        </div>
      </div>

      {/* Main navigation container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo and Tagline */}
        <div
          onClick={() => onSelectRole('guest')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
                Medi<span className="text-sky-600 dark:text-sky-400">Track</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden md:block tracking-tight font-medium">
              Connecting People. Connecting Workflows. Connecting Care.
            </p>
          </div>
        </div>

        {/* Center / Action buttons */}
        <div className="flex items-center gap-2">
          {/* Emergency Pulse Button */}
          <button
            onClick={onOpenEmergency}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-rose-600/30 hover:shadow-rose-600/50 transition-all animate-pulse"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span className="hidden xs:inline">Report Emergency</span>
            <span className="xs:hidden">SOS</span>
          </button>

          {/* AI Hospital Assistant Button */}
          <button
            onClick={onOpenAssistant}
            className="bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-semibold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
            title="Ask Gemini Hospital Information Assistant"
          >
            <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="hidden md:inline">AI Assistant</span>
          </button>
        </div>

        {/* Right tools: Role Switcher, i18n, Dark Mode, Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Role Chooser Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 transition-all ${activeRoleData.color}`}
            >
              <ActiveRoleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{activeRoleData.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  Switch Active Persona
                </div>
                <button
                  onClick={() => {
                    onSelectRole('patient');
                    setShowRoleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium"
                >
                  <User className="w-4 h-4 text-sky-500" />
                  <div>
                    <div className="font-semibold">Patient: Sarah Chen</div>
                    <div className="text-[10px] text-slate-400">ID: MT-892104 (DigiLocker)</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onSelectRole('doctor');
                    setShowRoleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium"
                >
                  <Stethoscope className="w-4 h-4 text-teal-500" />
                  <div>
                    <div className="font-semibold">Doctor: Dr. Aris Vance</div>
                    <div className="text-[10px] text-slate-400">Cardiology Dept (Room 4)</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onSelectRole('receptionist');
                    setShowRoleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium"
                >
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="font-semibold">Hospital Command</div>
                    <div className="text-[10px] text-slate-400">Reception, Queue, Beds & Labs</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onSelectRole('responder');
                    setShowRoleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium"
                >
                  <Ambulance className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="font-semibold">Emergency Responder</div>
                    <div className="text-[10px] text-slate-400">EMS Rapid Unit 104</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Multi-language Toggle (English / Hindi) */}
          <button
            onClick={onToggleLang}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-bold"
            title="Switch Language (English / हिन्दी)"
          >
            <Globe className="w-4 h-4 text-teal-600" />
            <span className="uppercase">{lang}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Light / Dark Clinical Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Live Hospital & Queue Feed
                    </h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => appStore.markAllNotificationsAsRead()}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => appStore.markNotificationAsRead(n.id)}
                        className={`p-3 text-xs cursor-pointer transition-colors ${
                          !n.read
                            ? 'bg-sky-50/50 dark:bg-sky-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-semibold ${
                              n.type === 'emergency'
                                ? 'text-rose-600'
                                : n.type === 'queue'
                                ? 'text-teal-600'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
