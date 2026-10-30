// Source: Google Maps Platform Code Assist
import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Hospital,
  ShieldAlert,
  Crosshair,
  Ambulance,
  Phone,
  Radio,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Zap,
  Footprints,
  User,
} from 'lucide-react';

export interface MarkerItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'emergency' | 'hospital' | 'responder' | 'user';
  subtitle?: string;
  accuracy?: number;
  isHelper?: boolean;
  ambulanceData?: {
    unitCode: string;
    type: string;
    driverName: string;
    paramedicName: string;
    phone: string;
    status: string;
    etaMinutes: number;
    distanceKm: number;
    equipment?: string[];
  };
  emergencyData?: {
    severity: string;
    victimsCount: number;
    status: string;
    address: string;
  };
  hospitalData?: {
    emergencyBedsFree: number;
    icuBedsFree: number;
    phone: string;
  };
}

interface GoogleMapsViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerItem[];
  routePoints?: { lat: number; lng: number }[];
  className?: string;
  onSelectMarker?: (marker: MarkerItem) => void;
  showCenterControl?: boolean;
  selectedMarkerId?: string;
  onSimulateMovement?: (ambulanceId: string) => void;
  isDroppingPin?: boolean;
  onPinDropped?: (coords: { lat: number; lng: number }) => void;
  droppedPin?: { lat: number; lng: number } | null;
}

// Inner helper to draw polyline using modern Google Maps JS API on the active map instance
const MapRouteRenderer: React.FC<{
  routePoints: { lat: number; lng: number }[];
  color?: string;
}> = ({ routePoints, color = '#2563EB' }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !(window as any).google?.maps || routePoints.length < 2) {
      return;
    }

    const polyline = new (window as any).google.maps.Polyline({
      path: routePoints,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, routePoints, color]);

  return null;
};

// Inner helper to handle click-to-drop-pin and smart bounds fitting
const MapEventsAndBounds: React.FC<{
  center: { lat: number; lng: number };
  markers: MarkerItem[];
  routePoints: { lat: number; lng: number }[];
  isDroppingPin?: boolean;
  onPinDropped?: (coords: { lat: number; lng: number }) => void;
}> = ({ center, markers, routePoints, isDroppingPin, onPinDropped }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !isDroppingPin || !onPinDropped) return;

    const listener = map.addListener('click', (e: any) => {
      if (e.latLng) {
        onPinDropped({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });

    return () => {
      if ((window as any).google?.maps?.event) {
        (window as any).google.maps.event.removeListener(listener);
      }
    };
  }, [map, isDroppingPin, onPinDropped]);

  // Adjust camera to fit markers & route if available
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !(window as any).google?.maps) return;

    const allPts = [
      center,
      ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...routePoints,
    ].filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number');

    if (allPts.length >= 2) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      allPts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else if (allPts.length === 1) {
      map.panTo(allPts[0]);
    }
  }, [map, markers, routePoints, center]);

  return null;
};

export const GoogleMapsView: React.FC<GoogleMapsViewProps> = ({
  center,
  zoom = 14,
  markers = [],
  routePoints = [],
  className = 'h-80 w-full',
  onSelectMarker,
  showCenterControl = true,
  selectedMarkerId,
  onSimulateMovement,
  isDroppingPin = false,
  onPinDropped,
  droppedPin,
}) => {
  const [mapError, setMapError] = useState(false);
  const [activeMarker, setActiveMarker] = useState<MarkerItem | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Active Google Maps API Key from environment variable only
  const rawKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  const apiKey = rawKey && rawKey !== 'MY_GOOGLE_MAPS_API_KEY' ? rawKey.trim() : '';

  useEffect(() => {
    if (selectedMarkerId) {
      const found = markers.find((m) => m.id === selectedMarkerId);
      if (found) setActiveMarker(found);
    }
  }, [selectedMarkerId, markers]);

  // Fallback Tactical Vector Map if API key is invalid or maps JS fails to load
  const renderFallbackTacticalMap = () => {
    const allLats = [center.lat, ...markers.map((m) => m.lat), ...routePoints.map((r) => r.lat)];
    const allLngs = [center.lng, ...markers.map((m) => m.lng), ...routePoints.map((r) => r.lng)];

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const latSpan = Math.max(0.015, maxLat - minLat);
    const lngSpan = Math.max(0.015, maxLng - minLng);

    const toSvgCoords = (lat: number, lng: number) => {
      const x = 50 + (((lng - minLng) / lngSpan) * 700);
      const y = 450 - (((lat - minLat) / latSpan) * 400);
      return { x: Math.max(40, Math.min(760, x)), y: Math.max(40, Math.min(460, y)) };
    };

    const routeSvgPath = routePoints
      .map((pt, idx) => {
        const c = toSvgCoords(pt.lat, pt.lng);
        return `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`;
      })
      .join(' ');

    return (
      <div className={`relative bg-slate-900 overflow-hidden rounded-xl border border-slate-700 select-none ${className}`}>
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Road networks simulation for clinical realism */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 500">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Background grid roads */}
          <path d="M 0 140 Q 400 190 800 130" stroke="#334155" strokeWidth="6" fill="none" opacity="0.6" />
          <path d="M 120 0 Q 200 250 180 500" stroke="#334155" strokeWidth="5" fill="none" opacity="0.6" />
          <path d="M 0 350 C 300 320 500 390 800 340" stroke="#334155" strokeWidth="6" fill="none" opacity="0.6" />
          <path d="M 580 0 L 610 500" stroke="#334155" strokeWidth="5" fill="none" opacity="0.6" />
          <circle cx="390" cy="240" r="160" stroke="#1e293b" strokeWidth="2" fill="none" strokeDasharray="4 6" />

          {/* Polyline Route */}
          {routeSvgPath && (
            <>
              <path
                d={routeSvgPath}
                stroke="#ef4444"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity="0.3"
                filter="url(#glow)"
              />
              <path
                d={routeSvgPath}
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8 6"
                fill="none"
                className="animate-pulse"
              />
            </>
          )}
        </svg>

        {/* Tactical Markers */}
        <div className="absolute inset-0">
          {markers.map((marker) => {
            const pos = toSvgCoords(marker.lat, marker.lng);
            const isSelected = activeMarker?.id === marker.id;

            return (
              <div
                key={marker.id}
                style={{ left: `${(pos.x / 800) * 100}%`, top: `${(pos.y / 500) * 100}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
                onClick={() => {
                  setActiveMarker(marker);
                  onSelectMarker?.(marker);
                }}
              >
                {marker.type === 'emergency' && (
                  <div className="relative">
                    <span className="absolute -inset-2 bg-rose-500 rounded-full animate-ping opacity-60" />
                    <div className="relative p-2 bg-rose-600 text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5 text-white animate-bounce" />
                    </div>
                  </div>
                )}

                {marker.type === 'hospital' && (
                  <div className="relative">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg border-2 border-white flex items-center justify-center hover:scale-110 transition-transform">
                      <Hospital className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}

                {marker.type === 'responder' && (
                  <div className="relative">
                    <span className="absolute -inset-1.5 bg-amber-400 rounded-full animate-pulse opacity-50" />
                    <div className="relative p-2 bg-amber-500 text-slate-900 rounded-full shadow-lg border-2 border-slate-900 flex items-center justify-center">
                      <Ambulance className="w-5 h-5" />
                    </div>
                  </div>
                )}

                {marker.type === 'user' && (
                  <div className="p-1.5 bg-sky-500 text-white rounded-full shadow-md border-2 border-white">
                    <MapPin className="w-4 h-4" />
                  </div>
                )}

                {/* Floating tooltip */}
                <div
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none transition-all ${
                    isSelected || marker.type === 'emergency'
                      ? 'bg-slate-900 text-white border border-slate-700 opacity-100 scale-100'
                      : 'bg-slate-800/90 text-slate-200 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100'
                  }`}
                >
                  {marker.title}
                  {marker.subtitle && <span className="block text-[10px] text-sky-400 font-normal">{marker.subtitle}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* HUD overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>
            GPS: <strong className="text-white">{center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E</strong>
          </span>
          <span className="text-emerald-400 text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
            Live Tactical GIS
          </span>
        </div>
      </div>
    );
  };

  if (!apiKey || mapError) {
    return renderFallbackTacticalMap();
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <APIProvider
        apiKey={apiKey}
        onLoad={() => setMapError(false)}
        onError={() => setMapError(true)}
      >
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="w-full h-full"
        >
          {/* Synchronized route polyline overlay */}
          {routePoints && routePoints.length >= 2 && (
            <MapRouteRenderer routePoints={routePoints} color="#2563EB" />
          )}

          {/* Map click listener & bounds manager */}
          <MapEventsAndBounds
            center={center}
            markers={markers}
            routePoints={routePoints}
            isDroppingPin={isDroppingPin}
            onPinDropped={onPinDropped}
          />

          {/* Manually Dropped Pin (when fallback is active) */}
          {droppedPin && (
            <AdvancedMarker
              position={droppedPin}
              title="Incident Location (Manual Pin)"
            >
              <div className="relative group cursor-pointer -translate-y-3">
                <span className="absolute -inset-2 bg-red-600 rounded-full animate-ping opacity-80" />
                <div className="relative px-3 py-1.5 bg-red-600 text-white rounded-xl shadow-2xl border-2 border-white flex items-center gap-1.5 font-black text-xs">
                  <MapPin className="w-4 h-4 fill-white" />
                  <span>Dropped Incident Pin</span>
                </div>
              </div>
            </AdvancedMarker>
          )}

          {markers.map((marker) => {
            const isSelected = activeMarker?.id === marker.id;

            return (
              <AdvancedMarker
                key={marker.id}
                position={{ lat: marker.lat, lng: marker.lng }}
                title={marker.title}
                onClick={() => {
                  setActiveMarker(marker);
                  onSelectMarker?.(marker);
                }}
              >
                {marker.type === 'emergency' && (
                  <div className="relative group cursor-pointer -translate-y-2">
                    <span className="absolute -inset-2 bg-red-500 rounded-full animate-ping opacity-75" />
                    <div className="relative px-2.5 py-1.5 bg-red-600 text-white rounded-lg shadow-xl border-2 border-white flex items-center gap-1.5 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 animate-bounce text-white" />
                      <span>{marker.title}</span>
                    </div>
                  </div>
                )}

                {marker.type === 'hospital' && (
                  <div className="relative group cursor-pointer">
                    <div className="px-2 py-1 bg-emerald-600 text-white rounded-lg shadow-lg border-2 border-white flex items-center gap-1 font-bold text-xs hover:scale-105 transition-transform">
                      <Hospital className="w-3.5 h-3.5" />
                      <span>{marker.title}</span>
                    </div>
                  </div>
                )}

                {marker.type === 'responder' && (
                  <div className="relative group cursor-pointer -translate-y-1">
                    {marker.isHelper || marker.subtitle?.toLowerCase().includes('helper') || marker.subtitle?.toLowerCase().includes('civilian') ? (
                      <div className="relative">
                        <span className="absolute -inset-1.5 bg-blue-400 rounded-full animate-ping opacity-60" />
                        <div className="relative px-2.5 py-1.5 bg-blue-600 text-white rounded-lg shadow-xl border-2 border-white flex items-center gap-1.5 font-bold text-xs">
                          <Footprints className="w-4 h-4 text-white" />
                          <span>{marker.title}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute -inset-1.5 bg-amber-400 rounded-full animate-pulse opacity-60" />
                        <div className="relative px-2.5 py-1.5 bg-amber-500 text-slate-950 rounded-lg shadow-xl border-2 border-white flex items-center gap-1.5 font-black text-xs">
                          <Ambulance className="w-4 h-4 text-slate-950" />
                          <span>{marker.title}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {marker.type === 'user' && (
                  <div className="relative group cursor-pointer -translate-y-1">
                    <span className="absolute -inset-2 bg-sky-400 rounded-full animate-ping opacity-60" />
                    <div className="relative p-1.5 bg-sky-600 text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center">
                      <Navigation className="w-4 h-4 fill-white rotate-45" />
                    </div>
                  </div>
                )}
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>

      {/* Manual Pin Drop Instructional Banner */}
      {isDroppingPin && (
        <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg shadow-lg font-bold text-xs flex items-center gap-2 z-20 border border-amber-300 animate-pulse">
          <MapPin className="w-4 h-4" />
          <span>Click anywhere on the map to drop the incident pin</span>
        </div>
      )}

      {/* Floating Tactical Marker Callout Card */}
      {activeMarker && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                  activeMarker.type === 'emergency'
                    ? 'bg-red-600'
                    : activeMarker.type === 'responder'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-600'
                }`}
              >
                {activeMarker.type === 'emergency' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : activeMarker.type === 'responder' ? (
                  <Ambulance className="w-4 h-4" />
                ) : (
                  <Hospital className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{activeMarker.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {activeMarker.lat.toFixed(4)}° N, {activeMarker.lng.toFixed(4)}° E
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveMarker(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            {activeMarker.subtitle && (
              <p className="font-medium text-slate-600 dark:text-slate-400">{activeMarker.subtitle}</p>
            )}

            {/* Ambulance Details */}
            {activeMarker.ambulanceData && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Paramedic:</span>
                  <span className="font-bold">{activeMarker.ambulanceData.paramedicName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Driver:</span>
                  <span className="font-bold">{activeMarker.ambulanceData.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Live ETA:</span>
                  <span className="font-bold text-red-600">
                    {activeMarker.ambulanceData.etaMinutes} mins ({activeMarker.ambulanceData.distanceKm} km)
                  </span>
                </div>
                {onSimulateMovement && (
                  <button
                    onClick={() => onSimulateMovement(activeMarker.id)}
                    className="w-full mt-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Simulate Live Movement</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Control HUD Overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-[11px]">Google Maps Platform Live</span>
        </div>
      </div>
    </div>
  );
};
