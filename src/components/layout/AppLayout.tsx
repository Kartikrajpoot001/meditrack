import React, { useState } from 'react';
import {
  Activity,
  User,
  Stethoscope,
  Building2,
  Ambulance,
  Radio,
  Search,
  Bell,
  CheckCheck,
  ChevronDown,
  ShieldAlert,
  Bot,
  Menu,
  X,
  FileText,
  Calendar,
  Lock,
  Bed,
  Sparkles,
} from 'lucide-react';
import { UserRole, InAppNotification } from '../../types';
import { appStore } from '../../services/store';

interface AppLayoutProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole, userId?: string) => void;
  onOpenAssistant: () => void;
  onOpenSimulator: () => void;
  onOpenEmergency: () => void;
  notifications: InAppNotification[];
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentRole,
  onSelectRole,
  onOpenAssistant,
  onOpenSimulator,
  onOpenEmergency,
  notifications,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const roleMeta: Record<
    UserRole,
    { label: string; userName: string; sub: string; icon: React.ElementType }
  > = {
    patient: {
      label: 'Patient',
      userName: 'Sarah Chen',
      sub: 'ID: PT00234',
      icon: User,
    },
    doctor: {
      label: 'Doctor',
      userName: 'Dr. Aris Vance',
      sub: 'Cardiology, Room 4',
      icon: Stethoscope,
    },
    hospital: {
      label: 'Hospital Admin',
      userName: 'St. Jude Operations',
      sub: 'Facility Admin',
      icon: Building2,
    },
    receptionist: {
      label: 'Hospital Admin',
      userName: 'Reception Desk',
      sub: 'City Metro General',
      icon: Building2,
    },
    admin: {
      label: 'Hospital Admin',
      userName: 'Hospital Admin',
      sub: 'Operations Command',
      icon: Building2,
    },
    dispatcher: {
      label: 'Dispatcher',
      userName: 'Central Dispatch',
      sub: 'Emergency Operations',
      icon: Radio,
    },
    paramedic: {
      label: 'Paramedic',
      userName: 'Alex Mercer',
      sub: 'EMS Unit 104',
      icon: Ambulance,
    },
    responder: {
      label: 'Dispatcher',
      userName: 'Emergency Dispatch',
      sub: 'EMS Rapid Network',
      icon: Ambulance,
    },
    guest: {
      label: 'Guest',
      userName: 'Guest Explorer',
      sub: 'Overview Mode',
      icon: User,
    },
  };

  const activeMeta = roleMeta[currentRole] || roleMeta.patient;

  // Sidebar navigation menu items
  const navItems = [
    {
      role: 'patient' as UserRole,
      label: 'Patient Portal',
      icon: User,
    },
    {
      role: 'doctor' as UserRole,
      label: 'Doctor Station',
      icon: Stethoscope,
    },
    {
      role: 'hospital' as UserRole,
      label: 'Hospital Admin',
      icon: Building2,
    },
    {
      role: 'dispatcher' as UserRole,
      label: 'Dispatcher',
      icon: Radio,
    },
    {
      role: 'paramedic' as UserRole,
      label: 'Paramedic',
      icon: Ambulance,
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#F4F7F8] text-[#1F2937]">
      {/* FIXED LEFT SIDEBAR (#0B2F3A) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-[#0B2F3A] text-white flex flex-col justify-between transition-all duration-150 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div>
          {/* Sidebar Header / Brand Logo */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-[#144250]">
            <div
              onClick={() => onSelectRole('patient')}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden"
            >
              <div className="w-8 h-8 rounded-[6px] bg-[#0E7C7B] flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              {!sidebarCollapsed && (
                <div className="leading-tight">
                  <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                    MediTrack <span className="text-[11px] font-normal text-slate-300">Nexus</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Clinical EHR & Dispatch</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-slate-400 hover:text-white p-1 rounded-[4px] hover:bg-[#144250] transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Links */}
          <div className="p-2 space-y-1">
            <div className={`px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${sidebarCollapsed ? 'hidden' : 'block'}`}>
              Role Portals
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentRole === item.role ||
                (item.role === 'hospital' && (currentRole === 'receptionist' || currentRole === 'admin')) ||
                (item.role === 'dispatcher' && currentRole === 'responder');

              return (
                <button
                  key={item.role}
                  onClick={() => onSelectRole(item.role)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-[#0E7C7B] text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-[#144250]'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2]" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            <div className={`pt-3 pb-1 px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${sidebarCollapsed ? 'hidden' : 'block'}`}>
              Tools
            </div>

            <button
              onClick={onOpenAssistant}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm text-slate-300 hover:text-white hover:bg-[#144250] transition-colors text-left"
              title="Hospital Assistant"
            >
              <Bot className="w-4 h-4 shrink-0 text-[#0E7C7B]" />
              {!sidebarCollapsed && <span>Hospital Assistant</span>}
            </button>

            <button
              onClick={onOpenSimulator}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm text-slate-300 hover:text-white hover:bg-[#144250] transition-colors text-left"
              title="60s Live Demo"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
              {!sidebarCollapsed && <span>60s Live Demo</span>}
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Active User & Role Switcher */}
        <div className="p-3 border-t border-[#144250]">
          {!sidebarCollapsed ? (
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="w-full p-2 bg-[#144250] hover:bg-[#1A5162] rounded-[6px] text-left flex items-center justify-between text-xs transition-colors"
              >
                <div className="truncate">
                  <div className="font-semibold text-white truncate">{activeMeta.userName}</div>
                  <div className="text-[11px] text-slate-300 truncate">{activeMeta.label}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showRoleMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0B2F3A] border border-[#144250] rounded-[6px] shadow-lg py-1 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] text-slate-400 uppercase font-semibold">
                    Switch Active User
                  </div>
                  <button
                    onClick={() => {
                      onSelectRole('patient', 'pat-1');
                      setShowRoleMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#144250]"
                  >
                    Sarah Chen (Patient)
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('doctor', 'doc-1');
                      setShowRoleMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#144250]"
                  >
                    Dr. Aris Vance (Doctor)
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('hospital', 'hosp-1');
                      setShowRoleMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#144250]"
                  >
                    Hospital Admin (Operations)
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('dispatcher');
                      setShowRoleMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#144250]"
                  >
                    Dispatcher (GIS & Trauma)
                  </button>
                  <button
                    onClick={() => {
                      onSelectRole('paramedic');
                      setShowRoleMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#144250]"
                  >
                    Paramedic (EMS Unit 104)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => onSelectRole('patient')}
                className="w-8 h-8 rounded-full bg-[#144250] flex items-center justify-center text-xs font-bold text-white"
                title={activeMeta.userName}
              >
                {activeMeta.userName.charAt(0)}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTAINER (OFFSET BY SIDEBAR WIDTH) */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-150 ${
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {/* TOP BAR */}
        <header className="h-14 bg-white border-b border-[#E3E8EB] px-6 flex items-center justify-between sticky top-0 z-30">
          {/* Search field on the left */}
          <div className="relative w-72 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient ID, doctor, record..."
              className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E7C7B]"
            />
          </div>

          {/* Right actions: Emergency SOS, Notifications, User Name & Role */}
          <div className="flex items-center gap-3">
            {/* Plain solid Red Emergency SOS button */}
            <button
              onClick={onOpenEmergency}
              className="bg-[#D32F2F] hover:bg-[#B71C1C] text-white px-3.5 py-1.5 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-none"
            >
              <ShieldAlert className="w-4 h-4 text-white stroke-[2]" />
              <span>Report Emergency</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="p-2 rounded-[6px] hover:bg-[#F4F7F8] border border-[#E3E8EB] text-slate-600 relative transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D32F2F] text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E3E8EB] rounded-[8px] shadow-md py-2 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-[#E3E8EB] flex items-center justify-between font-semibold text-slate-700">
                    <span>Notifications ({unreadCount})</span>
                    <button
                      onClick={() => appStore.markAllNotificationsAsRead()}
                      className="text-[11px] text-[#0E7C7B] hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E3E8EB]">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">No notifications</div>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => appStore.markNotificationAsRead(n.id)}
                          className={`p-3 cursor-pointer ${
                            !n.read ? 'bg-slate-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-medium text-slate-900">{n.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Active user badge */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#E3E8EB] text-xs">
              <div className="w-7 h-7 rounded-full bg-[#0E7C7B] text-white flex items-center justify-center font-semibold text-[11px]">
                {activeMeta.userName.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-slate-800 leading-tight">{activeMeta.userName}</div>
                <div className="text-[11px] text-slate-500">{activeMeta.label}</div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT AREA (#F4F7F8) */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
