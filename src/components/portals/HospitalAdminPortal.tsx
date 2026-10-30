import React, { useState } from 'react';
import {
  Layers,
  Bed,
  Users,
  Calendar,
  Building2,
  Activity,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Box,
  RotateCw,
  Pill,
  CreditCard,
  UserCheck,
  BarChart3,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Stethoscope,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { AppState, appStore, validatePatientIdFormat } from '../../services/store';
import { AuthUser } from '../../services/auth';
import { Hospital, PatientProfile, QueueToken } from '../../types';
import { WardFloor3DView } from '../3d/WardFloor3DView';
import { PharmacyReorderModal } from '../pharmacy/PharmacyReorderModal';
import { AmbulanceFleetMap } from '../ambulance/AmbulanceFleetMap';

interface HospitalAdminPortalProps {
  appState: AppState;
  currentUser: AuthUser | null;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onOpenEmergency: () => void;
}

export const HospitalAdminPortal: React.FC<HospitalAdminPortalProps> = ({
  appState,
  currentUser,
  activePage,
  onNavigate,
  onOpenEmergency,
}) => {
  const currentHospital: Hospital =
    appState.hospitals.find((h) => h.id === currentUser?.uid) || appState.hospitals[0];

  // Ward & Bed state
  const [selectedWard, setSelectedWard] = useState<string>('All Wards');
  const [selectedBedId, setSelectedBedId] = useState<string | null>('B-101');

  // Walk-in registration state
  const [lookupId, setLookupId] = useState('');
  const [walkinName, setWalkinName] = useState('Ananya Rao');
  const [walkinAge, setWalkinAge] = useState(28);
  const [walkinGender, setWalkinGender] = useState<PatientProfile['gender']>('Female');
  const [walkinBlood, setWalkinBlood] = useState<PatientProfile['bloodGroup']>('B+');
  const [walkinPhone, setWalkinPhone] = useState('+91 98114 22319');
  const [walkinAllergies, setWalkinAllergies] = useState('Penicillin');
  const [walkinReason, setWalkinReason] = useState('Persistent chest tightness & wheezing');
  const [assignDoctorId, setAssignDoctorId] = useState(appState.doctors[0]?.id || 'doc-1');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [walkinError, setWalkinError] = useState('');

  // Hospital Patient Search state
  const [searchPatientId, setSearchPatientId] = useState('');
  const [searchPatientError, setSearchPatientError] = useState('');
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [searchedPatient, setSearchedPatient] = useState<PatientProfile | null>(null);

  // Pharmacy Purchase Order Reorder Modal State
  const [reorderItem, setReorderItem] = useState<{ code: string; name: string; cat: string } | null>(null);
  const [reorderSupplier, setReorderSupplier] = useState('Sun Pharma Distribution');
  const [reorderQuantity, setReorderQuantity] = useState(100);
  const [reorderApproval, setReorderApproval] = useState<'pending' | 'approved'>('pending');
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState('');

  // Hospital Billing & UPI Verification State
  const [paymentSubTab, setPaymentSubTab] = useState<'all' | 'pending_verification' | 'settled'>('all');
  const [rejectModalBillId, setRejectModalBillId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentActionNotice, setPaymentActionNotice] = useState('');

  const allBeds = appState.wardBeds || [];
  const filteredBeds = allBeds.filter((bed) => {
    if (selectedWard === 'All Wards') return true;
    return bed.ward === selectedWard;
  });

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
      `Patient registered! Assigned Token ${newToken.tokenNumber} for Dr. ${assignedDoc.name} in Room ${assignedDoc.roomNumber}. Unique ID: ${targetPatient.uniquePatientId}`
    );

    setTimeout(() => setRegistrationMessage(''), 8000);
  };

  const handleHospitalPatientSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchPatientError('');
    setSearchBlocked(false);
    setSearchedPatient(null);

    const trimmed = searchPatientId.trim();
    if (!trimmed) {
      return;
    }

    const formatRes = validatePatientIdFormat(trimmed);
    if (!formatRes.isValid) {
      setSearchPatientError(formatRes.error || 'Invalid Patient ID format');
      setSearchBlocked(true);
      return;
    }

    const found = appState.patients.find(
      (p) => p.uniquePatientId.toUpperCase() === trimmed.toUpperCase()
    );

    if (!found) {
      setSearchPatientError('No patient found with this ID');
      setSearchBlocked(true);
      return;
    }

    setSearchedPatient(found);
  };

  const handleBedStatusChange = (bedId: string, status: 'available' | 'occupied' | 'maintenance') => {
    appStore.updateWardBedStatus(bedId, status);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 0. AMBULANCE FLEET & LIVE MAP */}
      {activePage === 'ambulances' && (
        <AmbulanceFleetMap
          appState={appState}
          onRequestSOS={onOpenEmergency}
        />
      )}

      {/* 1. DASHBOARD */}
      {activePage === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {currentHospital.name} Operations Command
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                NABH Level 3 Trauma Facility • Live Real-Time Hospital Overview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenEmergency}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Immediate One-Tap SOS Emergency Broadcast"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>One-Tap SOS</span>
              </button>

              <button
                onClick={() => onNavigate('bed-management')}
                className="px-3.5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Bed className="w-4 h-4" />
                <span>3D Ward Floor</span>
              </button>
            </div>
          </div>

          {/* STAT TILES */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigate('bed-management')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B]"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Total Beds</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{totalBedsCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">across 4 hospital wards</div>
            </div>

            <div
              onClick={() => onNavigate('bed-management')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B]"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Occupied Beds</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#D32F2F]">{occupiedCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {Math.round((occupiedCount / (totalBedsCount || 1)) * 100)}% occupancy
              </div>
            </div>

            <div
              onClick={() => onNavigate('bed-management')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B]"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Available</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{availableCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">ready for immediate intake</div>
            </div>

            <div
              onClick={() => onNavigate('incoming-emergencies')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B]"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Active Emergencies</span>
                <ShieldAlert className="w-4 h-4 text-[#D32F2F]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#D32F2F]">{appState.emergencies.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Trauma bays alerted</div>
            </div>
          </div>

          {/* Quick shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => onNavigate('patients')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:bg-slate-50"
            >
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Walk-In Registration
              </h3>
              <p className="text-xs text-slate-500">
                Register walk-in patients, issue digital tokens, and assign consulting doctors.
              </p>
            </div>
            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:bg-slate-50"
            >
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Pharmacy Inventory
              </h3>
              <p className="text-xs text-slate-500">
                Monitor essential emergency drugs, low stock thresholds, and trigger reorders.
              </p>
            </div>
            <div
              onClick={() => onNavigate('doctors')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:bg-slate-50"
            >
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Doctor Shifts
              </h3>
              <p className="text-xs text-slate-500">
                Inspect active clinical queues, room assignments, and doctor duty hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. APPOINTMENTS */}
      {activePage === 'appointments' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Hospital Central Appointments Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">All digital tokens across departments</p>
          </div>

          <div className="divide-y divide-[#E3E8EB] text-xs">
            {appState.queueTokens.map((tok) => (
              <div key={tok.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[#0E7C7B] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {tok.tokenNumber}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">{tok.patientName}</div>
                    <div className="text-slate-500 text-[11px]">{tok.doctorName} • {tok.reason}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {tok.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PATIENTS (Walk-in desk & Directory) */}
      {activePage === 'patients' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Patient Intake & Token Issuance</h2>
            {registrationMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{registrationMessage}</span>
              </div>
            )}
            {walkinError && (
              <div className="p-3 bg-red-50 border border-red-200 text-[#D32F2F] text-xs rounded-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D32F2F] shrink-0" />
                <span>{walkinError}</span>
              </div>
            )}
            <form onSubmit={handleRegisterWalkIn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unique Patient ID (Existing Patient Lookup)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupId}
                    onChange={(e) => {
                      setLookupId(e.target.value);
                      if (walkinError) setWalkinError('');
                    }}
                    placeholder="e.g. PT51829 (leave blank for new walk-in)"
                    className="flex-1 bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                  <button
                    type="button"
                    onClick={handleLookupExistingPatient}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-[#E3E8EB] transition-colors cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: PT + 5 digits (e.g. PT51829). If provided, ID must exist in system.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Patient Name *</label>
                  <input
                    type="text"
                    required
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Doctor *</label>
                <select
                  value={assignDoctorId}
                  onChange={(e) => setAssignDoctorId(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                >
                  {appState.doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.specialization} (Room {d.roomNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Issue Digital Token
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Hospital Patient Record Search</h3>
              <p className="text-xs text-slate-500">
                Lookup registered patient record by Unique Patient ID (PT + 5 digits).
              </p>
            </div>

            <form onSubmit={handleHospitalPatientSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchPatientId}
                  onChange={(e) => {
                    setSearchPatientId(e.target.value);
                    if (searchPatientError) {
                      setSearchPatientError('');
                      setSearchBlocked(false);
                    }
                  }}
                  placeholder="Enter Patient ID (e.g. PT51829)"
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Search
              </button>
            </form>

            {searchPatientError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-[#D32F2F] font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D32F2F] shrink-0" />
                <span>{searchPatientError}</span>
              </div>
            )}

            {searchBlocked && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                <ShieldAlert className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <p className="font-semibold text-slate-700">Access Blocked</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Record lookup failed. Invalid or nonexistent patient identifier.
                </p>
              </div>
            )}

            {searchedPatient && (
              <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-teal-100">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{searchedPatient.name}</h4>
                    <span className="font-mono text-teal-700 text-xs font-semibold">{searchedPatient.uniquePatientId}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Verified Active Record
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div><strong>Age/Gender:</strong> {searchedPatient.age}y / {searchedPatient.gender}</div>
                  <div><strong>Blood Group:</strong> {searchedPatient.bloodGroup}</div>
                  <div><strong>Phone:</strong> {searchedPatient.phone}</div>
                  <div><strong>Email:</strong> {searchedPatient.email}</div>
                  <div className="col-span-2">
                    <strong>Allergies:</strong> {searchedPatient.allergies.length > 0 ? searchedPatient.allergies.join(', ') : 'None documented'}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#E3E8EB]">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                All Hospital Registered Records ({appState.patients.length})
              </h4>
              <div className="divide-y divide-[#E3E8EB] text-xs max-h-56 overflow-y-auto">
                {appState.patients.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{p.name} ({p.uniquePatientId})</div>
                      <div className="text-[11px] text-slate-500">Blood: {p.bloodGroup} • Phone: {p.phone}</div>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {p.gender}, {p.age}y
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. INCOMING EMERGENCIES */}
      {activePage === 'incoming-emergencies' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] animate-ping" />
                <h2 className="text-base font-bold text-slate-900">Inbound Emergency & Trauma Feed</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time telemetry and victim vitals dispatched from the Emergency Response Network
              </p>
            </div>
            <button
              onClick={onOpenEmergency}
              className="px-3.5 py-1.5 rounded-lg bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Open Emergency Network</span>
            </button>
          </div>

          {appState.emergencies.filter((e) => e.status !== 'Closed').length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No active incoming emergencies at this moment. Trauma bays on standby.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {appState.emergencies
                .filter((e) => e.status !== 'Closed')
                .map((emg) => {
                  const isDestinationThisHosp =
                    emg.destinationHospitalId === 'hosp-1' || !emg.destinationHospitalId;

                  return (
                    <div
                      key={emg.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isDestinationThisHosp
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-[#E3E8EB] bg-[#F4F7F8]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#D32F2F]" />
                          <span className="font-bold text-slate-900 text-sm uppercase">
                            {emg.emergencyType}
                          </span>
                          <span className="text-[10px] bg-red-100 text-[#D32F2F] font-bold px-2 py-0.5 rounded uppercase">
                            {emg.severity}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
                            {emg.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {emg.etaMinutes !== undefined && (
                            <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded flex items-center gap-1">
                              <span>ETA:</span>
                              <span>{emg.etaMinutes} min</span>
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 font-mono">
                            {emg.id}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
                        <div className="space-y-1">
                          <div className="text-slate-700">
                            <strong>Location:</strong> {emg.address}
                          </div>
                          <div className="text-slate-600">
                            <strong>Victims:</strong> {emg.victimsCount} casualty(ies) reported
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            <strong>Caller:</strong> {emg.callerName} ({emg.callerPhone})
                          </div>
                          {emg.description && (
                            <div className="text-slate-600 text-[11px] italic mt-1 bg-white p-2 rounded border border-slate-100">
                              "{emg.description}"
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-slate-700">
                            <strong>Target Hospital:</strong>{' '}
                            <span className="font-semibold text-[#0E7C7B]">
                              {emg.destinationHospitalName || 'Triage in progress / City Metro General'}
                            </span>
                          </div>

                          {/* Who is bringing the victim: Ambulance vs Civilian */}
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                            <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                              <span>Who is bringing the victim:</span>
                              <span className="text-[10px] font-medium text-slate-400">Transport Manifest</span>
                            </div>
                            {emg.assignedAmbulance ? (
                              <div className="flex items-center gap-2 text-xs text-red-900 font-semibold bg-red-50 p-1.5 rounded border border-red-200">
                                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[10px]">AMBULANCE</span>
                                <span>{emg.assignedAmbulance.unitCode} ({emg.assignedAmbulance.type})</span>
                                <span className="text-slate-500 font-normal text-[11px] ml-auto">Paramedic: {emg.assignedAmbulance.paramedicName}</span>
                              </div>
                            ) : emg.helpers && emg.helpers.some((h) => h.roleOption === 'transport_victim') ? (
                              (() => {
                                const transportHelper = emg.helpers.find((h) => h.roleOption === 'transport_victim');
                                return (
                                  <div className="flex items-center gap-2 text-xs text-blue-900 font-semibold bg-blue-50 p-1.5 rounded border border-blue-200">
                                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">CIVILIAN</span>
                                    <span>{transportHelper?.name} ({transportHelper?.vehicleDetails || 'Personal Vehicle'})</span>
                                    <span className="text-slate-500 font-normal text-[11px] ml-auto">ETA: {transportHelper?.etaMinutes || emg.etaMinutes || 5}m</span>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-slate-500 text-[11px] italic">
                                Ambulance dispatch / transport coordination in progress ({emg.status})
                              </div>
                            )}

                            {/* Responders & Helpers Tag Cluster */}
                            {((emg.helpers && emg.helpers.length > 0) || (emg.responders && emg.responders.length > 0)) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {emg.helpers?.map((h) => (
                                  <span key={h.id} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    Helper: {h.name} ({h.roleOption === 'help_scene' ? 'Safe First Aid' : h.roleOption === 'guide_ambulance' ? 'Guiding Route' : 'Transporting'})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live Vitals Telemetry Box */}
                      {emg.vitals && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-teal-200 shadow-xs">
                          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-teal-100">
                            <span className="font-bold text-teal-900 text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                              Live Inbound Patient Vitals Telemetry
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {emg.vitals.recordedBy || 'Field Paramedic'} • {emg.vitals.recordedAt ? new Date(emg.vitals.recordedAt).toLocaleTimeString() : 'Live'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Blood Pressure</div>
                              <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                                {emg.vitals.bloodPressure || '—'}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Heart Rate</div>
                              <div className="text-sm font-bold text-red-600 font-mono mt-0.5">
                                {emg.vitals.heartRate ? `${emg.vitals.heartRate} bpm` : '—'}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">Oxygen SpO2</div>
                              <div className="text-sm font-bold text-teal-700 font-mono mt-0.5">
                                {emg.vitals.spo2 ? `${emg.vitals.spo2}%` : '—'}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">
                              <div className="text-[10px] text-slate-500 font-semibold uppercase">GCS Coma Scale</div>
                              <div className="text-sm font-bold text-indigo-700 font-mono mt-0.5">
                                {emg.vitals.gcs ? `${emg.vitals.gcs}/15` : '—'}
                              </div>
                            </div>
                          </div>
                          {emg.vitals.conditionNotes && (
                            <div className="mt-2 text-[11px] text-slate-600 bg-teal-50/50 p-1.5 rounded">
                              <strong>Clinical Field Note:</strong> {emg.vitals.conditionNotes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Incident Timeline Log [Time] [Event] [Who did it] */}
                      {emg.timeline && emg.timeline.length > 0 && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                          <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Incident Timeline Audit Log</span>
                            <span className="text-[10px] text-slate-400 font-normal">{emg.timeline.length} events logged</span>
                          </div>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {emg.timeline.map((ev) => (
                              <div key={ev.id} className="text-[11px] flex items-start gap-2 py-1 border-b border-slate-100 last:border-b-0">
                                <span className="font-mono text-slate-400 shrink-0 font-medium">{ev.timestamp}</span>
                                <div className="flex-1">
                                  <span className="font-semibold text-slate-800">{ev.event}</span>
                                  {ev.details && <span className="text-slate-500 ml-1">({ev.details})</span>}
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                                  {ev.who}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hospital Bay Reservation & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-200/60">
                        <div className="text-xs text-slate-500">
                          {emg.hospitalReadinessConfirmed ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              ✓ Trauma Bed Prepared & Locked ({emg.bedsReserved?.emergency || 1} ER Bay, {emg.bedsReserved?.icu || 1} ICU)
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              ⚠️ Intake Pending: Emergency Bay Not Yet Prepared
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!emg.hospitalReadinessConfirmed && (
                            <button
                              onClick={() => {
                                appStore.confirmHospitalReadiness(emg.id, {
                                  emergency: emg.victimsCount || 1,
                                  icu: 1,
                                });
                              }}
                              className="px-3 py-1.5 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Accept & Prepare Bed
                            </button>
                          )}
                          {emg.status !== 'Hospital Handover' && emg.status !== 'Closed' && (
                            <button
                              onClick={() => {
                                appStore.hospitalHandover(
                                  emg.id,
                                  'hosp-1',
                                  'City Metro General Hospital',
                                  'Trauma Resuscitation Bay 1'
                                );
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Confirm Handover & Admit
                            </button>
                          )}
                          {emg.status === 'Hospital Handover' && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              ✓ Patient Admitted ({emg.hospitalBedAssigned || 'ER Bay 1'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* 5. DOCTORS */}
      {activePage === 'doctors' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Medical Staff & Doctor Roster</h2>
              <p className="text-xs text-slate-500 mt-0.5">Clinical team credentials and approval workflow</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {appState.doctors.length} Physicians Registered
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {appState.doctors.map((d) => {
              const isApproved = d.approvalStatus !== 'pending';

              return (
                <div key={d.id} className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-bold text-slate-900 text-sm">{d.name}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900 animate-pulse'
                      }`}>
                        {isApproved ? 'Active Duty' : 'Pending Approval'}
                      </span>
                    </div>
                    <div className="text-[#0E7C7B] font-semibold mt-0.5">{d.specialization}</div>
                    <div className="text-slate-500 text-[11px] mt-1">
                      Room {d.roomNumber} • {d.experienceYears} Years Exp.
                    </div>
                    {d.registrationNumber && (
                      <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                        Reg: {d.registrationNumber}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#E3E8EB] flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{d.id}</span>
                    {!isApproved ? (
                      <button
                        onClick={() => appStore.approveDoctor(d.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Approve Credentials
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        ✓ Verified by Admin
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. DEPARTMENTS */}
      {activePage === 'departments' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Hospital Clinical Departments</h2>
            <p className="text-xs text-slate-500 mt-0.5">Divisional beds, doctors, and equipment allocation</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {[
              { name: 'Cardiology', head: 'Dr. Aris Vance MD', beds: 24, icu: 8 },
              { name: 'Orthopedics & Trauma', head: 'Dr. Vikram Malhotra MS', beds: 30, icu: 4 },
              { name: 'Emergency Medicine', head: 'Dr. Neha Sharma MD', beds: 16, icu: 10 },
              { name: 'Pulmonology & Critical Care', head: 'Dr. Priya Desai MD', beds: 20, icu: 6 },
              { name: 'Pediatrics & Neonatology', head: 'Dr. Rajesh Nair MD', beds: 18, icu: 4 },
              { name: 'General Surgery & OT', head: 'Dr. Sunita Rao MS', beds: 12, icu: 4 },
            ].map((dep, idx) => (
              <div key={idx} className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">{dep.name}</div>
                <div className="text-slate-600 text-[11px]">Head: {dep.head}</div>
                <div className="flex justify-between pt-1 border-t border-[#E3E8EB] text-slate-500">
                  <span>General Beds: <strong>{dep.beds}</strong></span>
                  <span>ICU: <strong>{dep.icu}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. DOCTOR SCHEDULE */}
      {activePage === 'doctor-schedule' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Institutional Clinical Roster</h2>
            <p className="text-xs text-slate-500 mt-0.5">Weekly shift schedule across OPD and Emergency services</p>
          </div>
          <div className="p-6 text-center text-slate-400 text-xs">
            Shift roster synchronized with NABH staff requirements.
          </div>
        </div>
      )}

      {/* 8. BED MANAGEMENT (Isometric 3D floor view + Bed table) */}
      {activePage === 'bed-management' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-1.5 flex flex-wrap gap-1 text-xs">
            {['All Wards', 'General Ward A', 'ICU Ward B', 'Trauma Bay', 'Surgical Suites'].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWard(w)}
                className={`px-4 py-2 font-semibold rounded cursor-pointer transition-colors ${
                  selectedWard === w ? 'bg-[#0E7C7B] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-4 h-4 text-[#0E7C7B]" />
                  <span>Interactive 3D Isometric Ward Floor</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any bed to select row in table below. Drag to rotate, scroll to zoom.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600" /> Available</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#D32F2F]" /> Occupied</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Maintenance</span>
              </div>
            </div>

            <WardFloor3DView
              beds={filteredBeds}
              selectedBedId={selectedBedId}
              onSelectBed={(id) => setSelectedBedId(id)}
              activeWard={selectedWard}
            />
          </div>

          {/* Bed Ledger Table */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Bed ID</th>
                  <th className="py-2.5 px-4">Ward</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Admitted Patient</th>
                  <th className="py-2.5 px-4 text-right">Quick Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8EB]">
                {filteredBeds.map((bed) => (
                  <tr
                    key={bed.id}
                    onClick={() => setSelectedBedId(bed.id)}
                    className={`cursor-pointer ${selectedBedId === bed.id ? 'bg-teal-50/70 font-medium' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{bed.id}</td>
                    <td className="py-2.5 px-4 text-slate-700">{bed.ward}</td>
                    <td className="py-2.5 px-4 text-slate-600">{bed.type}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
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
                    <td className="py-2.5 px-4 text-slate-800">{bed.patientName || '—'}</td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleBedStatusChange(bed.id, 'available')}
                          className="px-2 py-0.5 border rounded text-[11px] hover:bg-emerald-50"
                        >
                          Vacate
                        </button>
                        <button
                          onClick={() => handleBedStatusChange(bed.id, 'occupied')}
                          className="px-2 py-0.5 border rounded text-[11px] hover:bg-red-50"
                        >
                          Admit
                        </button>
                        <button
                          onClick={() => handleBedStatusChange(bed.id, 'maintenance')}
                          className="px-2 py-0.5 border rounded text-[11px] hover:bg-amber-50"
                        >
                          Service
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. PAYMENTS (Hospital Revenue & Billing Ledger) */}
      {activePage === 'payments' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-5">
          <div className="pb-3 border-b border-[#E3E8EB] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Billing & Receivables Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live inpatient, OPD, emergency, and pharmacy invoices</p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
              {appState.bills?.length || 0} Total Invoices
            </span>
          </div>

          {/* Revenue KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Collected</span>
              <span className="text-xl font-bold text-emerald-700 block mt-1">
                ₹{appState.bills?.filter(b => b.status === 'Paid').reduce((acc, b) => acc + b.amount, 0).toLocaleString() || 0}
              </span>
              <span className="text-[10px] text-emerald-600">Settled invoices</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Pending Receivables</span>
              <span className="text-xl font-bold text-amber-700 block mt-1">
                ₹{appState.bills?.filter(b => b.status === 'Pending').reduce((acc, b) => acc + b.amount, 0).toLocaleString() || 0}
              </span>
              <span className="text-[10px] text-amber-600">Awaiting payment</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Insurance Claims</span>
              <span className="text-xl font-bold text-indigo-700 block mt-1">
                ₹{appState.bills?.reduce((acc, b) => acc + (b.insuranceCovered || 0), 0).toLocaleString() || 0}
              </span>
              <span className="text-[10px] text-slate-500">TPA verified</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Active Billing Desks</span>
              <span className="text-xl font-bold text-slate-800 block mt-1">4 Counter Desks</span>
              <span className="text-[10px] text-teal-600">UPI / Card / Cash</span>
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="border border-[#E3E8EB] rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Invoice ID</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8EB]">
                {appState.bills?.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.id}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{b.patientName}</td>
                    <td className="py-2 px-3 text-slate-600">{b.category}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{b.description}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">₹{b.amount.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        b.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{b.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. CALENDAR */}
      {activePage === 'calendar' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Institutional Event & OT Calendar</h2>
            <p className="text-xs text-slate-500 mt-0.5">Surgical theatre slots, CME conferences, and administrative reviews</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2">
              <span className="font-bold text-slate-800 block text-sm">Today&apos;s Major Surgeries</span>
              <div className="space-y-1.5 text-slate-600">
                <div className="p-2 bg-white rounded border border-[#E3E8EB]">
                  <strong>04:00 PM:</strong> Coronary Angioplasty (Cath Lab 2, Dr. Aris Vance)
                </div>
                <div className="p-2 bg-white rounded border border-[#E3E8EB]">
                  <strong>02:30 PM:</strong> Arthroscopic Meniscal Debridement (OT 1, Dr. Vikram Malhotra)
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2">
              <span className="font-bold text-slate-800 block text-sm">Administrative Shifts</span>
              <div className="space-y-1.5 text-slate-600">
                <div className="p-2 bg-white rounded border border-[#E3E8EB]">
                  <strong>Trauma Desk Shift:</strong> Dr. Neha Sharma (ER Duty Commander)
                </div>
                <div className="p-2 bg-white rounded border border-[#E3E8EB]">
                  <strong>ICU Rounds:</strong> 02:00 PM - 03:30 PM (Ward B)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. INVENTORY (Pharmacy Formulary & Reorder Workflow) */}
      {activePage === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden text-xs">
            <div className="p-4 border-b border-[#E3E8EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pharmacy Formulary & Consumables Ledger</h2>
                <p className="text-slate-500 text-[11px] mt-0.5">Automated low-threshold alerts for emergency medications</p>
              </div>
              {reorderSuccessMsg && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
                  {reorderSuccessMsg}
                </span>
              )}
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Item Code</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Stock</th>
                  <th className="py-2.5 px-4">Threshold</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8EB]">
                {[
                  { code: 'MED-091', name: 'Adrenaline (Epinephrine) 1mg/ml', cat: 'Emergency Injections', stock: 120, min: 50 },
                  { code: 'MED-112', name: 'Atropine Sulfate 0.6mg', cat: 'Resuscitation', stock: 18, min: 25 },
                  { code: 'MED-204', name: 'Budesonide Susp 0.5mg', cat: 'Respiratory', stock: 450, min: 100 },
                  { code: 'MED-318', name: 'Normal Saline 0.9% 500ml', cat: 'IV Fluids', stock: 32, min: 100 },
                  { code: 'CON-008', name: 'Disposable Ventilator Circuits', cat: 'ICU Consumables', stock: 14, min: 20 },
                ].map((item) => (
                  <tr key={item.code} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{item.code}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4 text-slate-500">{item.cat}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{item.stock}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{item.min}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setReorderItem(item);
                          setReorderQuantity(100);
                        }}
                        className="px-3 py-1 text-xs font-bold rounded bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white cursor-pointer shadow-xs"
                      >
                        Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Active Purchase Requests Table (Phase 6) */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Institutional Purchase Requests & Supplier Orders</h3>
                <p className="text-slate-500 text-[11px]">Authorized procurement orders placed to pharmaceutical suppliers</p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {appState.pharmacyOrders?.length || 0} Orders
              </span>
            </div>

            <div className="border border-[#E3E8EB] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Medicine</th>
                    <th className="py-2 px-3">Supplier</th>
                    <th className="py-2 px-3">Quantity</th>
                    <th className="py-2 px-3">Est. Cost</th>
                    <th className="py-2 px-3">Approval Status</th>
                    <th className="py-2 px-3">Requested At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8EB]">
                  {appState.pharmacyOrders?.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{po.id}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{po.medicineName}</td>
                      <td className="py-2 px-3 text-slate-600">{po.supplier}</td>
                      <td className="py-2 px-3 font-mono font-bold">{po.quantity} {po.unit}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">₹{po.totalCost?.toLocaleString() || 0}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          po.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          po.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                        {new Date(po.requestedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REORDER FORMULARY PURCHASE ORDER VIA TATA 1MG, PHARMEASY, APOLLO, OR NETMEDS */}
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
          onOrderPlaced={(res) => {
            setReorderSuccessMsg(`Order placed via ${res.providerName} (${res.quantity} units)! Record ID: ${res.orderId || 'saved'}`);
            setTimeout(() => setReorderSuccessMsg(''), 5000);
            setReorderItem(null);
          }}
        />
      )}

      {/* 12. HELP CENTER */}
      {activePage === 'help-center' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4 max-w-2xl mx-auto text-xs">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Hospital Administration Manual & Escalations</h2>
            <p className="text-slate-500 mt-0.5">NABH Accreditation standards and emergency response protocols</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-[#E3E8EB] space-y-2">
            <div className="font-bold text-slate-900">Emergency Bed Reservation SLA</div>
            <div className="text-slate-600">
              When an inbound code red ambulance is confirmed, trauma bay bed counts must be locked within 60 seconds to satisfy national golden-hour triage guidelines.
            </div>
          </div>
        </div>
      )}

      {/* 13. REPORT */}
      {activePage === 'report' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Statutory Compliance & Locker Access Audit Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">Immutable audit trail of all doctor locker accesses and emergency overrides</p>
          </div>
          <div className="divide-y divide-[#E3E8EB] text-xs">
            {appState.accessLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{log.doctorName} → Patient #{log.patientId}</div>
                  <div className="text-slate-500 text-[11px]">{log.purpose} • Type: <strong className="uppercase">{log.accessType}</strong></div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{log.timestamp.split('T')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
