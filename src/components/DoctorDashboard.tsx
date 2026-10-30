import React, { useState } from 'react';
import {
  Stethoscope,
  Search,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Pill,
  Plus,
  Trash2,
  Clock,
  User,
  FileText,
  Calendar,
  ShieldAlert,
  Check,
  Building2,
  Activity,
  Heart,
  Droplet,
  FolderHeart,
  ExternalLink,
} from 'lucide-react';
import { AppState, appStore, validatePatientIdFormat } from '../services/store';
import { Doctor, PatientProfile, PrescriptionMedicine, QueueToken } from '../types';
import { Language, translations } from '../i18n/translations';

interface DoctorDashboardProps {
  appState: AppState;
  lang: Language;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ appState, lang }) => {
  const t = translations[lang];

  // Active Doctor
  const currentDoctor: Doctor =
    appState.doctors.find((d) => d.id === appState.currentUserId) || appState.doctors[0];

  // Queue filter tab: All | Waiting | In consultation | Completed
  const [queueTab, setQueueTab] = useState<'all' | 'waiting' | 'in_consultation' | 'done'>('all');

  // Search by Unique Patient ID
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPatient, setSearchedPatient] = useState<PatientProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [breakGlassModal, setBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassActive, setBreakGlassActive] = useState(false);

  // Selected patient manual override
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Consultation Builder State
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

  // Doctor's live queue tokens
  const doctorQueue = appState.queueTokens.filter((q) => q.doctorId === currentDoctor.id && q.status !== 'cancelled');
  const inConsultToken = doctorQueue.find((q) => q.status === 'in_consultation');
  const waitingTokens = doctorQueue.filter((q) => q.status === 'waiting');
  const doneTokens = doctorQueue.filter((q) => q.status === 'done');

  // Filtered queue tokens
  const filteredQueue = doctorQueue.filter((item) => {
    if (queueTab === 'all') return true;
    return item.status === queueTab;
  });

  // Determine currently viewed patient
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

  // Consent validation
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

      const isAuthorized =
        appState.consentRules.some(
          (c) => c.patientId === found.id && c.doctorId === currentDoctor.id && c.status === 'active'
        ) || doctorQueue.some((q) => q.patientId === found.id);

      if (isAuthorized) {
        appStore.recordDoctorLockerAccess({
          patientId: found.id,
          doctorId: currentDoctor.id,
          doctorName: currentDoctor.name,
          hospitalId: currentDoctor.hospitalId,
          hospitalName: currentDoctor.hospitalName,
          purpose: 'Clinical Locker Examination & Queue Verification',
          accessType: 'routine',
        });
      }
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

  const patientPrescriptions = activeConsultPatient
    ? appState.prescriptions.filter((p) => p.patientId === activeConsultPatient.id)
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Station Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Doctor Station & Consultation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentDoctor.name} • {currentDoctor.specialization} • Room {currentDoctor.roomNumber} • {currentDoctor.hospitalName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCallNext}
            disabled={waitingTokens.length === 0}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              waitingTokens.length > 0
                ? 'bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white shadow-sm'
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

      {/* Main 2-Column Clinical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Today's Queue & Patient Search */}
        <div className="lg:col-span-5 space-y-5">
          {/* Patient Lookup Card */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Search Patient Record
            </h2>
            <form onSubmit={handleSearchPatient} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Enter ID (e.g. PT00234) or Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-medium rounded-lg transition-colors"
              >
                Lookup
              </button>
            </form>
            {searchError && (
              <p className="text-[11px] text-[#D32F2F] mt-2 font-medium">{searchError}</p>
            )}
          </div>

          {/* Today's Queue Card */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden">
            <div className="p-4 border-b border-[#E3E8EB] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Today's Patient Queue</h2>
                <p className="text-xs text-slate-500">
                  {waitingTokens.length} waiting • {inConsultToken ? '1 in room' : '0 in room'} • {doneTokens.length} completed
                </p>
              </div>
            </div>

            {/* Queue Filter Tabs */}
            <div className="flex border-b border-[#E3E8EB] bg-[#F4F7F8] text-xs font-medium">
              {(
                [
                  { id: 'all', label: 'All', count: doctorQueue.length },
                  { id: 'waiting', label: 'Waiting', count: waitingTokens.length },
                  { id: 'in_consultation', label: 'In Room', count: inConsultToken ? 1 : 0 },
                  { id: 'done', label: 'Completed', count: doneTokens.length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setQueueTab(tab.id)}
                  className={`flex-1 py-2.5 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                    queueTab === tab.id
                      ? 'border-[#0E7C7B] text-[#0E7C7B] bg-white font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      queueTab === tab.id
                        ? 'bg-teal-50 text-[#0E7C7B]'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Queue List */}
            <div className="divide-y divide-[#E3E8EB] max-h-[520px] overflow-y-auto">
              {filteredQueue.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No patients in this queue category.
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const patient = appState.patients.find((p) => p.id === item.patientId);
                  const isSelected = activeConsultPatient?.id === item.patientId;
                  const isConsulting = item.status === 'in_consultation';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedPatientId(item.patientId);
                        setSearchedPatient(null);
                        setBreakGlassActive(false);
                      }}
                      className={`p-3.5 flex items-start justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/60 border-l-4 border-l-[#0E7C7B]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                            isConsulting
                              ? 'bg-teal-600 text-white'
                              : item.status === 'waiting'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-500 border border-[#E3E8EB]'
                          }`}
                        >
                          {item.tokenNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.patientName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {patient?.uniquePatientId || 'PT-????'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>
                              Time:{' '}
                              {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>•</span>
                            <span>Est: {item.estimatedWaitMinutes} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            item.status === 'in_consultation'
                              ? 'bg-teal-100 text-teal-800'
                              : item.status === 'waiting'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'done'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Selected Patient Details & Consultation Form */}
        <div className="lg:col-span-7 space-y-5">
          {activeConsultPatient ? (
            <>
              {/* Highlighted ALLERGY Warning Banner */}
              {activeConsultPatient.allergies.length > 0 && (
                <div className="bg-red-50 border border-[#D32F2F] rounded-lg p-3.5 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#D32F2F] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-[#D32F2F] uppercase tracking-wider">
                      Critical Allergy Warning
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {activeConsultPatient.allergies.map((allergy, i) => (
                        <span
                          key={i}
                          className="bg-red-100 text-[#D32F2F] text-xs font-semibold px-2 py-0.5 rounded border border-red-200"
                        >
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Profile & Consent Banner */}
              <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E8EB]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {activeConsultPatient.name}
                      </h2>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold border border-[#E3E8EB]">
                        {activeConsultPatient.uniquePatientId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeConsultPatient.age} yrs • {activeConsultPatient.gender} • Blood Group:{' '}
                      <strong className="text-slate-800">{activeConsultPatient.bloodGroup}</strong> • Phone:{' '}
                      {activeConsultPatient.phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasConsent ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Record Authorized</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setBreakGlassModal(true)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#D32F2F] bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Break-Glass Access</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-1">
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">BP</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">120/80</div>
                    <div className="text-[10px] text-slate-400">mmHg</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pulse</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">74</div>
                    <div className="text-[10px] text-slate-400">bpm</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">SpO2</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">99%</div>
                    <div className="text-[10px] text-slate-400">Room air</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Temp</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">98.4°F</div>
                    <div className="text-[10px] text-slate-400">Oral</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Weight</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">64 kg</div>
                    <div className="text-[10px] text-slate-400">BMI 22.1</div>
                  </div>
                </div>

                {/* Chronic Conditions & Current Medicines */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">
                      Chronic Conditions
                    </span>
                    {activeConsultPatient.chronicConditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {activeConsultPatient.chronicConditions.map((cond, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-[#E3E8EB] text-slate-700 px-2 py-0.5 rounded text-[11px]"
                          >
                            {cond}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">None reported</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded bg-[#F4F7F8] border border-[#E3E8EB]">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">
                      Current Medications
                    </span>
                    {activeConsultPatient.currentMedicines.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {activeConsultPatient.currentMedicines.map((med, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-[#E3E8EB] text-slate-700 px-2 py-0.5 rounded text-[11px]"
                          >
                            {typeof med === 'string' ? med : `${med.name} ${med.dosage ? `(${med.dosage})` : ''}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">No active medication</span>
                    )}
                  </div>
                </div>

                {/* Past Diagnostic Reports & Locker Records */}
                {patientReports.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E3E8EB]">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">
                      Authorized Medical Locker Reports ({patientReports.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {patientReports.map((rep) => (
                        <div
                          key={rep.id}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-[#E3E8EB] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="truncate">
                              <div className="font-semibold text-slate-800 truncate">{rep.title}</div>
                              <div className="text-[10px] text-slate-400">{rep.date} • {rep.category}</div>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#0E7C7B] font-medium shrink-0 cursor-pointer hover:underline">
                            View
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Consultation & Prescription Form */}
              <form
                onSubmit={handleSaveConsultation}
                className="bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                  <h3 className="text-sm font-bold text-slate-900">
                    Clinical Evaluation & Prescription Builder
                  </h3>
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Prescription Saved & History Updated
                    </span>
                  )}
                </div>

                {/* Symptoms & Diagnosis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Presented Symptoms & Observations
                    </label>
                    <textarea
                      rows={2}
                      value={consultSymptoms}
                      onChange={(e) => setConsultSymptoms(e.target.value)}
                      placeholder="e.g. Mild shortness of breath, nocturnal wheezing for 5 days"
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Clinical Diagnosis
                    </label>
                    <textarea
                      rows={2}
                      value={consultDiagnosis}
                      onChange={(e) => setConsultDiagnosis(e.target.value)}
                      placeholder="e.g. Moderate Bronchial Asthma Exacerbation"
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                {/* Prescription Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Prescription Medicines
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMedicine}
                      className="inline-flex items-center gap-1 text-xs text-[#0E7C7B] hover:text-[#0c6b6a] font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  <div className="border border-[#E3E8EB] rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                          <th className="py-2 px-3">Medicine Name</th>
                          <th className="py-2 px-3">Dosage</th>
                          <th className="py-2 px-3">Frequency</th>
                          <th className="py-2 px-3">Duration</th>
                          <th className="py-2 px-3">Instructions</th>
                          <th className="py-2 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E8EB]">
                        {medicines.map((med, idx) => (
                          <tr key={idx} className="bg-white hover:bg-slate-50">
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="e.g. Paracetamol"
                                value={med.name}
                                onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] py-1 text-xs text-slate-800 focus:outline-none font-medium"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="500 mg"
                                value={med.dose}
                                onChange={(e) => handleMedicineChange(idx, 'dose', e.target.value)}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] py-1 text-xs text-slate-800 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="TID"
                                value={med.frequency}
                                onChange={(e) =>
                                  handleMedicineChange(idx, 'frequency', e.target.value)
                                }
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] py-1 text-xs text-slate-800 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="5 days"
                                value={med.duration}
                                onChange={(e) =>
                                  handleMedicineChange(idx, 'duration', e.target.value)
                                }
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] py-1 text-xs text-slate-800 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                placeholder="After meals"
                                value={med.instructions}
                                onChange={(e) =>
                                  handleMedicineChange(idx, 'instructions', e.target.value)
                                }
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-[#0E7C7B] py-1 text-xs text-slate-800 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {medicines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedicine(idx)}
                                  className="text-slate-400 hover:text-[#D32F2F] p-1"
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

                {/* Diagnostic Orders & Follow-Up Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Diagnostic Laboratory Orders
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Complete Blood Count',
                        'Serum Electrolytes',
                        'Chest X-Ray (PA View)',
                        'HbA1c',
                        'Lipid Panel',
                      ].map((test) => {
                        const isChecked = selectedLabTests.includes(test);
                        return (
                          <button
                            type="button"
                            key={test}
                            onClick={() => toggleLabTest(test)}
                            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                              isChecked
                                ? 'bg-teal-50 border-[#0E7C7B] text-[#0E7C7B] font-medium'
                                : 'bg-[#F4F7F8] border-[#E3E8EB] text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}
                            {test}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Recommended Follow-Up Date
                    </label>
                    <input
                      type="date"
                      value={consultFollowUp}
                      onChange={(e) => setConsultFollowUp(e.target.value)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                {/* Additional Clinical Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor Advice & Notes
                  </label>
                  <input
                    type="text"
                    value={consultNotes}
                    onChange={(e) => setConsultNotes(e.target.value)}
                    placeholder="e.g. Avoid cold drinks; report immediately if shortness of breath recurs."
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E3E8EB]">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    Save Prescription & Update Locker
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-12 text-center text-slate-500">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Patient Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select a patient from today's queue on the left or search by Unique Patient ID to inspect locker and build consultation notes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Break-Glass Modal */}
      {breakGlassModal && activeConsultPatient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] max-w-md w-full p-5 space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[#D32F2F] shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Emergency Break-Glass Override
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overriding consent will be permanently audited and notified to the patient in real time.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-[#E3E8EB] text-xs">
              <span className="font-semibold text-slate-700">Patient:</span>{' '}
              {activeConsultPatient.name} ({activeConsultPatient.uniquePatientId})
            </div>

            <form onSubmit={handleBreakGlassConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Emergency Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="e.g. Patient unresponsive in emergency resuscitation unit; vital locker history required."
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#D32F2F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBreakGlassModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#E3E8EB] text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-semibold"
                >
                  Confirm Break-Glass Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
