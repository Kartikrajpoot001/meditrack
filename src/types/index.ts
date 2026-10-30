export type UserRole = 'patient' | 'doctor' | 'receptionist' | 'admin' | 'responder' | 'guest' | 'hospital' | 'dispatcher' | 'paramedic';

export interface WardBedData {
  id: string;
  bedNumber: string;
  ward: string;
  type: string;
  status: 'available' | 'occupied' | 'maintenance';
  patientId?: string;
  patientName?: string;
  row: number;
  col: number;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export type DoseSlot = 'Morning' | 'Afternoon' | 'Night';
export type DoseStatus = 'Pending' | 'Taken' | 'Taken late' | 'Missed' | 'Skipped';

export interface DoseLog {
  slot: DoseSlot;
  status: DoseStatus;
  markedAt?: string; // e.g. "08:15 AM"
  scheduledTime?: string; // e.g. "08:00 AM"
  note?: string;
}

export interface CurrentMedicine {
  id: string;
  name: string;
  dosage: string;
  strength?: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  source?: 'prescribed' | 'manual';
  prescribedBy?: string;
  prescribedDate?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: 'active' | 'completed';
  shape?: 'round' | 'capsule' | 'oval';
  color?: string;
  timeSlots?: DoseSlot[];
  daysLeft?: number;
  totalDays?: number;
  doseHistory?: Record<string, Partial<Record<DoseSlot, DoseLog>>>;
  takenToday?: {
    Morning?: boolean;
    Afternoon?: boolean;
    Night?: boolean;
  };
}

export interface DayAdherenceRecord {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  allTaken: boolean;
  hasMissed: boolean;
  hasLateOrSkipped: boolean;
  status: 'taken' | 'missed' | 'skipped' | 'none';
  doses: {
    medicineName: string;
    slot: DoseSlot;
    status: DoseStatus;
    markedAt?: string;
  }[];
}

export interface MedicationAdherenceStats {
  currentStreak: number;
  bestStreak: number;
  adherenceRate7Days: number;
  adherenceRate30Days: number;
  missedMessage?: string;
  todayCompletedCount: number;
  todayTotalCount: number;
  history7Days: DayAdherenceRecord[];
  history30Days: DayAdherenceRecord[];
}

export interface VaccinationRecord {
  vaccine: string;
  date: string;
  dose: string;
  administeredAt?: string;
}

export interface MedicalReport {
  id: string;
  patientId: string;
  title: string;
  category: 'Radiology' | 'Blood Test' | 'Cardiology' | 'Pathology' | 'Emergency' | 'Other';
  date: string;
  doctorName: string;
  hospitalName: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  summary: string;
  findings?: string;
}

export interface PrescriptionMedicine {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  uniquePatientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  date: string;
  diagnosis: string;
  symptoms: string;
  medicines: PrescriptionMedicine[];
  labTestsOrdered?: string[];
  followUpDate?: string;
  notes?: string;
}

export interface PatientProfile {
  id: string;
  uniquePatientId: string; // Format MT-XXXXXX
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies: string[];
  chronicConditions: string[];
  currentMedicines: CurrentMedicine[];
  emergencyContacts: EmergencyContact[];
  vaccinations: VaccinationRecord[];
  lastViewedByDoctor?: {
    doctorId: string;
    doctorName: string;
    hospitalName: string;
    timestamp: string;
  };
}

export interface AccessLog {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  timestamp: string;
  purpose: string;
  accessType: 'routine' | 'emergency_break_glass';
  reason?: string;
}

export interface ConsentRule {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  hospitalName: string;
  grantedAt: string;
  status: 'active' | 'revoked';
  accessCount: number;
}

export interface BedCapacity {
  generalTotal: number;
  generalOccupied: number;
  icuTotal: number;
  icuOccupied: number;
  emergencyTotal: number;
  emergencyOccupied: number;
  ventilatorsTotal: number;
  ventilatorsOccupied: number;
  ambulancesTotal: number;
  ambulancesOccupied: number;
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  emergencyHelpline: string;
  specialties: string[];
  rating: number;
  beds: BedCapacity;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  hospitalId: string;
  hospitalName: string;
  roomNumber: string;
  experienceYears: number;
  status: 'available' | 'in_consultation' | 'off_duty';
  approvalStatus?: 'approved' | 'pending';
  registrationNumber?: string;
  currentToken?: string;
  avgConsultationTimeMinutes: number;
  consultationFee?: number;
  department?: string;
  customId?: string;
  phone?: string;
}

export interface QueueToken {
  id: string;
  tokenNumber: string; // e.g. "C-14"
  appointmentId?: string;
  patientId: string;
  patientName: string;
  uniquePatientId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  hospitalId: string;
  status: 'waiting' | 'in_consultation' | 'done' | 'no_show' | 'cancelled' | 'payment_pending';
  paymentStatus?: 'paid' | 'pending' | 'pay_at_hospital' | 'pending_verification';
  paymentId?: string;
  heldUntil?: number; // Epoch timestamp (ms) for the 30-minute hold
  reason: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
  estimatedWaitMinutes: number;
  roomNumber: string;
  appointmentDate?: string;
  timeSlot?: string;
  fee?: number;
}

export interface AppointmentSlot {
  id: string;
  hospitalId: string;
  hospitalName: string;
  department: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  availableSlots: number;
  totalSlots: number;
}

export type EmergencySeverity = 'critical' | 'urgent' | 'moderate';
export type EmergencyType =
  | 'accident'
  | 'collapse'
  | 'burn'
  | 'other'
  | 'Road Accident'
  | 'Cardiac Arrest'
  | 'Trauma / Fall'
  | 'Respiratory Distress'
  | 'Fire / Burns'
  | 'Other';

export type EmergencyLifecycleStatus =
  | 'Reported'
  | 'Dispatcher Alerted'
  | 'Ambulance Dispatched'
  | 'Helpers Responding'
  | 'Ambulance En Route'
  | 'Assessment and Transport'
  | 'Hospital Handover'
  | 'Closed'
  | 'reported'
  | 'validated'
  | 'accepted'
  | 'en_route'
  | 'hospital_ready'
  | 'arrived'
  | 'Responders Assigned'
  | 'Victim Picked Up'
  | 'At Hospital';

export type EmergencyStatus = EmergencyLifecycleStatus;

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  event: string;
  who: string;
  role: 'witness' | 'dispatcher' | 'helper' | 'civilian_helper' | 'paramedic' | 'hospital' | 'system';
  details?: string;
}

export type HelperRoleOption = 'help_scene' | 'transport_victim' | 'guide_ambulance';

export interface IncidentHelper {
  id: string;
  name: string;
  phone?: string;
  distanceKm: number;
  etaMinutes: number;
  roleChoice?: HelperRoleOption;
  roleOption?: HelperRoleOption;
  roleLabel?: 'Help at Scene' | 'Transport Victim' | 'Guide Ambulance' | string;
  status: 'accepted' | 'arrived' | 'assistance_given' | 'transporting' | 'hospital_reached';
  acceptedAt: string;
  arrivedAt?: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  lastLocationUpdate?: string;
  selectedHospitalId?: string;
  selectedHospitalName?: string;
  transportHospitalId?: string;
  transportHospitalName?: string;
  vehicleDetails?: string;
  safetyConfirmed?: boolean;
  sceneNotes?: string;
  landmarks?: string;
  roadBlocks?: string;
  victimCountEstimate?: number;
  photoUrl?: string;
  sceneDetails?: {
    exactSpot?: string;
    landmarks?: string;
    roadBlocks?: string;
    victimCount?: number;
    photoUrl?: string;
    shortNote?: string;
    updatedAt?: string;
  };
  assistanceNotes?: string;
  arrivedAtScene?: boolean;
  assistanceGiven?: boolean;
}

export interface AmbulanceUnit {
  id: string;
  unitCode: string;
  driverName: string;
  paramedicName: string;
  phone: string;
  type: 'ALS Mobile ICU' | 'BLS Rapid Care' | 'Trauma Ambulance';
  baseLocation: string;
  lat: number;
  lng: number;
  status: 'available' | 'dispatched' | 'en_route' | 'at_scene' | 'transporting';
  etaMinutes: number;
  distanceKm: number;
  equipment: string[];
  dispatchedAt?: string;
}

export type ResponderType = 'Civilian' | 'Ambulance' | 'Volunteer';

export interface IncidentResponder {
  id: string;
  name: string;
  type: ResponderType;
  phone?: string;
  distanceKm: number;
  etaMinutes: number;
  acceptedAt: string;
  vehicle?: string;
  hasVehicle?: boolean;
  equipment?: string[];
  notes?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface EmergencyVitals {
  bloodPressure?: string;
  heartRate?: number;
  spo2?: number;
  gcs?: number; // Glasgow Coma Scale (3-15)
  respiratoryRate?: number;
  temperature?: string;
  conditionNotes?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface EmergencyCase {
  id: string; // e.g. INC-2026-0001
  callerName: string;
  callerPhone: string;
  emergencyType: EmergencyType;
  victimsCount: number;
  severity: EmergencySeverity;
  lat: number;
  lng: number;
  address: string;
  description: string;
  photoUrl?: string;
  reportedAt: string;
  status: EmergencyLifecycleStatus;

  // Track A: Official Ambulance Response
  assignedAmbulance?: AmbulanceUnit;
  ambulanceDispatchedAt?: string;
  ambulanceEtaMinutes?: number;

  // Track B: Nearby Helpers (Three Options)
  helpers?: IncidentHelper[];
  claimedSlots?: EmergencySlotClaims;

  // Hospital Handover & Transport
  destinationHospitalId?: string;
  destinationHospitalName?: string;
  hospitalReadinessConfirmed?: boolean;
  transportingEntity?: 'ambulance' | 'civilian_helper';
  transportingHelperName?: string;
  hospitalBedAssigned?: string;
  hospitalHandoverAt?: string;

  // Patient Vitals
  vitals?: EmergencyVitals;

  // Timeline Event Log
  timeline: IncidentTimelineEvent[];

  // Resolution & Archive
  closedAt?: string;
  closeSummary?: string;

  // Backwards compatibility
  responders?: IncidentResponder[];
  responderId?: string;
  responderName?: string;
  responderPhone?: string;
  responderLocation?: {
    lat: number;
    lng: number;
  };
  confidenceCount?: number;
  confirmations?: {
    timestamp: string;
    callerPhone: string;
  }[];
  etaMinutes?: number;
  bedsReserved?: {
    emergency: number;
    icu: number;
  };
  pickedUpAt?: string;
  arrivedAtHospitalAt?: string;
  selectedVehicle?: string;
}

export interface OperationItem {
  id: string;
  theatreNumber: string;
  procedureName: string;
  patientName: string;
  uniquePatientId: string;
  surgeonName: string;
  hospitalId: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  startTime: string;
  durationEstimate: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  uniquePatientId: string;
  doctorName: string;
  hospitalId: string;
  testName: string;
  category: string;
  orderedAt: string;
  status: 'ordered' | 'sample_collected' | 'report_ready' | 'uploaded_to_locker';
}

export interface PharmacyItem {
  id: string;
  hospitalId: string;
  name: string;
  category: string;
  stock: number;
  minThreshold: number;
  unit: string;
  dosageForm: string;
}

export interface EmergencySlotClaims {
  ambulance?: {
    claimedBy: string;
    unitCode: string;
    timestamp: string;
  };
  transport?: {
    claimedBy: string;
    helperId: string;
    timestamp: string;
    hospitalName?: string;
    arrived?: boolean;
    arrivedAt?: string;
  };
  scene?: Array<{
    claimedBy: string;
    helperId: string;
    timestamp: string;
    arrived?: boolean;
    arrivedAt?: string;
  }>;
  guide?: {
    claimedBy: string;
    helperId: string;
    timestamp: string;
  };
}

export type BillCategory = 'Consultation' | 'Lab test' | 'Medicine' | 'Surgery' | 'Room' | 'Ambulance';
export type BillStatus = 'Paid' | 'Pending' | 'Pending Verification' | 'Refunded';
export type PaymentMethod = 'UPI' | 'Card' | 'Cash' | 'Insurance' | 'Razorpay';

export interface PaymentBill {
  id: string; // e.g. "INV-2026-001"
  patientId: string;
  patientName: string;
  date: string;
  hospitalName: string;
  hospitalId: string;
  doctorName?: string;
  category: BillCategory;
  description: string;
  amount: number;
  insuranceCovered?: number;
  status: BillStatus;
  paymentMethod?: PaymentMethod;
  transactionRef?: string;
  paidAt?: string;
  tokenId?: string;
  appointmentId?: string;
  paymentId?: string;
  razorpayOrderId?: string;
  utr?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  heldUntil?: number;
}

export interface DoctorCalendarEvent {
  id: string;
  doctorId: string;
  title: string;
  type: 'appointment' | 'surgery' | 'shift' | 'todo' | 'holiday' | 'leave';
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  patientName?: string;
  room?: string;
  color?: string;
  isHoliday?: boolean;
  holidayName?: string;
}

export interface DoctorTodo {
  id: string;
  doctorId: string;
  text: string;
  category: 'Patient call' | 'Lab follow-up' | 'Paperwork' | 'Rounds';
  priority: 'urgent' | 'normal' | 'low';
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: string;
}

export interface PharmacyPurchaseOrder {
  id: string;
  hospitalId: string;
  medicineName: string;
  supplier: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'approved' | 'delivered';
  requestedAt: string;
  totalCost: number;
}

export interface InAppNotification {
  id: string;
  recipientRole?: UserRole | 'all';
  recipientPatientId?: string;
  recipientDoctorId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'queue' | 'emergency' | 'access' | 'system' | 'lab';
  category?: 'emergency' | 'queue' | 'payment' | 'reminder' | 'system';
  slotType?: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance';
  caseId?: string;
  claimedBy?: string;
  isCancelled?: boolean;
}

