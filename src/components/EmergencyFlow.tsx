import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  MapPin,
  Ambulance,
  AlertTriangle,
  Phone,
  CheckCircle2,
  Clock,
  Radio,
  ArrowRight,
  Navigation,
  Building2,
  Check,
} from 'lucide-react';
import { AppState, appStore, getDistanceInMeters } from '../services/store';
import { EmergencyCase, EmergencySeverity, EmergencyType } from '../types';
import { GoogleMapsView } from './GoogleMapsView';
import { DispatcherDashboard } from './DispatcherDashboard';
import { ParamedicDashboard } from './ParamedicDashboard';
import { Language, translations } from '../i18n/translations';

interface EmergencyFlowProps {
  appState: AppState;
  lang: Language;
}

export const EmergencyFlow: React.FC<EmergencyFlowProps> = ({ appState, lang }) => {
  const t = translations[lang];

  // Active view tab inside emergency suite: 'report' | 'dispatcher' | 'paramedic'
  const [subView, setSubView] = useState<'report' | 'dispatcher' | 'paramedic'>('report');

  // Report form state
  const [callerName, setCallerName] = useState('Rahul Verma');
  const [callerPhone, setCallerPhone] = useState('+91 98119 88776');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('Road Accident');
  const [victimsCount, setVictimsCount] = useState(2);
  const [severity, setSeverity] = useState<EmergencySeverity>('critical');
  const [description, setDescription] = useState(
    'Two-vehicle collision with severe trauma casualties near traffic intersection.'
  );
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.6189,
    lng: 77.2144, // Connaught Place, New Delhi
  });
  const [locatingGps, setLocatingGps] = useState(false);
  const [reportResult, setReportResult] = useState<{
    isDuplicate: boolean;
    caseItem: EmergencyCase;
  } | null>(null);

  // Capture GPS on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      setLocatingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocatingGps(false);
        },
        () => {
          setLocatingGps(false);
        },
        { timeout: 4000 }
      );
    }
  }, []);

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = appStore.reportEmergency({
      callerName,
      callerPhone,
      emergencyType,
      victimsCount,
      severity,
      lat: userCoords.lat,
      lng: userCoords.lng,
      address: 'Janpath Crossing, Connaught Place, New Delhi',
      description,
      photoUrl:
        'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80',
    });

    setReportResult(result);
  };

  const activeCase = reportResult?.caseItem || appState.emergencies[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Emergency Response & Incident Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS incident logging, automated deduplication, and hospital intake handshake
          </p>
        </div>

        {/* Sub-view switcher tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E3E8EB] text-xs font-semibold">
          <button
            onClick={() => setSubView('report')}
            className={`px-3 py-1.5 rounded transition-colors ${
              subView === 'report'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Incident Report Desk
          </button>
          <button
            onClick={() => setSubView('dispatcher')}
            className={`px-3 py-1.5 rounded transition-colors ${
              subView === 'dispatcher'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatcher Console
          </button>
          <button
            onClick={() => setSubView('paramedic')}
            className={`px-3 py-1.5 rounded transition-colors ${
              subView === 'paramedic'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paramedic Telemetry
          </button>
        </div>
      </div>

      {subView === 'dispatcher' ? (
        <DispatcherDashboard appState={appState} lang={lang} />
      ) : subView === 'paramedic' ? (
        <ParamedicDashboard appState={appState} lang={lang} />
      ) : (
        /* Report View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Report Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D32F2F]" />
                <span>One-Tap Incident Intake</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {locatingGps ? 'Locating...' : 'GPS Locked'}
              </span>
            </div>

            {reportResult && (
              <div
                className={`p-3 rounded-lg border text-xs ${
                  reportResult.isDuplicate
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="font-bold">
                  {reportResult.isDuplicate
                    ? 'Merged with Existing Incident (<150m deduplication)'
                    : 'New Emergency Incident Dispatched'}
                </div>
                <div className="text-[11px] mt-0.5">
                  Assigned Case ID: {reportResult.caseItem.id} • Status: {reportResult.caseItem.status}
                </div>
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Type
                </label>
                <select
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value as any)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                >
                  <option value="Road Accident">Road Accident / Vehicular Collision</option>
                  <option value="Cardiac Arrest">Cardiac Arrest / Unresponsive</option>
                  <option value="Trauma / Fall">Major Trauma / Severe Fall</option>
                  <option value="Respiratory Distress">Acute Respiratory Distress</option>
                  <option value="Fire / Burns">Fire / Burn Injuries</option>
                  <option value="Other">Other Medical Emergency</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number of Victims
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={victimsCount}
                    onChange={(e) => setVictimsCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  >
                    <option value="critical">Critical (Code Red)</option>
                    <option value="urgent">Urgent (Code Yellow)</option>
                    <option value="non_urgent">Non-Urgent (Code Green)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Caller Name
                  </label>
                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Caller Phone
                  </label>
                  <input
                    type="text"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location & Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB] text-xs font-mono text-slate-600 flex items-center justify-between">
                <span>GPS Coordinates</span>
                <span className="font-bold">
                  {userCoords.lat.toFixed(4)}° N, {userCoords.lng.toFixed(4)}° E
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Dispatch Emergency Call & Reserve Beds
              </button>
            </form>
          </div>

          {/* Active Incident Details & Map (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Incident Scene Location Map</h3>
                <span className="text-xs text-slate-500 font-mono">
                  {activeCase ? activeCase.address : 'Janpath, New Delhi'}
                </span>
              </div>

              <GoogleMapsView
                center={{ lat: userCoords.lat, lng: userCoords.lng }}
                zoom={14}
                markers={[
                  {
                    id: 'incident-pt',
                    lat: userCoords.lat,
                    lng: userCoords.lng,
                    title: emergencyType,
                    type: 'emergency',
                  },
                  ...appState.hospitals.map((h) => ({
                    id: h.id,
                    lat: h.lat,
                    lng: h.lng,
                    title: h.name,
                    subtitle: `${h.beds.emergencyTotal - h.beds.emergencyOccupied} ER beds`,
                    type: 'hospital' as const,
                  })),
                ]}
                className="h-[320px] w-full"
              />
            </div>

            {/* Quick Switch to Dispatcher */}
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Ready to manage triage & hospital assignment?
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Open the Dispatcher Console to view suitable hospitals and route ambulances.
                </p>
              </div>
              <button
                onClick={() => setSubView('dispatcher')}
                className="px-3.5 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Open Dispatcher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
