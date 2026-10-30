import React, { useState } from 'react';
import {
  Radio,
  MapPin,
  Ambulance,
  Building2,
  AlertTriangle,
  Clock,
  Phone,
  CheckCircle2,
  Navigation,
  ShieldAlert,
  ArrowRight,
  Send,
} from 'lucide-react';
import { AppState, appStore, getDistanceInMeters } from '../services/store';
import { EmergencyCase, Hospital } from '../types';
import { GoogleMapsView } from './GoogleMapsView';
import { Language } from '../i18n/translations';

interface DispatcherDashboardProps {
  appState: AppState;
  lang: Language;
}

export const DispatcherDashboard: React.FC<DispatcherDashboardProps> = ({ appState }) => {
  // Active incidents list
  const activeEmergencies = appState.emergencies;
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    activeEmergencies[0]?.id || ''
  );
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState('');

  const currentCase =
    activeEmergencies.find((e) => e.id === selectedCaseId) || activeEmergencies[0];

  // Calculate Suitable Hospitals row data
  const suitableHospitals = currentCase
    ? appState.hospitals
        .map((hosp) => {
          const distMeters = getDistanceInMeters(
            currentCase.lat,
            currentCase.lng,
            hosp.lat,
            hosp.lng
          );
          const distKm = (distMeters / 1000).toFixed(1);
          const etaMinutes = Math.max(3, Math.round(distMeters / 420)); // ~25km/h city speed
          const vacantEr = hosp.beds.emergencyTotal - hosp.beds.emergencyOccupied;
          const vacantIcu = hosp.beds.icuTotal - hosp.beds.icuOccupied;

          // Compute Readiness percentage based on ER & ICU availability
          const erReadiness = Math.min(100, Math.round((vacantEr / (hosp.beds.emergencyTotal || 1)) * 100));
          const icuReadiness = Math.min(100, Math.round((vacantIcu / (hosp.beds.icuTotal || 1)) * 100));
          const readinessPct = Math.round(erReadiness * 0.6 + icuReadiness * 0.4);

          return {
            ...hosp,
            distMeters,
            distKm,
            etaMinutes,
            vacantEr,
            vacantIcu,
            readinessPct: Math.max(20, Math.min(99, readinessPct)),
          };
        })
        .sort((a, b) => a.distMeters - b.distMeters)
    : [];

  // Map markers
  const mapCenter = currentCase
    ? { lat: currentCase.lat, lng: currentCase.lng }
    : { lat: 28.6189, lng: 77.2144 };

  const mapMarkers = currentCase
    ? [
        {
          id: 'incident-loc',
          lat: currentCase.lat,
          lng: currentCase.lng,
          title: `Incident: ${currentCase.emergencyType}`,
          subtitle: `${currentCase.victimsCount} victims • ${currentCase.severity.toUpperCase()}`,
          type: 'emergency' as const,
        },
        ...(currentCase.responderLocation
          ? [
              {
                id: 'ambulance-unit',
                lat: currentCase.responderLocation.lat,
                lng: currentCase.responderLocation.lng,
                title: currentCase.responderName || 'EMS Unit 104',
                subtitle: 'Active Responder Unit',
                type: 'responder' as const,
              },
            ]
          : []),
        ...appState.hospitals.map((h) => ({
          id: h.id,
          lat: h.lat,
          lng: h.lng,
          title: h.name,
          subtitle: `${h.beds.emergencyTotal - h.beds.emergencyOccupied} ER Beds Vacant`,
          type: 'hospital' as const,
        })),
      ]
    : [];

  const handleSelectHospital = (hosp: (typeof suitableHospitals)[0]) => {
    if (!currentCase) return;

    appStore.updateEmergencyStatus(currentCase.id, 'accepted', hosp.id, hosp.name);
    setDispatchStatusMsg(`Destination confirmed: ${hosp.name}. Hospital trauma bay on standby.`);
    setTimeout(() => setDispatchStatusMsg(''), 5000);
  };

  const handleAdvanceStatus = (caseId: string, nextStatus: EmergencyCase['status']) => {
    appStore.updateEmergencyStatus(caseId, nextStatus);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Central Emergency Dispatcher
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-Time Accident Telemetry • GIS Incident Routing • Hospital Intake Handshake
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-red-100 text-[#D32F2F] font-bold px-2.5 py-1 rounded border border-red-200">
            {activeEmergencies.length} Active Emergencies
          </span>
        </div>
      </div>

      {dispatchStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{dispatchStatusMsg}</span>
        </div>
      )}

      {/* Incident Switcher Strip */}
      <div className="bg-white rounded-lg border border-[#E3E8EB] p-2 flex flex-wrap gap-2">
        {activeEmergencies.map((emg) => {
          const isSelected = emg.id === currentCase?.id;
          return (
            <button
              key={emg.id}
              onClick={() => setSelectedCaseId(emg.id)}
              className={`px-3 py-2 rounded text-left text-xs transition-colors flex items-center gap-2.5 ${
                isSelected
                  ? 'bg-red-50 border border-[#D32F2F] text-slate-900 font-semibold'
                  : 'bg-[#F4F7F8] border border-[#E3E8EB] text-slate-600 hover:text-slate-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  emg.severity === 'critical' ? 'bg-[#D32F2F]' : 'bg-amber-500'
                }`}
              />
              <div>
                <div className="font-bold">{emg.emergencyType}</div>
                <div className="text-[10px] text-slate-400 font-normal">
                  {emg.address.split(',')[0]} • {emg.victimsCount} victims
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Google Map Area */}
      <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#D32F2F]" />
            <h2 className="text-sm font-bold text-slate-900">
              Live Incident GIS & Responder Tracking Map
            </h2>
          </div>
          {currentCase && (
            <span className="font-mono text-xs text-slate-500">
              Target: {currentCase.lat.toFixed(4)}° N, {currentCase.lng.toFixed(4)}° E
            </span>
          )}
        </div>

        <GoogleMapsView
          center={mapCenter}
          zoom={13}
          markers={mapMarkers}
          className="h-[360px] w-full"
        />
      </div>

      {/* "Suitable Hospitals" Row */}
      <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden">
        <div className="p-4 border-b border-[#E3E8EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Suitable Hospitals</h3>
            <p className="text-xs text-slate-500">
              Ranked by transit time, ER trauma readiness, and vacant bed capacity for this incident
            </p>
          </div>
          {currentCase?.destinationHospitalName && (
            <div className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-medium">
              Selected: <strong>{currentCase.destinationHospitalName}</strong>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-4">Hospital Name</th>
                <th className="py-2.5 px-4">ETA</th>
                <th className="py-2.5 px-4">Distance</th>
                <th className="py-2.5 px-4">Readiness %</th>
                <th className="py-2.5 px-4">ER Beds</th>
                <th className="py-2.5 px-4">ICU Beds</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EB]">
              {suitableHospitals.map((hosp) => {
                const isSelected = currentCase?.destinationHospitalId === hosp.id;
                return (
                  <tr
                    key={hosp.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-teal-50/60 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{hosp.name}</div>
                      <div className="text-[10px] text-slate-500">{hosp.address}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                      {hosp.etaMinutes} min
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{hosp.distKm} km</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              hosp.readinessPct > 70
                                ? 'bg-emerald-600'
                                : hosp.readinessPct > 40
                                ? 'bg-amber-500'
                                : 'bg-[#D32F2F]'
                            }`}
                            style={{ width: `${hosp.readinessPct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {hosp.readinessPct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      <span className="font-bold text-emerald-700">{hosp.vacantEr}</span>
                      <span className="text-slate-400">/{hosp.beds.emergencyTotal}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      <span className="font-bold text-slate-800">{hosp.vacantIcu}</span>
                      <span className="text-slate-400">/{hosp.beds.icuTotal}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleSelectHospital(hosp)}
                        className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white shadow-sm'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Status Workflow Bar */}
      {currentCase && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
              Current Incident Status
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5 capitalize">
              {currentCase.status.replace('_', ' ')}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleAdvanceStatus(currentCase.id, 'en_route')}
              className="px-3 py-1.5 rounded text-xs font-medium border border-[#E3E8EB] hover:bg-slate-50 text-slate-700"
            >
              Mark En Route
            </button>
            <button
              onClick={() => handleAdvanceStatus(currentCase.id, 'hospital_ready')}
              className="px-3 py-1.5 rounded text-xs font-medium border border-[#E3E8EB] hover:bg-slate-50 text-slate-700"
            >
              Hospital Ready
            </button>
            <button
              onClick={() => handleAdvanceStatus(currentCase.id, 'arrived')}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white"
            >
              Mark Casualty Arrived
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
