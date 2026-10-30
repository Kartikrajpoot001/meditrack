import React, { useState, useEffect, useRef } from 'react';
import {
  Ambulance,
  MapPin,
  Navigation,
  ShieldAlert,
  Hospital as HospitalIcon,
  Phone,
  Clock,
  Activity,
  Gauge,
  Fuel,
  Wind,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Send,
  Zap,
} from 'lucide-react';
import { appStore, AppState } from '../../services/store';
import { AmbulanceUnit, EmergencyCase, Hospital } from '../../types';
import { GoogleMapsView, MarkerItem } from '../GoogleMapsView';

interface AmbulanceFleetMapProps {
  appState: AppState;
  onNavigateToIncident?: (incidentId: string) => void;
  onRequestSOS?: () => void;
}

export const AmbulanceFleetMap: React.FC<AmbulanceFleetMapProps> = ({
  appState,
  onNavigateToIncident,
  onRequestSOS,
}) => {
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>(
    appState.ambulances[0]?.id || 'amb-1'
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'active'>('all');

  // Booking Form State
  const [bookingCallerName, setBookingCallerName] = useState('Sarah Chen');
  const [bookingCallerPhone, setBookingCallerPhone] = useState('+91 98112 34567');
  const [bookingAddress, setBookingAddress] = useState('Barakhamba Road, Connaught Place, New Delhi');
  const [bookingType, setBookingType] = useState<EmergencyCase['emergencyType']>('accident');
  const [bookingSeverity, setBookingSeverity] = useState<EmergencyCase['severity']>('critical');
  const [bookingHospitalId, setBookingHospitalId] = useState<string>(appState.hospitals[0]?.id || 'hosp-1');
  const [bookingDescription, setBookingDescription] = useState('Urgent ambulance required for cardiac distress.');
  const [bookingSuccessNotice, setBookingSuccessNotice] = useState<string | null>(null);

  const selectedAmbulance =
    appState.ambulances.find((a) => a.id === selectedAmbulanceId) ||
    appState.ambulances[0];

  const activeEmergencies = appState.emergencies.filter((e) => e.status !== 'Closed');

  // Live simulation loop: ticks every 2.5 seconds to advance en_route ambulances towards target
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Find ambulances with active missions or cycle coordinates
      appState.ambulances.forEach((amb) => {
        if (amb.status === 'en_route' || amb.status === 'dispatched' || isSimulating) {
          // Find target incident or hospital
          const assignedIncident = appState.emergencies.find(
            (e) => e.assignedAmbulance?.id === amb.id && e.status !== 'Closed'
          );

          let targetLat = 28.6315;
          let targetLng = 77.2167;

          if (assignedIncident) {
            targetLat = assignedIncident.lat;
            targetLng = assignedIncident.lng;
          } else {
            // slight gentle drift around central hub
            targetLat = amb.lat + (Math.random() * 0.002 - 0.001);
            targetLng = amb.lng + (Math.random() * 0.002 - 0.001);
          }

          appStore.stepAmbulanceMovement(amb.id, targetLat, targetLng, 0.12);
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isSimulating, appState.ambulances, appState.emergencies]);

  const handleDispatchAmbulance = (ambulanceId: string, caseId: string) => {
    appStore.dispatchAmbulance(caseId, ambulanceId);
    setSelectedAmbulanceId(ambulanceId);
    setIsSimulating(true);
  };

  const handleStatusChange = (status: AmbulanceUnit['status']) => {
    if (selectedAmbulance) {
      appStore.updateAmbulanceStatus(selectedAmbulance.id, status);
    }
  };

  const handleBookAmbulanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = appStore.bookAmbulance({
      callerName: bookingCallerName,
      callerPhone: bookingCallerPhone,
      pickupAddress: bookingAddress,
      lat: 28.6289 + (Math.random() * 0.01 - 0.005),
      lng: 77.2185 + (Math.random() * 0.01 - 0.005),
      emergencyType: bookingType,
      severity: bookingSeverity,
      destinationHospitalId: bookingHospitalId,
      description: bookingDescription,
    });

    setBookingSuccessNotice(
      `Dispatched ${result.assignedAmbulance.unitCode} for Incident #${result.caseItem.id}! ETA: ${result.assignedAmbulance.etaMinutes} mins.`
    );
    setSelectedAmbulanceId(result.assignedAmbulance.id);
    setIsSimulating(true);

    setTimeout(() => {
      setShowBookingModal(false);
      setBookingSuccessNotice(null);
    }, 2000);
  };

  // Build marker list for Google Maps
  const mapMarkers: MarkerItem[] = [
    // Ambulances
    ...appState.ambulances.map((amb) => ({
      id: amb.id,
      lat: amb.lat,
      lng: amb.lng,
      title: `${amb.unitCode} (${amb.status.toUpperCase()})`,
      type: 'responder' as const,
      subtitle: `${amb.type} • Paramedic: ${amb.paramedicName} | Driver: ${amb.driverName}`,
      ambulanceData: {
        unitCode: amb.unitCode,
        type: amb.type,
        driverName: amb.driverName,
        paramedicName: amb.paramedicName,
        phone: amb.phone,
        status: amb.status,
        etaMinutes: amb.etaMinutes,
        distanceKm: amb.distanceKm,
        equipment: amb.equipment,
      },
    })),
    // Emergency Incidents
    ...activeEmergencies.map((emg) => ({
      id: emg.id,
      lat: emg.lat,
      lng: emg.lng,
      title: `${emg.id} • ${emg.emergencyType.toUpperCase()}`,
      type: 'emergency' as const,
      subtitle: `${emg.address} (${emg.severity.toUpperCase()})`,
      emergencyData: {
        severity: emg.severity,
        victimsCount: emg.victimsCount,
        status: emg.status,
        address: emg.address,
      },
    })),
    // Active Civilian Responders / Helpers
    ...activeEmergencies.flatMap((emg) =>
      (emg.helpers || [])
        .filter((h) => Boolean(h.location))
        .map((h) => {
          const roleName = h.roleOption ? h.roleOption.replace(/_/g, ' ') : (h.roleChoice ? h.roleChoice.replace(/_/g, ' ') : 'Help at Scene');
          return {
            id: `helper-${h.id}`,
            lat: h.location!.lat,
            lng: h.location!.lng,
            title: `Helper: ${h.name}`,
            type: 'responder' as const,
            isHelper: true,
            subtitle: `Civilian Helper (${roleName}) • ${h.status.toUpperCase()} • Incident #${emg.id}`,
          };
        })
    ),
    // Regional Hospitals
    ...appState.hospitals.map((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      title: h.name,
      type: 'hospital' as const,
      subtitle: `${h.beds.emergencyTotal - h.beds.emergencyOccupied} ER Beds • ${h.beds.icuTotal - h.beds.icuOccupied} ICU Beds`,
      hospitalData: {
        emergencyBedsFree: h.beds.emergencyTotal - h.beds.emergencyOccupied,
        icuBedsFree: h.beds.icuTotal - h.beds.icuOccupied,
        phone: h.phone,
      },
    })),
  ];

  const filteredAmbulances = appState.ambulances.filter((amb) => {
    if (filterStatus === 'available') return amb.status === 'available';
    if (filterStatus === 'active') return amb.status !== 'available';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <Ambulance className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Live Ambulance Fleet & Google Maps Tracking
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Live GIS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time rapid ALS/BLS ambulance tracking, telemetry streaming, automatic dispatch, and hospital routing.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Simulation Toggle */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              isSimulating
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-slate-950" />
                <span>Simulating Live GPS Run...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-700 dark:fill-slate-200" />
                <span>Simulate Ambulance Movement</span>
              </>
            )}
          </button>

          {/* Book / Request Ambulance Button */}
          <button
            onClick={() => setShowBookingModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-600/30 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Book / Request Ambulance</span>
          </button>
        </div>
      </div>

      {/* 2. FLEET METRICS QUICK COUNTERS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
            <span>Total Fleet</span>
            <Ambulance className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {appState.ambulances.length} Units
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            ALS Mobile ICUs & BLS Units
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-bold uppercase">
            <span>Available on Standby</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
            {appState.ambulances.filter((a) => a.status === 'available').length}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">Ready for immediate dispatch</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-700 font-bold uppercase">
            <span>En Route / Transporting</span>
            <Navigation className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400">
            {appState.ambulances.filter((a) => a.status !== 'available').length}
          </div>
          <div className="text-[11px] text-amber-600 mt-1 font-medium">Active emergency coordination</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/20 shadow-xs">
          <div className="flex items-center justify-between text-xs text-blue-700 font-bold uppercase">
            <span>Average Dispatch ETA</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-400">
            4.2 mins
          </div>
          <div className="text-[11px] text-blue-600 mt-1 font-medium">Target response: &lt; 8 mins (SDG 3)</div>
        </div>
      </div>

      {/* 3. MAIN LIVE MAP CONTAINER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Live Google Maps Platform Fleet View
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              • Centered on Capital Central District (Delhi-NCR)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ambulance
            </span>
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Emergency SOS
            </span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Hospital
            </span>
          </div>
        </div>

        {/* Real Google Maps Component */}
        <div className="h-[520px] w-full">
          <GoogleMapsView
            center={{
              lat: selectedAmbulance?.lat || 28.6289,
              lng: selectedAmbulance?.lng || 77.2185,
            }}
            zoom={14}
            className="w-full h-full"
            selectedMarkerId={selectedAmbulanceId}
            onSelectMarker={(m) => {
              if (m.type === 'responder') {
                setSelectedAmbulanceId(m.id);
              } else if (m.type === 'emergency' && onNavigateToIncident) {
                onNavigateToIncident(m.id);
              }
            }}
            onSimulateMovement={(ambId) => {
              setSelectedAmbulanceId(ambId);
              setIsSimulating(true);
            }}
            markers={mapMarkers}
          />
        </div>
      </div>

      {/* 4. FLEET UNIT CONTROLLER & TELEMETRY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ambulance Units List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <span>Ambulance Roster</span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
                {filteredAmbulances.length}
              </span>
            </h3>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('available')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterStatus === 'available'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Available
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterStatus === 'active'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Active
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAmbulances.map((amb) => {
              const isSelected = selectedAmbulance?.id === amb.id;
              const assignedEmergency = appState.emergencies.find(
                (e) => e.assignedAmbulance?.id === amb.id && e.status !== 'Closed'
              );

              return (
                <div
                  key={amb.id}
                  onClick={() => setSelectedAmbulanceId(amb.id)}
                  className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Ambulance className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">
                            {amb.unitCode}
                          </h4>
                          <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                            {amb.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {amb.baseLocation}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        amb.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                      }`}
                    >
                      {amb.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Paramedic Crew
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {amb.paramedicName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Driver & Phone
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {amb.driverName}
                      </span>
                    </div>
                  </div>

                  {assignedEmergency && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/50 text-[11px] text-red-900 dark:text-red-200 flex items-center justify-between">
                      <span className="font-semibold">
                        Mission: {assignedEmergency.id} ({assignedEmergency.emergencyType})
                      </span>
                      <span className="font-mono font-bold">
                        ETA {amb.etaMinutes}m ({amb.distanceKm} km)
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-mono">
                      GPS: {amb.lat.toFixed(4)}, {amb.lng.toFixed(4)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAmbulanceId(amb.id);
                        setIsSimulating(true);
                      }}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Live Track</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Ambulance Live Telemetry & Mission Control */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Telemetry & Unit Command
          </h3>

          {selectedAmbulance ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    {selectedAmbulance.unitCode}
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedAmbulance.type}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${selectedAmbulance.phone}`}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </a>
                </div>
              </div>

              {/* Live Vehicle Telemetry Gauges */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Gauge className="w-4 h-4 mx-auto text-sky-600 mb-1" />
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Speed
                  </span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {selectedAmbulance.status === 'en_route' || selectedAmbulance.status === 'transporting'
                      ? '54 km/h'
                      : '0 km/h'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Fuel className="w-4 h-4 mx-auto text-amber-600 mb-1" />
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Fuel
                  </span>
                  <span className="text-base font-black text-amber-700 dark:text-amber-400">
                    86%
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Wind className="w-4 h-4 mx-auto text-teal-600 mb-1" />
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    O2 Supply
                  </span>
                  <span className="text-base font-black text-teal-700 dark:text-teal-400">
                    1950 PSI
                  </span>
                </div>
              </div>

              {/* Status State Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Update Mission Status:
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {(['available', 'dispatched', 'en_route', 'at_scene', 'transporting'] as AmbulanceUnit['status'][]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(st)}
                        className={`py-1.5 px-2 rounded-lg font-bold uppercase text-[10px] transition-colors cursor-pointer border ${
                          selectedAmbulance.status === st
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Onboard Equipment Badges */}
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                  Verified Onboard Equipment
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedAmbulance.equipment.map((eq) => (
                    <span
                      key={eq}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-medium"
                    >
                      ✓ {eq}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rapid Incident Dispatch Picker */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Assign to Active Emergency:
                </span>
                {activeEmergencies.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeEmergencies.map((emg) => (
                      <div
                        key={emg.id}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {emg.id}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {emg.emergencyType} • {emg.address}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDispatchAmbulance(selectedAmbulance.id, emg.id)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Dispatch
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No active emergencies pending dispatch.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Select an ambulance unit to inspect live telemetry.
            </div>
          )}
        </div>
      </div>

      {/* 5. BOOK / REQUEST AMBULANCE MODAL */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <Ambulance className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Request Emergency Ambulance
                </h3>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {bookingSuccessNotice && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{bookingSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={handleBookAmbulanceSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Patient / Caller Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bookingCallerName}
                    onChange={(e) => setBookingCallerName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={bookingCallerPhone}
                    onChange={(e) => setBookingCallerPhone(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Pickup Location / Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={bookingAddress}
                    onChange={(e) => setBookingAddress(e.target.value)}
                    className="w-full p-2.5 pl-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                  <MapPin className="w-4 h-4 text-red-600 absolute left-2.5 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Emergency Nature
                  </label>
                  <select
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="accident">Accident / Collision</option>
                    <option value="collapse">Cardiac / Collapse</option>
                    <option value="Respiratory Distress">Respiratory Distress</option>
                    <option value="burn">Thermal / Burn</option>
                    <option value="other">General Medical Trauma</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Severity Level
                  </label>
                  <select
                    value={bookingSeverity}
                    onChange={(e) => setBookingSeverity(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="critical">Critical (Immediate Code Red)</option>
                    <option value="urgent">Urgent</option>
                    <option value="moderate">Moderate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Destination Hospital (Live Bed Availability)
                </label>
                <select
                  value={bookingHospitalId}
                  onChange={(e) => setBookingHospitalId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  {appState.hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.beds.emergencyTotal - h.beds.emergencyOccupied} ER Beds / {h.beds.icuTotal - h.beds.icuOccupied} ICU Beds Free)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Patient Condition & Notes
                </label>
                <textarea
                  rows={2}
                  value={bookingDescription}
                  onChange={(e) => setBookingDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Dispatch Nearest Ambulance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
