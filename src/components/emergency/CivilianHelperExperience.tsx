import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  MapPin,
  Footprints,
  Car,
  Compass,
  CheckCircle2,
  Phone,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Info,
  X,
  Clock,
  Navigation,
  Check,
  ChevronDown,
  ChevronUp,
  Radio,
  Sparkles,
  Camera,
  Users,
  Eye,
  Send,
  Zap,
} from 'lucide-react';
import { AppState, appStore, getDistanceInMeters } from '../../services/store';
import { AuthUser } from '../../services/auth';
import {
  EmergencyCase,
  HelperRoleOption,
  IncidentHelper,
} from '../../types';
import { GoogleMapsView, MarkerItem } from '../GoogleMapsView';

interface CivilianHelperExperienceProps {
  appState: AppState;
  currentUser: AuthUser | null;
  onOpenOneTapSOS?: () => void;
}

export const CivilianHelperExperience: React.FC<CivilianHelperExperienceProps> = ({
  appState,
  currentUser,
}) => {
  // Live GPS tracking state
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myAccuracy, setMyAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'ready' | 'denied' | 'error'>('acquiring');

  // Ignored incidents (by ID) so the notification card is dismissed for this session
  const [ignoredIds, setIgnoredIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('meditrack_ignored_helpers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Flow State: 'notification' | 'choose_role' | 'mission'
  // Persist active mission in session so refreshing does not lose active helping status
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(() => {
    return sessionStorage.getItem('meditrack_active_helper_incident') || null;
  });

  const [activeRole, setActiveRole] = useState<HelperRoleOption | null>(() => {
    return (sessionStorage.getItem('meditrack_active_helper_role') as HelperRoleOption) || null;
  });

  const [isFullScreenChooseRole, setIsFullScreenChooseRole] = useState<boolean>(false);
  const [selectedIncidentForRoleChoice, setSelectedIncidentForRoleChoice] = useState<EmergencyCase | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(false);
  const [missionMinimized, setMissionMinimized] = useState<boolean>(false);

  // Guide Ambulance custom input states
  const [guideSpotInput, setGuideSpotInput] = useState<string>('');
  const [guideLandmarksInput, setGuideLandmarksInput] = useState<string>('');
  const [guideRoadBlocksInput, setGuideRoadBlocksInput] = useState<string>('');
  const [guideSentNotice, setGuideSentNotice] = useState<boolean>(false);

  // Throttle ref for GPS position updates (every 3.5 seconds)
  const lastLocationBroadcastRef = useRef<number>(0);

  // Helper ID persistent
  const helperIdRef = useRef<string>('');
  if (!helperIdRef.current) {
    let existing: string | null = null;
    try {
      existing = typeof window !== 'undefined' ? sessionStorage.getItem('meditrack_helper_id') : null;
      if (!existing) {
        existing = `hlp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        sessionStorage.setItem('meditrack_helper_id', existing);
      }
    } catch {
      existing = `hlp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    helperIdRef.current = existing;
  }
  const helperId = helperIdRef.current;
  const helperName = currentUser?.name || 'Civilian Responder (You)';

  // 1. LIVE GPS WATCHER (navigator.geolocation.watchPosition with enableHighAccuracy: true)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      setMyCoords(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);

        setMyCoords({ lat, lng });
        setMyAccuracy(acc);
        setGpsStatus('ready');

        // Throttle updates to incident responder record in store.ts (every 3 to 5 seconds)
        const now = Date.now();
        if (activeIncidentId && now - lastLocationBroadcastRef.current >= 3000) {
          lastLocationBroadcastRef.current = now;
          appStore.updateResponderLocation(activeIncidentId, helperId, { lat, lng }, acc);
        }
      },
      (err) => {
        console.warn('Geolocation watchPosition warning:', err.message);
        if (err.code === 1) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('error');
        }
        // Do not silently set hardcoded coordinates: location is unavailable until user drops a pin or allows access
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeIncidentId, helperId]);

  // Find candidate incident nearby that needs helpers and isn't closed or ignored
  const activeEmergencies = appState.emergencies.filter((e) => e.status !== 'Closed');

  // Currently active mission incident
  const currentMissionIncident = activeIncidentId
    ? appState.emergencies.find((e) => e.id === activeIncidentId)
    : null;

  // The helper record on that incident
  const currentHelperRecord = currentMissionIncident?.helpers?.find(
    (h) => h.id === helperId || h.name === helperName
  );

  // If incident was closed, finish mission
  useEffect(() => {
    if (activeIncidentId && (!currentMissionIncident || currentMissionIncident.status === 'Closed')) {
      setActiveIncidentId(null);
      setActiveRole(null);
      sessionStorage.removeItem('meditrack_active_helper_incident');
      sessionStorage.removeItem('meditrack_active_helper_role');
    }
  }, [activeIncidentId, currentMissionIncident]);

  // Find the first unaccepted nearby emergency to alert on (excluding ignored ones)
  const nearbyAlertIncident = activeEmergencies.find((emg) => {
    if (activeIncidentId) return false;
    if (ignoredIds.includes(emg.id)) return false;
    // Check if helper already accepted
    const alreadyHelper = emg.helpers?.some((h) => h.id === helperId || h.name === helperName);
    return !alreadyHelper;
  });

  // Calculate distance to nearby alert incident
  const getDistanceText = (emg: EmergencyCase) => {
    if (!myCoords) return '1.2 km away';
    const meters = getDistanceInMeters(myCoords.lat, myCoords.lng, emg.lat, emg.lng);
    if (meters < 1000) return `${meters}m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  const getDistanceNum = (emg: EmergencyCase) => {
    if (!myCoords) return 1.2;
    return Number((getDistanceInMeters(myCoords.lat, myCoords.lng, emg.lat, emg.lng) / 1000).toFixed(2));
  };

  // Handlers
  const handleIgnore = (incidentId: string) => {
    const updated = [...ignoredIds, incidentId];
    setIgnoredIds(updated);
    try {
      sessionStorage.setItem('meditrack_ignored_helpers', JSON.stringify(updated));
    } catch {}
  };

  const handleOpenChooseRole = (incident: EmergencyCase) => {
    setSelectedIncidentForRoleChoice(incident);
    setIsFullScreenChooseRole(true);
  };

  const handleSelectRole = (role: HelperRoleOption) => {
    const incident = selectedIncidentForRoleChoice || nearbyAlertIncident;
    if (!incident) return;

    // Check slot availability
    if (role === 'transport_victim' && incident.claimedSlots?.transport) {
      alert('This slot was just claimed by another helper.');
      return;
    }
    if (role === 'guide_ambulance' && incident.claimedSlots?.guide) {
      alert('This slot was just claimed by another helper.');
      return;
    }
    if (role === 'help_scene' && (incident.claimedSlots?.scene?.length || 0) >= 2) {
      alert('Help at scene is already at maximum capacity (2 helpers).');
      return;
    }

    const dist = getDistanceNum(incident);
    const eta = Math.max(1, Math.round(dist * 3));

    // Register helper in store and broadcast to all windows
    const result = appStore.claimAssistanceSlot(
      incident.id,
      role === 'help_scene' ? 'help_scene' : role === 'transport_victim' ? 'transport' : 'guide_ambulance',
      {
        id: helperId,
        name: helperName,
        role: 'civilian_helper',
        location: myCoords || { lat: incident.lat - 0.003, lng: incident.lng - 0.003 },
        accuracy: myAccuracy || 10,
        distanceKm: dist,
        etaMinutes: eta,
      }
    );

    setActiveIncidentId(incident.id);
    setActiveRole(role);
    setIsFullScreenChooseRole(false);

    try {
      sessionStorage.setItem('meditrack_active_helper_incident', incident.id);
      sessionStorage.setItem('meditrack_active_helper_role', role);
    } catch {}
  };

  const handleMarkArrived = () => {
    if (!currentMissionIncident) return;
    appStore.helperMarkArrived(currentMissionIncident.id, helperId, 'Civilian helper arrived on scene.');
  };

  const handleMarkAssistanceGiven = () => {
    if (!currentMissionIncident) return;
    appStore.helperMarkAssistanceGiven(currentMissionIncident.id, helperId);
  };

  const handleSendGuideUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMissionIncident) return;

    appStore.guideAmbulanceUpdate(currentMissionIncident.id, helperId, {
      landmarks: guideLandmarksInput.trim() || undefined,
      roadBlocks: guideRoadBlocksInput.trim() || undefined,
      notes: guideSpotInput.trim() || undefined,
    });

    setGuideSentNotice(true);
    setTimeout(() => setGuideSentNotice(false), 4000);
    setGuideSpotInput('');
    setGuideLandmarksInput('');
    setGuideRoadBlocksInput('');
  };

  const handleEndMission = () => {
    if (confirm('Are you sure you want to exit this assistance mission?')) {
      if (currentMissionIncident) {
        appStore.cancelAssistanceSlot(
          currentMissionIncident.id,
          activeRole === 'help_scene' ? 'help_scene' : activeRole === 'transport_victim' ? 'transport' : 'guide_ambulance',
          helperId,
          'Helper finished or stepped down'
        );
      }
      setActiveIncidentId(null);
      setActiveRole(null);
      sessionStorage.removeItem('meditrack_active_helper_incident');
      sessionStorage.removeItem('meditrack_active_helper_role');
    }
  };

  // Helper for simulation: Move closer to scene for desk testing
  const handleSimulateStepForward = () => {
    if (!currentMissionIncident || !myCoords) return;
    const stepLat = myCoords.lat + (currentMissionIncident.lat - myCoords.lat) * 0.35;
    const stepLng = myCoords.lng + (currentMissionIncident.lng - myCoords.lng) * 0.35;
    const newLoc = { lat: Number(stepLat.toFixed(6)), lng: Number(stepLng.toFixed(6)) };
    setMyCoords(newLoc);
    appStore.updateResponderLocation(currentMissionIncident.id, helperId, newLoc, 5);
  };

  // Check slots taken for the chosen role card
  const checkSlotStatus = (emg: EmergencyCase, role: HelperRoleOption) => {
    if (role === 'help_scene') {
      const count = emg.helpers?.filter((h) => h.roleOption === 'help_scene').length || 0;
      const isTaken = count >= 2;
      return {
        isTaken,
        label: isTaken ? 'Taken by another helper' : `${2 - count} slot(s) open`,
      };
    }
    if (role === 'transport_victim') {
      const isTaken =
        !!emg.claimedSlots?.transport ||
        (emg.helpers?.some((h) => h.roleOption === 'transport_victim') ?? false);
      return {
        isTaken,
        label: isTaken ? 'Taken by another helper' : '1 slot open',
      };
    }
    if (role === 'guide_ambulance') {
      const isTaken =
        !!emg.claimedSlots?.guide ||
        (emg.helpers?.some((h) => h.roleOption === 'guide_ambulance') ?? false);
      return {
        isTaken,
        label: isTaken ? 'Taken by another helper' : '1 slot open',
      };
    }
    return { isTaken: false, label: 'Available' };
  };

  // Turn-by-turn Google Maps link
  const getGoogleMapsDirUrl = (incLat: number, incLng: number) => {
    if (!myCoords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${incLat},${incLng}&travelmode=walking`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${myCoords.lat},${myCoords.lng}&destination=${incLat},${incLng}&travelmode=walking`;
  };

  return (
    <>
      {/* ========================================================
          1. NOTIFICATION CARD: Emergency nearby
          ======================================================== */}
      {nearbyAlertIncident && !isFullScreenChooseRole && !activeIncidentId && (
        <aside
          role="region"
          aria-label="Nearby emergency notification"
          className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-500 p-5 space-y-3.5 ring-4 ring-red-500/10">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </span>
                <span className="text-xs font-black tracking-wider uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Emergency nearby
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 font-mono">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
                <span>{getDistanceText(nearbyAlertIncident)}</span>
              </span>
            </div>

            {/* Incident Type & Location */}
            <div>
              <div className="text-base font-black text-slate-900 tracking-tight flex items-center justify-between">
                <span>{nearbyAlertIncident.emergencyType.toUpperCase()}</span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  #{nearbyAlertIncident.id}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                {nearbyAlertIncident.address}
              </p>
            </div>

            {/* One-line plain explanation (as requested) */}
            <p className="text-xs text-slate-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 font-medium leading-relaxed">
              Someone needs help. You can help in one of three ways.
            </p>

            {/* Big Accept / Ignore Buttons (as requested) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleIgnore(nearbyAlertIncident.id)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors text-center"
              >
                Ignore
              </button>
              <button
                type="button"
                onClick={() => handleOpenChooseRole(nearbyAlertIncident)}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30"
              >
                <span>Accept</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================
          2. FULL-SCREEN "CHOOSE HOW YOU CAN HELP" PAGE
          ======================================================== */}
      {isFullScreenChooseRole && selectedIncidentForRoleChoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-role-title"
          className="fixed inset-0 z-50 bg-[#F4F7F8] overflow-y-auto animate-in fade-in duration-200 flex flex-col"
        >
          {/* Top Bar */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-slate-500">
                    {selectedIncidentForRoleChoice.id}
                  </span>
                  <span className="text-[11px] font-bold uppercase bg-red-100 text-red-800 px-2 py-0.5 rounded">
                    {selectedIncidentForRoleChoice.emergencyType}
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    • {getDistanceText(selectedIncidentForRoleChoice)}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-700 truncate max-w-md">
                  {selectedIncidentForRoleChoice.address}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHowItWorksOpen(true)}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 underline flex items-center gap-1 cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>How does this work?</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullScreenChooseRole(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Cancel"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </header>

          {/* Main Container */}
          <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-6 flex flex-col justify-center">
            <div className="text-center space-y-1">
              <h1 id="choose-role-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Choose how you can help
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
                Pick the role that fits what you can do safely right now. Only available slots can be chosen.
              </p>
            </div>

            {/* THREE LARGE CARDS (as requested) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Help at Scene */}
              {(() => {
                const status = checkSlotStatus(selectedIncidentForRoleChoice, 'help_scene');
                return (
                  <div
                    className={`rounded-2xl border-2 p-6 flex flex-col justify-between transition-all ${
                      status.isTaken
                        ? 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
                        : 'bg-white border-blue-400 hover:border-blue-600 shadow-md hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Footprints className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Help at Scene</h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Go there and give basic first aid until the ambulance arrives
                      </p>
                      <div className="pt-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Estimated effort: ~15-20 mins • High physical presence</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      {status.isTaken ? (
                        <div className="text-center text-xs font-bold text-slate-500 py-2.5 bg-slate-200/80 rounded-xl">
                          Taken by another helper
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectRole('help_scene')}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>I Will Help at Scene</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Card 2: Transport Victim */}
              {(() => {
                const status = checkSlotStatus(selectedIncidentForRoleChoice, 'transport_victim');
                return (
                  <div
                    className={`rounded-2xl border-2 p-6 flex flex-col justify-between transition-all ${
                      status.isTaken
                        ? 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
                        : 'bg-white border-emerald-400 hover:border-emerald-600 shadow-md hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Car className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Transport Victim</h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Take the victim to a hospital in your vehicle (only if safe)
                      </p>
                      <div className="pt-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Estimated effort: ~25 mins • Requires private car/taxi</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      {status.isTaken ? (
                        <div className="text-center text-xs font-bold text-slate-500 py-2.5 bg-slate-200/80 rounded-xl">
                          Taken by another helper
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectRole('transport_victim')}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>I Will Transport Victim</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Guide Ambulance */}
              {(() => {
                const status = checkSlotStatus(selectedIncidentForRoleChoice, 'guide_ambulance');
                return (
                  <div
                    className={`rounded-2xl border-2 p-6 flex flex-col justify-between transition-all ${
                      status.isTaken
                        ? 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
                        : 'bg-white border-purple-400 hover:border-purple-600 shadow-md hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Compass className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Guide Ambulance</h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Share landmarks and road info so the ambulance reaches faster
                      </p>
                      <div className="pt-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        <span>Estimated effort: ~5-10 mins • Phone/Navigation guidance</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      {status.isTaken ? (
                        <div className="text-center text-xs font-bold text-slate-500 py-2.5 bg-slate-200/80 rounded-xl">
                          Taken by another helper
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectRole('guide_ambulance')}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>I Will Guide Ambulance</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </main>
        </div>
      )}

      {/* ========================================================
          "HOW DOES THIS WORK?" EXPLANATION MODAL (3-STEP)
          ======================================================== */}
      {howItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Info className="w-5 h-5 text-teal-700" />
                <span>How MediTrack Helper Flow Works</span>
              </h3>
              <button
                type="button"
                onClick={() => setHowItWorksOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Pick one available role</h4>
                  <p className="text-slate-600 mt-0.5">
                    Choose what you can handle. As soon as you accept, that role is locked so other helpers do not duplicate your effort.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Navigate and coordinate in real-time</h4>
                  <p className="text-slate-600 mt-0.5">
                    Your live GPS coordinates guide you to the incident and are shared with 108 Dispatchers and incoming ambulances so everyone has continuous visibility.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Tap action milestones</h4>
                  <p className="text-slate-600 mt-0.5">
                    Tap "I have arrived" and "Assistance given" to sync with emergency teams until the official ambulance arrives and assumes clinical care.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setHowItWorksOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer hover:bg-slate-800"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          3. HELPER MISSION SCREEN (Active when activeIncidentId is set)
          ======================================================== */}
      {currentMissionIncident && activeRole && (
        <aside
          role="region"
          aria-label="Active emergency assistance mission"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-300 shadow-2xl transition-all pointer-events-auto"
        >
          {/* Status banner (Requirement 4) */}
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="text-xs font-black tracking-wide flex items-center gap-2">
                <span>You are helping on {currentMissionIncident.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-800/80 text-teal-200 border border-teal-600">
                  {activeRole.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMissionMinimized(!missionMinimized)}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-xs font-semibold flex items-center gap-1"
              >
                <span>{missionMinimized ? 'Expand Mission' : 'Minimize'}</span>
                {missionMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleEndMission}
                className="text-[11px] font-semibold text-rose-300 hover:text-rose-100 hover:underline px-2 py-0.5 cursor-pointer"
              >
                End
              </button>
            </div>
          </div>

          {/* Expanded Mission Panel */}
          {!missionMinimized && (
            <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8FAFC]">
              {/* SECTION A: GOOGLE MAP WITH ROUTE, LIVE POSITION, DISTANCE & ETA */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="font-black text-slate-900 text-xs sm:text-sm">
                      Live Route & Navigation to Incident
                    </span>
                    {myAccuracy && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        GPS Accuracy: ±{myAccuracy}m
                      </span>
                    )}
                  </div>

                  {/* Open in Google Maps button (as requested in 3a) */}
                  <a
                    href={getGoogleMapsDirUrl(currentMissionIncident.lat, currentMissionIncident.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>

                {/* The Live Google Map */}
                {(() => {
                  const mapCenter = myCoords || {
                    lat: currentMissionIncident.lat,
                    lng: currentMissionIncident.lng,
                  };
                  const routePts = myCoords
                    ? [myCoords, { lat: currentMissionIncident.lat, lng: currentMissionIncident.lng }]
                    : [];

                  const markers: MarkerItem[] = [
                    {
                      id: 'incident-target',
                      lat: currentMissionIncident.lat,
                      lng: currentMissionIncident.lng,
                      title: `${currentMissionIncident.emergencyType.toUpperCase()} (${currentMissionIncident.id})`,
                      type: 'emergency',
                      subtitle: currentMissionIncident.address,
                    },
                  ];

                  if (myCoords) {
                    markers.push({
                      id: helperId,
                      lat: myCoords.lat,
                      lng: myCoords.lng,
                      title: 'Your Live Position',
                      type: 'responder',
                      subtitle: `Civilian Helper (${activeRole.replace('_', ' ')})`,
                      isHelper: true,
                    });
                  }

                  // Also show official ambulance if dispatched
                  if (currentMissionIncident.assignedAmbulance) {
                    markers.push({
                      id: currentMissionIncident.assignedAmbulance.id,
                      lat: currentMissionIncident.assignedAmbulance.lat,
                      lng: currentMissionIncident.assignedAmbulance.lng,
                      title: currentMissionIncident.assignedAmbulance.unitCode,
                      type: 'responder',
                      subtitle: `Official Ambulance • ETA: ${currentMissionIncident.assignedAmbulance.etaMinutes}m`,
                    });
                  }

                  return (
                    <div className="space-y-2">
                      <GoogleMapsView
                        center={mapCenter}
                        zoom={15}
                        markers={markers}
                        routePoints={routePts}
                        className="h-60 sm:h-72 w-full rounded-xl"
                      />

                      {/* Distance & ETA info strip */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">Distance to scene:</span>
                          <span className="font-mono font-black text-slate-900">
                            {getDistanceText(currentMissionIncident)}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-bold text-slate-700">Estimated Walking ETA:</span>
                          <span className="font-mono font-black text-blue-700">
                            ~{Math.max(1, Math.round(getDistanceNum(currentMissionIncident) * 12))} mins
                          </span>
                        </div>

                        {/* Simulation helper button for desk testing */}
                        <button
                          type="button"
                          onClick={handleSimulateStepForward}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Simulate moving closer towards scene"
                        >
                          <Zap className="w-3 h-3 text-amber-600" />
                          <span>Simulate Move Forward (Test)</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* GRID: INCIDENT DETAILS & ROLE STEPS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* SECTION B: EXACT ADDRESS, LANDMARK, VICTIMS, PHOTO, REPORTER NOTE */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="font-black text-slate-900 text-sm">Incident Briefing</h3>
                    <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      {currentMissionIncident.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 block">Exact Address:</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{currentMissionIncident.address}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="font-bold text-slate-500 block">Victims Count:</span>
                        <span className="font-black text-slate-900 text-sm">
                          {currentMissionIncident.victimsCount} Casualty(s)
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block">Severity:</span>
                        <span className="font-black text-red-600 text-sm uppercase">
                          {currentMissionIncident.severity}
                        </span>
                      </div>
                    </div>

                    {currentMissionIncident.description && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                        <span className="font-bold text-slate-900 block mb-0.5">Reporter's Note:</span>
                        <p className="italic text-slate-600 leading-relaxed">
                          "{currentMissionIncident.description}"
                        </p>
                      </div>
                    )}

                    {currentMissionIncident.photoUrl && (
                      <div>
                        <span className="font-bold text-slate-500 block mb-1">Scene Photo:</span>
                        <img
                          src={currentMissionIncident.photoUrl}
                          alt="Incident scene"
                          className="w-full h-36 object-cover rounded-xl border border-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* SECTION D: CALL 108 BUTTON (as requested in 3d) */}
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href="tel:108"
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-red-600/30 cursor-pointer transition-all"
                    >
                      <Phone className="w-4 h-4 fill-white" />
                      <span>Call 108 (Emergency Dispatch Command)</span>
                    </a>
                  </div>
                </div>

                {/* SECTION C & E: ROLE STEP LIST & SAFETY TIPS */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Step List for Chosen Role */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="font-black text-slate-900 text-sm">Role Action Steps</h3>
                      <span className="text-[11px] font-bold text-blue-700 uppercase">
                        {activeRole.replace('_', ' ')}
                      </span>
                    </div>

                    {/* STEPS FOR "HELP AT SCENE" */}
                    {activeRole === 'help_scene' && (
                      <div className="space-y-3 text-xs">
                        {/* Step 1: Go there */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
                              1
                            </span>
                            <span className="font-bold text-slate-800">Go to Scene</span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700">In Progress</span>
                        </div>

                        {/* Step 2: Arrive & Button */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
                                2
                              </span>
                              <span className="font-bold text-slate-800">Arrive at Scene</span>
                            </div>
                            {currentHelperRecord?.status === 'arrived' ||
                            currentHelperRecord?.status === 'assistance_given' ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ Arrived
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={handleMarkArrived}
                            disabled={
                              currentHelperRecord?.status === 'arrived' ||
                              currentHelperRecord?.status === 'assistance_given'
                            }
                            className={`w-full py-2.5 rounded-xl font-black text-xs cursor-pointer transition-all ${
                              currentHelperRecord?.status === 'arrived' ||
                              currentHelperRecord?.status === 'assistance_given'
                                ? 'bg-slate-200 text-slate-500 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                          >
                            I Have Arrived
                          </button>
                        </div>

                        {/* Step 3: Give Help & Button */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
                                3
                              </span>
                              <span className="font-bold text-slate-800">Give Basic First Aid</span>
                            </div>
                            {currentHelperRecord?.status === 'assistance_given' ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ Assistance Given
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={handleMarkAssistanceGiven}
                            disabled={currentHelperRecord?.status === 'assistance_given'}
                            className={`w-full py-2.5 rounded-xl font-black text-xs cursor-pointer transition-all ${
                              currentHelperRecord?.status === 'assistance_given'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            Assistance Given
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEPS FOR "TRANSPORT VICTIM" */}
                    {activeRole === 'transport_victim' && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <span className="font-bold text-slate-800 block">
                            Target Hospital ER:
                          </span>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-bold text-slate-900 flex justify-between items-center">
                            <span>City Metro General Hospital Trauma Bay</span>
                            <span className="text-emerald-700 text-[11px]">Ready</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleMarkArrived}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs cursor-pointer"
                          >
                            I Have Arrived at Scene
                          </button>
                          <button
                            type="button"
                            onClick={handleMarkAssistanceGiven}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs cursor-pointer"
                          >
                            Victim In Vehicle
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEPS FOR "GUIDE AMBULANCE" */}
                    {activeRole === 'guide_ambulance' && (
                      <form onSubmit={handleSendGuideUpdate} className="space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Current Landmarks / Nearest Intersection:
                          </label>
                          <input
                            type="text"
                            value={guideLandmarksInput}
                            onChange={(e) => setGuideLandmarksInput(e.target.value)}
                            placeholder="e.g. Opposite Central Bank ATM, Gate 4"
                            className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Road Blocks / Clear Path Info:
                          </label>
                          <input
                            type="text"
                            value={guideRoadBlocksInput}
                            onChange={(e) => setGuideRoadBlocksInput(e.target.value)}
                            placeholder="e.g. Center lane clear, avoid left service lane"
                            className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          {guideSentNotice && (
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Relayed to 108 Dispatch & AMB
                            </span>
                          )}
                          <button
                            type="submit"
                            className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Share Route Info</span>
                          </button>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleMarkArrived}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs cursor-pointer"
                          >
                            I Have Arrived
                          </button>
                          <button
                            type="button"
                            onClick={handleMarkAssistanceGiven}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs cursor-pointer"
                          >
                            Assistance Given
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* SECTION E: ROLE-SPECIFIC SAFETY TIPS (as requested in 3e) */}
                  <div className="bg-amber-50 rounded-2xl border border-amber-300 p-5 space-y-2 text-xs text-amber-950">
                    <div className="flex items-center gap-2 font-black text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Safety Instructions for {activeRole.replace('_', ' ').toUpperCase()}</span>
                    </div>

                    {activeRole === 'help_scene' && (
                      <ul className="space-y-1.5 list-disc pl-4 text-amber-950/90 leading-relaxed font-medium">
                        <li><strong>Do not move the victim</strong> if neck or spinal injury is suspected, unless imminent life hazards (fire, traffic) exist.</li>
                        <li><strong>Apply firm, continuous pressure</strong> to active bleeding wounds with clean cloth or sterile dressing.</li>
                        <li><strong>Check airway & breathing</strong>. If unconscious but breathing, position gently in recovery posture.</li>
                        <li>Keep bystander crowds back and keep the victim calm and warm until ambulance arrival.</li>
                      </ul>
                    )}

                    {activeRole === 'transport_victim' && (
                      <ul className="space-y-1.5 list-disc pl-4 text-amber-950/90 leading-relaxed font-medium">
                        <li><strong>Proceed only if safe and appropriate</strong> to move the victim.</li>
                        <li>Never transport unconscious, head-injured, or spinal-trauma victims in a personal vehicle.</li>
                        <li>Drive safely with hazard lights blinking; adhere to road traffic discipline.</li>
                        <li>Contact hospital ER in advance so stretcher and resuscitation team await at casualty door.</li>
                      </ul>
                    )}

                    {activeRole === 'guide_ambulance' && (
                      <ul className="space-y-1.5 list-disc pl-4 text-amber-950/90 leading-relaxed font-medium">
                        <li><strong>Remain on the sidewalk</strong> or safely off active vehicular lanes.</li>
                        <li>Wave with a bright object or phone flashlight at intersections to signal the approaching ambulance.</li>
                        <li>Direct traffic to clear the curbside so the ambulance can pull directly next to the patient.</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
};
