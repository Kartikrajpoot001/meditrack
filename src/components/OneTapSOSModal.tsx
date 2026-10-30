import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  MapPin,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight,
  Camera,
  Check,
  AlertTriangle,
  Radio,
  Ambulance,
  Users,
  Compass,
  Crosshair,
  AlertCircle,
} from 'lucide-react';
import { appStore } from '../services/store';
import { EmergencyCase, EmergencyType, EmergencyLifecycleStatus } from '../types';
import { GoogleMapsView } from './GoogleMapsView';

interface OneTapSOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToIncident?: (caseId: string) => void;
}

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

const INCIDENT_PHOTOS = [
  { label: 'Vehicular Collision', url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pedestrian Collapse', url: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Thermal Injury', url: 'https://images.unsplash.com/photo-1542884748-2b87b36c6b90?auto=format&fit=crop&w=800&q=80' },
  { label: 'Trauma / Fall', url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80' },
];

export const OneTapSOSModal: React.FC<OneTapSOSModalProps> = ({
  isOpen,
  onClose,
  onNavigateToIncident,
}) => {
  // Real GPS state - never silently fallback to hardcoded coordinates
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showPinDropMap, setShowPinDropMap] = useState<boolean>(false);

  // Created Case State
  const [activeCase, setActiveCase] = useState<EmergencyCase | null>(null);

  // Supplementary details state (AFTER SOS is sent)
  const [category, setCategory] = useState<EmergencyType>('accident');
  const [victims, setVictims] = useState<number>(1);
  const [selectedPhoto, setSelectedPhoto] = useState<string>(INCIDENT_PHOTOS[0].url);
  const [note, setNote] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Reverse geocode via server-side proxy
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/maps/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        setAddress(data.address);
      } else {
        setAddress(`Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`);
      }
    } catch {
      setAddress(`Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`);
    }
  };

  // Real GPS capture using navigator.geolocation with enableHighAccuracy: true
  const detectGPS = () => {
    setIsLocating(true);
    setGpsError(null);

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser. Please drop a pin on the map.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);

        setCoords({ lat, lng });
        setAccuracyMeters(acc);
        setGpsError(null);
        setIsLocating(false);

        // Fetch reverse geocoded address
        reverseGeocode(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setGpsError('Location permission denied. Please allow location access or drop a pin on the map.');
        } else if (err.code === 3) {
          setGpsError('GPS location request timed out. Please retry or drop a pin on the map.');
        } else {
          setGpsError('GPS position unavailable. Please drop a pin on the map.');
        }
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      detectGPS();
      setSavedSuccess(false);
    } else {
      setShowPinDropMap(false);
      setGpsError(null);
    }
  }, [isOpen]);

  // Keep active case synced if store updates across tabs
  useEffect(() => {
    if (activeCase) {
      const unsub = appStore.subscribe((state) => {
        const found = state.emergencies.find((e) => e.id === activeCase.id);
        if (found) {
          setActiveCase({ ...found });
        }
      });
      return () => unsub();
    }
  }, [activeCase?.id]);

  if (!isOpen) return null;

  // Handle manual pin dropped on map
  const handlePinDropped = (point: { lat: number; lng: number }) => {
    setCoords({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
    setAccuracyMeters(5); // manual pin precision
    setGpsError(null);
    setShowPinDropMap(false);
    reverseGeocode(point.lat, point.lng);
  };

  // Demo fallback strictly labeled
  const handleUseDemoLocation = () => {
    const demoLat = 28.6315;
    const demoLng = 77.2167;
    setCoords({ lat: demoLat, lng: demoLng });
    setAccuracyMeters(10);
    setAddress('Connaught Circus, Barakhamba, Central District, New Delhi [DEMO]');
    setGpsError(null);
  };

  // STEP 1: TRIGGER ONE-TAP SOS
  const handleTriggerSOS = () => {
    // If coords are still loading, try instant capture
    if (!coords) {
      if ('geolocation' in navigator) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            const acc = Math.round(pos.coords.accuracy);
            setCoords({ lat, lng });
            setAccuracyMeters(acc);
            setIsLocating(false);

            const res = appStore.triggerOneTapSOS({
              lat,
              lng,
              address: address || `GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${acc}m)`,
              callerName: 'Witness (One-Tap SOS)',
              callerPhone: '+91 98112 00000',
              emergencyType: category,
            });
            setActiveCase(res.caseItem);
          },
          () => {
            setIsLocating(false);
            setGpsError('Unable to get GPS location. Please drop a pin on the map before broadcasting SOS.');
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
        return;
      } else {
        setGpsError('Please drop a pin on the map to set the emergency location.');
        return;
      }
    }

    const res = appStore.triggerOneTapSOS({
      lat: coords.lat,
      lng: coords.lng,
      address: address || `GPS Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      callerName: 'Witness (One-Tap SOS)',
      callerPhone: '+91 98112 00000',
      emergencyType: category,
    });

    setActiveCase(res.caseItem);
  };

  // STEP 1: SUBMIT OPTIONAL SUPPLEMENTARY DETAILS
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;

    appStore.updateIncidentAfterSOS(activeCase.id, {
      emergencyType: category,
      victimsCount: victims,
      photoUrl: selectedPhoto,
      description: note.trim() || `Witness added: ${category} with ${victims} victim(s).`,
    });

    setSavedSuccess(true);
  };

  const getStepState = (caseStatus: EmergencyLifecycleStatus, step: EmergencyLifecycleStatus) => {
    const currentIndex = LIFECYCLE_STEPS.indexOf(caseStatus);
    const stepIndex = LIFECYCLE_STEPS.indexOf(step);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-red-200 max-h-[94vh] overflow-y-auto space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">One-Tap Emergency SOS</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  Instant Dual-Track
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Captures real GPS • Broadcasts to 108 Dispatcher & Nearby Helpers simultaneously
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Coordinates Bar */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Crosshair className={`w-4 h-4 text-red-600 shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
              <div className="font-bold text-slate-900 truncate">
                {isLocating
                  ? 'Acquiring high-accuracy GPS fix...'
                  : coords
                  ? address || `${coords.lat.toFixed(5)}°N, ${coords.lng.toFixed(5)}°E`
                  : 'No location acquired yet'}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={detectGPS}
                disabled={isLocating}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                <span>Re-check GPS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPinDropMap(!showPinDropMap)}
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-800 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <MapPin className="w-3 h-3" />
                <span>{showPinDropMap ? 'Close Pin Drop' : 'Drop a Pin'}</span>
              </button>
            </div>
          </div>

          {/* Precision and Coordinates metadata */}
          {coords && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
              </span>
              {accuracyMeters !== null && (
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  GPS Accuracy: ±{accuracyMeters} meters
                </span>
              )}
            </div>
          )}

          {/* GPS Error Alert & Manual Drop Pin Callout */}
          {gpsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-2 text-rose-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{gpsError}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPinDropMap(true)}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Click to Drop Pin on Map</span>
                </button>
                <button
                  type="button"
                  onClick={handleUseDemoLocation}
                  className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 rounded text-[11px] font-semibold cursor-pointer"
                >
                  Use Demo Location (Central Delhi)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Drop-a-pin Map Fallback */}
        {showPinDropMap && (
          <div className="rounded-xl border border-sky-300 overflow-hidden bg-slate-100 p-2 space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-sky-950 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-600 animate-bounce" />
                <span>Click anywhere on the map to set exact incident location</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPinDropMap(false)}
                className="text-slate-500 hover:text-slate-800 font-bold"
              >
                ✕ Close
              </button>
            </div>
            <GoogleMapsView
              center={coords || { lat: 28.6315, lng: 77.2167 }}
              zoom={15}
              className="h-64 w-full rounded-lg"
              isDroppingPin={true}
              droppedPin={coords}
              onPinDropped={handlePinDropped}
            />
          </div>
        )}

        {/* BEFORE SOS IS TRIGGERED: BIG RED BUTTON */}
        {!activeCase ? (
          <div className="py-6 text-center space-y-6">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleTriggerSOS}
                disabled={isLocating}
                className="relative group w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 text-white font-black text-2xl shadow-2xl shadow-red-600/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center border-4 border-white disabled:opacity-75"
              >
                <span className="absolute -inset-3 rounded-full bg-red-500/20 animate-ping pointer-events-none" />
                <ShieldAlert className="w-12 h-12 mb-2 drop-shadow" />
                <span className="tracking-wider">ONE-TAP SOS</span>
                <span className="text-[11px] font-normal opacity-90 mt-1">
                  {isLocating ? 'Locating...' : 'Tap to Broadcast'}
                </span>
              </button>
            </div>

            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tapping will instantly capture your real device GPS coordinates, generate an Incident ID, and alert the central dispatcher + registered nearby civilian helpers within 3 km.
            </p>
          </div>
        ) : (
          /* AFTER SOS IS TRIGGERED: LIVE STEP TRACKER & SUPPLEMENTARY FORM */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Success Banner */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    SOS Broadcasted • <span className="font-mono text-emerald-800">{activeCase.id}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Dual tracks active: Dispatcher alerted & nearby civilian helpers notified.
                  </div>
                </div>
              </div>
              <span className="text-xs font-black bg-emerald-200/60 text-emerald-900 px-2.5 py-1 rounded-md">
                {activeCase.status}
              </span>
            </div>

            {/* 8-Step Lifecycle Tracker */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                8-Step Incident Lifecycle:
              </span>
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[650px] flex items-center justify-between relative py-2">
                  <div className="absolute top-1/2 left-3 right-3 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const state = getStepState(activeCase.status, step);
                    return (
                      <div key={step} className="flex flex-col items-center relative z-10 text-center px-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                            state === 'completed'
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                              : state === 'active'
                              ? 'bg-red-600 text-white ring-4 ring-red-100 animate-pulse'
                              : 'bg-white text-slate-400 border border-slate-300'
                          }`}
                        >
                          {state === 'completed' ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[9px] mt-1 font-bold whitespace-nowrap ${
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

            {/* Supplementary Details Form (Optional - added AFTER SOS) */}
            <form onSubmit={handleSaveDetails} className="space-y-3.5 pt-1">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Add Optional Details (SOS already sent):</span>
                <span className="text-slate-400 font-normal">Optional</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Emergency Type</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EmergencyType)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="accident">Vehicular Accident</option>
                    <option value="collapse">Medical Collapse</option>
                    <option value="burn">Fire / Burn</option>
                    <option value="other">Trauma / Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estimated Victims</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={victims}
                    onChange={(e) => setVictims(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Photo Presets */}
              <div>
                <label className="font-bold text-slate-700 text-xs block mb-1">Scene Photo (Optional)</label>
                <div className="grid grid-cols-4 gap-2">
                  {INCIDENT_PHOTOS.map((p) => (
                    <div
                      key={p.url}
                      onClick={() => setSelectedPhoto(p.url)}
                      className={`p-1 rounded-lg border cursor-pointer transition-all ${
                        selectedPhoto === p.url
                          ? 'border-red-600 ring-2 ring-red-300'
                          : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-12 object-cover rounded" />
                      <span className="text-[9px] block text-center font-semibold mt-0.5 truncate">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 text-xs block mb-1">Scene Notes / Landmarks</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Near metro exit 3, traffic is building up, victim is responsive."
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {savedSuccess ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Details synced live with Dispatcher & Crew
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Updates sync in real-time</span>
                )}

                <div className="flex items-center gap-2">
                  {onNavigateToIncident && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToIncident(activeCase.id);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      View Live Tracker
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Save Details
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
