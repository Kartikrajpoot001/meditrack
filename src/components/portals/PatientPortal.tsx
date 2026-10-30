import React, { useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  FolderHeart,
  Pill,
  Clock,
  ShieldAlert,
  CreditCard,
  HelpCircle,
  Copy,
  Check,
  QrCode,
  Upload,
  Plus,
  Phone,
  FileText,
  AlertTriangle,
  User,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Lock,
  Unlock,
  Building2,
  CheckCircle2,
  Search,
  Star,
  MapPin,
  Activity,
  AlertCircle,
  Circle,
  Stethoscope,
  Info,
  ShoppingBag,
  ChevronRight,
  RefreshCw,
  Flame,
  Sun,
  Sunrise,
  Moon,
  X,
  Sparkles,
} from 'lucide-react';
import { AppState, appStore, calculatePeopleAhead } from '../../services/store';
import { AuthUser } from '../../services/auth';
import {
  PatientProfile,
  MedicalReport,
  QueueToken,
  CurrentMedicine,
  DoseSlot,
  DoseStatus,
  DoseLog,
  MedicationAdherenceStats,
  DayAdherenceRecord,
} from '../../types';
import { PatientAnatomyView } from '../3d/PatientAnatomyView';
import { PatientPaymentsPage } from '../patient/PatientPaymentsPage';
import { PharmacyReorderModal } from '../pharmacy/PharmacyReorderModal';
import { AmbulanceFleetMap } from '../ambulance/AmbulanceFleetMap';
import { QRCodeSVG } from 'qrcode.react';
import { openRazorpayCheckout } from '../../services/razorpay';

interface PatientPortalProps {
  appState: AppState;
  currentUser: AuthUser | null;
  activePage: string;
  onNavigate: (pageId: string) => void;
  onOpenEmergency: () => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  appState,
  currentUser,
  activePage,
  onNavigate,
  onOpenEmergency,
}) => {
  // Current patient profile from state - strictly isolated to logged-in user
  const patient = appState.patients.find(
    (p) =>
      p.id === currentUser?.uid ||
      (currentUser?.customId && p.uniquePatientId.toUpperCase() === currentUser.customId.toUpperCase())
  );

  // Safe fallback for hook initialization if patient record is not found
  const safePatient: PatientProfile = patient || {
    id: '',
    name: '',
    age: 0,
    gender: 'Other',
    bloodGroup: 'O+',
    phone: '',
    email: '',
    uniquePatientId: '',
    allergies: [],
    chronicConditions: [],
    currentMedicines: [],
    vaccinations: [],
    emergencyContacts: [],
  };

  // UI helpers
  const [copiedId, setCopiedId] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reorderingMed, setReorderingMed] = useState<{
    name: string;
    dosage?: string;
    currentStock?: number;
  } | null>(null);

  // Toast / feedback message
  const [actionSuccessToast, setActionSuccessToast] = useState('');

  // Daily Medicine Tracking & Adherence State
  const [adherenceRange, setAdherenceRange] = useState<'7days' | '30days'>('7days');
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<{
    date: string;
    formattedDate: string;
    doses: {
      medicineName: string;
      slot: DoseSlot;
      status: DoseStatus;
      markedAt?: string;
    }[];
  } | null>(null);
  const [showAddManualMedModal, setShowAddManualMedModal] = useState(false);
  const [manualMedName, setManualMedName] = useState('');
  const [manualMedDosage, setManualMedDosage] = useState('');
  const [manualMedFrequency, setManualMedFrequency] = useState('Once daily');
  const [manualMedSlots, setManualMedSlots] = useState<DoseSlot[]>(['Morning']);
  const [manualMedDuration, setManualMedDuration] = useState('30');
  const [manualMedInstructions, setManualMedInstructions] = useState('Take with water after food');

  // Cancel & Reschedule Modals
  const [cancelModalToken, setCancelModalToken] = useState<QueueToken | null>(null);
  const [rescheduleModalToken, setRescheduleModalToken] = useState<QueueToken | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState('10:45 AM');
  const [rescheduleError, setRescheduleError] = useState('');

  // New report form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState<MedicalReport['category']>('Blood Test');
  const [reportDoctor, setReportDoctor] = useState('Dr. Aris Vance, MD');
  const [reportHospital, setReportHospital] = useState('City Metro General Hospital');
  const [reportSummary, setReportSummary] = useState('');

  // -------------------------------------------------------------
  // A) Step-by-Step Book Appointment State (4-Step Wizard)
  // -------------------------------------------------------------
  const [bookStep, setBookStep] = useState<1 | 2 | 3 | 4>(1);
  const [searchHospQuery, setSearchHospQuery] = useState('');
  const [selectedHospId, setSelectedHospId] = useState<string>(appState.hospitals[0]?.id || 'hosp-1');
  const [selectedDept, setSelectedDept] = useState<string>('Cardiology');
  const [selectedDocId, setSelectedDocId] = useState<string>(
    appState.doctors.find((d) => d.hospitalId === (appState.hospitals[0]?.id || 'hosp-1'))?.id ||
      appState.doctors[0]?.id ||
      'doc-1'
  );
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('10:45 AM');
  const [bookReason, setBookReason] = useState('Routine consultation & check-up');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Editable patient details in Step 4 (auto-filled from profile)
  const [formName, setFormName] = useState(safePatient.name);
  const [formAge, setFormAge] = useState(safePatient.age ? safePatient.age.toString() : '28');
  const [formGender, setFormGender] = useState(safePatient.gender || 'Female');
  const [formBloodGroup, setFormBloodGroup] = useState(safePatient.bloodGroup || 'O+');
  const [formAllergies, setFormAllergies] = useState((safePatient.allergies || []).join(', '));
  const [formPhone, setFormPhone] = useState(safePatient.phone || '');
  const [formUniqueId, setFormUniqueId] = useState(safePatient.uniquePatientId || '');
  const [shareRecordsConsent, setShareRecordsConsent] = useState(true);
  const [bookedReceiptToken, setBookedReceiptToken] = useState<QueueToken | null>(null);
  const [bookingPaymentChoice, setBookingPaymentChoice] = useState<'upi' | 'razorpay' | 'pay_at_hospital'>('upi');
  const [bookingUtr, setBookingUtr] = useState('');
  const [bookingUtrError, setBookingUtrError] = useState('');

  const upiId = (import.meta as any).env?.VITE_UPI_ID || 'meditrack@icici';
  const upiName = (import.meta as any).env?.VITE_UPI_NAME || 'MediTrack Healthcare';

  // Sync state if safePatient updates
  React.useEffect(() => {
    if (patient) {
      setFormName(patient.name);
      setFormAge(patient.age ? patient.age.toString() : '28');
      setFormGender(patient.gender);
      setFormBloodGroup(patient.bloodGroup);
      setFormAllergies((patient.allergies || []).join(', '));
      setFormPhone(patient.phone);
      setFormUniqueId(patient.uniquePatientId);
    }
  }, [patient]);

  // Queue tokens & calculations
  const patientReports = (appState.reports || []).filter((r) => r.patientId === safePatient.id);
  const patientTokens = (appState.queueTokens || []).filter((q) => q.patientId === safePatient.id);
  const activeToken =
    patientTokens.find((q) => q.status === 'in_consultation' || q.status === 'waiting') ||
    patientTokens[0];

  // People ahead calculation
  const peopleAhead = activeToken ? calculatePeopleAhead(activeToken, appState.queueTokens) : 0;
  const estWaitMinutes = peopleAhead * 8;

  const baseDate = new Date();
  const estTimeDate = new Date(baseDate.getTime() + estWaitMinutes * 60000);
  const reachTimeDate = new Date(estTimeDate.getTime() - 10 * 60000);

  const formattedEstTime = estTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedReachTime = reachTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const totalQueueSize = Math.max(peopleAhead + 1, 6);
  const peopleProcessed = Math.max(0, totalQueueSize - peopleAhead);
  const queueProgressPercent = Math.min(100, Math.round((peopleProcessed / totalQueueSize) * 100));

  const accessLogs = (appState.accessLogs || []).filter((l) => l.patientId === safePatient.id);
  const consentRules = (appState.consentRules || []).filter((c) => c.patientId === safePatient.id);

  // -------------------------------------------------------------
  // C) Visual Medications & Dose Tracking Helpers
  // -------------------------------------------------------------
  const simulatedDate = appStore.getSimulatedDate();
  const adherenceStats = appStore.getPatientAdherence(safePatient.id);
  const activeMedicines = safePatient.currentMedicines.filter((m) => m.status !== 'completed');

  // Calculate scheduled doses for today
  const allScheduledDoses: {
    medicine: CurrentMedicine;
    medIndex: number;
    slot: DoseSlot;
    timeStr: string;
    isTaken: boolean;
    status: DoseStatus;
    markedAt?: string;
  }[] = [];

  activeMedicines.forEach((med, mIdx) => {
    const slots = med.timeSlots || ['Morning'];
    slots.forEach((slot) => {
      const timeStr = slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM';
      const doseLog = med.doseHistory?.[simulatedDate]?.[slot];
      const isTaken = doseLog ? (doseLog.status === 'Taken' || doseLog.status === 'Taken late') : !!med.takenToday?.[slot];
      const status: DoseStatus = doseLog?.status || (isTaken ? 'Taken' : 'Pending');
      allScheduledDoses.push({
        medicine: med,
        medIndex: mIdx,
        slot,
        timeStr,
        isTaken,
        status,
        markedAt: doseLog?.markedAt,
      });
    });
  });

  const totalDosesCount = allScheduledDoses.length;
  const takenDosesCount = allScheduledDoses.filter((d) => d.isTaken).length;
  const doseCompletionPercent = totalDosesCount > 0 ? Math.round((takenDosesCount / totalDosesCount) * 100) : 0;

  const handleMarkDose = (
    medIdOrName: string,
    slot: DoseSlot,
    status: 'Taken' | 'Skipped'
  ) => {
    const res = appStore.markPatientDose(safePatient.id, medIdOrName, slot, status);
    if (res.success) {
      setActionSuccessToast(`Dose marked: ${res.message}`);
      setTimeout(() => setActionSuccessToast(''), 3000);
    }
  };

  const handleToggleDose = (
    medName: string,
    slot: DoseSlot,
    status: 'taken' | 'skipped'
  ) => {
    handleMarkDose(medName, slot, status === 'taken' ? 'Taken' : 'Skipped');
  };

  const handleSimulateNextDay = () => {
    const res = appStore.simulateNextDay();
    setActionSuccessToast(
      `🧪 Next Day Simulated! Advanced to ${res.newDate}. ${res.missedCount > 0 ? `${res.missedCount} unconfirmed doses saved as Missed.` : 'All scheduled doses were completed!'}`
    );
    setTimeout(() => setActionSuccessToast(''), 4500);
  };

  const handleAddManualMedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMedName.trim() || manualMedSlots.length === 0) return;
    appStore.addPatientMedicine(safePatient.id, {
      name: manualMedName.trim(),
      dosage: manualMedDosage.trim() || '1 Dose',
      frequency: manualMedFrequency,
      timeSlots: manualMedSlots,
      durationDays: parseInt(manualMedDuration, 10) || 30,
      instructions: manualMedInstructions.trim(),
    });
    setShowAddManualMedModal(false);
    setManualMedName('');
    setManualMedDosage('');
    setActionSuccessToast(`Added ${manualMedName} to your daily schedule!`);
    setTimeout(() => setActionSuccessToast(''), 3500);
  };

  const copyPatientId = () => {
    navigator.clipboard?.writeText(safePatient.uniquePatientId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUploadReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle) return;

    appStore.uploadMedicalReport({
      patientId: safePatient.id,
      title: reportTitle,
      category: reportCategory,
      date: new Date().toISOString().split('T')[0],
      doctorName: reportDoctor,
      hospitalName: reportHospital,
      fileUrl:
        'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
      fileType: 'pdf',
      summary: reportSummary || 'Clinically verified laboratory diagnostic panel.',
    });

    setReportTitle('');
    setReportSummary('');
    setShowUploadModal(false);
  };

  // Step 4 final confirmation handler
  // Step 4 final confirmation handler
  const handleFinalConfirmAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingUtrError('');

    if (!formName.trim()) {
      setBookingError('Please enter your full name');
      return;
    }
    if (!formPhone.trim()) {
      setBookingError('Please enter a valid contact phone number');
      return;
    }
    if (!bookReason.trim()) {
      setBookingError('Please enter the reason for your consultation visit');
      return;
    }

    if (bookingPaymentChoice === 'upi') {
      if (!bookingUtr || !/^\d{12}$/.test(bookingUtr.trim())) {
        setBookingUtrError('Please enter a valid 12-digit numeric UPI Transaction Reference (UTR).');
        return;
      }
    }

    setBookingLoading(true);

    try {
      const selectedDoc = appState.doctors.find((d) => d.id === selectedDocId);
      const allergiesArray = formAllergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const fee = selectedDoc?.consultationFee || 500;

      if (bookingPaymentChoice === 'upi') {
        const newToken = appStore.bookAppointment({
          patientId: safePatient.id,
          patientName: formName.trim(),
          uniquePatientId: formUniqueId || safePatient.uniquePatientId,
          doctorId: selectedDocId,
          hospitalId: selectedHospId,
          department: selectedDept,
          reason: bookReason.trim(),
          shareRecordsConsent: shareRecordsConsent,
          appointmentDate: selectedDate,
          timeSlot: selectedTimeSlot,
          fee: fee,
          paymentChoice: 'upi',
          utr: bookingUtr.trim(),
          patientDetails: {
            name: formName.trim(),
            age: parseInt(formAge, 10) || safePatient.age || 25,
            gender: formGender,
            bloodGroup: formBloodGroup,
            allergies: allergiesArray,
            phone: formPhone.trim(),
          },
        });

        setBookedReceiptToken(newToken);
        setActionSuccessToast('UPI Reference submitted! Your slot is held for 30 minutes while hospital staff verifies payment.');
        setTimeout(() => setActionSuccessToast(''), 6000);
      } else if (bookingPaymentChoice === 'pay_at_hospital') {
        const newToken = appStore.bookAppointment({
          patientId: safePatient.id,
          patientName: formName.trim(),
          uniquePatientId: formUniqueId || safePatient.uniquePatientId,
          doctorId: selectedDocId,
          hospitalId: selectedHospId,
          department: selectedDept,
          reason: bookReason.trim(),
          shareRecordsConsent: shareRecordsConsent,
          appointmentDate: selectedDate,
          timeSlot: selectedTimeSlot,
          fee: fee,
          paymentChoice: 'pay_at_hospital',
          patientDetails: {
            name: formName.trim(),
            age: parseInt(formAge, 10) || safePatient.age || 25,
            gender: formGender,
            bloodGroup: formBloodGroup,
            allergies: allergiesArray,
            phone: formPhone.trim(),
          },
        });

        setBookedReceiptToken(newToken);
        setActionSuccessToast('Appointment confirmed! Please pay consultation fee at the hospital reception desk.');
        setTimeout(() => setActionSuccessToast(''), 5000);
      } else {
        // Razorpay online flow: Hold slot and launch real server-verified checkout
        const pendingToken = appStore.bookAppointment({
          patientId: safePatient.id,
          patientName: formName.trim(),
          uniquePatientId: formUniqueId || safePatient.uniquePatientId,
          doctorId: selectedDocId,
          hospitalId: selectedHospId,
          department: selectedDept,
          reason: bookReason.trim(),
          shareRecordsConsent: shareRecordsConsent,
          appointmentDate: selectedDate,
          timeSlot: selectedTimeSlot,
          fee: fee,
          isPendingPayment: true,
          paymentChoice: 'razorpay',
          patientDetails: {
            name: formName.trim(),
            age: parseInt(formAge, 10) || safePatient.age || 25,
            gender: formGender,
            bloodGroup: formBloodGroup,
            allergies: allergiesArray,
            phone: formPhone.trim(),
          },
        });

        const bill = appStore.getState().bills.find(
          (b) => b.tokenId === pendingToken.id || b.appointmentId === pendingToken.id
        );

        if (!bill) {
          throw new Error('Billing record could not be generated for online checkout.');
        }

        openRazorpayCheckout({
          billId: bill.id,
          amountInRupees: fee,
          description: `OPD Consultation: ${selectedDept} with ${selectedDoc?.name || 'Physician'}`,
          patientName: formName.trim(),
          patientEmail: safePatient.email,
          patientPhone: formPhone.trim(),
          onSuccess: (paymentResult) => {
            const res = appStore.confirmAppointmentPayment(pendingToken.id, paymentResult.razorpay_payment_id, 'Razorpay');
            setBookedReceiptToken(res.token);
            setActionSuccessToast('Payment verified successfully! Your appointment token is active.');
            setTimeout(() => setActionSuccessToast(''), 5000);
          },
          onFailure: (err) => {
            setBookingError('Payment failed or cancelled: ' + (err?.message || err));
          },
        });
      }
    } catch (err: any) {
      setBookingError(err.message || 'Failed to book appointment. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointmentConfirm = () => {
    if (!cancelModalToken) return;
    try {
      appStore.cancelAppointment(cancelModalToken.id);
      setActionSuccessToast(`Appointment #${cancelModalToken.tokenNumber} has been cancelled.`);
      setCancelModalToken(null);
      setTimeout(() => setActionSuccessToast(''), 5000);
    } catch (err: any) {
      setActionSuccessToast(err.message || 'Failed to cancel appointment');
    }
  };

  const handleRescheduleAppointmentConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalToken) return;
    setRescheduleError('');

    try {
      appStore.rescheduleAppointment(rescheduleModalToken.id, rescheduleDate, rescheduleSlot);
      setActionSuccessToast(`Appointment rescheduled to ${rescheduleDate} at ${rescheduleSlot}.`);
      setRescheduleModalToken(null);
      setTimeout(() => setActionSuccessToast(''), 5000);
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment');
    }
  };

  const toggleConsent = (ruleId: string, doctorId: string, currentStatus: string) => {
    if (currentStatus === 'active') {
      appStore.revokeConsent(safePatient.id, doctorId);
    } else {
      appStore.grantConsent(safePatient.id, doctorId);
    }
  };

  // Filtered hospitals for Step 1
  const filteredHospitals = appState.hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchHospQuery.toLowerCase()) ||
      h.specialties.some((s) => s.toLowerCase().includes(searchHospQuery.toLowerCase())) ||
      h.address.toLowerCase().includes(searchHospQuery.toLowerCase())
  );

  // Selected hospital and available doctors for Step 2
  const currentSelectedHospital =
    appState.hospitals.find((h) => h.id === selectedHospId) || appState.hospitals[0];

  const availableDepts = currentSelectedHospital?.specialties || [
    'Cardiology',
    'Orthopedics',
    'General Medicine',
    'Pulmonology',
  ];

  const doctorsInSelectedHosp = appState.doctors.filter((d) => {
    const matchesHosp = d.hospitalId === selectedHospId;
    if (!matchesHosp) return false;
    if (!selectedDept) return true;
    return (
      d.specialization.toLowerCase().includes(selectedDept.toLowerCase()) ||
      (d.department && d.department.toLowerCase().includes(selectedDept.toLowerCase())) ||
      selectedDept === 'General Medicine'
    );
  });

  // Time slots for Step 3
  const timeSlots = [
    { time: '09:30 AM', period: 'Morning', status: 'Available' },
    { time: '10:15 AM', period: 'Morning', status: 'Available' },
    { time: '10:45 AM', period: 'Morning', status: 'Fast Track' },
    { time: '11:30 AM', period: 'Morning', status: 'Available' },
    { time: '02:00 PM', period: 'Afternoon', status: 'Available' },
    { time: '02:45 PM', period: 'Afternoon', status: 'Available' },
    { time: '03:30 PM', period: 'Afternoon', status: 'Filling Fast' },
    { time: '04:15 PM', period: 'Evening', status: 'Available' },
  ];

  // Helper for pill visual shapes
  const renderPillShapeIcon = (shape?: 'round' | 'capsule' | 'oval', color: string = '#0E7C7B') => {
    if (shape === 'capsule') {
      return (
        <div
          className="w-5 h-2.5 rounded-full border border-current shrink-0 flex overflow-hidden"
          style={{ color }}
        >
          <div className="w-1/2 h-full bg-current opacity-80" />
          <div className="w-1/2 h-full bg-current opacity-20" />
        </div>
      );
    }
    if (shape === 'round') {
      return (
        <div
          className="w-4 h-4 rounded-full border-2 border-current shrink-0 flex items-center justify-center"
          style={{ color }}
        >
          <div className="w-full h-0.5 bg-current opacity-60" />
        </div>
      );
    }
    return (
      <div
        className="w-5 h-3 rounded-md border-2 border-current shrink-0 flex items-center justify-center"
        style={{ color }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      </div>
    );
  };

  // Strict Patient ID isolation: Only allow access if verified logged-in patient record exists
  if (!patient) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-xl border border-red-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-xs text-red-600 font-semibold">
          No patient found with this ID
        </p>
        <p className="text-xs text-slate-500">
          The Patient portal can only open the logged-in patient&apos;s own verified record. Please return to the gateway and log in with your valid Patient ID.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-4 py-2 bg-[#0E7C7B] text-white text-xs font-semibold rounded-lg hover:bg-[#0c6b6a] cursor-pointer transition-colors"
        >
          Return to Gateway
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 0. AMBULANCE FLEET & LIVE MAP FOR PATIENTS */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'ambulances' && (
        <AmbulanceFleetMap
          appState={appState}
          onRequestSOS={onOpenEmergency}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. DASHBOARD PAGE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'dashboard' && (
        <div className="space-y-6">
          {/* Greeting Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E8EB]">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back, {patient.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                MediTrack DigiLocker • Unique ID:{' '}
                <strong className="text-slate-800 font-mono">{patient.uniquePatientId}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenEmergency}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Immediate One-Tap SOS Emergency Broadcast"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
                <span>One-Tap SOS</span>
              </button>

              <button
                onClick={copyPatientId}
                className="px-3 py-1.5 rounded-lg border border-[#E3E8EB] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedId ? 'Copied' : 'Share ID'}</span>
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Show QR</span>
              </button>
            </div>
          </div>

          {/* SUMMARY TILES */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigate('emergency-card')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Blood & Allergies</span>
                <ShieldAlert className="w-4 h-4 text-[#D32F2F]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{patient.bloodGroup}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {patient.allergies.length > 0
                  ? `${patient.allergies.length} Critical Allergies`
                  : 'No known allergies'}
              </div>
            </div>

            <div
              onClick={() => onNavigate('queue-token')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Live Token</span>
                <Clock className="w-4 h-4 text-[#0E7C7B]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#0E7C7B] font-mono">
                {activeToken ? `#${activeToken.tokenNumber}` : 'None'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {activeToken ? `${peopleAhead} people ahead` : 'No active queue'}
              </div>
            </div>

            <div
              onClick={() => onNavigate('records')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Medical Locker</span>
                <FolderHeart className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{patientReports.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Verified lab & radiology files</div>
            </div>

            <div
              onClick={() => onNavigate('medications')}
              className="bg-white rounded-lg border border-[#E3E8EB] p-4 cursor-pointer hover:border-[#0E7C7B] transition-colors relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Active Meds</span>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-black">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />
                  <span>{adherenceStats.currentStreak}d streak</span>
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 flex items-baseline justify-between">
                <span>{activeMedicines.length}</span>
                <span className="text-xs font-semibold text-emerald-700 font-mono">
                  {adherenceStats.adherenceRate7Days}% adherence
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                <span>{takenDosesCount}/{totalDosesCount} doses taken today</span>
                {adherenceStats.missedMessage && (
                  <span className="text-[10px] text-red-600 font-bold">⚠️ Missed dose</span>
                )}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* B) PROMINENT "NEXT APPOINTMENT" CARD ON DASHBOARD */}
          {/* ------------------------------------------------------------- */}
          {activeToken ? (
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E8EB]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-[#0E7C7B] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Next Appointment</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B] border border-teal-200">
                        Live OPD Queue
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeToken.doctorName} • {activeToken.roomNumber} •{' '}
                      {appState.hospitals.find((h) => h.id === activeToken.hospitalId)?.name ||
                        'City Metro General Hospital'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onNavigate('queue-token')}
                    className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Full Live Tracker</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Exact user requirement texts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Assigned Token</span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Active
                    </span>
                  </div>

                  {/* 1. "Token #C-04, Active" */}
                  <div className="text-2xl font-black font-mono text-slate-900">
                    Token #{activeToken.tokenNumber}, Active
                  </div>

                  {/* 2. "Your turn comes after X people" */}
                  <div className="text-xs font-medium text-slate-700">
                    {activeToken.status === 'in_consultation' ? (
                      <span className="font-bold text-teal-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#0E7C7B]" />
                        It is your turn! Please enter {activeToken.roomNumber}.
                      </span>
                    ) : peopleAhead === 0 ? (
                      <span className="font-bold text-teal-700">
                        You are next in line. Please be right outside {activeToken.roomNumber}.
                      </span>
                    ) : (
                      <span>
                        Your turn comes after{' '}
                        <strong className="text-slate-900 font-bold">{peopleAhead}</strong>{' '}
                        {peopleAhead === 1 ? 'person' : 'people'}
                      </span>
                    )}
                  </div>

                  {/* Progress bar of people ahead */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Queue Progress</span>
                      <span className="font-mono font-semibold">
                        {peopleAhead === 0
                          ? 'In Consultation'
                          : `${peopleAhead} ahead`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#0E7C7B] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${queueProgressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 font-medium">Estimated Timetable</div>

                    {/* 3. "Estimated time: 10:45 AM (about 40 min)" */}
                    <div className="text-sm font-bold text-slate-900">
                      Estimated time: {formattedEstTime} (about {estWaitMinutes} min)
                    </div>

                    {/* 4. "Please reach the cabin by 10:35 AM" */}
                    <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-[#0E7C7B] font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Please reach the cabin by {formattedReachTime}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1">
                    Calculated automatically from average consultation duration of 8 min.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Need to see a doctor today?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Book an OPD slot in real time to lock your cabin wait queue token.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('book-appointment')}
                  className="px-3.5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Book Appointment</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* C) VISUAL MEDICATIONS CARD ON DASHBOARD */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E8EB]">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-[#0E7C7B]" />
                <h3 className="text-sm font-bold text-slate-900">Today&apos;s Daily Medications</h3>
              </div>
              <button
                onClick={() => onNavigate('medications')}
                className="text-xs text-[#0E7C7B] font-semibold hover:underline"
              >
                View Full Pill Schedule →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
              {/* Circular SVG Progress Ring */}
              <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#E3E8EB"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#0E7C7B"
                      strokeWidth="5"
                      strokeDasharray={163.36}
                      strokeDashoffset={163.36 - (163.36 * doseCompletionPercent) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold font-mono text-slate-900">
                    {doseCompletionPercent}%
                  </span>
                </div>

                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-slate-900">Today&apos;s Doses</div>
                  <div className="text-slate-500">
                    {takenDosesCount} of {totalDosesCount} doses taken
                  </div>
                  <div className="text-[10px] text-teal-700 font-medium">
                    {doseCompletionPercent === 100
                      ? 'All doses taken!'
                      : `${totalDosesCount - takenDosesCount} pending today`}
                  </div>
                </div>
              </div>

              {/* Medication Snapshot Pills */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {patient.currentMedicines.slice(0, 4).map((med, idx) => {
                  const isLowStock = (med.daysLeft || 30) <= 5;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {renderPillShapeIcon(med.shape, med.color || '#0E7C7B')}
                        <div>
                          <div className="font-bold text-slate-900 truncate max-w-[150px]">
                            {med.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {med.dosage} • {med.frequency}
                          </div>
                        </div>
                      </div>

                      {isLowStock ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                          Refill ({med.daysLeft}d)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">
                          {med.daysLeft || 18}d left
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Reports and Doctor Access Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E8EB]">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Medical Locker Files
                </h3>
                <button
                  onClick={() => onNavigate('records')}
                  className="text-xs text-[#0E7C7B] font-semibold hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-[#E3E8EB]">
                {patientReports.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">{r.title}</div>
                        <div className="text-[10px] text-slate-400">
                          {r.date} • {r.doctorName}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {r.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E8EB]">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Doctor Locker Access Audit Log
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Real-time audited</span>
              </div>

              <div className="divide-y divide-[#E3E8EB]">
                {accessLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{log.doctorName}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {log.hospitalName} • {log.purpose}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Toast */}
      {actionSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. APPOINTMENTS PAGE WITH CANCEL & RESCHEDULE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'appointments' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E8EB]">
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Consultations & Appointments</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time appointment schedule with OPD cabin status, reschedule & cancellation management
              </p>
            </div>
            <button
              onClick={() => {
                setBookedReceiptToken(null);
                setBookStep(1);
                onNavigate('book-appointment');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Book New Appointment</span>
            </button>
          </div>

          <div className="divide-y divide-[#E3E8EB]">
            {patientTokens.map((tok) => {
              const ahead = calculatePeopleAhead(tok, appState.queueTokens);
              const isCancelled = tok.status === 'cancelled';
              const isCompleted = tok.status === 'done';
              const canModify = !isCancelled && !isCompleted;

              return (
                <div
                  key={tok.id}
                  className={`py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                    isCancelled ? 'opacity-60 bg-slate-50/50 p-3 rounded-lg' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-lg border font-mono font-bold flex flex-col items-center justify-center text-xs shrink-0 ${
                        isCancelled
                          ? 'bg-slate-100 border-slate-300 text-slate-400'
                          : 'bg-teal-50 border-teal-200 text-[#0E7C7B]'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-sans">Token</span>
                      <span className="text-sm font-black leading-none">#{tok.tokenNumber}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{tok.doctorName}</span>
                        {tok.appointmentId && (
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {tok.appointmentId}
                          </span>
                        )}
                      </div>

                      <div className="text-slate-600 text-xs flex flex-wrap items-center gap-2">
                        <span>{tok.department}</span>
                        <span>•</span>
                        <span>Room {tok.roomNumber}</span>
                        <span>•</span>
                        <span className="text-slate-500">
                          {appState.hospitals.find((h) => h.id === tok.hospitalId)?.name || 'City Metro General Hospital'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 font-mono font-semibold text-slate-700">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{tok.appointmentDate || 'Today'}</span>
                          <span>{tok.timeSlot ? `• ${tok.timeSlot}` : ''}</span>
                        </span>
                        <span>OPD Fee: ₹{tok.fee || 500}</span>
                        {tok.reason && (
                          <span className="text-slate-400 italic">
                            &quot;{tok.reason}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isCancelled
                          ? 'bg-red-100 text-red-800'
                          : tok.status === 'in_consultation'
                          ? 'bg-teal-100 text-teal-800'
                          : tok.status === 'waiting'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tok.status.replace('_', ' ')}
                    </span>

                    {!isCancelled && (
                      <button
                        onClick={() => onNavigate('queue-token')}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-[#E3E8EB] hover:bg-slate-50 text-slate-700 cursor-pointer"
                      >
                        Queue ({ahead} ahead)
                      </button>
                    )}

                    {canModify && (
                      <>
                        <button
                          onClick={() => {
                            setRescheduleModalToken(tok);
                            setRescheduleDate(tok.appointmentDate || todayStr);
                            setRescheduleSlot(tok.timeSlot || '10:45 AM');
                            setRescheduleError('');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 cursor-pointer transition-colors"
                        >
                          Reschedule
                        </button>

                        <button
                          onClick={() => setCancelModalToken(tok)}
                          className="px-2.5 py-1 text-xs font-semibold rounded border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {patientTokens.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No appointments scheduled</p>
                <p className="text-slate-400">
                  You haven&apos;t booked any doctor consultations yet. Use our 4-step wizard to book an OPD slot.
                </p>
                <button
                  onClick={() => {
                    setBookedReceiptToken(null);
                    setBookStep(1);
                    onNavigate('book-appointment');
                  }}
                  className="mt-2 px-4 py-2 bg-[#0E7C7B] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#0c6b6a] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Your First Appointment</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. A) BOOK APPOINTMENT PAGE (CLEAN 4-STEP WIZARD) */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'book-appointment' && (
        <div className="space-y-6">
          {/* Header & Progress Bar */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Book Outpatient Consultation</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clean 4-step appointment booking wizard with real-time slot and queue allocation
                </p>
              </div>

              {/* Step indicator badges */}
              <div className="flex items-center gap-1.5 text-xs">
                {[
                  { step: 1, label: 'Hospital' },
                  { step: 2, label: 'Doctor' },
                  { step: 3, label: 'Date & Slot' },
                  { step: 4, label: 'Confirm' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      bookStep === s.step
                        ? 'bg-[#0E7C7B] text-white shadow-xs'
                        : bookStep > s.step
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span>{s.step}.</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-[#0E7C7B] h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(bookStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* SUCCESS SCREEN */}
          {bookedReceiptToken && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      Appointment Confirmed & Token Generated!
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Your booking has been registered and broadcast to the doctor&apos;s queue and hospital operations.
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Token Number</div>
                  <span className="font-mono text-2xl font-black text-emerald-900 bg-white px-3 py-1 rounded border border-emerald-300 inline-block mt-0.5">
                    #{bookedReceiptToken.tokenNumber}
                  </span>
                </div>
              </div>

              {/* Appointment ID, Token, People Ahead, Estimated Time */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-4 rounded-lg border border-emerald-200 shadow-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Appointment ID</span>
                  <span className="font-semibold text-slate-800 font-mono text-xs">
                    {bookedReceiptToken.appointmentId || bookedReceiptToken.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Doctor & Cabin</span>
                  <span className="font-semibold text-slate-800">
                    {bookedReceiptToken.doctorName} (Room {bookedReceiptToken.roomNumber})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">People Ahead</span>
                  <span className="font-semibold text-teal-800 font-mono text-sm">
                    {calculatePeopleAhead(bookedReceiptToken, appState.queueTokens)} people ahead
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimated Time</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {bookedReceiptToken.timeSlot || '10:45 AM'} ({bookedReceiptToken.appointmentDate || 'Today'})
                  </span>
                </div>
              </div>

              {/* Payment Status Notice */}
              {bookedReceiptToken.paymentStatus === 'pending_verification' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Pending Hospital Verification • 30-Minute Slot Hold</div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Your UTR has been submitted to the hospital finance desk. Your slot is guaranteed and held for 30 minutes. Once approved, you will receive an instant notification.
                    </p>
                  </div>
                </div>
              )}
              {bookedReceiptToken.paymentStatus === 'pay_at_hospital' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Pay consultation fee of ₹{bookedReceiptToken.fee || 500} at the hospital desk upon arrival.</span>
                </div>
              )}
              {bookedReceiptToken.paymentStatus === 'paid' && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Payment Confirmed (₹{bookedReceiptToken.fee || 500}) • Queue token is active and ready for OPD check-in.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigate('appointments')}
                  className="px-4 py-2 bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>View in My Appointments</span>
                </button>
                <button
                  onClick={() => onNavigate('queue-token')}
                  className="px-4 py-2 bg-white border border-teal-300 text-teal-800 hover:bg-teal-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Track Live Queue Token</span>
                </button>
                <button
                  onClick={() => {
                    setBookedReceiptToken(null);
                    setBookStep(1);
                  }}
                  className="px-4 py-2 bg-white border border-[#E3E8EB] text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer ml-auto"
                >
                  Book Another Appointment
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: CHOOSE A HOSPITAL */}
          {!bookedReceiptToken && bookStep === 1 && (
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Step 1: Select Hospital</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Search and pick a certified hospital based on distance, specialty rating, and facilities.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchHospQuery}
                    onChange={(e) => setSearchHospQuery(e.target.value)}
                    placeholder="Search hospital or specialty..."
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {filteredHospitals.map((h, i) => {
                  const isSelected = selectedHospId === h.id;
                  const distanceKm = i === 0 ? '1.4 km' : i === 1 ? '3.2 km' : i === 2 ? '5.8 km' : '7.4 km';
                  return (
                    <div
                      key={h.id}
                      onClick={() => setSelectedHospId(h.id)}
                      className={`p-4 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0E7C7B] bg-teal-50/40 ring-1 ring-[#0E7C7B]'
                          : 'border-[#E3E8EB] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{h.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-semibold">
                              {h.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{h.address}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                            <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                            <span>{h.rating}</span>
                          </span>
                          <span className="block text-[11px] font-mono text-slate-500 mt-1">
                            {distanceKm}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {h.specialties.map((spec, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#E3E8EB] flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {h.beds ? h.beds.generalTotal - h.beds.generalOccupied : 20} OPD beds active
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHospId(h.id);
                            setBookStep(2);
                          }}
                          className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#0E7C7B] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>Select Hospital</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Back / Next Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E3E8EB]">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="px-3.5 py-2 rounded-lg border border-[#E3E8EB] text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedHospId}
                  onClick={() => setBookStep(2)}
                  className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span>Next: Choose Doctor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE DEPARTMENT & DOCTOR */}
          {!bookedReceiptToken && bookStep === 2 && (
            <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 2: Choose Department & Doctor
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selected Hospital: <strong>{currentSelectedHospital?.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setBookStep(1)}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Change Hospital</span>
                </button>
              </div>

              {/* Department Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Department
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableDepts.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDept(dept)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        selectedDept === dept
                          ? 'bg-[#0E7C7B] text-white shadow-xs'
                          : 'bg-[#F4F7F8] text-slate-700 border border-[#E3E8EB] hover:bg-slate-100'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doctor Cards */}
              <div className="space-y-2.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">Available Doctors</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {doctorsInSelectedHosp.map((doc) => {
                    const isSelected = selectedDocId === doc.id;
                    const waitingCount = appState.queueTokens.filter(
                      (q) => q.doctorId === doc.id && q.status === 'waiting'
                    ).length;
                    const docFee = doc.consultationFee || 500;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`p-4 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0E7C7B] bg-teal-50/40 ring-1 ring-[#0E7C7B]'
                            : 'border-[#E3E8EB] bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 text-[#0E7C7B] flex items-center justify-center font-bold shrink-0">
                              <Stethoscope className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {doc.specialization}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                <strong>{doc.experienceYears} years</strong> clinical experience • Room{' '}
                                <strong className="text-slate-700">{doc.roomNumber}</strong>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              doc.status === 'in_consultation'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {doc.status === 'in_consultation' ? 'Cabin Active' : 'Available'}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[#E3E8EB] flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Live Queue: {waitingCount} patients</span>
                          <span className="font-mono text-[#0E7C7B] font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Fee: ₹{docFee}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Back / Next Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E3E8EB]">
                <button
                  type="button"
                  onClick={() => setBookStep(1)}
                  className="px-4 py-2 rounded-lg border border-[#E3E8EB] text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Hospitals</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedDocId}
                  onClick={() => setBookStep(3)}
                  className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span>Next: Choose Date & Slot</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CHOOSE DATE AND TIME SLOT */}
          {!bookedReceiptToken && bookStep === 3 && (() => {
            const selectedDoc = appState.doctors.find((d) => d.id === selectedDocId);

            // Check if doctor is on leave or holiday on selected date
            const doctorLeaveOrHoliday = appState.doctorCalendarEvents.find(
              (ev) =>
                (ev.doctorId === 'all' || ev.doctorId === selectedDocId) &&
                (ev.type === 'holiday' || ev.type === 'leave') &&
                ev.date === selectedDate
            );

            // Check already booked slots for this doctor on selected date
            const bookedSlots = appState.queueTokens
              .filter(
                (q) =>
                  q.status !== 'cancelled' &&
                  q.doctorId === selectedDocId &&
                  q.appointmentDate === selectedDate
              )
              .map((q) => q.timeSlot);

            return (
              <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Step 3: Choose Date & Available Slot
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Doctor: <strong>{selectedDoc?.name}</strong> • Room {selectedDoc?.roomNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => setBookStep(2)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Change Doctor</span>
                  </button>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Select Date</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Today', date: todayStr },
                      { label: 'Tomorrow', date: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
                      { label: '+2 Days', date: new Date(Date.now() + 172800000).toISOString().split('T')[0] },
                      { label: '+3 Days', date: new Date(Date.now() + 259200000).toISOString().split('T')[0] },
                    ].map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setSelectedDate(d.date)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          selectedDate === d.date
                            ? 'bg-[#0E7C7B] text-white shadow-xs'
                            : 'bg-[#F4F7F8] border border-[#E3E8EB] text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d.label} ({d.date.slice(5)})
                      </button>
                    ))}
                  </div>

                  <div className="max-w-xs pt-1">
                    <input
                      type="date"
                      min={todayStr}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                {/* Doctor Holiday or Leave Warning */}
                {doctorLeaveOrHoliday && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900">
                        Doctor Unavailable on this date: {doctorLeaveOrHoliday.title}
                      </p>
                      <p className="text-[11px] text-red-700 mt-0.5">
                        {doctorLeaveOrHoliday.type === 'holiday'
                          ? 'Public hospital holiday observed. Outpatient clinics are closed.'
                          : `Dr. ${selectedDoc?.name} is on scheduled leave. Booking is disabled for this day.`}
                        {' '}Please select another date above.
                      </p>
                    </div>
                  </div>
                )}

                {/* Time Slots Grid */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Available Time Slots for {selectedDate}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Booked slots are disabled to prevent double-booking
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {timeSlots.map((s, idx) => {
                      const isBooked = bookedSlots.includes(s.time);
                      const isSelected = selectedTimeSlot === s.time;
                      const isDisabled = !!doctorLeaveOrHoliday || isBooked;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedTimeSlot(s.time)}
                          className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                            isDisabled
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'border-[#0E7C7B] bg-teal-50 ring-1 ring-[#0E7C7B] text-slate-900 cursor-pointer'
                              : 'border-[#E3E8EB] bg-white hover:bg-slate-50 cursor-pointer text-slate-800'
                          }`}
                        >
                          <div className="font-mono font-bold text-sm">{s.time}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{s.period}</div>
                          <span
                            className={`inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              isBooked
                                ? 'bg-red-100 text-red-700'
                                : s.status === 'Fast Track'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isBooked ? 'Booked' : s.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Back / Next Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E3E8EB]">
                  <button
                    type="button"
                    onClick={() => setBookStep(2)}
                    className="px-4 py-2 rounded-lg border border-[#E3E8EB] text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Doctor</span>
                  </button>
                  <button
                    type="button"
                    disabled={!!doctorLeaveOrHoliday || !selectedTimeSlot || bookedSlots.includes(selectedTimeSlot)}
                    onClick={() => setBookStep(4)}
                    className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <span>Next: Review & Confirm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: CONFIRMATION & PROFILE AUTO-FILL */}
          {!bookedReceiptToken && bookStep === 4 && (() => {
            const selectedDoc = appState.doctors.find((d) => d.id === selectedDocId);
            const fee = selectedDoc?.consultationFee || 500;

            return (
              <form
                onSubmit={handleFinalConfirmAppointment}
                className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E3E8EB]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Step 4: Confirm Details & Patient Consent
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Auto-filled from your verified health profile. Review details and digital consent before confirming.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookStep(3)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Slots</span>
                  </button>
                </div>

                {/* Validation Error Banner */}
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Summary Banner */}
                <div className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Hospital</span>
                    <span className="font-semibold text-slate-800">{currentSelectedHospital?.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Attending Doctor</span>
                    <span className="font-semibold text-slate-800">
                      {selectedDoc?.name} (Room {selectedDoc?.roomNumber})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Department</span>
                    <span className="font-semibold text-slate-800">{selectedDept}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Date & Time</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {selectedDate} • {selectedTimeSlot}
                    </span>
                  </div>
                </div>

                {/* Auto-filled & Editable Form Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Patient Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Age *</label>
                    <input
                      type="number"
                      required
                      value={formAge}
                      onChange={(e) => setFormAge(e.target.value)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value as any)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                    <select
                      value={formBloodGroup}
                      onChange={(e) => setFormBloodGroup(e.target.value as any)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:border-[#0E7C7B]"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Unique Patient ID
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formUniqueId}
                      className="w-full bg-slate-100 border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-600 font-mono font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Known Drug & Food Allergies
                  </label>
                  <input
                    type="text"
                    value={formAllergies}
                    onChange={(e) => setFormAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, Peanuts (leave blank if none)"
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reason for Visit / Chief Complaint *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={bookReason}
                    onChange={(e) => setBookReason(e.target.value)}
                    placeholder="Describe your current symptoms or reason for visit..."
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                {/* Consent Toggle */}
                <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consentToggle"
                    checked={shareRecordsConsent}
                    onChange={(e) => setShareRecordsConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#0E7C7B] rounded border-teal-300 focus:ring-[#0E7C7B] cursor-pointer"
                  />
                  <label htmlFor="consentToggle" className="text-xs cursor-pointer select-none">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0E7C7B]" />
                      <span>Share my medical records with this hospital</span>
                    </div>
                    <p className="text-slate-600 mt-0.5 text-[11px]">
                      Grants temporary digital consent for the attending physician to view your
                      DigiLocker diagnostic reports and prescription history during this consultation.
                    </p>
                  </label>
                </div>

                {/* Fee Summary Card */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span>Consultation Fee Breakdown</span>
                    <span className="text-[10px] text-slate-500 font-normal">OPD Schedule</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Doctor Consultation Fee</span>
                    <span className="font-mono">₹{fee}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Facility & Queue Token Registration</span>
                    <span className="font-mono text-emerald-700 font-semibold">FREE (₹0)</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                    <span>Total Payable</span>
                    <span className="font-mono text-[#0E7C7B]">₹{fee}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-bold text-slate-900">
                    Select Payment Method *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBookingPaymentChoice('upi')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        bookingPaymentChoice === 'upi'
                          ? 'border-[#0E7C7B] bg-teal-50/60 ring-1 ring-[#0E7C7B]'
                          : 'border-[#E3E8EB] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Manual UPI</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          0% Fee
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Scan QR code or open UPI App & submit 12-digit UTR
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookingPaymentChoice('razorpay')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        bookingPaymentChoice === 'razorpay'
                          ? 'border-[#0E7C7B] bg-teal-50/60 ring-1 ring-[#0E7C7B]'
                          : 'border-[#E3E8EB] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Razorpay Online</span>
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Cards, NetBanking, Gateways with server-side validation
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookingPaymentChoice('pay_at_hospital')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        bookingPaymentChoice === 'pay_at_hospital'
                          ? 'border-[#0E7C7B] bg-teal-50/60 ring-1 ring-[#0E7C7B]'
                          : 'border-[#E3E8EB] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Pay at Counter</span>
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Cash or POS at hospital reception before consultation
                      </p>
                    </button>
                  </div>

                  {/* Manual UPI Flow Details */}
                  {bookingPaymentChoice === 'upi' && (() => {
                    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
                      upiName
                    )}&am=${fee}&cu=INR&tn=${encodeURIComponent(
                      'Consultation ' + (safePatient.uniquePatientId || 'Token')
                    )}`;

                    return (
                      <div className="p-4 rounded-lg bg-teal-50/70 border border-teal-200 space-y-4 text-xs">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="bg-white p-2.5 rounded-lg border border-teal-200 shadow-xs shrink-0">
                            <QRCodeSVG value={upiUri} size={130} level="M" />
                            <div className="text-[10px] text-center text-slate-500 mt-1 font-mono">
                              Scan with any UPI App
                            </div>
                          </div>

                          <div className="space-y-2 flex-1 w-full">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-500 block">Payee Name</span>
                                <span className="font-semibold text-slate-900">{upiName}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">UPI ID (VPA)</span>
                                <span className="font-mono font-bold text-[#0E7C7B]">{upiId}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Payable Amount</span>
                                <span className="font-mono font-bold text-slate-900">₹{fee}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Verification Window</span>
                                <span className="font-semibold text-amber-700">30-min slot hold</span>
                              </div>
                            </div>

                            {/* Mobile Deep Link */}
                            <div className="pt-1">
                              <a
                                href={upiUri}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0E7C7B] text-white font-semibold text-xs hover:bg-[#0c6b6a] cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Pay with UPI App (GPay / PhonePe / Paytm)</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* UTR Input Section */}
                        <div className="space-y-1.5 pt-2 border-t border-teal-200">
                          <label className="block font-bold text-slate-900 text-xs">
                            Enter 12-Digit UPI Transaction Reference (UTR) *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={12}
                            value={bookingUtr}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 12);
                              setBookingUtr(cleaned);
                              setBookingUtrError('');
                            }}
                            placeholder="e.g. 518293847291 (12 digits from your receipt)"
                            className="w-full bg-white border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-900 font-mono font-bold tracking-wider text-xs focus:outline-none focus:border-[#0E7C7B]"
                          />
                          {bookingUtrError && (
                            <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{bookingUtrError}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500">
                            Check the completed payment screen in your UPI app for the 12-digit UTR/UPI Ref ID. Once entered, hospital administration will verify and confirm your consultation queue token.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {bookingPaymentChoice === 'razorpay' && (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-600">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#0E7C7B]" />
                        <span>Instant Gateway Authorization</span>
                      </div>
                      <p className="text-[11px]">
                        The ₹{fee} consultation fee is loaded directly from server-side records. Upon successful payment verification, your queue token is activated immediately.
                      </p>
                    </div>
                  )}

                  {bookingPaymentChoice === 'pay_at_hospital' && (
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1 text-amber-900">
                      <div className="font-semibold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-amber-700" />
                        <span>Pay at Hospital Desk</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Please arrive 15 minutes before your scheduled slot ({selectedTimeSlot}) to pay at the registration counter.
                      </p>
                    </div>
                  )}
                </div>

                {/* Back / Submit Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setBookStep(3)}
                    className="px-4 py-2 rounded-lg border border-[#E3E8EB] text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Slots</span>
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="px-5 py-2.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] disabled:bg-slate-400 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    {bookingLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Confirming Appointment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Appointment & Generate Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            );
          })()}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MEDICAL RECORDS (DigiLocker) PAGE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'records' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Medical Locker & Diagnostic Files</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived clinical reports accessible only with your explicit digital consent.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Report</span>
            </button>
          </div>

          <div className="bg-white rounded-lg border border-[#E3E8EB] overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F7F8] border-b border-[#E3E8EB] text-slate-600 font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Report Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Attending Doctor</th>
                  <th className="py-2.5 px-4">Facility</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8EB]">
                {patientReports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{r.title}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{r.category}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{r.date}</td>
                    <td className="py-2.5 px-4 text-slate-700">{r.doctorName}</td>
                    <td className="py-2.5 px-4 text-slate-500">{r.hospitalName}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedReport(r)}
                        className="text-[#0E7C7B] hover:underline font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Consent Permissions Ledger */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Doctor Access Permissions (Consent Manager)
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Grant or revoke doctor permission to inspect your medical locker
            </p>

            <div className="divide-y divide-[#E3E8EB]">
              {consentRules.map((rule) => (
                <div key={rule.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{rule.doctorName}</div>
                    <div className="text-[11px] text-slate-500">
                      {rule.hospitalName} • Access Count: {rule.accessCount} times
                    </div>
                  </div>
                  <button
                    onClick={() => toggleConsent(rule.id, rule.doctorId, rule.status)}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      rule.status === 'active'
                        ? 'bg-red-50 text-[#D32F2F] border border-red-200 hover:bg-red-100'
                        : 'bg-teal-50 text-[#0E7C7B] border border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    {rule.status === 'active' ? 'Revoke Access' : 'Grant Access'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. C) MEDICATIONS PAGE (MORE VISUAL) */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'medications' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Visual Medication Manager & Schedule
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pill shapes, time-of-day chips, dose adherence tracking, and refill reminders.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setReorderingMed({
                    name: patient.currentMedicines[0]?.name || 'Atorvastatin 20mg',
                    dosage: patient.currentMedicines[0]?.dosage || '20mg',
                    currentStock: patient.currentMedicines[0]?.daysLeft || 12,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[#0E7C7B] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Reorder Online</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('book-appointment')}
                className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Consult for Refill
              </button>
            </div>
          </div>

          {/* Today's Doses Progress Card */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Circular SVG Progress Ring */}
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#E3E8EB"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#0E7C7B"
                      strokeWidth="6"
                      strokeDasharray={201.06}
                      strokeDashoffset={201.06 - (201.06 * doseCompletionPercent) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold font-mono text-slate-900">
                    {doseCompletionPercent}%
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">Today&apos;s Doses Adherence</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {takenDosesCount} of {totalDosesCount} scheduled doses logged as taken
                  </p>
                  <div className="text-[11px] text-[#0E7C7B] font-semibold mt-1">
                    {doseCompletionPercent === 100
                      ? 'All prescribed doses taken today! Excellent adherence.'
                      : `${totalDosesCount - takenDosesCount} dose(s) pending for today.`}
                  </div>
                </div>
              </div>

              {/* Adherence Chips */}
              <div className="flex items-center gap-2 text-xs">
                {['Morning', 'Afternoon', 'Night'].map((timeSlot) => {
                  const dosesInSlot = allScheduledDoses.filter((d) => d.slot === timeSlot);
                  if (dosesInSlot.length === 0) return null;
                  const allDone = dosesInSlot.every((d) => d.isTaken);
                  return (
                    <div
                      key={timeSlot}
                      className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${
                        allDone
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-[#F4F7F8] border-[#E3E8EB] text-slate-700'
                      }`}
                    >
                      {allDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="font-semibold">{timeSlot}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Simple Daily Timeline View */}
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Daily Regimen Timeline
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Morning', time: '08:00 AM' },
                { label: 'Afternoon', time: '01:00 PM' },
                { label: 'Night', time: '09:00 PM' },
              ].map((tl) => {
                const doses = allScheduledDoses.filter((d) => d.slot === tl.label);
                return (
                  <div
                    key={tl.label}
                    className="p-3.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#E3E8EB]">
                      <span className="font-bold text-slate-900">{tl.label}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{tl.time}</span>
                    </div>

                    {doses.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-2">
                        No medicines scheduled
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {doses.map((d, dIdx) => (
                          <div
                            key={dIdx}
                            className="bg-white p-2 rounded border border-[#E3E8EB] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {renderPillShapeIcon(d.medicine.shape, d.medicine.color)}
                              <div>
                                <div className="font-bold text-slate-800">{d.medicine.name}</div>
                                <div className="text-[10px] text-slate-400">{d.medicine.dosage}</div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleDose(
                                  d.medicine.name,
                                  d.slot,
                                  d.isTaken ? 'skipped' : 'taken'
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                d.isTaken
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {d.isTaken ? 'Taken ✓' : 'Mark'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Medicine Cards Grid with Days Left & Refill Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patient.currentMedicines.map((med, idx) => {
              const daysLeft = med.daysLeft || 18;
              const totalDays = med.totalDays || 30;
              const percentLeft = Math.min(100, Math.round((daysLeft / totalDays) * 100));
              const isLowStock = daysLeft <= 5;

              return (
                <div
                  key={idx}
                  className="bg-white rounded-lg border border-[#E3E8EB] p-4 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        {renderPillShapeIcon(med.shape, med.color || '#0E7C7B')}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Dose: <strong className="text-slate-800">{med.dosage}</strong> •{' '}
                          {med.frequency}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {med.shape || 'Capsule'}
                    </span>
                  </div>

                  {/* Time of Day Chips */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Schedule:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(['Morning', 'Afternoon', 'Night'] as const).map((timeSlot) => {
                        const isScheduled = med.timeSlots?.includes(timeSlot);
                        const isTaken = !!med.takenToday?.[timeSlot];
                        if (!isScheduled) return null;
                        return (
                          <div
                            key={timeSlot}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isTaken
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span>{timeSlot}</span>
                            {isTaken && <Check className="w-3 h-3 text-emerald-700" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Taken / Skip Buttons per active dose */}
                  <div className="p-2.5 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">Today&apos;s Dose Action:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleDose(
                            med.name,
                            med.timeSlots?.[0] || 'Morning',
                            'taken'
                          )
                        }
                        className="px-2.5 py-1 rounded bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                      >
                        Taken
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleDose(
                            med.name,
                            med.timeSlots?.[0] || 'Morning',
                            'skipped'
                          )
                        }
                        className="px-2.5 py-1 rounded border border-[#E3E8EB] bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer"
                      >
                        Skip
                      </button>
                    </div>
                  </div>

                  {/* Days Left & Refill Bar */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Supply Remaining</span>
                      {isLowStock ? (
                        <span className="font-bold text-[#D32F2F] bg-red-50 px-2 py-0.2 rounded border border-red-200">
                          Refill Needed ({daysLeft} days left)
                        </span>
                      ) : (
                        <span className="font-mono text-slate-700">
                          {daysLeft} days left ({totalDays}d course)
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-[#E3E8EB]">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isLowStock ? 'bg-[#D32F2F]' : 'bg-[#0E7C7B]'
                        }`}
                        style={{ width: `${percentLeft}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      Prescribed by {med.prescribedBy || 'Attending Physician'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReorderingMed({
                          name: med.name,
                          dosage: med.dosage,
                          currentStock: daysLeft,
                        })
                      }
                      className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[#0E7C7B] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>Reorder</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. B) QUEUE TOKEN PAGE (FULL DEDICATED TRACKER) */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'queue-token' && (
        <div className="max-w-xl mx-auto space-y-5">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-[#0E7C7B] mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded">
                Live Outpatient Queue Tracker
              </span>

              {/* Exact user requirement texts */}
              <div className="text-4xl font-black font-mono text-slate-900 mt-2">
                {activeToken ? `Token #${activeToken.tokenNumber}, Active` : 'No Active Token'}
              </div>

              <div className="text-sm font-semibold text-slate-700 mt-2">
                {activeToken ? (
                  activeToken.status === 'in_consultation' ? (
                    <span className="text-[#0E7C7B] font-bold">
                      It is your turn! Please enter {activeToken.roomNumber}.
                    </span>
                  ) : peopleAhead === 0 ? (
                    <span className="text-[#0E7C7B] font-bold">
                      You are next in line. Please be ready near {activeToken.roomNumber}.
                    </span>
                  ) : (
                    <span>
                      Your turn comes after{' '}
                      <strong className="text-slate-900 font-bold">{peopleAhead}</strong>{' '}
                      {peopleAhead === 1 ? 'person' : 'people'}
                    </span>
                  )
                ) : (
                  'You do not have an active queue token for today.'
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1">
                {activeToken
                  ? `${activeToken.doctorName} • ${activeToken.roomNumber} • ${activeToken.department}`
                  : 'Schedule an appointment to receive a real-time token.'}
              </p>
            </div>

            {activeToken ? (
              <div className="space-y-4 text-left pt-2">
                {/* 3. Estimated Time & 4. Reach Cabin Line */}
                <div className="p-4 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-[#E3E8EB]">
                    <span className="text-slate-500 font-medium">Estimated Consultation Time:</span>
                    <span className="font-mono font-bold text-slate-900">
                      Estimated time: {formattedEstTime} (about {estWaitMinutes} min)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-[#0E7C7B] font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Please reach the cabin by {formattedReachTime}</span>
                  </div>

                  {/* 5. Small visual progress bar of people ahead */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Live Queue Progress</span>
                      <span className="font-mono font-semibold">
                        {peopleAhead === 0 ? 'Inside Cabin' : `${peopleAhead} people ahead`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#0E7C7B] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${queueProgressPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Estimate computed as ({peopleAhead} people ahead × 8 min average consultation
                      time). Updates live when the doctor calls the next patient.
                    </div>
                  </div>
                </div>

                {/* Cabin Directions Card */}
                <div className="p-3.5 rounded-lg border border-[#E3E8EB] bg-white flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Cabin Location
                    </span>
                    <span className="font-bold text-slate-800">
                      OPD Block B • {activeToken.roomNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Ground floor, near Nursing Station 2
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Nurse on Duty
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('book-appointment')}
                className="px-4 py-2 bg-[#0E7C7B] text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              >
                Book an OPD Slot
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. EMERGENCY CARD PAGE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'emergency-card' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-6 max-w-3xl mx-auto">
          <div className="pb-3 border-b border-[#E3E8EB] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Emergency Medical Card</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paramedics can scan your QR code for rapid golden-hour triage
              </p>
            </div>
            <span className="font-mono text-xs font-bold bg-red-100 text-[#D32F2F] px-2.5 py-1 rounded">
              Code Red Safe
            </span>
          </div>

          {/* 3D Anatomy Model + Vitals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="rounded-lg border border-[#E3E8EB] p-2 bg-[#F4F7F8] h-64 flex flex-col items-center justify-center">
              <PatientAnatomyView className="w-full h-full" />
              <div className="text-[10px] text-slate-400 mt-1">3D Heart Anatomy (Hover to Pause)</div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-[10px] text-red-700 uppercase font-bold tracking-wider">
                  Blood Group
                </div>
                <div className="text-2xl font-black text-[#D32F2F] font-mono mt-0.5">
                  {patient.bloodGroup}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Critical Drug Allergies:</span>
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="bg-red-100 text-[#D32F2F] font-semibold px-2 py-0.5 rounded border border-red-200 text-xs"
                    >
                      {a}
                    </span>
                  ))}
                  {patient.allergies.length === 0 && <span className="text-slate-400">None</span>}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Emergency Kin Contact:</span>
                <div className="p-2.5 rounded bg-slate-50 border border-[#E3E8EB]">
                  {patient.emergencyContacts.map((c, i) => (
                    <div key={i} className="text-slate-800">
                      <strong>{c.name}</strong> ({c.relation}) —{' '}
                      <span className="font-mono">{c.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. PAYMENTS PAGE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'payments' && (
        <PatientPaymentsPage appState={appState} patient={patient} onNavigate={onNavigate} />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. HELP CENTER PAGE */}
      {/* ------------------------------------------------------------- */}
      {activePage === 'help-center' && (
        <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 space-y-4 max-w-2xl mx-auto">
          <div className="pb-3 border-b border-[#E3E8EB]">
            <h2 className="text-base font-bold text-slate-900">Patient Support & Emergency Helplines</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              24x7 clinical escalation and locker data privacy rights
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[#D32F2F]">
              <div className="font-bold">National Medical Emergency Ambulance: 108 / 112</div>
              <div className="text-[11px] mt-0.5">
                Direct line to trauma dispatchers and nearest emergency trauma bays.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <div className="font-bold text-slate-900">City Metro Hospital OPD Desk: +91 11 2345 6789</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Hours: Monday to Saturday, 08:00 AM - 08:00 PM
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F4F7F8] border border-[#E3E8EB]">
              <div className="font-bold text-slate-900">Your DigiLocker Privacy Rights</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Under NABH and Indian Digital Health Mission (ABDM) standards, doctors may only inspect
                your medical history if you have an active appointment or grant consent. You may
                revoke consent at any time from the Medical Records tab.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS: QR CODE, UPLOAD REPORT, INSPECT REPORT */}
      {/* ------------------------------------------------------------- */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-6 max-w-xs w-full text-center space-y-3 shadow-lg">
            <h3 className="text-sm font-bold text-slate-900">Unique Patient QR Code</h3>
            <div className="w-44 h-44 mx-auto bg-slate-100 rounded-lg p-3 border border-[#E3E8EB] flex items-center justify-center">
              <QrCode className="w-36 h-36 text-slate-800" />
            </div>
            <div className="font-mono text-sm font-bold text-[#0E7C7B]">
              {patient.uniquePatientId}
            </div>
            <p className="text-[11px] text-slate-500">
              {patient.name} • {patient.bloodGroup}
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-1.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 max-w-md w-full space-y-3.5 shadow-lg text-xs">
            <h3 className="text-sm font-bold text-slate-900">Upload Diagnostic Document</h3>
            <form onSubmit={handleUploadReport} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. 2D Echocardiogram or HbA1c Test"
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as any)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                >
                  <option value="Blood Test">Blood Test</option>
                  <option value="Radiology / Scan">Radiology / Scan</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Prescription">Prescription</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Clinical Notes or Summary
                </label>
                <textarea
                  rows={2}
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Key findings or doctor observations..."
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 rounded border border-[#E3E8EB] text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-[#0E7C7B] text-white font-semibold cursor-pointer"
                >
                  Save to Locker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E8EB] p-5 max-w-lg w-full space-y-3.5 shadow-lg text-xs">
            <div className="flex items-start justify-between pb-2 border-b border-[#E3E8EB]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedReport.title}</h3>
                <p className="text-slate-500 mt-0.5">
                  {selectedReport.category} • {selectedReport.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-[#F4F7F8] rounded-lg border border-[#E3E8EB]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Clinical Summary</div>
                <div className="text-slate-800 mt-1 leading-relaxed">{selectedReport.summary}</div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Facility: {selectedReport.hospitalName}</span>
                <span>Doctor: {selectedReport.doctorName}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-1.5 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Close File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REORDER MEDICINE MODAL (Tata 1mg, PharmEasy, Apollo, Netmeds) */}
      {reorderingMed && (
        <PharmacyReorderModal
          isOpen={true}
          onClose={() => setReorderingMed(null)}
          item={{
            name: reorderingMed.name,
            dosage: reorderingMed.dosage,
            currentStock: reorderingMed.currentStock,
          }}
          patientId={patient.id}
          isHospitalInventory={false}
        />
      )}

      {/* CANCEL APPOINTMENT CONFIRMATION MODAL */}
      {cancelModalToken && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md w-full space-y-4 shadow-xl text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cancel Appointment #{cancelModalToken.tokenNumber}?
                </h3>
                <p className="text-slate-500 mt-1">
                  Are you sure you want to cancel your consultation with{' '}
                  <strong className="text-slate-700">{cancelModalToken.doctorName}</strong> scheduled for{' '}
                  <strong className="text-slate-700">{cancelModalToken.appointmentDate || 'Today'} ({cancelModalToken.timeSlot || 'OPD'})</strong>?
                </p>
                <p className="text-[11px] text-red-600 mt-1">
                  Your OPD queue token will be released and removed from the active queue.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModalToken(null)}
                className="px-4 py-2 rounded-lg border border-[#E3E8EB] text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleCancelAppointmentConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer transition-colors shadow-xs"
              >
                Yes, Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE APPOINTMENT MODAL */}
      {rescheduleModalToken && (() => {
        const docLeave = appState.doctorCalendarEvents.find(
          (ev) =>
            (ev.doctorId === 'all' || ev.doctorId === rescheduleModalToken.doctorId) &&
            (ev.type === 'holiday' || ev.type === 'leave') &&
            ev.date === rescheduleDate
        );

        const bookedForDate = appState.queueTokens
          .filter(
            (q) =>
              q.status !== 'cancelled' &&
              q.doctorId === rescheduleModalToken.doctorId &&
              q.appointmentDate === rescheduleDate &&
              q.id !== rescheduleModalToken.id
          )
          .map((q) => q.timeSlot);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-[#E3E8EB] p-6 max-w-lg w-full space-y-4 shadow-xl text-xs">
              <div className="flex items-start justify-between pb-2 border-b border-[#E3E8EB]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reschedule Appointment #{rescheduleModalToken.tokenNumber}
                  </h3>
                  <p className="text-slate-500 mt-0.5">
                    Dr. {rescheduleModalToken.doctorName} • Room {rescheduleModalToken.roomNumber}
                  </p>
                </div>
                <button
                  onClick={() => setRescheduleModalToken(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {rescheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{rescheduleError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select New Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                {docLeave && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-[11px]">
                    <strong>Doctor Unavailable:</strong> {docLeave.title}. Please pick another date.
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Select New Time Slot for {rescheduleDate}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {timeSlots.map((s, idx) => {
                      const isBooked = bookedForDate.includes(s.time);
                      const isSelected = rescheduleSlot === s.time;
                      const isDisabled = !!docLeave || isBooked;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setRescheduleSlot(s.time)}
                          className={`p-2 rounded-lg border text-xs text-center transition-all ${
                            isDisabled
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'border-[#0E7C7B] bg-teal-50 ring-1 ring-[#0E7C7B] text-slate-900 cursor-pointer font-bold'
                              : 'border-[#E3E8EB] bg-white hover:bg-slate-50 cursor-pointer text-slate-800'
                          }`}
                        >
                          <div className="font-mono text-xs">{s.time}</div>
                          <span
                            className={`inline-block mt-0.5 text-[9px] px-1 py-0.2 rounded ${
                              isBooked ? 'bg-red-100 text-red-700 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {isBooked ? 'Booked' : s.period}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3E8EB]">
                <button
                  type="button"
                  onClick={() => setRescheduleModalToken(null)}
                  className="px-4 py-2 rounded-lg border border-[#E3E8EB] text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!docLeave || !rescheduleSlot || bookedForDate.includes(rescheduleSlot)}
                  onClick={handleRescheduleAppointmentConfirm}
                  className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] disabled:bg-slate-300 text-white font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Confirm Reschedule
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
