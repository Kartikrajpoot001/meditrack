import React, { useState } from 'react';
import {
  Ambulance,
  Phone,
  Activity,
  Heart,
  Droplet,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Navigation,
  ArrowRight,
  ShieldAlert,
  Send,
  Building2,
} from 'lucide-react';
import { AppState, appStore } from '../services/store';
import { EmergencyCase } from '../types';
import { Language } from '../i18n/translations';

interface ParamedicDashboardProps {
  appState: AppState;
  lang: Language;
}

export const ParamedicDashboard: React.FC<ParamedicDashboardProps> = ({ appState }) => {
  // Active ambulance trip case
  const activeEmergencies = appState.emergencies;
  const currentCase = activeEmergencies[0];

  // Editable vitals on board
  const [heartRate, setHeartRate] = useState(104);
  const [bloodPressure, setBloodPressure] = useState('105/65');
  const [spo2, setSpo2] = useState(94);
  const [respRate, setRespRate] = useState(24);
  const [gcsScore, setGcsScore] = useState(13); // Glasgow Coma Scale (3-15)
  const [vitalsSaved, setVitalsSaved] = useState(false);

  // Paramedic call modal
  const [callingHospital, setCallingHospital] = useState(false);
  const [callActive, setCallActive] = useState(false);

  // Timeline definitions
  const timelineSteps: {
    key: EmergencyCase['status'];
    label: string;
    sub: string;
  }[] = [
    { key: 'reported', label: 'Reported', sub: 'GPS incident logged' },
    { key: 'validated', label: 'Validated', sub: 'Deduplicated & triage confirmed' },
    { key: 'accepted', label: 'Dispatched', sub: 'EMS unit on scene' },
    { key: 'en_route', label: 'En Route', sub: 'Transit to ER bay' },
    { key: 'hospital_ready', label: 'Hospital Ready', sub: 'Trauma team standing by' },
    { key: 'arrived', label: 'Arrived', sub: 'Patient handed over' },
  ];

  const getStepIndex = (status: EmergencyCase['status']) => {
    return timelineSteps.findIndex((s) => s.key === status);
  };

  const currentStepIdx = currentCase ? getStepIndex(currentCase.status) : 2;

  const handleAdvanceNextStatus = () => {
    if (!currentCase) return;
    const nextIdx = (currentStepIdx + 1) % timelineSteps.length;
    const nextKey = timelineSteps[nextIdx].key;
    appStore.updateEmergencyStatus(currentCase.id, nextKey);
  };

  const handleSaveTelemetry = (e: React.FormEvent) => {
    e.preventDefault();
    setVitalsSaved(true);
    setTimeout(() => setVitalsSaved(false), 3000);
  };

  const handleStartCall = () => {
    setCallingHospital(true);
    setTimeout(() => {
      setCallingHospital(false);
      setCallActive(true);
    }, 1200);
  };

  const handleEndCall = () => {
    setCallActive(false);
  };

  const destinationHospital = appState.hospitals.find(
    (h) => h.id === currentCase?.destinationHospitalId
  ) || appState.hospitals[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. TRIP HEADER */}
      <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-[#D32F2F] shrink-0">
            <Ambulance className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900">
                EMS Unit 104 • {currentCase ? currentCase.emergencyType : 'Priority Transport'}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-[#D32F2F]">
                {currentCase?.severity.toUpperCase() || 'CRITICAL'}
              </span>
              <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E8EB]">
                Incident ID: {currentCase?.id || 'INC-8821'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Paramedic: Alex Mercer • Driver: Vikram Singh • Advanced Cardiac Life Support (ACLS) Unit
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartCall}
            className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-[#D32F2F] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>Call Hospital</span>
          </button>
          <button
            onClick={handleAdvanceNextStatus}
            className="px-4 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Update Status</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. TRIP TIMELINE */}
      <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Trip Progression Timeline
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Current Stage: <strong className="text-slate-800">{timelineSteps[currentStepIdx]?.label}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {timelineSteps.map((step, idx) => {
            const isPassed = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div
                key={step.key}
                className={`p-2.5 rounded-lg border text-xs transition-colors ${
                  isCurrent
                    ? 'bg-teal-50 border-[#0E7C7B] text-[#0E7C7B]'
                    : isPassed
                    ? 'bg-slate-50 border-[#E3E8EB] text-slate-600'
                    : 'bg-white border-[#E3E8EB] text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold">0{idx + 1}</span>
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#0E7C7B] animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <div className="font-bold text-slate-900 mt-1">{step.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">
                  {step.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 3. PATIENT VITALS & TELEMETRY (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#D32F2F]" />
                <span>On-Board Patient Telemetry & Vitals</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transmitted in real-time to receiving emergency department
              </p>
            </div>
            {vitalsSaved && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                Telemetry Synced
              </span>
            )}
          </div>

          <form onSubmit={handleSaveTelemetry} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Heart Rate */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>Heart Rate</span>
                  <Heart className="w-3.5 h-3.5 text-[#D32F2F]" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)}
                    className="w-20 bg-transparent text-xl font-mono font-bold text-slate-900 border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">bpm</span>
                </div>
              </div>

              {/* Blood Pressure */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>Blood Pressure</span>
                  <Droplet className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="text"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    className="w-24 bg-transparent text-xl font-mono font-bold text-slate-900 border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">mmHg</span>
                </div>
              </div>

              {/* SpO2 */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>SpO2</span>
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(parseInt(e.target.value) || 0)}
                    className="w-16 bg-transparent text-xl font-mono font-bold text-slate-900 border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">% O2</span>
                </div>
              </div>

              {/* Respiratory Rate */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>Resp Rate</span>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    value={respRate}
                    onChange={(e) => setRespRate(parseInt(e.target.value) || 0)}
                    className="w-16 bg-transparent text-xl font-mono font-bold text-slate-900 border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">/min</span>
                </div>
              </div>

              {/* GCS */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <span>GCS Score</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    min={3}
                    max={15}
                    value={gcsScore}
                    onChange={(e) => setGcsScore(parseInt(e.target.value) || 3)}
                    className="w-16 bg-transparent text-xl font-mono font-bold text-slate-900 border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">/ 15</span>
                </div>
              </div>

              {/* Blood Group */}
              <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Blood Group
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">B+</div>
              </div>
            </div>

            {/* Paramedic Field Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paramedic Interventions & Field Observations
              </label>
              <textarea
                rows={2}
                defaultValue="Oxygen administered via non-rebreather mask @ 10L/min. IV line 18G secured in left antecubital fossa. Normal saline 500ml running."
                className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Transmit Telemetry to ER Trauma Bay
              </button>
            </div>
          </form>
        </div>

        {/* 4. ROUTE INFO & RECEIVING HOSPITAL (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#0E7C7B]" />
                <span>Route & Destination Facility</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active transit tracking with priority corridor
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Receiving Hospital
                </span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {destinationHospital.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{destinationHospital.address}</div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                ER Standby Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E3E8EB] text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Estimated ETA</div>
                <div className="font-mono text-sm font-bold text-slate-900">4 min</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Distance</div>
                <div className="font-mono text-sm font-bold text-slate-900">1.8 km</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Corridor</div>
                <div className="text-xs font-bold text-emerald-700">Clear Green</div>
              </div>
            </div>
          </div>

          {/* Incident Location */}
          <div className="p-3 rounded-lg border border-[#E3E8EB] text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-[#D32F2F]" />
              <span className="font-bold uppercase text-[10px] tracking-wider">Pickup Site</span>
            </div>
            <div className="font-semibold text-slate-800">
              {currentCase ? currentCase.address : 'Janpath Crossing, Connaught Place, New Delhi'}
            </div>
            <div className="text-[11px] text-slate-500">
              Victims: {currentCase ? currentCase.victimsCount : 2} • Caller: {currentCase ? currentCase.callerName : 'Rahul Verma'}
            </div>
          </div>

          {/* Quick status cycle button */}
          <button
            onClick={handleAdvanceNextStatus}
            className="w-full py-2.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>Advance Trip Stage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calling Hospital Modal */}
      {(callingHospital || callActive) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] max-w-sm w-full p-5 space-y-4 shadow-lg text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-[#D32F2F] mx-auto">
              <Phone className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {callingHospital ? 'Connecting Priority Line...' : 'Live Trauma Bay Audio Link'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {destinationHospital.name} • ER Lead Dr. Neha Sharma
              </p>
            </div>

            {callActive && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                Connected: 00:32 • Audio Priority Stream Encrypted
              </div>
            )}

            <button
              onClick={handleEndCall}
              className="w-full py-2 bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              End Priority Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
