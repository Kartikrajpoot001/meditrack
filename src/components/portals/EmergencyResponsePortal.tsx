import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  MapPin,
  Ambulance,
  Building2,
  AlertTriangle,
  Clock,
  Phone,
  CheckCircle2,
  Navigation,
  Radio,
  ArrowRight,
  Activity,
  History,
  Heart,
  Droplet,
  Layers,
  Users,
  Flame,
  UserCheck,
  Send,
  Plus,
  Compass,
  Check,
  Car,
  Bike,
  Footprints,
  Eye,
  Camera,
  FileText,
  Hospital as HospitalIcon,
  RefreshCw,
  Sparkles,
  Sliders,
  ExternalLink,
  Info,
  X,
  ChevronRight,
  AlertCircle,
  Stethoscope,
  CheckSquare,
  Square,
  Share2,
} from 'lucide-react';
import { AppState, appStore, getDistanceInMeters } from '../../services/store';
import { AuthUser } from '../../services/auth';
import {
  EmergencyCase,
  EmergencySeverity,
  EmergencyType,
  EmergencyLifecycleStatus,
  IncidentHelper,
  HelperRoleOption,
  AmbulanceUnit,
  EmergencyVitals,
} from '../../types';
import { GoogleMapsView } from '../GoogleMapsView';
import { AmbulanceFleetMap } from '../ambulance/AmbulanceFleetMap';

interface EmergencyResponsePortalProps {
  appState: AppState;
  currentUser: AuthUser | null;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onOpenEmergency: () => void;
}

// Exact 8-step lifecycle
const LIFECYCLE_STEPS: EmergencyLifecycleStatus[] = [
  'Reported',
  'Dispatcher Alerted',
  'Ambulance Dispatched',
  'Helpers Responding',
  'Ambulance En Route',
  'Assessment and Transport',
  'Hospital Handover',
  'Closed',
];

const STEP_LABELS: Record<string, string> = {
  Reported: '1. Reported',
  'Dispatcher Alerted': '2. Dispatcher Alerted',
  'Ambulance Dispatched': '3. Ambulance Dispatched',
  'Helpers Responding': '4. Helpers Responding',
  'Ambulance En Route': '5. Ambulance En Route',
  'Assessment and Transport': '6. Assessment & Transport',
  'Hospital Handover': '7. Hospital Handover',
  Closed: '8. Closed',
};

const INCIDENT_PHOTOS = [
  { label: 'Vehicular Crash', url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pedestrian Collapse', url: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Thermal Injury', url: 'https://images.unsplash.com/photo-1542884748-2b87b36c6b90?auto=format&fit=crop&w=800&q=80' },
  { label: 'Trauma Scene', url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80' },
];

export const EmergencyResponsePortal: React.FC<EmergencyResponsePortalProps> = ({
  appState,
  currentUser,
  activePage,
  onNavigate,
}) => {
  const allEmergencies = appState.emergencies;
  const activeEmergencies = allEmergencies.filter((e) => e.status !== 'Closed');
  const closedEmergencies = allEmergencies.filter((e) => e.status === 'Closed');

  // Multi-Role Perspective switcher for simulation & evaluation
  const [activeRoleView, setActiveRoleView] = useState<'dispatcher' | 'citizen' | 'paramedic'>('dispatcher');

  // Currently selected incident for inspection/trip/vitals
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    activeEmergencies[0]?.id || allEmergencies[0]?.id || ''
  );

  const selectedCase =
    allEmergencies.find((e) => e.id === selectedCaseId) ||
    activeEmergencies[0] ||
    allEmergencies[0];

  // GPS auto-capture state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.6289,
    lng: 77.2185,
  });
  const [detectedAddress, setDetectedAddress] = useState(
    'Connaught Place Inner Circle, Near Rajiv Chowk Metro Gate 5, New Delhi'
  );
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);

  // STEP 1 Witness: One-Tap SOS broadcast feedback
  const [recentSOSCaseId, setRecentSOSCaseId] = useState<string | null>(null);

  // STEP 1 Supplementary details form state (filled AFTER SOS is sent)
  const [supplementaryDesc, setSupplementaryDesc] = useState('');
  const [supplementaryPhoto, setSupplementaryPhoto] = useState(INCIDENT_PHOTOS[0].url);
  const [supplementaryVictims, setSupplementaryVictims] = useState(1);
  const [supplementaryType, setSupplementaryType] = useState<EmergencyType>('accident');
  const [supplementarySaved, setSupplementarySaved] = useState(false);

  // TRACK B: Nearby user alert state (3 km simulation)
  const [nearbyAlertVisible, setNearbyAlertVisible] = useState(false);
  const [nearbyAlertCase, setNearbyAlertCase] = useState<EmergencyCase | null>(null);
  const [chooseAssistanceModalOpen, setChooseAssistanceModalOpen] = useState(false);
  const [assistanceRoleChoice, setAssistanceRoleChoice] = useState<HelperRoleOption | null>(null);

  // TRACK B - Option 1: Safe Assistance Checklist state
  const [safeAssistanceGiven, setSafeAssistanceGiven] = useState(false);
  const [helperArrivedScene, setHelperArrivedScene] = useState(false);

  // TRACK B - Option 2: Transport Victim state
  const [selectedHospitalForTransport, setSelectedHospitalForTransport] = useState<string>(
    appState.hospitals[0]?.id || 'hosp-1'
  );
  const [safeTransportWarningChecked, setSafeTransportWarningChecked] = useState(false);
  const [transportVehicleDetails, setTransportVehicleDetails] = useState('Personal Car (Maruti Brezza DL-3C-9902)');

  // TRACK B - Option 3: Guide Ambulance state
  const [guideLandmarks, setGuideLandmarks] = useState('Opposite Central Bank / Regal Cinema Gate');
  const [guideRoadBlocks, setGuideRoadBlocks] = useState('Clear via Outer Circle; avoid Inner Radial 2 due to metro construction');
  const [guideVictimEstimate, setGuideVictimEstimate] = useState(1);
  const [guideNotes, setGuideNotes] = useState('Victim is conscious on sidewalk; traffic has been diverted by pedestrians.');

  // Paramedic Vitals Form State
  const [vitalBP, setVitalBP] = useState(selectedCase?.vitals?.bloodPressure || '120/80');
  const [vitalHR, setVitalHR] = useState(selectedCase?.vitals?.heartRate || 88);
  const [vitalSpO2, setVitalSpO2] = useState(selectedCase?.vitals?.spo2 || 97);
  const [vitalGCS, setVitalGCS] = useState(selectedCase?.vitals?.gcs || 15);
  const [vitalNotes, setVitalNotes] = useState(selectedCase?.vitals?.conditionNotes || 'Mild concussive state, vitals stabilized on 4L O2.');
  const [vitalsSavedNotice, setVitalsSavedNotice] = useState(false);

  // Close Incident Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeSummaryText, setCloseSummaryText] = useState('');

  // Auto-capture GPS on load
  const captureGPS = () => {
    setIsCapturingGPS(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          setUserCoords({ lat, lng });
          setDetectedAddress(`GPS Fixed: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (Central Metro Zone)`);
          setIsCapturingGPS(false);
        },
        () => {
          setUserCoords({ lat: 28.6289, lng: 77.2185 });
          setDetectedAddress('Connaught Place Inner Circle, Near Metro Gate 5, New Delhi');
          setIsCapturingGPS(false);
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    } else {
      setIsCapturingGPS(false);
    }
  };

  useEffect(() => {
    captureGPS();
  }, []);

  // Update vitals form fields when selectedCase changes
  useEffect(() => {
    if (selectedCase?.vitals) {
      setVitalBP(selectedCase.vitals.bloodPressure || '120/80');
      setVitalHR(selectedCase.vitals.heartRate || 88);
      setVitalSpO2(selectedCase.vitals.spo2 || 97);
      setVitalGCS(selectedCase.vitals.gcs || 15);
      setVitalNotes(selectedCase.vitals.conditionNotes || '');
    }
  }, [selectedCaseId]);

  // Check if there is an active incident to trigger simulated nearby alert
  useEffect(() => {
    const active = activeEmergencies.find((e) => e.status !== 'Closed');
    if (active && !nearbyAlertCase) {
      setNearbyAlertCase(active);
    }
  }, [allEmergencies]);

  // STEP 1: ONE-TAP SOS ACTION
  const handleOneTapSOS = () => {
    const result = appStore.triggerOneTapSOS({
      lat: userCoords.lat,
      lng: userCoords.lng,
      address: detectedAddress,
      callerName: currentUser?.name || 'Witness Bystander',
      callerPhone: currentUser?.phone || '+91 98112 00000',
      emergencyType: 'accident',
    });

    setRecentSOSCaseId(result.caseItem.id);
    setSelectedCaseId(result.caseItem.id);
    setNearbyAlertCase(result.caseItem);
    setSupplementarySaved(false);
    setNearbyAlertVisible(true); // Trigger track B simulation immediately
  };

  // STEP 1: SUBMIT SUPPLEMENTARY DETAILS AFTER SOS
  const handleSaveSupplementary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recentSOSCaseId) return;

    appStore.updateIncidentAfterSOS(recentSOSCaseId, {
      description: supplementaryDesc.trim() || `Witness updated: ${supplementaryType} with ${supplementaryVictims} casualty(ies).`,
      photoUrl: supplementaryPhoto,
      victimsCount: supplementaryVictims,
      emergencyType: supplementaryType,
    });
    setSupplementarySaved(true);
  };

  // TRACK A: Dispatcher assigns and dispatches ambulance
  const handleDispatchAmbulance = (caseId: string, ambId: string) => {
    appStore.dispatchAmbulance(caseId, ambId);
  };

  // Phase 3 First-Accept-Wins feedback state
  const [slotFeedback, setSlotFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Phase 3 Handlers
  const handleDirectClaimSlot = (slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance', customName?: string) => {
    if (!selectedCase) return;
    const claimerName = customName || currentUser?.name || 'Authorized Responder';
    const res = appStore.claimAssistanceSlot(selectedCase.id, slotType, {
      id: currentUser?.uid || `usr-${Date.now()}`,
      name: claimerName,
      role: slotType === 'ambulance' ? 'paramedic' : slotType === 'transport' ? 'volunteer' : 'civilian_helper',
      unitCode: slotType === 'ambulance' ? 'AMB-104' : undefined,
      hospitalName: slotType === 'transport' ? 'City Metro General Hospital' : undefined,
      hospitalId: slotType === 'transport' ? 'hosp-1' : undefined,
    });

    if (res.success) {
      setSlotFeedback({
        type: 'success',
        message: `✓ Slot Claimed: ${slotType.replace('_', ' ').toUpperCase()} assigned to ${claimerName}. Timeline audit updated & conflicting alerts cancelled.`,
      });
    } else {
      setSlotFeedback({
        type: 'error',
        message: `✕ Claim Blocked (First-Accept-Wins): ${res.message}.`,
      });
    }
  };

  const handleCancelSlot = (slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance', helperId?: string) => {
    if (!selectedCase) return;
    appStore.cancelAssistanceSlot(selectedCase.id, slotType, helperId || 'current-user', 'Manually cancelled from command console');
    setSlotFeedback({
      type: 'info',
      message: `Assistance slot reopened and re-broadcasted to registered nearby responders.`,
    });
  };

  const handleTestDuplicateClaim = (slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance') => {
    if (!selectedCase) return;
    const res = appStore.claimAssistanceSlot(selectedCase.id, slotType, {
      id: 'competing-user-999',
      name: 'Competing Responder (Late Accept)',
      role: 'civilian_helper',
    });
    if (!res.success) {
      setSlotFeedback({
        type: 'error',
        message: `🔒 First-Accept-Wins Verified! ${res.message}. Simultaneous/subsequent claims are rejected.`,
      });
    } else {
      setSlotFeedback({
        type: 'success',
        message: `Slot was open and was successfully claimed.`,
      });
    }
  };

  const handleVerifyTimeouts = () => {
    appStore.checkSlotTimeouts();
    setSlotFeedback({
      type: 'info',
      message: `Checked 3-minute arrival timeouts across all active cases. Any un-arrived responders beyond 3 minutes have had their claims cancelled and slots re-broadcasted.`,
    });
  };

  // TRACK B: Helper accepts an assistance option
  const handleConfirmAssistance = (role: HelperRoleOption) => {
    if (!nearbyAlertCase) return;

    const helperName = currentUser?.name || (role === 'transport_victim' ? 'Aarav Sharma (Volunteer)' : 'Rohan Mehra (Civilian)');
    const targetHosp = appState.hospitals.find((h) => h.id === selectedHospitalForTransport) || appState.hospitals[0];

    const slotMap: Record<HelperRoleOption, 'transport' | 'help_scene' | 'guide_ambulance'> = {
      transport_victim: 'transport',
      help_scene: 'help_scene',
      guide_ambulance: 'guide_ambulance',
    };
    const slotType = slotMap[role];

    const claimRes = appStore.claimAssistanceSlot(nearbyAlertCase.id, slotType, {
      id: currentUser?.uid || `hlp-${Date.now()}`,
      name: helperName,
      role: role === 'transport_victim' ? 'Volunteer' : 'Civilian',
      hospitalId: role === 'transport_victim' ? targetHosp.id : undefined,
      hospitalName: role === 'transport_victim' ? targetHosp.name : undefined,
      vehicleDetails: role === 'transport_victim' ? transportVehicleDetails : undefined,
      landmarks: role === 'guide_ambulance' ? guideLandmarks : undefined,
      roadBlocks: role === 'guide_ambulance' ? guideRoadBlocks : undefined,
      victimCountEstimate: role === 'guide_ambulance' ? guideVictimEstimate : undefined,
      sceneNotes: role === 'guide_ambulance' ? guideNotes : undefined,
    });

    if (!claimRes.success) {
      alert(`Claim Conflict: ${claimRes.message}. First accept wins rule applied.`);
      return;
    }

    setChooseAssistanceModalOpen(false);
    setNearbyAlertVisible(false);
    setSelectedCaseId(nearbyAlertCase.id);

    // If help_scene was picked, navigate to scene instructions
    if (role === 'help_scene') {
      setAssistanceRoleChoice('help_scene');
    }
  };

  // STEP 3: Paramedic updates vitals
  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    appStore.updateParamedicVitals(
      selectedCase.id,
      {
        bloodPressure: vitalBP,
        heartRate: Number(vitalHR),
        spo2: Number(vitalSpO2),
        gcs: Number(vitalGCS),
        conditionNotes: vitalNotes,
        recordedBy: selectedCase.assignedAmbulance?.paramedicName || 'Field Paramedic Crew',
      },
      vitalNotes
    );

    setVitalsSavedNotice(true);
    setTimeout(() => setVitalsSavedNotice(false), 4000);
  };

  // STEP 3: Close incident
  const handleConfirmClose = () => {
    if (!selectedCase) return;
    appStore.closeIncident(selectedCase.id, closeSummaryText.trim() || 'All casualties triaged, transferred, and ER admission completed.');
    setCloseModalOpen(false);
    setCloseSummaryText('');
  };

  // Helper to determine step status
  const getStepState = (caseStatus: EmergencyLifecycleStatus, step: EmergencyLifecycleStatus) => {
    const currentIndex = LIFECYCLE_STEPS.indexOf(caseStatus);
    const stepIndex = LIFECYCLE_STEPS.indexOf(step);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* ROLE SWITCHER / SIMULATION BANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Emergency Response Command Center</h2>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full uppercase">
                Dual-Track System Live
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Parallel response: Track A (Official Ambulance Fleet) & Track B (Nearby Civilian Helpers within 3 km)
            </p>
          </div>
        </div>

        {/* Perspective Toggle Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveRoleView('dispatcher')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeRoleView === 'dispatcher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatcher View
          </button>
          <button
            onClick={() => setActiveRoleView('citizen')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeRoleView === 'citizen'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Citizen / Witness View
          </button>
          <button
            onClick={() => setActiveRoleView('paramedic')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeRoleView === 'paramedic'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paramedic (My Trip)
          </button>
        </div>
      </div>

      {/* TRACK B SIMULATION BANNER: NEARBY APP USER NOTIFICATION (within 3 km) */}
      {nearbyAlertVisible && nearbyAlertCase && (
        <div className="bg-amber-500 text-slate-950 rounded-xl p-4 shadow-lg border-2 border-amber-300 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>Track B Alert • Nearby App Users Within 3 km</span>
                  <span className="text-xs bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                    1.2 km from you
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-900 mt-0.5">
                  Emergency nearby: {nearbyAlertCase.emergencyType} at {nearbyAlertCase.address}. Your route intersects this area.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setNearbyAlertVisible(false)}
                className="px-3.5 py-2 bg-slate-900/10 hover:bg-slate-900/20 text-slate-900 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Ignore (Resume Journey)
              </button>
              <button
                onClick={() => setChooseAssistanceModalOpen(true)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-xs font-black shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <span>Accept & Choose Assistance</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8-STEP LIFECYCLE STEP TRACKER FOR SELECTED INCIDENT */}
      {selectedCase && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <h3 className="font-black text-slate-900 text-sm font-mono tracking-tight">
                {selectedCase.id}
              </h3>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {selectedCase.emergencyType}
              </span>
              <span className="text-xs text-slate-500">• {selectedCase.address}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Current Phase:</span>
              <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                {selectedCase.status}
              </span>
            </div>
          </div>

          {/* 8 Horizontal Step Tracker */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[800px] flex items-center justify-between relative py-2">
              {/* Connector line behind steps */}
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />

              {LIFECYCLE_STEPS.map((step, idx) => {
                const state = getStepState(selectedCase.status, step);
                return (
                  <div key={step} className="flex flex-col items-center relative z-10 text-center px-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        state === 'completed'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : state === 'active'
                          ? 'bg-red-600 text-white ring-4 ring-red-100 animate-pulse'
                          : 'bg-white text-slate-400 border-2 border-slate-300'
                      }`}
                    >
                      {state === 'completed' ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-bold whitespace-nowrap ${
                        state === 'completed'
                          ? 'text-emerald-800'
                          : state === 'active'
                          ? 'text-red-700 font-black'
                          : 'text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 1: DASHBOARD (Live counts, quick SOS, active track)
          ======================================================== */}
      {activePage === 'dashboard' && (
        <div className="space-y-6">
          {/* STATS METRIC CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigate('active-incidents')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-red-500 cursor-pointer shadow-xs transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
                <span>Active Incidents</span>
                <Radio className="w-4 h-4 text-red-500" />
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900">{activeEmergencies.length}</div>
              <div className="text-[11px] text-red-600 font-semibold mt-1">Live dual-track coordination</div>
            </div>

            <div
              onClick={() => onNavigate('responders')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-500 cursor-pointer shadow-xs transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
                <span>Fleet Ambulances</span>
                <Ambulance className="w-4 h-4 text-teal-600" />
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {appState.ambulances ? appState.ambulances.length : 4}
              </div>
              <div className="text-[11px] text-teal-600 font-semibold mt-1">
                {appState.ambulances?.filter((a) => a.status === 'available').length || 3} Available • 1 Dispatched
              </div>
            </div>

            <div
              onClick={() => onNavigate('active-incidents')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 cursor-pointer shadow-xs transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
                <span>Civilian Helpers (Track B)</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {allEmergencies.reduce((acc, e) => acc + (e.helpers?.length || 0), 0)}
              </div>
              <div className="text-[11px] text-blue-600 font-semibold mt-1">Assisting at scene / guiding</div>
            </div>

            <div
              onClick={() => onNavigate('hospital-readiness')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-500 cursor-pointer shadow-xs transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
                <span>Hospital Trauma Bays</span>
                <Building2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900">100%</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">All 4 Regional Hubs Ready</div>
            </div>
          </div>

          {/* TWO PARALLEL TRACKS SUMMARY CARD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Track A Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                    A
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Track A: Official Fleet Response</h4>
                    <span className="text-[11px] text-slate-500">Dispatcher & Paramedic Crew</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('active-incidents')}
                  className="text-xs text-red-700 font-bold hover:underline flex items-center gap-1"
                >
                  <span>Dispatch Command</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {appState.ambulances?.map((amb) => (
                  <div key={amb.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{amb.unitCode} • {amb.type}</div>
                      <div className="text-[11px] text-slate-500">
                        Crew: {amb.paramedicName} | Driver: {amb.driverName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        amb.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {amb.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">ETA: {amb.etaMinutes}m ({amb.distanceKm} km)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Track B Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    B
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Track B: Nearby App Users (3 km)</h4>
                    <span className="text-[11px] text-slate-500">Multiple Citizens Assisting</span>
                  </div>
                </div>
                <button
                  onClick={() => setChooseAssistanceModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-xs font-bold cursor-pointer"
                >
                  Test Role Choice
                </button>
              </div>

              <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Footprints className="w-4 h-4 text-blue-600" />
                    <span>1. Help at Scene</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Safe First Aid: Keep area safe, apply pressure to bleeding, keep victim still, stay on line.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-emerald-600" />
                    <span>2. Transport Victim</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Select nearby hospital with real-time bed capacity. Mandatory safety declaration required before moving.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-purple-600" />
                    <span>3. Guide Ambulance</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Live route landmarks and roadblocks shared directly with dispatcher & en-route ambulance crew.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE INCIDENTS PREVIEW */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Active Emergencies ({activeEmergencies.length})</h3>
              <button
                onClick={() => onNavigate('report-incident')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>One-Tap SOS</span>
              </button>
            </div>

            <div className="space-y-3">
              {activeEmergencies.map((emg) => (
                <div
                  key={emg.id}
                  onClick={() => setSelectedCaseId(emg.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    emg.id === selectedCaseId
                      ? 'border-red-500 bg-red-50/20 ring-1 ring-red-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">{emg.id}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800">
                        {emg.emergencyType}
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {emg.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Reported {new Date(emg.reportedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-700 font-medium">{emg.address}</div>

                  {/* Responders & Helpers Tag Cluster */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {emg.assignedAmbulance ? (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[11px] flex items-center gap-1">
                        <Ambulance className="w-3.5 h-3.5" />
                        <span>Ambulance {emg.assignedAmbulance.unitCode} (ETA {emg.assignedAmbulance.etaMinutes}m)</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold text-[11px]">Ambulance unassigned</span>
                    )}

                    {emg.helpers?.map((h) => (
                      <span key={h.id} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[11px]">
                        Helper: {h.name} ({h.roleOption === 'help_scene' ? 'At Scene' : h.roleOption === 'transport_victim' ? 'Transporting' : 'Guiding'})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 2: LIVE MAP (Google Maps with dual track markers)
          ======================================================== */}
      {activePage === 'live-map' && (
        <AmbulanceFleetMap
          appState={appState}
          onNavigateToIncident={(id) => {
            setSelectedCaseId(id);
            onNavigate('active-incidents');
          }}
          onRequestSOS={() => onNavigate('report-incident')}
        />
      )}

      {/* ========================================================
          PAGE 3: REPORT INCIDENT (STEP 1: ONE-TAP SOS BUTTON)
          ======================================================== */}
      {activePage === 'report-incident' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* STEP 1: BIG ONE-TAP SOS BUTTON */}
          <div className="bg-white rounded-2xl border-2 border-red-200 p-6 sm:p-8 text-center shadow-lg space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-3 py-1 rounded-full">
                Step 1 • Witness Instant Alert
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
                Emergency One-Tap SOS
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-2">
                Tap the big red button below. Your GPS location is immediately captured, an Incident ID is generated, and the Dispatcher + Nearby Helpers are notified instantly.
              </p>
            </div>

            {/* GPS Fixed Indicator */}
            <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 font-mono">
              <MapPin className="w-4 h-4 text-red-600 animate-pulse" />
              <span>{detectedAddress}</span>
              <button
                onClick={captureGPS}
                className="text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                title="Refresh GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCapturingGPS ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Pulsating Big Red SOS Button */}
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={handleOneTapSOS}
                className="relative group w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 text-white font-black text-2xl sm:text-3xl shadow-2xl shadow-red-600/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center border-4 border-white"
              >
                <span className="absolute -inset-3 rounded-full bg-red-500/20 animate-ping pointer-events-none" />
                <ShieldAlert className="w-12 h-12 sm:w-14 sm:h-14 mb-2 drop-shadow-md" />
                <span className="tracking-wider">ONE-TAP SOS</span>
                <span className="text-[11px] font-normal opacity-90 mt-1">Tap to Broadcast</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 italic">
              No login required. Supplementary details (photos, note, victim count) can be added AFTER broadcast.
            </p>
          </div>

          {/* CONFIRMATION CARD & SUPPLEMENTARY FORM (Shown when SOS is triggered) */}
          {recentSOSCaseId && (
            <div className="bg-white rounded-2xl border border-emerald-300 p-6 shadow-md space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 pb-3 border-b border-emerald-100">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    SOS Broadcasted Successfully!
                  </h3>
                  <p className="text-xs text-emerald-800 font-semibold font-mono">
                    Incident ID: {recentSOSCaseId} • Status: Dispatcher Alerted
                  </p>
                </div>
              </div>

              {/* Supplementary Details Form (AFTER SOS) */}
              <form onSubmit={handleSaveSupplementary} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800">Add Optional Scene Details:</span>
                  <span className="text-slate-500 ml-1">Help the responding ambulance and nearby volunteers prepare.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Emergency Category</label>
                    <select
                      value={supplementaryType}
                      onChange={(e) => setSupplementaryType(e.target.value as EmergencyType)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="accident">Vehicular Crash / Collision</option>
                      <option value="collapse">Pedestrian Collapse / Cardiac</option>
                      <option value="burn">Fire & Thermal Burns</option>
                      <option value="other">Trauma / Fall / Medical</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Estimated Victims Count</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={supplementaryVictims}
                        onChange={(e) => setSupplementaryVictims(parseInt(e.target.value, 10) || 1)}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Presets */}
                <div>
                  <label className="font-bold text-slate-700 text-xs block mb-1">Attach Scene Photo (Optional)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {INCIDENT_PHOTOS.map((p) => (
                      <div
                        key={p.url}
                        onClick={() => setSupplementaryPhoto(p.url)}
                        className={`p-1 rounded-lg border cursor-pointer transition-all ${
                          supplementaryPhoto === p.url
                            ? 'border-red-600 ring-2 ring-red-300'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={p.url} alt={p.label} className="w-full h-16 object-cover rounded" />
                        <span className="text-[10px] block text-center font-semibold mt-1 truncate">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 text-xs block mb-1">Witness Notes / Landmarks</label>
                  <textarea
                    rows={2}
                    value={supplementaryDesc}
                    onChange={(e) => setSupplementaryDesc(e.target.value)}
                    placeholder="e.g. Broken glass, one unconscious victim on pedestrian walkway near bus stand."
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {supplementarySaved ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Supplementary details synced with dispatcher & responders
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">All details are immediately broadcast live.</span>
                  )}

                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Save & Update Responders
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PAGE 4: ACTIVE INCIDENTS (TRACK A + TRACK B + TIMELINE LOG)
          ======================================================== */}
      {activePage === 'active-incidents' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="font-black text-slate-900 text-base">Active Dual-Track Incidents</h2>
              <p className="text-xs text-slate-500">
                Dispatcher command & control with ambulance fleet assignment, civilian helper list, and timeline logs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('report-incident')}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New SOS</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Incident List */}
            <div className="lg:col-span-1 space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Incidents in Progress ({activeEmergencies.length})
              </span>
              {activeEmergencies.map((emg) => (
                <div
                  key={emg.id}
                  onClick={() => setSelectedCaseId(emg.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    emg.id === selectedCaseId
                      ? 'border-red-600 bg-red-50/30 shadow-md ring-1 ring-red-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">{emg.id}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800">
                      {emg.emergencyType}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-700 font-medium truncate">{emg.address}</div>
                  <div className="mt-2 text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>Phase: {emg.status}</span>
                    <span className="text-slate-400 font-normal">{new Date(emg.reportedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Selected Incident Detail & Controls */}
            {selectedCase && (
              <div className="lg:col-span-2 space-y-4">
                {/* Incident Overview Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 text-lg font-mono">{selectedCase.id}</h3>
                        <span className="text-xs bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded uppercase">
                          {selectedCase.emergencyType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedCase.address}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCloseModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Close Incident
                      </button>
                    </div>
                  </div>

                  {/* TRACK A: Official Response - Ambulance Dispatch Section */}
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ambulance className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-slate-900 text-sm">
                          Track A: Ambulance Dispatch Command
                        </h4>
                      </div>
                      {selectedCase.assignedAmbulance ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded">
                          ✓ Dispatched: {selectedCase.assignedAmbulance.unitCode}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                          Awaiting Dispatcher
                        </span>
                      )}
                    </div>

                    {/* Ambulance Picker (Nearest First) */}
                    {!selectedCase.assignedAmbulance ? (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs text-slate-600 font-semibold block">
                          Available Units (Sorted Nearest First):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {appState.ambulances
                            ?.filter((a) => a.status === 'available')
                            .map((amb) => (
                              <div
                                key={amb.id}
                                className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col justify-between text-xs hover:border-red-500 transition-all"
                              >
                                <div>
                                  <div className="flex items-center justify-between font-bold text-slate-900">
                                    <span>{amb.unitCode}</span>
                                    <span className="text-red-600 font-mono">ETA {amb.etaMinutes} min ({amb.distanceKm} km)</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">{amb.type}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Paramedic: {amb.paramedicName}</div>
                                </div>
                                <button
                                  onClick={() => handleDispatchAmbulance(selectedCase.id, amb.id)}
                                  className="mt-2.5 w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded cursor-pointer transition-colors"
                                >
                                  Dispatch Ambulance
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="font-bold text-slate-900">
                          {selectedCase.assignedAmbulance.unitCode} ({selectedCase.assignedAmbulance.type})
                        </div>
                        <div className="text-slate-600">
                          Paramedic: {selectedCase.assignedAmbulance.paramedicName} | Driver: {selectedCase.assignedAmbulance.driverName}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          ETA to Scene: {selectedCase.assignedAmbulance.etaMinutes} mins • Status: {selectedCase.assignedAmbulance.status}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TRACK B: Nearby Civilian Helpers Section */}
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-slate-900 text-sm">
                          Track B: Nearby Responding Helpers ({selectedCase.helpers?.length || 0})
                        </h4>
                      </div>
                      <button
                        onClick={() => setChooseAssistanceModalOpen(true)}
                        className="text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded cursor-pointer"
                      >
                        + Add Helper Option
                      </button>
                    </div>

                    {selectedCase.helpers && selectedCase.helpers.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCase.helpers.map((h) => (
                          <div key={h.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{h.name}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                                {(h.roleOption || h.roleChoice || 'help_scene').replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              Distance: {h.distanceKm} km • ETA: {h.etaMinutes} mins • Status: {h.status}
                            </div>
                            {h.transportHospitalName && (
                              <div className="text-emerald-800 font-semibold text-[11px]">
                                Transporting victim to: {h.transportHospitalName} ({h.vehicleDetails || 'Personal Vehicle'})
                              </div>
                            )}
                            {h.landmarks && (
                              <div className="text-slate-600 text-[11px] bg-slate-50 p-1.5 rounded">
                                <strong>Guidance Shared:</strong> Landmark: {h.landmarks} | Roadblocks: {h.roadBlocks || 'None'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-2 bg-white rounded border border-dashed border-slate-200">
                        Broadcasting to registered app users within 3 km. No helpers checked in yet.
                      </div>
                    )}
                  </div>

                  {/* INCIDENT TIMELINE LOG [Time] [Event] [Who did it] */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-700" />
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                          Incident Timeline Audit Log
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {selectedCase.timeline?.length || 0} events recorded
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedCase.timeline?.map((ev) => (
                        <div key={ev.id} className="text-xs flex items-start gap-2.5 py-1.5 border-b border-slate-100 last:border-b-0">
                          <span className="font-mono text-slate-400 font-semibold text-[11px] shrink-0">
                            {ev.timestamp}
                          </span>
                          <div className="flex-1">
                            <span className="font-bold text-slate-900">{ev.event}</span>
                            {ev.details && (
                              <p className="text-[11px] text-slate-600 mt-0.5">{ev.details}</p>
                            )}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium shrink-0">
                            {ev.who}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 5: RESPONDERS & AMBULANCES (Ambulance Fleet & Active Volunteers)
          ======================================================== */}
      {(activePage === 'responders' || activePage === 'ambulances') && (
        <AmbulanceFleetMap
          appState={appState}
          onNavigateToIncident={(id) => {
            setSelectedCaseId(id);
            onNavigate('active-incidents');
          }}
          onRequestSOS={() => onNavigate('report-incident')}
        />
      )}

      {/* ========================================================
          PAGE 6: HOSPITAL READINESS (Regional Trauma Facilities)
          ======================================================== */}
      {activePage === 'hospital-readiness' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 text-base">Regional Hospital Trauma Readiness Matrix</h2>
              <p className="text-xs text-slate-500">Live bed availability, emergency bay status, ICU count, and triage capacity.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appState.hospitals.map((hosp) => {
              const freeEmergencyBeds = hosp.beds.emergencyTotal - hosp.beds.emergencyOccupied;
              const freeICUBeds = hosp.beds.icuTotal - hosp.beds.icuOccupied;
              const readiness = Math.round(((freeEmergencyBeds + freeICUBeds) / (hosp.beds.emergencyTotal + hosp.beds.icuTotal)) * 100);

              return (
                <div key={hosp.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                        <HospitalIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{hosp.name}</h4>
                        <p className="text-xs text-slate-500">{hosp.address}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {readiness}% Readiness
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Free ER Beds</span>
                      <span className="text-lg font-black text-emerald-700">{freeEmergencyBeds}</span>
                      <span className="text-[10px] text-slate-400 block">/ {hosp.beds.emergencyTotal} total</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Free ICU Beds</span>
                      <span className="text-lg font-black text-purple-700">{freeICUBeds}</span>
                      <span className="text-[10px] text-slate-400 block">/ {hosp.beds.icuTotal} total</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Helpline</span>
                      <span className="text-xs font-bold text-slate-800 block mt-1">102</span>
                      <span className="text-[10px] text-slate-400 block">Active 24/7</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 7: MY TRIP (Paramedic Trip Timeline, Vitals & Handover)
          ======================================================== */}
      {(activePage === 'my-trip' || activePage === 'vitals-entry' || activePage === 'handover') && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900 text-base">Paramedic Unit Trip Console</h2>
              <p className="text-xs text-slate-500">Live navigation, victim vitals telemetry, and hospital clinical handover.</p>
            </div>
            {selectedCase && (
              <span className="text-xs font-bold bg-red-100 text-red-800 px-3 py-1 rounded-full font-mono">
                Active Incident: {selectedCase.id}
              </span>
            )}
          </div>

          {selectedCase ? (
            <div className="space-y-6">
              {/* Trip Phase Bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-red-600 animate-spin" />
                    <h3 className="font-bold text-slate-900 text-sm">Ambulance Route Status</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                    Phase: {selectedCase.status}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                  <strong>Destination:</strong> {selectedCase.address} • <strong>Target Hospital:</strong> {selectedCase.destinationHospitalName || 'City Metro General'}
                </div>
              </div>

              {/* STEP 3: VITALS ENTRY FORM (BP, HR, SpO2, GCS) */}
              <div className="bg-white rounded-xl border border-teal-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-teal-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-700" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Professional Assessment & Vitals Entry</h4>
                      <p className="text-xs text-slate-500">Recorded vitals sync instantly with destination hospital's trauma desk.</p>
                    </div>
                  </div>
                  {vitalsSavedNotice && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Synced to Hospital!
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveVitals} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Blood Pressure</label>
                      <input
                        type="text"
                        value={vitalBP}
                        onChange={(e) => setVitalBP(e.target.value)}
                        placeholder="120/80"
                        className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={vitalHR}
                        onChange={(e) => setVitalHR(parseInt(e.target.value, 10) || 0)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-red-600"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Oxygen SpO2 (%)</label>
                      <input
                        type="number"
                        value={vitalSpO2}
                        onChange={(e) => setVitalSpO2(parseInt(e.target.value, 10) || 0)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-teal-700"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">GCS Score (/15)</label>
                      <input
                        type="number"
                        min={3}
                        max={15}
                        value={vitalGCS}
                        onChange={(e) => setVitalGCS(parseInt(e.target.value, 10) || 15)}
                        className="w-full p-2.5 rounded-lg border border-slate-300 font-mono font-bold text-indigo-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 text-xs block mb-1">Clinical Condition Notes</label>
                    <textarea
                      rows={2}
                      value={vitalNotes}
                      onChange={(e) => setVitalNotes(e.target.value)}
                      placeholder="e.g. Mild concussive disorientation, cervical collar applied, bilateral IV lines established."
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      Vitals will advance status to "Assessment and Transport"
                    </span>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Save & Sync Telemetry to Hospital
                    </button>
                  </div>
                </form>
              </div>

              {/* STEP 3: HOSPITAL HANDOVER BUTTON */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Step 7 • Hospital Handover</h4>
                    <p className="text-xs text-slate-500">Confirm victim arrival at Emergency Bay and hand over to clinical staff.</p>
                  </div>
                  {selectedCase.status !== 'Hospital Handover' && selectedCase.status !== 'Closed' ? (
                    <button
                      onClick={() => {
                        appStore.hospitalHandover(
                          selectedCase.id,
                          selectedCase.destinationHospitalId || 'hosp-1',
                          selectedCase.destinationHospitalName || 'City Metro General Hospital',
                          'Trauma Resuscitation Bay 1'
                        );
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Confirm Hospital Handover
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200">
                      ✓ Handover Complete ({selectedCase.hospitalBedAssigned || 'Bay 1'})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl text-center text-slate-500 text-xs border border-slate-200">
              No active trip selected. Choose an incident from Active Incidents.
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PAGE 8: HISTORY (Closed Incidents Archive)
          ======================================================== */}
      {activePage === 'history' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 text-base">Resolved Incidents & Historical Audit</h2>
              <p className="text-xs text-slate-500">Archived cases with full timestamps, responders involved, and clinical disposition.</p>
            </div>
          </div>

          <div className="space-y-4">
            {closedEmergencies.map((emg) => (
              <div key={emg.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{emg.id}</span>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {emg.emergencyType}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Resolved & Closed
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Closed: {emg.closedAt ? new Date(emg.closedAt).toLocaleTimeString() : 'Archived'}
                  </div>
                </div>

                <div className="text-xs text-slate-700">
                  <strong>Location:</strong> {emg.address}
                </div>

                {emg.closeSummary && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700">
                    <strong>Resolution Summary:</strong> {emg.closeSummary}
                  </div>
                )}

                {/* Timeline Log */}
                {emg.timeline && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Audit Trail ({emg.timeline.length} events)
                    </span>
                    <div className="space-y-1">
                      {emg.timeline.map((ev) => (
                        <div key={ev.id} className="text-[11px] flex items-center gap-2 text-slate-600">
                          <span className="font-mono text-slate-400">{ev.timestamp}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-800">{ev.event}</span>
                          <span className="text-slate-400 text-[10px]">({ev.who})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ========================================================
          PAGE 9: INCIDENT TIMELINE AUDIT & SLOT CLAIMING
          ======================================================== */}
      {activePage === 'incident-timeline' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900 text-base">Incident Lifecycle & Slot Claiming Timeline</h2>
              <p className="text-xs text-slate-500">Live audit log of all claims, cancellations, re-broadcasts, and 3-minute arrival timeouts.</p>
            </div>
            <button
              onClick={handleVerifyTimeouts}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Verify 3-Min Arrival Timeouts</span>
            </button>
          </div>

          {/* Feedback banner */}
          {slotFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
                slotFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : slotFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-sky-50 border-sky-300 text-sky-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {slotFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : slotFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-sky-600 shrink-0" />
                )}
                <span>{slotFeedback.message}</span>
              </div>
              <button
                onClick={() => setSlotFeedback(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Incident Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700 block mb-2">Select Active Incident to Inspect:</span>
            <div className="flex flex-wrap gap-2">
              {allEmergencies.map((emg) => (
                <button
                  key={emg.id}
                  onClick={() => setSelectedCaseId(emg.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedCaseId === emg.id
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {emg.id} ({emg.emergencyType.toUpperCase()})
                </button>
              ))}
            </div>
          </div>

          {selectedCase && (
            <div className="space-y-6">
              {/* Assistance Slots Status (Phase 3 Claiming) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Assistance Slot Allocation Matrix</h3>
                    <p className="text-xs text-slate-500">First-accept-wins rule: The first user to accept permanently locks the slot. Simultaneous alerts to other users are auto-cancelled.</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                    Phase: {selectedCase.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Ambulance Slot */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-bold text-slate-900">1. Ambulance (1 Slot)</span>
                        <Ambulance className="w-4 h-4 text-red-600" />
                      </div>
                      {selectedCase.assignedAmbulance || selectedCase.claimedSlots?.ambulance ? (
                        <div className="space-y-1 mt-1">
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 inline-block">
                            ✓ Claimed: {selectedCase.claimedSlots?.ambulance?.unitCode || selectedCase.assignedAmbulance?.unitCode}
                          </span>
                          <div className="text-[11px] text-slate-600">
                            <strong>Crew:</strong> {selectedCase.claimedSlots?.ambulance?.claimedBy || selectedCase.assignedAmbulance?.paramedicName}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 inline-block">
                            ○ Open Slot
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">First paramedic to accept locks dispatch</div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {selectedCase.assignedAmbulance || selectedCase.claimedSlots?.ambulance ? (
                        <>
                          <button
                            onClick={() => handleTestDuplicateClaim('ambulance')}
                            className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            Test Duplicate Claim (Verify Lock)
                          </button>
                          <button
                            onClick={() => handleCancelSlot('ambulance')}
                            className="w-full py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-semibold cursor-pointer transition-colors border border-rose-200"
                          >
                            Cancel Slot & Re-broadcast
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDirectClaimSlot('ambulance', 'EMS Paramedic Alex Mercer (Unit 104)')}
                            className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Claim as Paramedic (AMB-104)
                          </button>
                          <button
                            onClick={() => appStore.rebroadcastSlot(selectedCase.id, 'ambulance', currentUser?.name || 'Dispatcher')}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Re-broadcast Alert
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Transport Victim Slot */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-bold text-slate-900">2. Transport (1 Slot)</span>
                        <Car className="w-4 h-4 text-emerald-600" />
                      </div>
                      {selectedCase.claimedSlots?.transport ? (
                        <div className="space-y-1 mt-1">
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 inline-block">
                            ✓ Claimed: {selectedCase.claimedSlots.transport.claimedBy}
                          </span>
                          <div className="text-[11px] text-slate-600">
                            <strong>Target ER:</strong> {selectedCase.claimedSlots.transport.hospitalName || 'City Metro Hospital'}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 inline-block">
                            ○ Open Slot
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">First bystander with car/cab claims</div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {selectedCase.claimedSlots?.transport ? (
                        <>
                          <button
                            onClick={() => handleTestDuplicateClaim('transport')}
                            className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            Test Duplicate Claim (Verify Lock)
                          </button>
                          <button
                            onClick={() => handleCancelSlot('transport', selectedCase.claimedSlots?.transport?.helperId)}
                            className="w-full py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-semibold cursor-pointer transition-colors border border-rose-200"
                          >
                            Cancel Slot & Re-broadcast
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDirectClaimSlot('transport', 'Aarav Sharma (Volunteer)')}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Claim Transport Slot
                          </button>
                          <button
                            onClick={() => appStore.rebroadcastSlot(selectedCase.id, 'transport', currentUser?.name || 'Dispatcher')}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Re-broadcast Alert
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Help at Scene Slot (Max 2) */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-bold text-slate-900">3. Scene First Aid (Max 2)</span>
                        <Footprints className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300 inline-block">
                          {selectedCase.helpers?.filter((h) => h.roleOption === 'help_scene').length || 0} / 2 Claimed
                        </span>
                        <div className="space-y-1 mt-1.5">
                          {selectedCase.helpers
                            ?.filter((h) => h.roleOption === 'help_scene')
                            .map((h) => (
                              <div key={h.id} className="text-[11px] text-slate-700 flex items-center justify-between bg-white p-1 rounded border border-slate-200">
                                <span className="font-medium">• {h.name}</span>
                                <button
                                  onClick={() => handleCancelSlot('help_scene', h.id)}
                                  className="text-[9px] text-rose-600 hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {(selectedCase.helpers?.filter((h) => h.roleOption === 'help_scene').length || 0) < 2 ? (
                        <>
                          <button
                            onClick={() => handleDirectClaimSlot('help_scene', 'Rohan Mehra (Civilian First Aider)')}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Claim Scene First Aid Slot
                          </button>
                          <button
                            onClick={() => appStore.rebroadcastSlot(selectedCase.id, 'help_scene', currentUser?.name || 'Dispatcher')}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Re-broadcast Alert
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDirectClaimSlot('help_scene', 'Bystander 3 (Late Accept)')}
                          className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Test 3rd Claim (Verify Capacity Cap)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Guide Ambulance Slot */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-bold text-slate-900">4. Route Guide (1 Slot)</span>
                        <Compass className="w-4 h-4 text-purple-600" />
                      </div>
                      {selectedCase.claimedSlots?.guide ? (
                        <div className="space-y-1 mt-1">
                          <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-300 inline-block">
                            ✓ Claimed: {selectedCase.claimedSlots.guide.claimedBy}
                          </span>
                          <div className="text-[11px] text-slate-600">
                            <strong>Telemetry:</strong> Live approach bearings shared with EMS
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 inline-block">
                            ○ Open Slot
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">Guide paramedic through street roadblocks</div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {selectedCase.claimedSlots?.guide ? (
                        <>
                          <button
                            onClick={() => handleTestDuplicateClaim('guide_ambulance')}
                            className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            Test Duplicate Claim (Verify Lock)
                          </button>
                          <button
                            onClick={() => handleCancelSlot('guide_ambulance', selectedCase.claimedSlots?.guide?.helperId)}
                            className="w-full py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-semibold cursor-pointer transition-colors border border-rose-200"
                          >
                            Cancel Slot & Re-broadcast
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDirectClaimSlot('guide_ambulance', 'Vikram Sen (Civilian Guide)')}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Claim Route Guide Slot
                          </button>
                          <button
                            onClick={() => appStore.rebroadcastSlot(selectedCase.id, 'guide_ambulance', currentUser?.name || 'Dispatcher')}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Re-broadcast Alert
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete Incident Timeline Audit Log */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Chronological Audit Log</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedCase.timeline.length} Events</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {selectedCase.timeline.map((ev) => (
                    <div key={ev.id} className="py-2.5 flex items-start gap-3 text-xs">
                      <span className="font-mono text-slate-400 font-bold shrink-0">{ev.timestamp}</span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{ev.event}</div>
                        {ev.details && <div className="text-slate-500 mt-0.5">{ev.details}</div>}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold shrink-0">
                        {ev.who} ({ev.role})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ========================================================
          MODAL: TRACK B - "CHOOSE ASSISTANCE" (3 OPTIONS)
          ======================================================== */}
      {chooseAssistanceModalOpen && nearbyAlertCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Track B • Registered Bystander Action
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Choose Assistance for {nearbyAlertCase.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Accident 1.2 km from you at {nearbyAlertCase.address}. Multiple users can choose different roles.
                </p>
              </div>
              <button
                onClick={() => setChooseAssistanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* THREE ASSISTANCE OPTIONS */}
            <div className="space-y-3">
              {/* Option 1: Help at Scene */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  assistanceRoleChoice === 'help_scene'
                    ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <Footprints className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Option 1: Help at Scene</h4>
                      <p className="text-xs text-slate-500">Provide safe first aid and secure the area until the ambulance arrives.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAssistanceRoleChoice('help_scene')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      assistanceRoleChoice === 'help_scene'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Select
                  </button>
                </div>

                {assistanceRoleChoice === 'help_scene' && (
                  <div className="mt-4 pt-3 border-t border-blue-100 space-y-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-1.5 text-slate-700">
                      <span className="font-bold text-blue-900 block">Provide Safe Assistance Card:</span>
                      <div>• <strong>Do not move the victim</strong> unless there is immediate life hazard (fire, traffic).</div>
                      <div>• <strong>Keep the area safe</strong>: Divert traffic, turn on hazard lights, stay on sidewalk.</div>
                      <div>• <strong>Apply pressure to bleeding</strong>: Use clean cloth or sterile trauma dressing with steady pressure.</div>
                      <div>• <strong>Stay on the line</strong>: Reassure the victim and keep dispatch updated.</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHelperArrivedScene(true)}
                        className={`px-3 py-1.5 rounded font-bold text-xs cursor-pointer ${
                          helperArrivedScene ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {helperArrivedScene ? '✓ Arrived at Scene' : 'Mark Arrived'}
                      </button>
                      <button
                        onClick={() => setSafeAssistanceGiven(true)}
                        className={`px-3 py-1.5 rounded font-bold text-xs cursor-pointer ${
                          safeAssistanceGiven ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {safeAssistanceGiven ? '✓ Assistance Given' : 'Mark Assistance Given'}
                      </button>
                    </div>

                    <button
                      onClick={() => handleConfirmAssistance('help_scene')}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Confirm Help at Scene
                    </button>
                  </div>
                )}
              </div>

              {/* Option 2: Transport Victim */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  assistanceRoleChoice === 'transport_victim'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Option 2: Transport Victim</h4>
                      <p className="text-xs text-slate-500">Check hospital readiness and transport with personal vehicle or taxi.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAssistanceRoleChoice('transport_victim')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      assistanceRoleChoice === 'transport_victim'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Select
                  </button>
                </div>

                {assistanceRoleChoice === 'transport_victim' && (
                  <div className="mt-4 pt-3 border-t border-emerald-100 space-y-3 text-xs">
                    <span className="font-bold text-slate-800 block">Nearby Hospital Options & Real-Time Capacity:</span>
                    <div className="grid grid-cols-1 gap-2">
                      {appState.hospitals.map((hosp) => (
                        <label
                          key={hosp.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer ${
                            selectedHospitalForTransport === hosp.id
                              ? 'border-emerald-500 bg-emerald-50 font-bold'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="transport_hospital"
                              checked={selectedHospitalForTransport === hosp.id}
                              onChange={() => setSelectedHospitalForTransport(hosp.id)}
                            />
                            <div>
                              <div>{hosp.name}</div>
                              <div className="text-[10px] text-slate-500 font-normal">
                                {hosp.beds.emergencyTotal - hosp.beds.emergencyOccupied} ER Beds Free • {hosp.beds.icuTotal - hosp.beds.icuOccupied} ICU
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] text-emerald-700 font-mono">
                            ETA: 5 min (1.8 km)
                          </span>
                        </label>
                      ))}
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Your Vehicle Description</label>
                      <input
                        type="text"
                        value={transportVehicleDetails}
                        onChange={(e) => setTransportVehicleDetails(e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 bg-white"
                      />
                    </div>

                    {/* MANDATORY WARNING CHECKBOX */}
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={safeTransportWarningChecked}
                          onChange={(e) => setSafeTransportWarningChecked(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span className="font-bold text-amber-950 text-xs">
                          Proceed only if it is safe and appropriate to move the victim.
                        </span>
                      </label>
                    </div>

                    <button
                      disabled={!safeTransportWarningChecked}
                      onClick={() => handleConfirmAssistance('transport_victim')}
                      className={`w-full py-2 rounded-lg font-bold text-xs cursor-pointer ${
                        safeTransportWarningChecked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Confirm Civilian Transport & Alert Hospital
                    </button>
                  </div>
                )}
              </div>

              {/* Option 3: Guide Ambulance */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  assistanceRoleChoice === 'guide_ambulance'
                    ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-200'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Option 3: Guide Ambulance</h4>
                      <p className="text-xs text-slate-500">Share exact spot, landmarks, road blocks, victim count, and clear the route.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAssistanceRoleChoice('guide_ambulance')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      assistanceRoleChoice === 'guide_ambulance'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Select
                  </button>
                </div>

                {assistanceRoleChoice === 'guide_ambulance' && (
                  <div className="mt-4 pt-3 border-t border-purple-100 space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Exact Landmarks / Turnings</label>
                      <input
                        type="text"
                        value={guideLandmarks}
                        onChange={(e) => setGuideLandmarks(e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Road Blocks / Traffic Warnings</label>
                      <input
                        type="text"
                        value={guideRoadBlocks}
                        onChange={(e) => setGuideRoadBlocks(e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Estimated Victims</label>
                        <input
                          type="number"
                          value={guideVictimEstimate}
                          onChange={(e) => setGuideVictimEstimate(parseInt(e.target.value, 10) || 1)}
                          className="w-full p-2 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Short Scene Note</label>
                        <input
                          type="text"
                          value={guideNotes}
                          onChange={(e) => setGuideNotes(e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmAssistance('guide_ambulance')}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Update Dispatcher & Ambulance
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CLOSE INCIDENT (Dispatcher Closes with Summary)
          ======================================================== */}
      {closeModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Close Incident {selectedCase.id}</h3>
              <button onClick={() => setCloseModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Closing this incident will mark it as resolved, notify all participants, and archive the full timeline log into History.
            </p>

            <div>
              <label className="font-bold text-slate-700 text-xs block mb-1">Resolution Summary Note</label>
              <textarea
                rows={3}
                value={closeSummaryText}
                onChange={(e) => setCloseSummaryText(e.target.value)}
                placeholder="e.g. All 2 victims admitted to City Metro General Trauma Bay. Handover completed. Scene cleared."
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCloseModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm & Archive Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
