import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertOctagon,
  Radio,
  Ambulance,
  Hospital,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { appStore } from '../services/store';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEmergency: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  onNavigateToEmergency,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const steps = [
    {
      title: '1. Incident Reported via Geolocation GPS',
      subtitle: 'Accident report logged near Connaught Place / Janpath Crossing (28.6189° N, 77.2144° E).',
      badge: 'GPS Tagged',
      icon: AlertOctagon,
      color: 'text-rose-500',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
      actionText: 'Execute Report Trigger',
      details: 'A bystander reports a multi-vehicle collision with 2 severe trauma casualties. Location coordinates and timestamp are verified instantly.',
    },
    {
      title: '2. Auto-Deduplication Algorithm',
      subtitle: 'System cross-references active reports within 150m radius and 10 minutes.',
      badge: 'Zero Clutter',
      icon: Radio,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      actionText: 'Validate & Consolidate',
      details: 'A second caller from the same intersection is merged as a confirmation instead of creating duplicate records, bumping case confidence to 100%.',
    },
    {
      title: '3. Responder Dispatch & Acceptance',
      subtitle: 'EMS Rapid Response Unit 104 receives push dispatch with live GPS navigation.',
      badge: 'EMS Unit 104',
      icon: Ambulance,
      color: 'text-sky-500',
      bgColor: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900',
      actionText: 'Accept Dispatch',
      details: 'Paramedic Alex Mercer accepts the call. Unit switches to "En Route" with siren telemetry and estimated 4 min arrival to scene.',
    },
    {
      title: '4. Dynamic Hospital & Bed Matching',
      subtitle: 'Live querying of hospital trauma capacity, ICU vacancies, and route distance.',
      badge: 'Live Bed Data',
      icon: Hospital,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
      actionText: 'Match & Select Facility',
      details: 'City Metro General and St. Jude Trauma Center are compared. St. Jude has 6 vacant Level-1 Trauma beds and dedicated CT scanners ready.',
    },
    {
      title: '5. Hospital Readiness Handshake',
      subtitle: 'Emergency department confirms readiness and pre-reserves 2 Trauma & 1 ICU bed.',
      badge: 'Trauma Bay Prepped',
      icon: ShieldCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
      actionText: 'Confirm Hospital Readiness',
      details: 'Chief ER Physician locks bed reservations and signals ambulance: "Trauma Bay 1 ready, neurosurgeon standing by".',
    },
    {
      title: '6. Arrival, Admittance & Locker Integration',
      subtitle: 'Patient admitted, break-glass access logs medical allergies, and vitals are archived.',
      badge: 'Care Connected',
      icon: CheckCircle2,
      color: 'text-teal-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900',
      actionText: 'View Emergency Dashboard',
      details: 'Full loop complete in under 60 seconds! The emergency flow seamlessly transitioned from bystander to paramedic to hospital.',
    },
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoPlay && isOpen) {
      timer = setTimeout(() => {
        if (currentStep < steps.length - 1) {
          handleStepAction(currentStep + 1);
        } else {
          setAutoPlay(false);
        }
      }, 7000);
    }
    return () => clearTimeout(timer);
  }, [autoPlay, currentStep, isOpen]);

  if (!isOpen) return null;

  const handleStepAction = (stepIndex: number) => {
    setCurrentStep(stepIndex);

    // Trigger state changes in the store matching the step
    if (stepIndex === 1) {
      appStore.reportEmergency({
        callerName: 'Bystander Sim-Witness',
        callerPhone: '+91 98119 88776',
        emergencyType: 'Road Accident',
        victimsCount: 2,
        severity: 'critical',
        lat: 28.6189,
        lng: 77.2144,
        address: 'Janpath Crossing, Connaught Place, New Delhi',
        description: 'Multi-vehicle collision, two casualties with head trauma.',
      });
    } else if (stepIndex === 2) {
      // Trigger second report at same spot to prove deduplication
      appStore.reportEmergency({
        callerName: 'Traffic Police Officer',
        callerPhone: '+91 98224 11223',
        emergencyType: 'Road Accident',
        victimsCount: 2,
        severity: 'critical',
        lat: 28.6190,
        lng: 77.2145,
        address: 'Janpath Crossing, Connaught Place, New Delhi',
        description: 'Police confirming collision at Janpath crossing.',
      });
    } else if (stepIndex === 3) {
      const activeCase = appStore.getState().emergencies[0];
      if (activeCase) {
        appStore.responderAcceptEmergency(
          activeCase.id,
          'resp-104',
          'EMS Rapid Response Unit 104',
          '+91 98765 00104'
        );
      }
    } else if (stepIndex === 4) {
      const activeCase = appStore.getState().emergencies[0];
      if (activeCase) {
        appStore.selectDestinationHospital(activeCase.id, 'hosp-1', 4);
      }
    } else if (stepIndex === 5) {
      const activeCase = appStore.getState().emergencies[0];
      if (activeCase) {
        appStore.confirmHospitalReadiness(activeCase.id, { emergency: 2, icu: 1 });
      }
    } else if (stepIndex === 6) {
      const activeCase = appStore.getState().emergencies[0];
      if (activeCase) {
        appStore.markEmergencyArrived(activeCase.id);
      }
    }
  };

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">60-Second Judge Emergency Demo</h3>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Zinnovatio 4.0 Interactive
                </span>
              </div>
              <p className="text-xs text-rose-100">
                Experience the full automated end-to-end emergency triage workflow in real time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {steps.map((st, i) => (
              <button
                key={i}
                onClick={() => handleStepAction(i)}
                className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                  i === currentStep
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                    : i < currentStep
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-60 hover:opacity-100'
                }`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border border-current">
                  {i < currentStep ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline truncate max-w-full text-[10px]">
                  {st.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Step Showcase */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className={`p-5 rounded-2xl border ${currentStepData.bgColor}`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-md ${currentStepData.color}`}>
                <StepIcon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-xs border border-slate-200 dark:border-slate-700">
                    Step {currentStep + 1} of 6
                  </span>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {currentStepData.badge}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  {currentStepData.title}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {currentStepData.subtitle}
                </p>
                <div className="mt-4 p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Technical Architecture Highlight:</strong> {currentStepData.details}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics of the Simulated Case */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Incident Type</span>
              <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">Road Accident</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Triage Severity</span>
              <p className="text-sm font-bold text-rose-600 mt-0.5">Code Red (Critical)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Victims</span>
              <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">2 Casualties</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Destination ETA</span>
              <p className="text-sm font-bold text-emerald-600 mt-0.5">4 Minutes</p>
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                autoPlay
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{autoPlay ? 'Pause Auto-Play' : 'Auto-Play 60s Demo'}</span>
            </button>
            <button
              onClick={() => {
                appStore.resetToDefaultSeed();
                setCurrentStep(0);
                setAutoPlay(false);
              }}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1"
              title="Reset state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => handleStepAction(currentStep + 1)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md transition-all"
              >
                <span>Advance to Step {currentStep + 2}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToEmergency();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all"
              >
                <span>Open Live Emergency Command</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
