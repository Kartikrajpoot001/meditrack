import React, { useState } from 'react';
import {
  Building2,
  Users,
  Bed,
  Activity,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Box,
  RotateCw,
  Pill,
  ChevronRight,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { AppState, appStore, validatePatientIdFormat } from '../services/store';
import { Hospital, PatientProfile, QueueToken, WardBedData } from '../types';
import { Language } from '../i18n/translations';
import { WardFloor3DView } from './3d/WardFloor3DView';
import { PharmacyReorderModal } from './pharmacy/PharmacyReorderModal';

interface HospitalDashboardProps {
  appState: AppState;
  lang: Language;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({ appState, lang }) => {
  // Active hospital
  const currentHospital: Hospital =
    appState.hospitals.find((h) => h.id === appState.currentUserId) || appState.hospitals[0];

  // Ward Tab selector
  const [selectedWard, setSelectedWard] = useState<string>('All Wards');
  const [selectedBedId, setSelectedBedId] = useState<string | null>('B-101');
  const [activeMainSection, setActiveMainSection] = useState<'beds' | 'reception' | 'queues' | 'pharmacy'>('beds');
  const [reorderItem, setReorderItem] = useState<{ code: string; name: string; cat: string } | null>(null);

  // Walk-in registration state
  const [lookupId, setLookupId] = useState('');
  const [walkinName, setWalkinName] = useState('Ananya Rao');
  const [walkinAge, setWalkinAge] = useState(28);
  const [walkinGender, setWalkinGender] = useState<PatientProfile['gender']>('Female');
  const [walkinBlood, setWalkinBlood] = useState<PatientProfile['bloodGroup']>('B+');
  const [walkinPhone, setWalkinPhone] = useState('+91 98114 22319');
  const [walkinAllergies, setWalkinAllergies] = useState('Penicillin');
  const [assignDoctorId, setAssignDoctorId] = useState(appState.doctors[0]?.id || 'doc-1');
  const [walkinReason, setWalkinReason] = useState('Acute fever and respiratory symptoms');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [walkinError, setWalkinError] = useState('');

  // Hospital ward beds from state
  const allBeds = appState.wardBeds || [];

  // Filtered beds by ward
  const filteredBeds = allBeds.filter((bed) => {
    if (selectedWard === 'All Wards') return true;
    return bed.ward === selectedWard;
  });

  // Bed stats
  const totalBedsCount = allBeds.length;
  const occupiedCount = allBeds.filter((b) => b.status === 'occupied').length;
  const availableCount = allBeds.filter((b) => b.status === 'available').length;
  const maintenanceCount = allBeds.filter((b) => b.status === 'maintenance').length;

  const handleLookupExistingPatient = () => {
    setWalkinError('');
    setRegistrationMessage('');
    if (!lookupId.trim()) {
      setWalkinError('Please enter a Patient ID to lookup');
      return;
    }
    const trimmed = lookupId.trim();
    const formatRes = validatePatientIdFormat(trimmed);
    if (!formatRes.isValid) {
      setWalkinError(formatRes.error || 'Invalid Patient ID format');
      return;
    }
    const existing = appState.patients.find(
      (p) => p.uniquePatientId.toUpperCase() === trimmed.toUpperCase()
    );
    if (!existing) {
      setWalkinError('No patient found with this ID');
      return;
    }
    setWalkinName(existing.name);
    setWalkinAge(existing.age);
    setWalkinGender(existing.gender);
    setWalkinBlood(existing.bloodGroup);
    setWalkinPhone(existing.phone);
    setWalkinAllergies(existing.allergies.join(', '));
    setRegistrationMessage(`Verified record for ${existing.name} (${existing.uniquePatientId})`);
  };

  const handleRegisterWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    setWalkinError('');
    setRegistrationMessage('');

    let targetPatient: PatientProfile;

    if (lookupId.trim()) {
      const trimmed = lookupId.trim();
      const formatRes = validatePatientIdFormat(trimmed);
      if (!formatRes.isValid) {
        setWalkinError(formatRes.error || 'Invalid Patient ID format');
        return;
      }
      const existing = appState.patients.find(
        (p) => p.uniquePatientId.toUpperCase() === trimmed.toUpperCase()
      );
      if (!existing) {
        setWalkinError('No patient found with this ID');
        return;
      }
      targetPatient = existing;
    } else {
      targetPatient = appStore.registerPatient({
        name: walkinName,
        email: `${walkinName.toLowerCase().replace(/\s+/g, '')}@example.com`,
        phone: walkinPhone,
        age: walkinAge,
        gender: walkinGender,
        bloodGroup: walkinBlood,
        allergies: walkinAllergies ? [walkinAllergies] : [],
        chronicConditions: [],
        currentMedicines: [],
        vaccinations: [],
        emergencyContacts: [{ name: 'Family', relation: 'Kin', phone: walkinPhone }],
      });
    }

    const assignedDoc = appState.doctors.find((d) => d.id === assignDoctorId) || appState.doctors[0];
    const newToken = appStore.issueQueueToken({
      patientId: targetPatient.id,
      patientName: targetPatient.name,
      doctorId: assignedDoc.id,
      doctorName: assignedDoc.name,
      hospitalId: currentHospital.id,
      hospitalName: currentHospital.name,
      reason: walkinReason,
    });

    setRegistrationMessage(
      `Patient registered successfully. Assigned Token ${newToken.tokenNumber} for Dr. ${assignedDoc.name} in Room ${assignedDoc.roomNumber}. Unique ID: ${targetPatient.uniquePatientId}`
    );

    setTimeout(() => setRegistrationMessage(''), 8000);
  };

  const handleBedStatusChange = (bedId: string, status: 'available' | 'occupied' | 'maintenance') => {
    appStore.updateWardBedStatus(bedId, status);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hospital Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Hospital Operations & Capacity Command
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentHospital.name} • NABH Accredited Tertiary Center • Real-Time Ward State
          </p>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E3E8EB] text-xs font-semibold">
          <button
            onClick={() => setActiveMainSection('beds')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeMainSection === 'beds'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ward & Bed Management
          </button>
          <button
            onClick={() => setActiveMainSection('reception')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeMainSection === 'reception'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reception & Token Desk
          </button>
          <button
            onClick={() => setActiveMainSection('queues')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeMainSection === 'queues'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doctor Queues
          </button>
          <button
            onClick={() => setActiveMainSection('pharmacy')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeMainSection === 'pharmacy'
                ? 'bg-[#0E7C7B] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pharmacy & Consumables
          </button>
        </div>
      </div>

      {/* STAT TILES (Total, Occupied, Available, Maintenance) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Beds */}
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Total Beds</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalBedsCount}</span>
            <span className="text-xs text-slate-500">across 4 active wards</span>
          </div>
        </div>

        {/* Occupied Beds */}
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Occupied</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#D32F2F]">{occupiedCount}</span>
            <span className="text-xs text-slate-500">
              {Math.round((occupiedCount / (totalBedsCount || 1)) * 100)}% occupancy
            </span>
          </div>
        </div>

        {/* Available Beds */}
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Available</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{availableCount}</span>
            <span className="text-xs text-slate-500">ready for admission</span>
          </div>
        </div>

        {/* Under Maintenance */}
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Maintenance</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{maintenanceCount}</span>
            <span className="text-xs text-slate-500">sanitization / service</span>
          </div>
        </div>
      </div>

      {activeMainSection === 'beds' && (
        <div className="space-y-6">
          {/* Ward Tabs */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-1.5 flex flex-wrap gap-1">
            {['All Wards', 'General Ward A', 'ICU Ward B', 'Trauma Bay', 'Surgical Suites'].map(
              (ward) => (
                <button
                  key={ward}
                  onClick={() => setSelectedWard(ward)}
                  className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                    selectedWard === ward
                      ? 'bg-[#0E7C7B] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {ward}
                </button>
              )
            )}
          </div>

          {/* 3D Ward Floor View */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-4 h-4 text-[#0E7C7B]" />
                  <span>Interactive 3D Ward Isometric Floor</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any bed to inspect its patient and change occupancy. Drag to rotate view, scroll to zoom.
                </p>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span>
                  <span>Available</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#D32F2F]"></span>
                  <span>Occupied</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                  <span>Maintenance</span>
                </span>
              </div>
            </div>

            <WardFloor3DView
              beds={filteredBeds}
              selectedBedId={selectedBedId}
              onSelectBed={(bedId) => setSelectedBedId(bedId)}
              activeWard={selectedWard}
            />

            {/* Selected Bed Quick Bar */}
            {selectedBedId && (
              <div className="mt-3 p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {(() => {
                  const currentBed = allBeds.find((b) => b.id === selectedBedId);
                  if (!currentBed) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded border border-[#E3E8EB] text-slate-900">
                          {currentBed.id}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {currentBed.ward} • {currentBed.type}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {currentBed.patientName
                              ? `Assigned: ${currentBed.patientName} (${currentBed.patientId})`
                              : 'No patient currently admitted'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Set Status:</span>
                        <button
                          onClick={() => handleBedStatusChange(currentBed.id, 'available')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            currentBed.status === 'available'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-[#E3E8EB] text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Available
                        </button>
                        <button
                          onClick={() => handleBedStatusChange(currentBed.id, 'occupied')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            currentBed.status === 'occupied'
                              ? 'bg-[#D32F2F] text-white'
                              : 'bg-white border border-[#E3E8EB] text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Occupied
                        </button>
                        <button
                          onClick={() => handleBedStatusChange(currentBed.id, 'maintenance')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            currentBed.status === 'maintenance'
                              ? 'bg-amber-600 text-white'
                              : 'bg-white border border-[#E3E8EB] text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Maintenance
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Bed Management Table */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden">
            <div className="p-4 border-b border-[#E3E8EB] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bed Allocation Ledger</h3>
                <p className="text-xs text-slate-500">
                  Showing {filteredBeds.length} beds in {selectedWard}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Bed ID</th>
                    <th className="py-2.5 px-4">Ward</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Admitted Patient</th>
                    <th className="py-2.5 px-4 text-right">Quick Status Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8EB]">
                  {filteredBeds.map((bed) => {
                    const isSelected = selectedBedId === bed.id;
                    return (
                      <tr
                        key={bed.id}
                        onClick={() => setSelectedBedId(bed.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-50/70 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {bed.id}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{bed.ward}</td>
                        <td className="py-2.5 px-4 text-slate-600">{bed.type}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              bed.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bed.status === 'occupied'
                                ? 'bg-red-100 text-[#D32F2F]'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {bed.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {bed.patientName ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">{bed.patientName}</span>
                              <span className="font-mono text-[10px] text-slate-500">
                                ({bed.patientId})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleBedStatusChange(bed.id, 'available')}
                              disabled={bed.status === 'available'}
                              className={`px-2 py-0.5 text-[11px] rounded border ${
                                bed.status === 'available'
                                  ? 'bg-slate-100 text-slate-400 border-[#E3E8EB] cursor-not-allowed'
                                  : 'bg-white border-[#E3E8EB] text-slate-700 hover:border-emerald-500 hover:text-emerald-700'
                              }`}
                            >
                              Vacate
                            </button>
                            <button
                              onClick={() => handleBedStatusChange(bed.id, 'occupied')}
                              disabled={bed.status === 'occupied'}
                              className={`px-2 py-0.5 text-[11px] rounded border ${
                                bed.status === 'occupied'
                                  ? 'bg-slate-100 text-slate-400 border-[#E3E8EB] cursor-not-allowed'
                                  : 'bg-white border-[#E3E8EB] text-slate-700 hover:border-red-500 hover:text-red-700'
                              }`}
                            >
                              Admit
                            </button>
                            <button
                              onClick={() => handleBedStatusChange(bed.id, 'maintenance')}
                              disabled={bed.status === 'maintenance'}
                              className={`px-2 py-0.5 text-[11px] rounded border ${
                                bed.status === 'maintenance'
                                  ? 'bg-slate-100 text-slate-400 border-[#E3E8EB] cursor-not-allowed'
                                  : 'bg-white border-[#E3E8EB] text-slate-700 hover:border-amber-500 hover:text-amber-700'
                              }`}
                            >
                              Service
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEPTION & TOKEN DESK */}
      {activeMainSection === 'reception' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Patient Intake & Digital Token Issuance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register walk-in patient or lookup existing Unique Patient ID to assign a doctor.
              </p>
            </div>

            {registrationMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{registrationMessage}</span>
              </div>
            )}

            {walkinError && (
              <div className="bg-red-50 border border-red-200 text-[#D32F2F] text-xs p-3 rounded-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D32F2F] shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterWalkIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Existing Unique Patient ID (Existing Patient Lookup)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={lookupId}
                      onChange={(e) => {
                        setLookupId(e.target.value);
                        if (walkinError) setWalkinError('');
                      }}
                      placeholder="e.g. PT51829 (leave blank for new registration)"
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLookupExistingPatient}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-[#E3E8EB] text-xs transition-colors cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: PT + 5 digits (e.g. PT51829). If provided, ID must exist in patient records.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(parseInt(e.target.value) || 20)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value as any)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={walkinBlood}
                    onChange={(e) => setWalkinBlood(e.target.value as any)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Known Allergies
                </label>
                <input
                  type="text"
                  value={walkinAllergies}
                  onChange={(e) => setWalkinAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts"
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Consulting Doctor *
                </label>
                <select
                  value={assignDoctorId}
                  onChange={(e) => setAssignDoctorId(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                >
                  {appState.doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.specialization} (Room {doc.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Chief Complaint / Reason
                </label>
                <input
                  type="text"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Issue Digital Token & Add to Queue
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E3E8EB] p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Recent Tokens Issued Today</h2>
            <div className="divide-y divide-[#E3E8EB]">
              {appState.queueTokens.slice(0, 8).map((tok) => (
                <div key={tok.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold bg-teal-50 text-[#0E7C7B] px-2 py-0.5 rounded border border-teal-200">
                      {tok.tokenNumber}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{tok.patientName}</div>
                      <div className="text-[11px] text-slate-500">
                        {tok.doctorName} • {tok.reason}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      tok.status === 'in_consultation'
                        ? 'bg-teal-100 text-teal-800'
                        : tok.status === 'waiting'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {tok.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DOCTOR QUEUES */}
      {activeMainSection === 'queues' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {appState.doctors.map((doc) => {
            const docTokens = appState.queueTokens.filter((q) => q.doctorId === doc.id);
            const inRoom = docTokens.find((q) => q.status === 'in_consultation');
            const waiting = docTokens.filter((q) => q.status === 'waiting');

            return (
              <div key={doc.id} className="bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-3">
                <div className="flex items-start justify-between pb-2 border-b border-[#E3E8EB]">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{doc.name}</h3>
                    <p className="text-[11px] text-slate-500">
                      {doc.specialization} • Room {doc.roomNumber}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                    {waiting.length} waiting
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-600">Currently in Room:</div>
                  {inRoom ? (
                    <div className="p-2 rounded bg-teal-50 border border-teal-200 text-xs flex items-center justify-between">
                      <span className="font-bold text-[#0E7C7B]">{inRoom.patientName}</span>
                      <span className="font-mono text-[10px] font-bold">{inRoom.tokenNumber}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No patient in room</div>
                  )}

                  <div className="text-[11px] font-semibold text-slate-600 pt-1">Next in Queue:</div>
                  <div className="space-y-1">
                    {waiting.slice(0, 3).map((w) => (
                      <div
                        key={w.id}
                        className="p-1.5 rounded bg-slate-50 border border-[#E3E8EB] text-[11px] flex items-center justify-between"
                      >
                        <span className="text-slate-800">{w.patientName}</span>
                        <span className="font-mono font-bold text-amber-700">{w.tokenNumber}</span>
                      </div>
                    ))}
                    {waiting.length === 0 && (
                      <div className="text-[11px] text-slate-400">Queue is clear</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PHARMACY & CONSUMABLES */}
      {activeMainSection === 'pharmacy' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden">
          <div className="p-4 border-b border-[#E3E8EB] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hospital Pharmacy Formulary & Stocks</h3>
              <p className="text-xs text-slate-500">Essential critical drugs and consumables ledger</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-4">Item Code</th>
                <th className="py-2.5 px-4">Medicine / Consumable</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Current Stock</th>
                <th className="py-2.5 px-4">Minimum Threshold</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EB]">
              {[
                { code: 'MED-091', name: 'Adrenaline (Epinephrine) 1mg/ml', cat: 'Emergency Injections', stock: 120, min: 50, status: 'normal' },
                { code: 'MED-112', name: 'Atropine Sulfate 0.6mg', cat: 'Resuscitation', stock: 18, min: 25, status: 'low' },
                { code: 'MED-204', name: 'Budesonide Inhalation Susp 0.5mg', cat: 'Respiratory', stock: 450, min: 100, status: 'normal' },
                { code: 'MED-318', name: 'Normal Saline 0.9% 500ml', cat: 'IV Fluids', stock: 32, min: 100, status: 'critical' },
                { code: 'MED-402', name: 'Ceftriaxone 1g Vial', cat: 'Antibiotics', stock: 210, min: 60, status: 'normal' },
                { code: 'CON-008', name: 'Disposable Ventilator Circuits', cat: 'ICU Consumables', stock: 14, min: 20, status: 'low' },
              ].map((item) => (
                <tr key={item.code} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{item.code}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-2.5 px-4 text-slate-500">{item.cat}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{item.stock}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{item.min}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.status === 'critical'
                          ? 'bg-red-100 text-[#D32F2F]'
                          : item.status === 'low'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setReorderItem({ code: item.code, name: item.name, cat: item.cat })}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white transition-colors cursor-pointer shadow-xs"
                    >
                      Reorder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reorder Modal via Tata 1mg, PharmEasy, Apollo, or Netmeds */}
      {reorderItem && (
        <PharmacyReorderModal
          isOpen={true}
          onClose={() => setReorderItem(null)}
          item={{
            name: reorderItem.name,
            code: reorderItem.code,
            cat: reorderItem.cat,
          }}
          hospitalId={currentHospital.id}
          isHospitalInventory={true}
        />
      )}
    </div>
  );
};
