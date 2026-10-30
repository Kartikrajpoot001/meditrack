import React, { useState } from 'react';
import {
  Clock,
  Users,
  Search,
  Calendar,
  FileText,
  UserCheck,
  FolderHeart,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Pill,
  Plus,
  Trash2,
  ShieldAlert,
  Check,
  Stethoscope,
  Activity,
  ArrowRight,
  X,
} from 'lucide-react';
import { AppState, appStore, validatePatientIdFormat } from '../../services/store';
import { AuthUser } from '../../services/auth';
import { Doctor, PatientProfile, PrescriptionMedicine, QueueToken, MedicalReport } from '../../types';
import { AmbulanceFleetMap } from '../ambulance/AmbulanceFleetMap';

interface DoctorPortalProps {
  appState: AppState;
  currentUser: AuthUser | null;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onOpenEmergency: () => void;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  appState,
  currentUser,
  activePage,
  onNavigate,
  onOpenEmergency,
}) => {
  const currentDoctor: Doctor =
    appState.doctors.find((d) => d.id === currentUser?.uid) || appState.doctors[0];

  // Queue state
  const [queueTab, setQueueTab] = useState<'all' | 'waiting' | 'in_consultation' | 'done'>('all');

  // Search by Unique Patient ID
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPatient, setSearchedPatient] = useState<PatientProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [breakGlassModal, setBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassActive, setBreakGlassActive] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<MedicalReport | null>(null);

  // Prescription builder state
  const [consultDiagnosis, setConsultDiagnosis] = useState('');
  const [consultSymptoms, setConsultSymptoms] = useState('');
  const [consultNotes, setConsultNotes] = useState('');
  const [consultFollowUp, setConsultFollowUp] = useState('2026-11-28');
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    {
      name: 'Budesonide Inhaler',
      dose: '200 mcg',
      frequency: '2 puffs BID',
      duration: '30 days',
      instructions: 'Rinse mouth after inhalation',
    },
    {
      name: 'Cetirizine 10mg',
      dose: '1 tablet',
      frequency: 'Once daily (bedtime)',
      duration: '10 days',
      instructions: 'Take after dinner',
    },
  ]);
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([
    'Complete Blood Count',
    'Serum Electrolytes',
  ]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Doctor queues
  const doctorQueue = appState.queueTokens.filter((q) => q.doctorId === currentDoctor.id && q.status !== 'cancelled');
  const inConsultToken = doctorQueue.find((q) => q.status === 'in_consultation');
  const waitingTokens = doctorQueue.filter((q) => q.status === 'waiting');
  const doneTokens = doctorQueue.filter((q) => q.status === 'done');

  const filteredQueue = doctorQueue.filter((item) => {
    if (queueTab === 'all') return true;
    return item.status === queueTab;
  });

  const activeConsultPatient: PatientProfile | null = (() => {
    if (searchBlocked) return null;
    if (searchedPatient) return searchedPatient;
    if (selectedPatientId) {
      return appState.patients.find((p) => p.id === selectedPatientId) || null;
    }
    if (inConsultToken) {
      return appState.patients.find((p) => p.id === inConsultToken.patientId) || null;
    }
    if (waitingTokens.length > 0) {
      return appState.patients.find((p) => p.id === waitingTokens[0].patientId) || null;
    }
    return null;
  })();

  const hasConsent =
    breakGlassActive ||
    (activeConsultPatient &&
      (appState.consentRules.some(
        (c) =>
          c.patientId === activeConsultPatient.id &&
          c.doctorId === currentDoctor.id &&
          c.status === 'active'
      ) ||
        doctorQueue.some(
          (q) => q.patientId === activeConsultPatient.id && q.status !== 'no_show'
        )));

  const handleSearchPatient = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setBreakGlassActive(false);

    const query = searchQuery.trim().toUpperCase();
    if (!query) {
      setSearchBlocked(false);
      setSearchedPatient(null);
      setSelectedPatientId(null);
      return;
    }

    // Format validation: PT + 5 digits before lookup
    const formatCheck = validatePatientIdFormat(query);
    if (!formatCheck.isValid) {
      setSearchError(formatCheck.error || "Invalid Patient ID format. Must be 'PT' followed by 5 digits (e.g., PT00234)");
      setSearchBlocked(true);
      setSearchedPatient(null);
      setSelectedPatientId(null);
      return;
    }

    const found = appState.patients.find(
      (p) => p.uniquePatientId.toUpperCase() === query
    );

    if (found) {
      setSearchBlocked(false);
      setSearchError('');
      setSearchedPatient(found);
      setSelectedPatientId(found.id);

      appStore.recordDoctorLockerAccess({
        patientId: found.id,
        doctorId: currentDoctor.id,
        doctorName: currentDoctor.name,
        hospitalId: currentDoctor.hospitalId,
        hospitalName: currentDoctor.hospitalName,
        purpose: 'Clinical Locker Examination & Queue Verification',
        accessType: 'routine',
      });
    } else {
      setSearchError("No patient found with this ID");
      setSearchBlocked(true);
      setSearchedPatient(null);
      setSelectedPatientId(null);
    }
  };

  const handleBreakGlassConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakGlassReason || !activeConsultPatient) return;

    setBreakGlassActive(true);
    setBreakGlassModal(false);

    appStore.recordDoctorLockerAccess({
      patientId: activeConsultPatient.id,
      doctorId: currentDoctor.id,
      doctorName: currentDoctor.name,
      hospitalId: currentDoctor.hospitalId,
      hospitalName: currentDoctor.hospitalName,
      purpose: 'EMERGENCY BREAK-GLASS CLINICAL ACCESS',
      accessType: 'emergency_break_glass',
      reason: breakGlassReason,
    });
  };

  const handleCallNext = () => {
    appStore.callNextPatient(currentDoctor.id);
    setSearchedPatient(null);
    setSelectedPatientId(null);
    setBreakGlassActive(false);
  };

  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        name: '',
        dose: '',
        frequency: 'Once daily',
        duration: '7 days',
        instructions: 'After meals',
      },
    ]);
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMedicineChange = (idx: number, field: keyof PrescriptionMedicine, val: string) => {
    setMedicines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const toggleLabTest = (testName: string) => {
    setSelectedLabTests((prev) =>
      prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName]
    );
  };

  const handleSaveConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConsultPatient) return;

    const validMeds = medicines.filter((m) => m.name.trim() !== '');

    appStore.savePrescription({
      patientId: activeConsultPatient.id,
      patientName: activeConsultPatient.name,
      uniquePatientId: activeConsultPatient.uniquePatientId,
      doctorId: currentDoctor.id,
      doctorName: currentDoctor.name,
      doctorSpecialty: currentDoctor.specialization,
      hospitalName: currentDoctor.hospitalName,
      date: new Date().toISOString().split('T')[0],
      diagnosis: consultDiagnosis || 'Clinical Assessment Completed',
      symptoms: consultSymptoms || 'Evaluated during consultation',
      medicines: validMeds,
      labTestsOrdered: selectedLabTests,
      followUpDate: consultFollowUp,
      notes: consultNotes,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const patientReports = activeConsultPatient
    ? appState.reports.filter((r) => r.patientId === activeConsultPatient.id)
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hospital Admin Approval Status Banner */}
      {(currentDoctor.approvalStatus === 'pending' || currentUser?.approvalStatus === 'pending') && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-bold text-sm">Account Status: Pending Hospital Admin Approval</div>
            <p className="leading-relaxed text-amber-800">
              Your physician credentials ({currentDoctor.specialization}, Room {currentDoctor.roomNumber}) have been submitted to <strong>{currentDoctor.hospitalName}</strong>. You may review the clinical station, but active consultation caller status will activate once verified by the Facility Administrator.
            </p>
          </div>
        </div>
      )}

      {/* 0. INBOUND AMBULANCES & FLEET MAP */}
      {activePage === 'ambulances' && (
        <AmbulanceFleetMap
          appState={appState}
          onRequestSOS={onOpenEmergency}
        />
      )}

      {/* 1. DOCTOR DASHBOARD */}
      {activePage === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {currentDoctor.name} • Clinical Command
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentDoctor.specialization} • Room {currentDoctor.roomNumber} • {currentDoctor.hospitalName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenEmergency}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Broadcast Immediate Emergency SOS"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>One-Tap SOS</span>
              </button>

              <button
                onClick={handleCallNext}
                disabled={waitingTokens.length === 0}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  waitingTokens.length > 0
                    ? 'bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Call Next Patient</span>
                {waitingTokens.length > 0 && (
                  <span className="bg-white/20 text-white text-[11px] px-1.5 py-0.2 rounded font-mono">
                    {waitingTokens[0].tokenNumber}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Stat Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigate('today-queue')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Waiting in Queue</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700">{waitingTokens.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Estimated 12m each</div>
            </div>

            <div
              onClick={() => onNavigate('today-queue')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>In Room</span>
                <Activity className="w-4 h-4 text-[#0E7C7B]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#0E7C7B]">
                {inConsultToken ? inConsultToken.patientName : 'None'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {inConsultToken ? `Token #${inConsultToken.tokenNumber}` : 'Room vacant'}
              </div>
            </div>

            <div
              onClick={() => onNavigate('patients')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Completed Today</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{doneTokens.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Prescriptions archived</div>
            </div>

            <div
              onClick={() => onNavigate('prescriptions')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Total Roster</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{doctorQueue.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Scheduled consultations</div>
            </div>
          </div>

          {/* Quick Actions & Queue Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Next in Line</h3>
                <button
                  onClick={() => onNavigate('today-queue')}
                  className="text-xs text-[#0E7C7B] font-semibold hover:underline"
                >
                  Full Board
                </button>
              </div>

              <div className="divide-y divide-[#E3E8EB]">
                {waitingTokens.slice(0, 4).map((tok) => (
                  <div key={tok.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {tok.tokenNumber}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900">{tok.patientName}</div>
                        <div className="text-[10px] text-slate-400">{tok.reason}</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">Est: {tok.estimatedWaitMinutes}m</span>
                  </div>
                ))}
                {waitingTokens.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-xs">All patients attended to.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Search Patient ID</h3>
              </div>
              <p className="text-xs text-slate-500">
                Inspect medical locker records, blood group, and verified allergies before writing a prescription.
              </p>
              <form onSubmit={handleSearchPatient} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Unique Patient ID (e.g. PT00234)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0E7C7B] text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                >
                  Search
                </button>
              </form>
              {searchError && <p className="text-[11px] text-[#D32F2F] font-semibold">{searchError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 2. TODAY'S QUEUE */}
      {activePage === 'today-queue' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E8EB]">
            <div>
              <h2 className="text-base font-bold text-slate-900">Today's Patient Queue Board</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {waitingTokens.length} waiting • {inConsultToken ? '1 in consultation' : '0 in room'} • {doneTokens.length} completed
              </p>
            </div>
            <button
              onClick={handleCallNext}
              disabled={waitingTokens.length === 0}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                waitingTokens.length > 0
                  ? 'bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Call Next Patient</span>
            </button>
          </div>

          {/* Queue Filter Tabs */}
          <div className="flex border-b border-[#E3E8EB] bg-[#F4F7F8] text-xs font-semibold">
            {(
              [
                { id: 'all', label: 'All Patients', count: doctorQueue.length },
                { id: 'waiting', label: 'Waiting', count: waitingTokens.length },
                { id: 'in_consultation', label: 'In Room', count: inConsultToken ? 1 : 0 },
                { id: 'done', label: 'Completed', count: doneTokens.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setQueueTab(tab.id)}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  queueTab === tab.id
                    ? 'border-[#0E7C7B] text-[#0E7C7B] bg-white font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 font-mono">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="divide-y divide-[#E3E8EB]">
            {filteredQueue.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 p-2 rounded"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-teal-50 border border-teal-200 text-[#0E7C7B] font-mono font-bold flex items-center justify-center text-sm shrink-0">
                    {item.tokenNumber}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{item.patientName}</div>
                    <div className="text-[11px] text-slate-500">{item.reason}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      item.status === 'in_consultation'
                        ? 'bg-teal-100 text-teal-800'
                        : item.status === 'waiting'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPatientId(item.patientId);
                      onNavigate('prescriptions');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-[#0E7C7B] text-white hover:bg-[#0c6b6a] cursor-pointer"
                  >
                    Consult
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PATIENTS (Search by Patient ID) */}
      {activePage === 'patients' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Patient Directory & Medical Locker Inspection</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Search by Unique Patient ID to verify consent and review allergies before consultations.
            </p>
          </div>

          <form onSubmit={handleSearchPatient} className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Enter ID (e.g. PT00234)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0E7C7B] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Inspect Locker
            </button>
          </form>

          {searchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  <strong>Access Blocked:</strong> {searchError}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchError('');
                  setSearchBlocked(false);
                  setSearchQuery('');
                }}
                className="text-red-700 underline hover:text-red-900 cursor-pointer text-[11px] font-semibold"
              >
                Clear
              </button>
            </div>
          )}

          {activeConsultPatient && !searchBlocked && (
            <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-4">
              {activeConsultPatient.allergies.length > 0 && (
                <div className="p-3 bg-red-50 border border-[#D32F2F] rounded-lg text-xs text-[#D32F2F] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#D32F2F] shrink-0" />
                  <div>
                    <strong>ALLERGY WARNING:</strong> {activeConsultPatient.allergies.join(', ')}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E3E8EB]">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {activeConsultPatient.name} ({activeConsultPatient.uniquePatientId})
                  </div>
                  <div className="text-xs text-slate-500">
                    Age: {activeConsultPatient.age} • Gender: {activeConsultPatient.gender} • Blood: <strong className="text-slate-800">{activeConsultPatient.bloodGroup}</strong>
                  </div>
                </div>

                {hasConsent ? (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                    <Unlock className="w-3.5 h-3.5" /> Record Authorized
                  </span>
                ) : (
                  <button
                    onClick={() => setBreakGlassModal(true)}
                    className="px-2.5 py-1 bg-red-50 text-[#D32F2F] border border-red-200 rounded text-xs font-semibold cursor-pointer"
                  >
                    Break-Glass Override
                  </button>
                )}
              </div>

              {/* Diagnostic Files List */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Authorized Diagnostic Files ({patientReports.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {patientReports.map((rep) => (
                    <div key={rep.id} className="p-2.5 rounded bg-white border border-[#E3E8EB] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-semibold text-slate-900">{rep.title}</div>
                          <div className="text-[10px] text-slate-400">{rep.date} • {rep.category}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewReport(rep)}
                        className="text-[11px] text-[#0E7C7B] hover:text-[#0c6b6a] font-semibold cursor-pointer underline"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. APPOINTMENTS */}
      {activePage === 'appointments' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Consultation Calendar & Booked OPD Slots</h2>
            <p className="text-xs text-slate-500 mt-0.5">Roster of today's patient visits for Dr. {currentDoctor.name}</p>
          </div>

          <div className="divide-y divide-[#E3E8EB]">
            {doctorQueue.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{item.patientName} (Token #{item.tokenNumber})</div>
                  <div className="text-slate-500 text-[11px]">{item.reason} • Department: {item.department}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPatientId(item.patientId);
                    onNavigate('prescriptions');
                  }}
                  className="px-3 py-1 bg-[#0E7C7B] text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Open Prescription
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. PRESCRIPTIONS (Consultation Screen) */}
      {activePage === 'prescriptions' && (
        <form onSubmit={handleSaveConsultation} className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3E8EB]">
            <div>
              <h2 className="text-base font-bold text-slate-900">Clinical Consultation & Rx Builder</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Patient: <strong>{activeConsultPatient?.name || 'Sarah Chen'}</strong> ({activeConsultPatient?.uniquePatientId || 'PT00234'})
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-semibold">
                ✓ Prescription Saved to Locker
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Symptoms & Clinical Presentation</label>
              <textarea
                rows={2}
                value={consultSymptoms}
                onChange={(e) => setConsultSymptoms(e.target.value)}
                placeholder="e.g. Mild shortness of breath, nocturnal wheezing..."
                className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Diagnosis</label>
              <textarea
                rows={2}
                value={consultDiagnosis}
                onChange={(e) => setConsultDiagnosis(e.target.value)}
                placeholder="e.g. Moderate Bronchial Asthma Exacerbation..."
                className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>
          </div>

          {/* Medicines Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Prescribed Medicines</label>
              <button
                type="button"
                onClick={handleAddMedicine}
                className="text-xs text-[#0E7C7B] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Drug
              </button>
            </div>

            <div className="border border-[#E3E8EB] rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Drug Name</th>
                    <th className="py-2 px-3">Dose</th>
                    <th className="py-2 px-3">Frequency</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Instructions</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8EB]">
                  {medicines.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none font-semibold text-slate-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={m.dose}
                          onChange={(e) => handleMedicineChange(idx, 'dose', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none text-slate-700"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={m.frequency}
                          onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none text-slate-700"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={m.duration}
                          onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none text-slate-700"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={m.instructions}
                          onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] focus:outline-none text-slate-700"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicine(idx)}
                            className="text-slate-400 hover:text-[#D32F2F]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
            >
              Sign & Save Prescription to Patient Locker
            </button>
          </div>
        </form>
      )}

      {/* 6. DOCTOR SCHEDULE */}
      {activePage === 'doctor-schedule' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">OPD Clinical Hours & Duty Schedule</h2>
            <p className="text-xs text-slate-500 mt-0.5">Assigned shift roster and on-call availability</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <div className="font-bold text-slate-900 text-sm">Morning OPD Shift</div>
              <div className="text-slate-500 mt-0.5">09:00 AM - 01:00 PM (Monday to Friday)</div>
              <div className="text-emerald-700 font-semibold mt-2">Active Duty • Room 4</div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <div className="font-bold text-slate-900 text-sm">Evening Specialty Rounds</div>
              <div className="text-slate-500 mt-0.5">04:30 PM - 07:00 PM (Tuesday, Thursday)</div>
              <div className="text-slate-600 mt-2">ICU & Cardiology Ward Visits</div>
            </div>
          </div>
        </div>
      )}

      {/* 7. CALENDAR */}
      {activePage === 'calendar' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Clinical Master Calendar</h2>
            <p className="text-xs text-slate-500 mt-0.5">Conferences, rounds, surgical suites, and OPD consultations</p>
          </div>
          <div className="p-8 text-center text-slate-400 text-xs">
            Calendar view synced with hospital administration desk.
          </div>
        </div>
      )}

      {/* 8. REPORTS */}
      {activePage === 'reports' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Pathology & Radiology Sign-offs</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pending lab tests ordered for hospital patients</p>
          </div>
          <div className="divide-y divide-[#E3E8EB] text-xs">
            {appState.labOrders.map((lab) => (
              <div key={lab.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{lab.testName}</div>
                  <div className="text-slate-500 text-[11px]">Patient: {lab.patientName} • Ordered: {lab.orderedAt.split('T')[0]}</div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {lab.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. HELP CENTER */}
      {activePage === 'help-center' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4 max-w-2xl mx-auto text-xs">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Doctor Clinical Support & Guidelines</h2>
            <p className="text-slate-500 mt-0.5">Emergency break-glass legal protocol and drug formulary guidelines</p>
          </div>

          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[#D32F2F]">
            <div className="font-bold">Emergency Break-Glass Legal Protocol</div>
            <div className="mt-0.5">
              Break-glass clinical access is reserved strictly for life-threatening emergencies where patient consent cannot be obtained. Every override is permanently written to the statutory audit ledger and reported to the patient's registered emergency contacts.
            </div>
          </div>
        </div>
      )}

      {/* Break Glass Modal */}
      {breakGlassModal && activeConsultPatient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] max-w-md w-full p-5 space-y-4 shadow-lg text-xs">
            <h3 className="text-sm font-bold text-slate-900">Confirm Emergency Break-Glass Override</h3>
            <p className="text-slate-500">
              Access will be permanently logged under Dr. {currentDoctor.name}.
            </p>
            <form onSubmit={handleBreakGlassConfirm} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinical Emergency Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="e.g. Unresponsive casualty in resuscitation trauma bay..."
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBreakGlassModal(false)}
                  className="px-3 py-1.5 rounded border border-[#E3E8EB] text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-[#D32F2F] text-white font-semibold cursor-pointer"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diagnostic Report Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E3E8EB] max-w-lg w-full p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-start justify-between border-b border-[#E3E8EB] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0E7C7B] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {previewReport.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{previewReport.title}</h3>
                <p className="text-[11px] text-slate-500">
                  Date: {previewReport.date} • {previewReport.hospitalName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-[#F4F7F8] p-3.5 rounded-lg border border-[#E3E8EB]">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Reporting Clinician
                </span>
                <div className="font-semibold text-slate-800">{previewReport.doctorName}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Clinical Findings
                </span>
                <p className="text-slate-700 leading-relaxed text-xs">
                  {previewReport.findings || previewReport.summary || 'Normal physiological limits documented.'}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Summary & Impression
                </span>
                <p className="text-slate-700 leading-relaxed text-xs">
                  {previewReport.summary}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E8EB]">
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#E3E8EB] text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
