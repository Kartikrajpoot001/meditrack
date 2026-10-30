import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  FolderHeart,
  Pill,
  Clock,
  ShieldAlert,
  CreditCard,
  HelpCircle,
  Users,
  Search,
  FileText,
  UserCheck,
  Stethoscope,
  Building2,
  Bed,
  Layers,
  BarChart3,
  Radio,
  MapPin,
  Ambulance,
  Phone,
  Activity,
  History,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  Shield,
  Heart,
  Sparkles,
} from 'lucide-react';
import { appStore, AppState } from '../../services/store';
import { authService, AuthUser } from '../../services/auth';
import { PortalType } from '../auth/PortalLoginPage';

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface HospitalPortalLayoutProps {
  portal: PortalType;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onLogout: () => void;
  onOpenEmergency: () => void;
  onOpenAssistant: () => void;
  appState: AppState;
  currentUser: AuthUser | null;
  children: React.ReactNode;
}

export const HospitalPortalLayout: React.FC<HospitalPortalLayoutProps> = ({
  portal,
  activePage,
  onNavigate,
  onLogout,
  onOpenEmergency,
  onOpenAssistant,
  appState,
  currentUser,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Filter notifications relevant to current logged-in user or role, or broadcast to 'all'
  const notifications = useMemo(() => {
    const list = appState.notifications || [];
    if (!currentUser) return list;
    const uidLower = (currentUser.uid || '').toLowerCase();
    const customIdLower = (currentUser.customId || '').toLowerCase();
    const roleLower = (currentUser.role || '').toLowerCase();
    const staffRoleLower = (currentUser.staffRole || '').toLowerCase();
    const portalLower = (currentUser.portal || '').toLowerCase();

    return list.filter((n) => {
      // Broadcast to all
      if (!n.recipientRole || n.recipientRole === 'all') return true;

      // Role or portal match
      const r = n.recipientRole.toLowerCase();
      if (r === roleLower || r === staffRoleLower || r === portalLower) return true;

      // Patient ID match
      if (n.recipientPatientId) {
        const targetPid = n.recipientPatientId.toLowerCase();
        if (targetPid === uidLower || targetPid === customIdLower) return true;
      }

      // Doctor ID match
      if (n.recipientDoctorId) {
        const targetDocId = n.recipientDoctorId.toLowerCase();
        if (targetDocId === uidLower || targetDocId === customIdLower) return true;
      }

      return false;
    });
  }, [appState.notifications, currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [notifFilter, setNotifFilter] = useState<'all' | 'emergency' | 'queue' | 'payment' | 'reminder'>('all');

  // Exact menu structures required for each portal and hospital staff role
  const getMenuSections = (): MenuSection[] => {
    switch (portal) {
      case 'patient':
        return [
          {
            title: 'Main Menu',
            items: [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'ambulances', label: 'Ambulances & Map', icon: Ambulance, badge: 'Live' },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'book-appointment', label: 'Book Appointment', icon: CalendarPlus },
              { id: 'records', label: 'Medical Records', icon: FolderHeart, badge: appState.reports.length },
              { id: 'medications', label: 'Medications', icon: Pill },
              { id: 'queue-token', label: 'Queue Token', icon: Clock, badge: 'Live' },
              { id: 'emergency-card', label: 'Emergency Card', icon: ShieldAlert },
            ],
          },
          {
            title: 'Other Menu',
            items: [{ id: 'payments', label: 'Payments', icon: CreditCard }],
          },
          {
            title: 'Help',
            items: [{ id: 'help-center', label: 'Help Center', icon: HelpCircle }],
          },
        ];

      case 'doctor':
        return [
          {
            title: 'Main Menu',
            items: [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'today-queue', label: "Today's Queue", icon: Clock, badge: appState.queueTokens.filter((q) => q.status === 'waiting').length },
              { id: 'patients', label: 'Patients', icon: Users },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
            ],
          },
          {
            title: 'Other Menu',
            items: [
              { id: 'ambulances', label: 'Inbound Ambulances & Map', icon: Ambulance },
              { id: 'doctor-schedule', label: 'Doctor Schedule', icon: UserCheck },
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'reports', label: 'Reports', icon: FolderHeart },
            ],
          },
          {
            title: 'Help',
            items: [{ id: 'help-center', label: 'Help Center', icon: HelpCircle }],
          },
        ];

      case 'emergency':
      case 'hospital': {
        const staffRole = currentUser?.staffRole || currentUser?.role;

        if (staffRole === 'dispatcher' || portal === 'emergency') {
          return [
            {
              title: 'Dispatch Operations',
              items: [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'report-incident', label: 'One-Tap SOS', icon: ShieldAlert },
                { id: 'active-incidents', label: 'Active Incidents', icon: Radio, badge: appState.emergencies.filter(e => e.status !== 'Closed').length },
                { id: 'incident-timeline', label: 'Slot Claiming Matrix', icon: Activity },
                { id: 'live-map', label: 'Live Map', icon: MapPin },
                { id: 'ambulances', label: 'Ambulances', icon: Ambulance },
                { id: 'hospital-readiness', label: 'Hospital Readiness', icon: Building2 },
              ],
            },
            {
              title: 'Archive & Support',
              items: [
                { id: 'history', label: 'History Archive', icon: History },
                { id: 'help-center', label: 'Help Center', icon: HelpCircle },
              ],
            },
          ];
        }

        if (staffRole === 'paramedic') {
          return [
            {
              title: 'Mobile Paramedic Unit',
              items: [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'my-trip', label: 'My Trip & Telemetry', icon: Activity },
                { id: 'vitals-entry', label: 'Vitals Entry', icon: Activity },
                { id: 'handover', label: 'Hospital Handover', icon: Building2 },
                { id: 'active-incidents', label: 'Active Incidents', icon: Radio, badge: appState.emergencies.filter(e => e.status !== 'Closed').length },
                { id: 'live-map', label: 'Live Map', icon: MapPin },
                { id: 'ambulances', label: 'Ambulances', icon: Ambulance },
              ],
            },
            {
              title: 'Help',
              items: [{ id: 'help-center', label: 'Help Center', icon: HelpCircle }],
            },
          ];
        }

        // Default: Hospital Admin
        return [
          {
            title: 'Operations',
            items: [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'patients', label: 'Patients', icon: Users },
              { id: 'incoming-emergencies', label: 'Incoming Emergencies', icon: ShieldAlert, badge: appState.emergencies.filter(e => e.status !== 'Closed').length },
            ],
          },
          {
            title: 'Facility Management',
            items: [
              { id: 'ambulances', label: 'Ambulances & Fleet Map', icon: Ambulance, badge: appState.ambulances.length },
              { id: 'doctors', label: 'Doctors', icon: Stethoscope },
              { id: 'departments', label: 'Departments', icon: Building2 },
              { id: 'doctor-schedule', label: 'Doctor Schedule', icon: UserCheck },
              { id: 'bed-management', label: 'Bed Management', icon: Bed },
              { id: 'payments', label: 'Payments', icon: CreditCard },
              { id: 'inventory', label: 'Inventory', icon: Layers },
            ],
          },
          {
            title: 'Help',
            items: [{ id: 'help-center', label: 'Help Center', icon: HelpCircle }],
          },
        ];
      }

      default:
        return [
          {
            title: 'Main Menu',
            items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
          },
        ];
    }
  };

  const sections = getMenuSections();

  const getPortalBadge = () => {
    if (portal === 'patient') {
      return { label: 'Patient DigiLocker', color: 'text-teal-700 bg-teal-50 border-teal-200' };
    }
    if (portal === 'doctor') {
      return { label: 'Doctor Clinical Station', color: 'text-teal-700 bg-teal-50 border-teal-200' };
    }
    const staffRole = currentUser?.staffRole || currentUser?.role;
    if (staffRole === 'dispatcher') {
      return { label: 'Emergency Dispatch Station', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (staffRole === 'paramedic') {
      return { label: 'Paramedic Rapid Response', color: 'text-red-700 bg-red-50 border-red-200' };
    }
    return { label: 'Hospital Admin Command', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  };

  const portalBadge = getPortalBadge();

  return (
    <div className="min-h-screen bg-[#F4F7F8] flex flex-col font-sans text-slate-800">
      {/* Universal Top Bar */}
      <header className="bg-white border-b border-[#E3E8EB] h-14 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo & Portal Indicator */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F2D] flex items-center justify-center text-teal-400 shadow-2xs">
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            <div className="hidden sm:block leading-none">
              <span className="font-bold text-slate-900 text-sm tracking-tight">MediTrack</span>
              <span className="font-bold text-[#0E7C7B] text-sm ml-1">Nexus</span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${portalBadge.color}`}>
              {portalBadge.label}
            </span>
          </div>
        </div>

        {/* Center Search Field */}
        <div className="hidden md:flex items-center w-72 lg:w-96 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, appointments, doctors..."
            className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E7C7B]"
          />
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2.5">
          {/* One-Tap SOS Button */}
          <button
            onClick={onOpenEmergency}
            className="px-3 py-1.5 bg-[#D32F2F] hover:bg-red-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all hover:scale-105 active:scale-95"
            title="Immediate One-Tap SOS Emergency Broadcast"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="font-black">One-Tap SOS</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D32F2F]" />
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-lg border border-[#E3E8EB] shadow-xl py-2 z-50 text-xs">
                <div className="px-3 py-2 font-bold text-slate-900 border-b border-[#E3E8EB] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Clinical & Emergency Alerts</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                      {notifications.length}
                    </span>
                  </div>
                  <button
                    onClick={() => appStore.markAllNotificationsAsRead()}
                    className="text-[11px] text-[#0E7C7B] hover:underline font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#F4F7F8] border-b border-[#E3E8EB] overflow-x-auto text-[11px]">
                  {(['all', 'emergency', 'queue', 'payment', 'reminder'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setNotifFilter(tab)}
                      className={`px-2 py-0.5 rounded capitalize whitespace-nowrap cursor-pointer font-medium transition-colors ${
                        notifFilter === tab
                          ? 'bg-[#0E7C7B] text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#E3E8EB]">
                  {notifications
                    .filter((n) => {
                      if (notifFilter === 'all') return true;
                      if (notifFilter === 'emergency') return n.type === 'emergency' || n.category === 'emergency';
                      if (notifFilter === 'queue') return n.type === 'queue' || n.category === 'queue';
                      if (notifFilter === 'payment') return n.category === 'payment';
                      if (notifFilter === 'reminder') return n.category === 'reminder' || n.type === 'access';
                      return true;
                    })
                    .slice(0, 10)
                    .map((n) => (
                      <div
                        key={n.id}
                        onClick={() => appStore.markNotificationAsRead(n.id)}
                        className={`p-3 transition-colors cursor-pointer ${
                          !n.read ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] shrink-0" />}
                            <span>{n.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {n.message}
                        </div>

                        {/* First Accept Wins Indicator */}
                        {n.isCancelled && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <span>🚫 Slot Closed: Already claimed by {n.claimedBy || 'another responder'}</span>
                          </div>
                        )}
                      </div>
                    ))}

                  {notifications.length === 0 && (
                    <div className="p-6 text-center text-slate-400">No active alerts or notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Name & Role */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E3E8EB]">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.name || 'Authorized User'}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                {currentUser?.customId || currentUser?.role}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Log out of portal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#D32F2F] hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Multi-Page App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* LIGHT LEFT SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen ? 'block' : 'hidden'
          } md:block w-64 bg-white border-r border-[#E3E8EB] shrink-0 flex flex-col justify-between overflow-y-auto z-20`}
        >
          {/* Sidebar Menu Sections */}
          <div className="p-3 space-y-5">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                {/* Small Section Label */}
                <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {section.title}
                </div>

                {/* Menu Items with Soft Rounded Highlight */}
                {section.items.map((item) => {
                  const isActive = activePage === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-teal-50 text-[#0E7C7B] font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-[#0E7C7B]' : 'text-slate-400'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isActive
                              ? 'bg-teal-200/60 text-[#0E7C7B] font-bold'
                              : 'bg-slate-100 text-slate-500 font-semibold'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Bottom Profile & Logout Footer */}
          <div className="p-3 border-t border-[#E3E8EB] bg-[#F8FAFC]">
            <div className="flex items-center justify-between mb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Session Active</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {currentUser?.customId || 'Verified'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="w-full py-1.5 px-3 rounded-lg border border-[#E3E8EB] bg-white hover:bg-red-50 hover:text-[#D32F2F] text-xs font-semibold text-slate-600 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out of {portalBadge.label.split(' ')[0]}</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
