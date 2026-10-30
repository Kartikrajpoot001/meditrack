import {
  PatientProfile,
  MedicalReport,
  Prescription,
  AccessLog,
  ConsentRule,
  Hospital,
  Doctor,
  QueueToken,
  EmergencyCase,
  OperationItem,
  LabOrder,
  PharmacyItem,
  InAppNotification,
  UserRole,
  WardBedData,
  IncidentResponder,
  EmergencyVitals,
  AmbulanceUnit,
  IncidentHelper,
  IncidentTimelineEvent,
  HelperRoleOption,
  EmergencyLifecycleStatus,
  PaymentBill,
  BillCategory,
  BillStatus,
  PaymentMethod,
  DoctorCalendarEvent,
  DoctorTodo,
  PharmacyPurchaseOrder,
  EmergencySlotClaims,
  CurrentMedicine,
  DoseSlot,
  DoseStatus,
  DoseLog,
  MedicationAdherenceStats,
  DayAdherenceRecord,
} from '../types';

const STORAGE_KEY = 'meditrack_db_v6';
const CHANNEL_NAME = 'meditrack_channel';

// Date helper functions for Daily Medicine Tracking & Streak Simulation
export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateISO(d);
}

// Helper to seed baseline dose history (e.g. past 5 days of taken doses for initial streak)
export function buildSeedDoseHistory(
  slots: DoseSlot[],
  pastDaysCount: number = 5,
  referenceDate: string = '2026-10-30',
  todayStatus: Partial<Record<DoseSlot, { status: DoseStatus; markedAt?: string }>> = {}
): Record<string, Partial<Record<DoseSlot, DoseLog>>> {
  const history: Record<string, Partial<Record<DoseSlot, DoseLog>>> = {};
  for (let i = 1; i <= pastDaysCount; i++) {
    const dStr = addDaysToDate(referenceDate, -i);
    history[dStr] = {};
    slots.forEach((slot) => {
      const scheduledTime = slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM';
      const markedAt = slot === 'Morning' ? '08:14 AM' : slot === 'Afternoon' ? '01:05 PM' : '09:12 PM';
      history[dStr][slot] = {
        slot,
        status: 'Taken',
        scheduledTime,
        markedAt,
      };
    });
  }
  history[referenceDate] = {};
  slots.forEach((slot) => {
    const scheduledTime = slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM';
    const override = todayStatus[slot];
    if (override) {
      history[referenceDate][slot] = {
        slot,
        status: override.status,
        scheduledTime,
        markedAt: override.markedAt,
      };
    } else {
      history[referenceDate][slot] = {
        slot,
        status: 'Pending',
        scheduledTime,
      };
    }
  });
  return history;
}

// Validate format PT + 5 digits (e.g. PT00234, PT12345)
export function validatePatientIdFormat(id: string): { isValid: boolean; error?: string } {
  const clean = id.trim().toUpperCase();
  if (!/^PT\d{5}$/.test(clean)) {
    return {
      isValid: false,
      error: "Invalid Patient ID format. Must be 'PT' followed by 5 digits (e.g., PT00234)",
    };
  }
  return { isValid: true };
}

// Helper to calculate distance in meters between two lat/lng coordinates (Haversine formula)
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Calculate how many people are ahead of this queue token
export function calculatePeopleAhead(token: QueueToken, allTokens: QueueToken[]): number {
  if (token.status === 'in_consultation') return 0;
  if (token.status === 'done' || token.status === 'no_show' || token.status === 'cancelled') return 0;

  const doctorTokens = allTokens.filter((q) => q.doctorId === token.doctorId);
  const inConsultCount = doctorTokens.filter((q) => q.status === 'in_consultation').length;
  const waitingTokens = doctorTokens
    .filter((q) => q.status === 'waiting')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const myIndex = waitingTokens.findIndex((q) => q.id === token.id);
  if (myIndex === -1) return 0;

  return inConsultCount + myIndex;
}

// Generate unique patient ID format PT + 5 digits (e.g. PT00234, PT51829)
export function generateUniquePatientId(existingIds: string[] = []): string {
  let id = '';
  do {
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
    id = `PT${randomDigits}`;
  } while (existingIds.includes(id));
  return id;
}

export interface AppState {
  patients: PatientProfile[];
  reports: MedicalReport[];
  prescriptions: Prescription[];
  accessLogs: AccessLog[];
  consentRules: ConsentRule[];
  hospitals: Hospital[];
  doctors: Doctor[];
  queueTokens: QueueToken[];
  emergencies: EmergencyCase[];
  operations: OperationItem[];
  labOrders: LabOrder[];
  pharmacy: PharmacyItem[];
  notifications: InAppNotification[];
  wardBeds: WardBedData[];
  ambulances: AmbulanceUnit[];
  bills: PaymentBill[];
  doctorCalendarEvents: DoctorCalendarEvent[];
  doctorTodos: DoctorTodo[];
  pharmacyOrders: PharmacyPurchaseOrder[];
  currentUserRole: UserRole;
  currentUserId: string;
  simulatedDate?: string;
}

const INITIAL_WARD_BEDS: WardBedData[] = [
  { id: 'bed-101', bedNumber: 'Bed 101', ward: 'General Ward A', type: 'General', status: 'occupied', patientId: 'pat-1', patientName: 'Sarah Chen', row: 0, col: 0 },
  { id: 'bed-102', bedNumber: 'Bed 102', ward: 'General Ward A', type: 'General', status: 'available', row: 0, col: 1 },
  { id: 'bed-103', bedNumber: 'Bed 103', ward: 'General Ward A', type: 'General', status: 'occupied', patientId: 'pat-2', patientName: 'Rajesh Patel', row: 0, col: 2 },
  { id: 'bed-104', bedNumber: 'Bed 104', ward: 'General Ward A', type: 'General', status: 'available', row: 0, col: 3 },
  { id: 'bed-105', bedNumber: 'Bed 105', ward: 'General Ward A', type: 'General', status: 'maintenance', row: 0, col: 4 },
  { id: 'bed-106', bedNumber: 'Bed 106', ward: 'General Ward A', type: 'General', status: 'available', row: 0, col: 5 },
  { id: 'bed-107', bedNumber: 'Bed 107', ward: 'General Ward A', type: 'General', status: 'occupied', patientId: 'pat-4', patientName: 'David Miller', row: 1, col: 0 },
  { id: 'bed-108', bedNumber: 'Bed 108', ward: 'General Ward A', type: 'General', status: 'occupied', patientId: 'pat-7', patientName: 'Meera Sengupta', row: 1, col: 1 },
  { id: 'bed-109', bedNumber: 'Bed 109', ward: 'General Ward A', type: 'General', status: 'available', row: 1, col: 2 },
  { id: 'bed-110', bedNumber: 'Bed 110', ward: 'General Ward A', type: 'General', status: 'available', row: 1, col: 3 },
  { id: 'bed-111', bedNumber: 'Bed 111', ward: 'General Ward A', type: 'General', status: 'maintenance', row: 1, col: 4 },
  { id: 'bed-112', bedNumber: 'Bed 112', ward: 'General Ward A', type: 'General', status: 'occupied', patientId: 'pat-10', patientName: 'Gurpreet Singh', row: 1, col: 5 },
];

const INITIAL_HOSPITALS: Hospital[] = [
  {
    id: 'hosp-1',
    name: 'City Metro General Hospital',
    code: 'CMGH',
    address: 'Connaught Circus, Barakhamba, Central District, New Delhi',
    lat: 28.6315,
    lng: 77.2167,
    phone: '+91 11 2345 6789',
    emergencyHelpline: '102 / +91 11 2345 9999',
    specialties: ['Cardiology', 'Orthopedics', 'Emergency Trauma', 'General Medicine'],
    rating: 4.8,
    beds: {
      generalTotal: 120,
      generalOccupied: 98,
      icuTotal: 25,
      icuOccupied: 20,
      emergencyTotal: 16,
      emergencyOccupied: 11,
      ventilatorsTotal: 14,
      ventilatorsOccupied: 11,
      ambulancesTotal: 6,
      ambulancesOccupied: 3,
    },
  },
  {
    id: 'hosp-2',
    name: 'St. Jude Trauma & Cardiac Institute',
    code: 'SJTC',
    address: 'Ring Road, South Extension Part II, New Delhi',
    lat: 28.5729,
    lng: 77.2223,
    phone: '+91 11 4567 8901',
    emergencyHelpline: '108 / +91 11 4567 9999',
    specialties: ['Level-1 Trauma Center', 'Cardiothoracic Surgery', 'Pediatrics', 'Neurology'],
    rating: 4.9,
    beds: {
      generalTotal: 90,
      generalOccupied: 72,
      icuTotal: 30,
      icuOccupied: 24,
      emergencyTotal: 20,
      emergencyOccupied: 14,
      ventilatorsTotal: 18,
      ventilatorsOccupied: 13,
      ambulancesTotal: 8,
      ambulancesOccupied: 5,
    },
  },
  {
    id: 'hosp-3',
    name: 'Apex Multi-Specialty Health Center',
    code: 'AMHC',
    address: 'Sector 12, Dwarka Metro Corridor, New Delhi',
    lat: 28.5921,
    lng: 77.0460,
    phone: '+91 11 2808 1234',
    emergencyHelpline: '102 / +91 11 2808 9000',
    specialties: ['Pulmonology', 'General Medicine', 'Endocrinology', 'Gastroenterology'],
    rating: 4.7,
    beds: {
      generalTotal: 80,
      generalOccupied: 55,
      icuTotal: 18,
      icuOccupied: 12,
      emergencyTotal: 12,
      emergencyOccupied: 7,
      ventilatorsTotal: 10,
      ventilatorsOccupied: 6,
      ambulancesTotal: 4,
      ambulancesOccupied: 2,
    },
  },
  {
    id: 'hosp-4',
    name: 'Apollo Crest Critical Care & Research',
    code: 'ACCR',
    address: 'Mathura Road, Okhla Industrial Area Phase II, New Delhi',
    lat: 28.5355,
    lng: 77.2731,
    phone: '+91 11 2682 5555',
    emergencyHelpline: '108 / +91 11 2682 9999',
    specialties: ['Cardiology', 'Neurology', 'Oncology', 'Organ Transplant'],
    rating: 4.9,
    beds: {
      generalTotal: 150,
      generalOccupied: 128,
      icuTotal: 40,
      icuOccupied: 34,
      emergencyTotal: 24,
      emergencyOccupied: 18,
      ventilatorsTotal: 22,
      ventilatorsOccupied: 19,
      ambulancesTotal: 10,
      ambulancesOccupied: 7,
    },
  },
];

const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Aris Vance, MD',
    email: 'aris.vance@citymetro.health',
    specialization: 'Senior Interventional Cardiologist',
    hospitalId: 'hosp-1',
    hospitalName: 'City Metro General Hospital',
    roomNumber: 'Cabin 3',
    experienceYears: 14,
    status: 'in_consultation',
    currentToken: 'C-00',
    avgConsultationTimeMinutes: 8,
    consultationFee: 800,
  },
  {
    id: 'doc-2',
    name: 'Dr. Priya Sharma, MBBS, MS',
    email: 'priya.sharma@stjude.health',
    specialization: 'Emergency Medicine & Trauma Specialist',
    hospitalId: 'hosp-2',
    hospitalName: 'St. Jude Trauma & Cardiac Institute',
    roomNumber: 'Cabin 1',
    experienceYears: 11,
    status: 'in_consultation',
    currentToken: 'E-01',
    avgConsultationTimeMinutes: 10,
    consultationFee: 600,
  },
  {
    id: 'doc-3',
    name: 'Dr. Rajesh Kulkarni, MS (Ortho)',
    email: 'rajesh.k@citymetro.health',
    specialization: 'Orthopedic & Joint Replacement Surgeon',
    hospitalId: 'hosp-1',
    hospitalName: 'City Metro General Hospital',
    roomNumber: 'Cabin 7',
    experienceYears: 16,
    status: 'available',
    currentToken: 'O-02',
    avgConsultationTimeMinutes: 12,
    consultationFee: 750,
  },
  {
    id: 'doc-4',
    name: 'Dr. Ananya Iyer, MD (Pediatrics)',
    email: 'ananya.iyer@stjude.health',
    specialization: 'Consultant Pediatrician & Neonatologist',
    hospitalId: 'hosp-2',
    hospitalName: 'St. Jude Trauma & Cardiac Institute',
    roomNumber: 'Cabin 2',
    experienceYears: 9,
    status: 'available',
    currentToken: 'P-01',
    avgConsultationTimeMinutes: 10,
    consultationFee: 500,
  },
  {
    id: 'doc-5',
    name: 'Dr. Sameer Sen, MD (Pulm)',
    email: 'sameer.sen@apexhealth.org',
    specialization: 'Pulmonologist & Sleep Medicine Specialist',
    hospitalId: 'hosp-3',
    hospitalName: 'Apex Multi-Specialty Health Center',
    roomNumber: 'Cabin 5',
    experienceYears: 13,
    status: 'available',
    currentToken: undefined,
    avgConsultationTimeMinutes: 8,
    consultationFee: 650,
  },
  {
    id: 'doc-6',
    name: 'Dr. Radhika Nair, MD (Internal)',
    email: 'radhika.nair@apollocrest.health',
    specialization: 'Senior Physician & Internal Medicine',
    hospitalId: 'hosp-4',
    hospitalName: 'Apollo Crest Critical Care & Research',
    roomNumber: 'Cabin 4',
    experienceYears: 15,
    status: 'available',
    currentToken: undefined,
    avgConsultationTimeMinutes: 10,
    consultationFee: 700,
  },
];

const INITIAL_PATIENTS: PatientProfile[] = [
  {
    id: 'pat-1',
    uniquePatientId: 'PT00234',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    phone: '+91 98112 34567',
    age: 32,
    gender: 'Female',
    bloodGroup: 'B+',
    allergies: ['Penicillin', 'Sulfa Antibiotics', 'Tree Nuts (Severe)'],
    chronicConditions: ['Bronchial Asthma (Moderate)', 'Mild Hypertension'],
    currentMedicines: [
      {
        id: 'med-1',
        name: 'Budesonide ResDecoder Inhaler',
        dosage: '200 mcg',
        strength: '200 mcg',
        frequency: 'Twice daily',
        duration: '30 days',
        instructions: 'Rinse mouth with water after each inhalation',
        source: 'prescribed',
        prescribedBy: 'Dr. Aris Vance, MD on 2026-10-15',
        prescribedDate: '2026-10-15',
        startDate: '2026-10-15',
        endDate: '2026-11-15',
        status: 'active',
        shape: 'capsule',
        color: '#0E7C7B',
        timeSlots: ['Morning', 'Night'],
        daysLeft: 16,
        totalDays: 30,
        doseHistory: buildSeedDoseHistory(['Morning', 'Night'], 5, '2026-10-30', {
          Morning: { status: 'Taken', markedAt: '08:15 AM' },
        }),
        takenToday: { Morning: true, Night: false },
      },
      {
        id: 'med-2',
        name: 'Montelukast Sodium',
        dosage: '10 mg',
        strength: '10 mg',
        frequency: 'Once daily at bedtime',
        duration: '30 days',
        instructions: 'Take 1 tablet in evening with water',
        source: 'prescribed',
        prescribedBy: 'Dr. Aris Vance, MD on 2026-10-15',
        prescribedDate: '2026-10-15',
        startDate: '2026-10-15',
        endDate: '2026-11-15',
        status: 'active',
        shape: 'round',
        color: '#2563EB',
        timeSlots: ['Night'],
        daysLeft: 4, // low stock! refill needed
        totalDays: 30,
        doseHistory: buildSeedDoseHistory(['Night'], 5, '2026-10-30', {}),
        takenToday: { Night: false },
      },
      {
        id: 'med-3',
        name: 'Levocetirizine Dihydrochloride',
        dosage: '5 mg',
        strength: '5 mg',
        frequency: 'Once daily as needed',
        duration: '30 days',
        instructions: 'Take when allergy symptoms flare',
        source: 'prescribed',
        prescribedBy: 'Dr. Aris Vance, MD on 2026-10-15',
        prescribedDate: '2026-10-15',
        startDate: '2026-10-15',
        endDate: '2026-11-15',
        status: 'active',
        shape: 'oval',
        color: '#7C3AED',
        timeSlots: ['Night'],
        daysLeft: 24,
        totalDays: 30,
        doseHistory: buildSeedDoseHistory(['Night'], 5, '2026-10-30', {}),
        takenToday: { Night: false },
      },
      {
        id: 'med-4',
        name: 'Vitamin D3 Cholecalciferol',
        dosage: '60,000 IU',
        strength: '60,000 IU',
        frequency: 'Weekly',
        duration: '60 days',
        instructions: 'Take with milk after breakfast',
        source: 'manual',
        prescribedBy: 'Added manually by you on 2026-10-10',
        prescribedDate: '2026-10-10',
        startDate: '2026-10-10',
        endDate: '2026-12-10',
        status: 'active',
        shape: 'round',
        color: '#D97706',
        timeSlots: ['Morning'],
        daysLeft: 40,
        totalDays: 60,
        doseHistory: buildSeedDoseHistory(['Morning'], 5, '2026-10-30', {
          Morning: { status: 'Taken', markedAt: '09:00 AM' },
        }),
        takenToday: { Morning: true },
      },
    ],
    emergencyContacts: [
      { name: 'Michael Chen', relation: 'Spouse', phone: '+91 98112 34568' },
      { name: 'Elena Chen', relation: 'Mother', phone: '+91 98112 99887' },
    ],
    vaccinations: [
      { vaccine: 'COVID-19 Covishield', date: '2023-08-14', dose: 'Booster Dose 3' },
      { vaccine: 'Influenza Annual', date: '2025-10-10', dose: 'Annual Quadrivalent' },
      { vaccine: 'Tetanus Toxoid', date: '2024-04-12', dose: 'Booster' },
      { vaccine: 'Hepatitis B', date: '2022-01-19', dose: 'Complete 3-Dose Series' },
    ],
    lastViewedByDoctor: {
      doctorId: 'doc-1',
      doctorName: 'Dr. Aris Vance, MD',
      hospitalName: 'City Metro General Hospital',
      timestamp: '2026-10-28T14:30:00Z',
    },
  },
  {
    id: 'pat-2',
    uniquePatientId: 'PT00891',
    name: 'Rajesh Patel',
    email: 'rajesh.patel@example.com',
    phone: '+91 98220 12345',
    age: 49,
    gender: 'Male',
    bloodGroup: 'O+',
    allergies: ['NSAIDs / Ibuprofen (Gastric Bleed Risk)'],
    chronicConditions: ['Type 2 Diabetes Mellitus', 'Dyslipidemia'],
    currentMedicines: [
      { id: 'med-pat2-1', name: 'Metformin HCl', dosage: '1000 mg', frequency: 'Twice daily after meals' },
      { id: 'med-pat2-2', name: 'Atorvastatin', dosage: '20 mg', frequency: 'Once daily at night' },
    ],
    emergencyContacts: [
      { name: 'Meena Patel', relation: 'Wife', phone: '+91 98220 54321' },
      { name: 'Aarav Patel', relation: 'Son', phone: '+91 98220 98765' },
    ],
    vaccinations: [
      { vaccine: 'COVID-19 Covaxin', date: '2023-05-18', dose: 'Booster' },
      { vaccine: 'Pneumococcal Conjugate (PCV13)', date: '2024-11-04', dose: 'Single Dose' },
    ],
    lastViewedByDoctor: {
      doctorId: 'doc-3',
      doctorName: 'Dr. Rajesh Kulkarni, MS',
      hospitalName: 'City Metro General Hospital',
      timestamp: '2026-10-27T11:15:00Z',
    },
  },
  {
    id: 'pat-3',
    uniquePatientId: 'PT51829',
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+91 98711 55443',
    age: 28,
    gender: 'Female',
    bloodGroup: 'A+',
    allergies: [],
    chronicConditions: ['Hypothyroidism (Controlled)'],
    currentMedicines: [
      { id: 'med-pat3-1', name: 'Levothyroxine Sodium', dosage: '50 mcg', frequency: 'Morning empty stomach' },
      { id: 'med-pat3-2', name: 'Ferrous Ascorbate & Folic Acid', dosage: '100 mg', frequency: 'Once daily' },
    ],
    emergencyContacts: [
      { name: 'Siddharth Menon', relation: 'Husband', phone: '+91 98711 99881' },
    ],
    vaccinations: [
      { vaccine: 'COVID-19', date: '2023-03-21', dose: 'Booster' },
      { vaccine: 'Rubella (MMR)', date: '2021-06-15', dose: 'Dose 2' },
    ],
  },
  {
    id: 'pat-4',
    uniquePatientId: 'PT67123',
    name: 'David Miller',
    email: 'david.miller@example.com',
    phone: '+91 98991 77665',
    age: 62,
    gender: 'Male',
    bloodGroup: 'AB-',
    allergies: ['Aspirin', 'Iodinated Contrast Media (Severe Anaphylaxis)'],
    chronicConditions: ['Coronary Artery Disease', 'Hypertension Grade 2'],
    currentMedicines: [
      { id: 'med-pat4-1', name: 'Clopidogrel', dosage: '75 mg', frequency: 'Once daily' },
      { id: 'med-pat4-2', name: 'Telmisartan', dosage: '40 mg', frequency: 'Morning' },
      { id: 'med-pat4-3', name: 'Amlodipine', dosage: '5 mg', frequency: 'Evening' },
    ],
    emergencyContacts: [
      { name: 'Grace Miller', relation: 'Daughter', phone: '+91 98991 22334' },
    ],
    vaccinations: [
      { vaccine: 'Influenza', date: '2025-10-01', dose: 'Annual' },
      { vaccine: 'Shingles (Shingrix)', date: '2024-02-14', dose: 'Series Completed' },
    ],
    lastViewedByDoctor: {
      doctorId: 'doc-1',
      doctorName: 'Dr. Aris Vance, MD',
      hospitalName: 'City Metro General Hospital',
      timestamp: '2026-10-29T08:00:00Z',
    },
  },
  {
    id: 'pat-5',
    uniquePatientId: 'PT40291',
    name: 'Anita Sharma',
    email: 'anita.sharma@example.com',
    phone: '+91 98450 66778',
    age: 38,
    gender: 'Female',
    bloodGroup: 'O-',
    allergies: ['Ciprofloxacin', 'Latex Gloves'],
    chronicConditions: ['Migraine with Aura'],
    currentMedicines: [
      { id: 'med-pat5-1', name: 'Propranolol', dosage: '40 mg', frequency: 'Once daily (Prophylaxis)' },
    ],
    emergencyContacts: [
      { name: 'Vikram Sharma', relation: 'Brother', phone: '+91 98450 11223' },
    ],
    vaccinations: [{ vaccine: 'COVID-19', date: '2023-01-10', dose: 'Booster' }],
  },
  // Additional realistic patients for full roster
  {
    id: 'pat-6',
    uniquePatientId: 'PT72183',
    name: 'Kabir Verma',
    email: 'kabir.v@example.com',
    phone: '+91 98101 22334',
    age: 24,
    gender: 'Male',
    bloodGroup: 'B-',
    allergies: [],
    chronicConditions: [],
    currentMedicines: [],
    emergencyContacts: [{ name: 'Sunil Verma', relation: 'Father', phone: '+91 98101 99887' }],
    vaccinations: [{ vaccine: 'Tetanus', date: '2025-01-15', dose: 'Booster' }],
  },
  {
    id: 'pat-7',
    uniquePatientId: 'PT94810',
    name: 'Meera Sengupta',
    email: 'meera.s@example.com',
    phone: '+91 98202 33445',
    age: 54,
    gender: 'Female',
    bloodGroup: 'A-',
    allergies: ['Morphine (Nausea/Syncope)'],
    chronicConditions: ['Osteoarthritis (Bilateral Knees)'],
    currentMedicines: [{ id: 'med-pat7-1', name: 'Glucosamine Sulfate', dosage: '1500 mg', frequency: 'Daily' }],
    emergencyContacts: [{ name: 'Arjun Sengupta', relation: 'Son', phone: '+91 98202 88776' }],
    vaccinations: [{ vaccine: 'Influenza', date: '2025-09-12', dose: 'Annual' }],
  },
  {
    id: 'pat-8',
    uniquePatientId: 'PT11928',
    name: 'Rohan Deshmukh',
    email: 'rohan.d@example.com',
    phone: '+91 98303 44556',
    age: 41,
    gender: 'Male',
    bloodGroup: 'AB+',
    allergies: ['Peanuts'],
    chronicConditions: ['Gastroesophageal Reflux Disease (GERD)'],
    currentMedicines: [{ id: 'med-pat8-1', name: 'Pantoprazole', dosage: '40 mg', frequency: 'Morning before meals' }],
    emergencyContacts: [{ name: 'Tanvi Deshmukh', relation: 'Wife', phone: '+91 98303 11223' }],
    vaccinations: [{ vaccine: 'COVID-19', date: '2022-12-05', dose: 'Booster' }],
  },
  {
    id: 'pat-9',
    uniquePatientId: 'PT38294',
    name: 'Fatima Al-Mansoor',
    email: 'fatima.m@example.com',
    phone: '+91 98404 55667',
    age: 36,
    gender: 'Female',
    bloodGroup: 'O+',
    allergies: [],
    chronicConditions: ['Anemia (Iron Deficiency)'],
    currentMedicines: [{ id: 'med-pat9-1', name: 'Ferrous Fumarate', dosage: '200 mg', frequency: 'Twice daily' }],
    emergencyContacts: [{ name: 'Tariq Mansoor', relation: 'Husband', phone: '+91 98404 99001' }],
    vaccinations: [{ vaccine: 'Hepatitis B', date: '2023-04-10', dose: 'Booster' }],
  },
  {
    id: 'pat-10',
    uniquePatientId: 'PT65432',
    name: 'Gurpreet Singh',
    email: 'gurpreet.s@example.com',
    phone: '+91 98505 66778',
    age: 58,
    gender: 'Male',
    bloodGroup: 'B+',
    allergies: ['Cephalosporins'],
    chronicConditions: ['Chronic Kidney Disease Stage 2', 'Hypertension'],
    currentMedicines: [
      { id: 'med-pat10-1', name: 'Losartan', dosage: '50 mg', frequency: 'Daily' },
      { id: 'med-pat10-2', name: 'Torsemide', dosage: '10 mg', frequency: 'Morning' },
    ],
    emergencyContacts: [{ name: 'Harpreet Kaur', relation: 'Wife', phone: '+91 98505 22334' }],
    vaccinations: [{ vaccine: 'Pneumococcal', date: '2024-05-20', dose: 'Dose 1' }],
  },
  {
    id: 'pat-11',
    uniquePatientId: 'PT87654',
    name: 'Zoya Khan',
    email: 'zoya.khan@example.com',
    phone: '+91 98606 77889',
    age: 19,
    gender: 'Female',
    bloodGroup: 'A+',
    allergies: ['Dust Mites', 'Pollen'],
    chronicConditions: ['Allergic Rhinitis'],
    currentMedicines: [{ id: 'med-pat11-1', name: 'Cetirizine', dosage: '10 mg', frequency: 'As needed' }],
    emergencyContacts: [{ name: 'Imran Khan', relation: 'Father', phone: '+91 98606 11223' }],
    vaccinations: [{ vaccine: 'HPV Gardasil 9', date: '2023-09-18', dose: 'Completed 3 Doses' }],
  },
  {
    id: 'pat-12',
    uniquePatientId: 'PT23456',
    name: 'Vikramaditya Roy',
    email: 'vikram.roy@example.com',
    phone: '+91 98707 88990',
    age: 71,
    gender: 'Male',
    bloodGroup: 'O+',
    allergies: ['Penicillin G', 'Codeine'],
    chronicConditions: ['Atrial Fibrillation', 'Parkinsonism (Early Stage)'],
    currentMedicines: [
      { id: 'med-pat12-1', name: 'Apixaban (Eliquis)', dosage: '5 mg', frequency: 'Twice daily' },
      { id: 'med-pat12-2', name: 'Levodopa/Carbidopa', dosage: '100/25 mg', frequency: 'Thrice daily' },
    ],
    emergencyContacts: [{ name: 'Sunita Roy', relation: 'Wife', phone: '+91 98707 33445' }],
    vaccinations: [{ vaccine: 'Influenza + COVID-19', date: '2025-10-15', dose: 'Co-administered' }],
  },
  {
    id: 'pat-13',
    uniquePatientId: 'PT45678',
    name: 'Aisha Banerjee',
    email: 'aisha.b@example.com',
    phone: '+91 98808 99001',
    age: 29,
    gender: 'Female',
    bloodGroup: 'AB+',
    allergies: [],
    chronicConditions: ['Polycystic Ovary Syndrome (PCOS)'],
    currentMedicines: [{ id: 'med-pat13-1', name: 'Myo-Inositol', dosage: '2000 mg', frequency: 'Morning' }],
    emergencyContacts: [{ name: 'Debashis Banerjee', relation: 'Father', phone: '+91 98808 44556' }],
    vaccinations: [{ vaccine: 'Tetanus', date: '2024-08-01', dose: 'Booster' }],
  },
  {
    id: 'pat-14',
    uniquePatientId: 'PT78901',
    name: 'Karthik Ramanathan',
    email: 'karthik.r@example.com',
    phone: '+91 98909 00112',
    age: 44,
    gender: 'Male',
    bloodGroup: 'A-',
    allergies: ['Shellfish'],
    chronicConditions: ['Hyperuricemia / Gout'],
    currentMedicines: [{ id: 'med-pat14-1', name: 'Febuxostat', dosage: '40 mg', frequency: 'Daily' }],
    emergencyContacts: [{ name: 'Deepa Ramanathan', relation: 'Wife', phone: '+91 98909 55667' }],
    vaccinations: [{ vaccine: 'COVID-19', date: '2023-02-14', dose: 'Booster' }],
  },
  {
    id: 'pat-15',
    uniquePatientId: 'PT90123',
    name: 'Anushka Joshi',
    email: 'anushka.j@example.com',
    phone: '+91 98110 11223',
    age: 34,
    gender: 'Female',
    bloodGroup: 'B+',
    allergies: ['Sulfa drugs'],
    chronicConditions: ['Generalized Anxiety Disorder'],
    currentMedicines: [{ id: 'med-pat15-1', name: 'Escitalopram', dosage: '10 mg', frequency: 'Morning' }],
    emergencyContacts: [{ name: 'Amit Joshi', relation: 'Husband', phone: '+91 98110 66778' }],
    vaccinations: [{ vaccine: 'Influenza', date: '2025-10-05', dose: 'Annual' }],
  },
];

const INITIAL_REPORTS: MedicalReport[] = [
  {
    id: 'rep-1',
    patientId: 'pat-1',
    title: 'High-Resolution Chest CT & Pulmonary Function Test',
    category: 'Radiology',
    date: '2026-09-15',
    doctorName: 'Dr. Sameer Kapoor, MD (Pulmonology)',
    hospitalName: 'City Metro General Hospital',
    fileUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
    fileType: 'image',
    summary: 'Clear lung parenchyma without consolidation or focal lesions. FEV1/FVC ratio 78% responsive to bronchodilators.',
    findings: 'Compatible with controlled bronchial asthma. No ground glass opacities.',
  },
  {
    id: 'rep-2',
    patientId: 'pat-1',
    title: 'Comprehensive Metabolic Panel & Complete Blood Count',
    category: 'Blood Test',
    date: '2026-08-20',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalName: 'City Metro General Hospital',
    fileUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
    fileType: 'pdf',
    summary: 'Hemoglobin 13.8 g/dL, WBC 6,400 /uL, Platelets 280,000 /uL. Serum Creatinine 0.82 mg/dL. All parameters within normal reference ranges.',
  },
  {
    id: 'rep-3',
    patientId: 'pat-1',
    title: '12-Lead Electrocardiogram (ECG)',
    category: 'Cardiology',
    date: '2026-10-10',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalName: 'City Metro General Hospital',
    fileUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80',
    fileType: 'image',
    summary: 'Normal sinus rhythm at 72 bpm. Normal axis, no ST-T segment elevation or depression. PR interval 158 ms.',
  },
  {
    id: 'rep-4',
    patientId: 'pat-2',
    title: 'HbA1c & Fasting Lipid Panel',
    category: 'Pathology',
    date: '2026-10-05',
    doctorName: 'Dr. Neha Gupta, MD (Endocrinology)',
    hospitalName: 'City Metro General Hospital',
    fileUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
    fileType: 'pdf',
    summary: 'HbA1c 6.8% (Target < 7.0%). Total Cholesterol 182 mg/dL, LDL 96 mg/dL, Triglycerides 148 mg/dL.',
  },
  {
    id: 'rep-5',
    patientId: 'pat-4',
    title: 'Color Doppler Echocardiography',
    category: 'Cardiology',
    date: '2026-07-22',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalName: 'City Metro General Hospital',
    fileUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
    fileType: 'image',
    summary: 'Left ventricular ejection fraction (LVEF) 54%. Mild concentric LV hypertrophy. Grade 1 diastolic dysfunction. No significant regurgitation.',
  },
];

const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'pr-1',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    uniquePatientId: 'PT00234',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    doctorSpecialty: 'Senior Cardiologist',
    hospitalName: 'City Metro General Hospital',
    date: '2026-10-28',
    diagnosis: 'Bronchial Asthma maintenance with seasonal mild tachycardia',
    symptoms: 'Mild shortness of breath during brisk walking, occasional night wheezing',
    medicines: [
      {
        name: 'Budesonide + Formoterol Inhaler',
        dose: '200/6 mcg',
        frequency: '2 puffs twice daily',
        duration: '30 days',
        instructions: 'Rinse mouth thoroughly with water after inhalation.',
      },
      {
        name: 'Levocetirizine',
        dose: '5 mg',
        frequency: '1 tablet once daily at night',
        duration: '14 days',
        instructions: 'Take after dinner.',
      },
    ],
    labTestsOrdered: ['Serum IgE Level', 'Repeat Peak Expiratory Flow Rate (PEFR)'],
    followUpDate: '2026-11-28',
    notes: 'Avoid cold exposure and known tree nut allergens. Patient educated on correct inhaler spacer technique.',
  },
  {
    id: 'pr-2',
    patientId: 'pat-2',
    patientName: 'Rajesh Patel',
    uniquePatientId: 'PT00891',
    doctorId: 'doc-3',
    doctorName: 'Dr. Rajesh Kulkarni, MS',
    doctorSpecialty: 'Orthopedic Surgeon',
    hospitalName: 'City Metro General Hospital',
    date: '2026-10-20',
    diagnosis: 'Right Knee Patellofemoral Pain Syndrome (Mild)',
    symptoms: 'Anterior right knee pain when descending stairs',
    medicines: [
      {
        name: 'Paracetamol Controlled Release',
        dose: '650 mg',
        frequency: '1 tablet twice daily after food',
        duration: '7 days',
        instructions: 'Do NOT use NSAIDs / Ibuprofen due to known gastric allergy.',
      },
      {
        name: 'Diacerein + Glucosamine',
        dose: '50/750 mg',
        frequency: '1 tablet once daily',
        duration: '30 days',
        instructions: 'Take with main meal.',
      },
    ],
    labTestsOrdered: ['Right Knee Weight-Bearing X-Ray (AP & Lateral)'],
    followUpDate: '2026-11-15',
    notes: 'Prescribed quadriceps isometric exercises and cycling.',
  },
];

const INITIAL_QUEUE: QueueToken[] = [
  {
    id: 'q-0',
    tokenNumber: 'C-00',
    patientId: 'pat-10',
    patientName: 'Gurpreet Singh',
    uniquePatientId: 'PT65432',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'in_consultation',
    reason: 'Post-MI follow-up evaluation',
    priority: 'urgent',
    createdAt: '2026-10-29T08:00:00Z',
    estimatedWaitMinutes: 0,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '09:00 AM',
    fee: 800,
  },
  {
    id: 'q-1',
    tokenNumber: 'C-01',
    patientId: 'pat-2',
    patientName: 'Rajesh Patel',
    uniquePatientId: 'PT00891',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Pre-operative cardiac clearance for elective orthopedics',
    priority: 'normal',
    createdAt: '2026-10-29T08:15:00Z',
    estimatedWaitMinutes: 8,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '09:30 AM',
    fee: 800,
  },
  {
    id: 'q-2',
    tokenNumber: 'C-02',
    patientId: 'pat-4',
    patientName: 'David Miller',
    uniquePatientId: 'PT67123',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Blood pressure fluctuation check',
    priority: 'normal',
    createdAt: '2026-10-29T08:25:00Z',
    estimatedWaitMinutes: 16,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '10:00 AM',
    fee: 800,
  },
  {
    id: 'q-3',
    tokenNumber: 'C-03',
    patientId: 'pat-7',
    patientName: 'Meera Sengupta',
    uniquePatientId: 'PT94810',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Palpitation evaluation & ECG review',
    priority: 'normal',
    createdAt: '2026-10-29T08:35:00Z',
    estimatedWaitMinutes: 24,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '10:30 AM',
    fee: 800,
  },
  {
    id: 'q-3b',
    tokenNumber: 'C-03B',
    patientId: 'pat-5',
    patientName: 'Anita Sharma',
    uniquePatientId: 'PT40291',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Holter monitor rhythm review',
    priority: 'normal',
    createdAt: '2026-10-29T08:45:00Z',
    estimatedWaitMinutes: 32,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '11:00 AM',
    fee: 800,
  },
  {
    id: 'q-4',
    tokenNumber: 'C-04',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    uniquePatientId: 'PT00234',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    department: 'Cardiology',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Routine quarterly cardiac & asthma follow-up',
    priority: 'normal',
    createdAt: '2026-10-29T08:55:00Z',
    estimatedWaitMinutes: 40,
    roomNumber: 'Cabin 3',
    appointmentDate: '2026-10-29',
    timeSlot: '11:30 AM',
    fee: 800,
  },
  {
    id: 'q-ortho-2',
    tokenNumber: 'O-02',
    patientId: 'pat-7',
    patientName: 'Meera Sengupta',
    uniquePatientId: 'PT94810',
    doctorId: 'doc-3',
    doctorName: 'Dr. Rajesh Kulkarni, MS',
    department: 'Orthopedics',
    hospitalId: 'hosp-1',
    status: 'waiting',
    reason: 'Bilateral knee joint stiffness',
    priority: 'normal',
    createdAt: '2026-10-29T09:00:00Z',
    estimatedWaitMinutes: 15,
    roomNumber: 'Room 7',
    appointmentDate: '2026-10-29',
    timeSlot: '10:00 AM',
    fee: 750,
  },
  {
    id: 'q-5',
    tokenNumber: 'E-01',
    patientId: 'pat-10',
    patientName: 'Gurpreet Singh',
    uniquePatientId: 'PT65432',
    doctorId: 'doc-2',
    doctorName: 'Dr. Priya Sharma, MS',
    department: 'Emergency & Trauma',
    hospitalId: 'hosp-2',
    status: 'in_consultation',
    reason: 'Acute severe flank pain and hematuria',
    priority: 'urgent',
    createdAt: '2026-10-29T09:10:00Z',
    estimatedWaitMinutes: 0,
    roomNumber: 'Trauma Bay 1',
    appointmentDate: '2026-10-29',
    timeSlot: '09:00 AM',
    fee: 600,
  },
];

const INITIAL_ACCESS_LOGS: AccessLog[] = [
  {
    id: 'log-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalId: 'hosp-1',
    hospitalName: 'City Metro General Hospital',
    timestamp: '2026-10-28T14:30:15Z',
    purpose: 'Cardiology follow-up & medication review',
    accessType: 'routine',
  },
  {
    id: 'log-2',
    patientId: 'pat-1',
    doctorId: 'doc-2',
    doctorName: 'Dr. Priya Sharma, MS',
    hospitalId: 'hosp-2',
    hospitalName: 'St. Jude Trauma Institute',
    timestamp: '2026-05-12T03:22:00Z',
    purpose: 'Acute allergic reaction triage in emergency department',
    accessType: 'emergency_break_glass',
    reason: 'Patient arrived with acute respiratory distress and severe lip edema; required urgent verification of penicillin & nut allergy profile.',
  },
  {
    id: 'log-3',
    patientId: 'pat-2',
    doctorId: 'doc-3',
    doctorName: 'Dr. Rajesh Kulkarni, MS',
    hospitalId: 'hosp-1',
    hospitalName: 'City Metro General Hospital',
    timestamp: '2026-10-27T11:15:30Z',
    purpose: 'Knee joint consultation and prescription creation',
    accessType: 'routine',
  },
];

const INITIAL_CONSENT_RULES: ConsentRule[] = [
  {
    id: 'cs-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalName: 'City Metro General Hospital',
    grantedAt: '2026-01-10T10:00:00Z',
    status: 'active',
    accessCount: 14,
  },
  {
    id: 'cs-2',
    patientId: 'pat-1',
    doctorId: 'doc-3',
    doctorName: 'Dr. Rajesh Kulkarni, MS',
    hospitalName: 'City Metro General Hospital',
    grantedAt: '2026-08-15T12:00:00Z',
    status: 'active',
    accessCount: 3,
  },
  {
    id: 'cs-3',
    patientId: 'pat-2',
    doctorId: 'doc-1',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalName: 'City Metro General Hospital',
    grantedAt: '2026-10-01T09:30:00Z',
    status: 'active',
    accessCount: 5,
  },
];

const INITIAL_OPERATIONS: OperationItem[] = [
  {
    id: 'ot-1',
    theatreNumber: 'OT-1 (Cardiac Suite)',
    procedureName: 'Percutaneous Coronary Angioplasty (PTCA)',
    patientName: 'David Miller',
    uniquePatientId: 'MT-671234',
    surgeonName: 'Dr. Aris Vance, MD',
    hospitalId: 'hosp-1',
    status: 'in_progress',
    startTime: '2026-10-29T07:30:00Z',
    durationEstimate: '90 mins (65 mins elapsed)',
  },
  {
    id: 'ot-2',
    theatreNumber: 'OT-2 (Orthopedic Robotic)',
    procedureName: 'Total Knee Arthroplasty (Right)',
    patientName: 'Meera Sengupta',
    uniquePatientId: 'MT-948102',
    surgeonName: 'Dr. Rajesh Kulkarni, MS',
    hospitalId: 'hosp-1',
    status: 'scheduled',
    startTime: '2026-10-29T11:00:00Z',
    durationEstimate: '120 mins',
  },
  {
    id: 'ot-3',
    theatreNumber: 'OT-3 (Trauma Emergency)',
    procedureName: 'Exploratory Laparotomy & Splenic Repair',
    patientName: 'Emergency Casualty #109',
    uniquePatientId: 'MT-119283',
    surgeonName: 'Dr. Priya Sharma, MS',
    hospitalId: 'hosp-2',
    status: 'completed',
    startTime: '2026-10-29T04:15:00Z',
    durationEstimate: '110 mins (Completed at 06:05)',
  },
];

const INITIAL_LAB_ORDERS: LabOrder[] = [
  {
    id: 'lab-1',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    uniquePatientId: 'MT-892104',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalId: 'hosp-1',
    testName: 'Serum Total IgE & Allergen Profile',
    category: 'Immunology',
    orderedAt: '2026-10-28T14:40:00Z',
    status: 'sample_collected',
  },
  {
    id: 'lab-2',
    patientId: 'pat-2',
    patientName: 'Rajesh Patel',
    uniquePatientId: 'MT-304912',
    doctorName: 'Dr. Rajesh Kulkarni, MS',
    hospitalId: 'hosp-1',
    testName: 'Knee Joint Synovial Fluid Analysis',
    category: 'Pathology',
    orderedAt: '2026-10-27T11:30:00Z',
    status: 'uploaded_to_locker',
  },
  {
    id: 'lab-3',
    patientId: 'pat-4',
    patientName: 'David Miller',
    uniquePatientId: 'MT-671234',
    doctorName: 'Dr. Aris Vance, MD',
    hospitalId: 'hosp-1',
    testName: 'High Sensitivity Troponin-I & CK-MB',
    category: 'Cardiology Marker',
    orderedAt: '2026-10-29T08:05:00Z',
    status: 'report_ready',
  },
];

const INITIAL_PHARMACY: PharmacyItem[] = [
  {
    id: 'ph-1',
    hospitalId: 'hosp-1',
    name: 'Epinephrine Auto-Injector (0.3mg)',
    category: 'Emergency Anaphylaxis',
    stock: 4,
    minThreshold: 10, // LOW STOCK RISK!
    unit: 'vials',
    dosageForm: 'Injectable',
  },
  {
    id: 'ph-2',
    hospitalId: 'hosp-1',
    name: 'Amoxicillin + Clavulanate (625mg)',
    category: 'Broad Spectrum Antibiotic',
    stock: 18,
    minThreshold: 50, // LOW STOCK RISK!
    unit: 'strips',
    dosageForm: 'Tablet',
  },
  {
    id: 'ph-3',
    hospitalId: 'hosp-1',
    name: 'Metformin HCl (1000mg ER)',
    category: 'Anti-Diabetic',
    stock: 240,
    minThreshold: 40,
    unit: 'tablets',
    dosageForm: 'Tablet',
  },
  {
    id: 'ph-4',
    hospitalId: 'hosp-1',
    name: 'Atorvastatin (20mg)',
    category: 'Cardiovascular / Statin',
    stock: 180,
    minThreshold: 30,
    unit: 'tablets',
    dosageForm: 'Tablet',
  },
  {
    id: 'ph-5',
    hospitalId: 'hosp-1',
    name: 'Budesonide ResDecoder Inhaler',
    category: 'Respiratory',
    stock: 65,
    minThreshold: 20,
    unit: 'inhalers',
    dosageForm: 'MDI Aerosol',
  },
  {
    id: 'ph-6',
    hospitalId: 'hosp-1',
    name: 'Normal Saline (0.9% 500ml IV)',
    category: 'Intravenous Fluids',
    stock: 350,
    minThreshold: 100,
    unit: 'IV bags',
    dosageForm: 'Infusion',
  },
];

const INITIAL_AMBULANCES: AmbulanceUnit[] = [
  {
    id: 'amb-1',
    unitCode: 'AMB-104',
    driverName: 'Satish Kumar',
    paramedicName: 'Lead Paramedic Roy',
    phone: '+91 98765 00104',
    type: 'ALS Mobile ICU',
    baseLocation: 'Barakhamba Circle Dispatch Post',
    lat: 28.625,
    lng: 77.218,
    status: 'en_route',
    etaMinutes: 3,
    distanceKm: 0.8,
    equipment: ['Oxygen Ventilator', 'AED Defibrillator', 'Spine Board', 'Suction Unit', 'IV Infusion'],
  },
  {
    id: 'amb-2',
    unitCode: 'AMB-108',
    driverName: 'Vinod Sharma',
    paramedicName: 'Paramedic Sunita',
    phone: '+91 98110 00108',
    type: 'BLS Rapid Care',
    baseLocation: 'Connaught Place Central Hub',
    lat: 28.633,
    lng: 77.216,
    status: 'available',
    etaMinutes: 5,
    distanceKm: 1.4,
    equipment: ['Oxygen Cylinder', 'Burn Dressing Kits', 'Foldable Stretcher', 'C-Collar'],
  },
  {
    id: 'amb-3',
    unitCode: 'AMB-112',
    driverName: 'Gurdeep Singh',
    paramedicName: 'Dr. R. Taneja (Field MD)',
    phone: '+91 98701 00112',
    type: 'Trauma Ambulance',
    baseLocation: 'Janpath Metro Post',
    lat: 28.621,
    lng: 77.219,
    status: 'available',
    etaMinutes: 6,
    distanceKm: 1.9,
    equipment: ['Chest Tube Tray', 'Portable Ultrasound', 'Blood Warmers', 'Intubation Kit'],
  },
  {
    id: 'amb-4',
    unitCode: 'AMB-115',
    driverName: 'Ashok Yadav',
    paramedicName: 'Paramedic Team 12',
    phone: '+91 98765 00115',
    type: 'ALS Mobile ICU',
    baseLocation: 'Okhla Industrial Station',
    lat: 28.538,
    lng: 77.271,
    status: 'available',
    etaMinutes: 8,
    distanceKm: 3.2,
    equipment: ['Cardiac Monitor', 'Mechanical CPR', 'Defibrillator', 'Advanced Airway'],
  },
];

const INITIAL_EMERGENCIES: EmergencyCase[] = [
  {
    id: 'INC-2026-0001',
    callerName: 'Rahul Verma (Witness)',
    callerPhone: '+91 98119 88776',
    emergencyType: 'accident',
    victimsCount: 2,
    severity: 'critical',
    lat: 28.6189,
    lng: 77.2144,
    address: 'Near Janpath Crossing / Tolstoy Marg, New Delhi',
    description: 'Two-wheeler and sedan collision. One victim unconscious with visible head trauma, second victim with fractured lower limb.',
    photoUrl: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80',
    reportedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    status: 'Helpers Responding',
    assignedAmbulance: {
      id: 'amb-1',
      unitCode: 'AMB-104',
      driverName: 'Satish Kumar',
      paramedicName: 'Lead Paramedic Roy',
      phone: '+91 98765 00104',
      type: 'ALS Mobile ICU',
      baseLocation: 'Barakhamba Circle Dispatch Post',
      lat: 28.625,
      lng: 77.218,
      status: 'en_route',
      etaMinutes: 3,
      distanceKm: 0.8,
      equipment: ['Oxygen Ventilator', 'AED Defibrillator', 'Spine Board'],
    },
    ambulanceDispatchedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    ambulanceEtaMinutes: 3,
    helpers: [
      {
        id: 'hlp-1',
        name: 'Dr. Kabir Roy',
        phone: '+91 98102 33445',
        distanceKm: 0.3,
        etaMinutes: 2,
        roleChoice: 'help_scene',
        roleLabel: 'Help at Scene',
        status: 'arrived',
        acceptedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        arrivedAtScene: true,
        assistanceGiven: true,
        assistanceNotes: 'Airway clear. Direct pressure on bleeding scalp wound applied. C-spine stabilized.',
      },
      {
        id: 'hlp-2',
        name: 'Aarav Sharma',
        phone: '+91 98711 66554',
        distanceKm: 0.9,
        etaMinutes: 3,
        roleChoice: 'guide_ambulance',
        roleLabel: 'Guide Ambulance',
        status: 'accepted',
        acceptedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
        sceneDetails: {
          exactSpot: 'Right lane past Janpath intersection near red post box',
          landmarks: 'Opposite Central Park Gate 4',
          roadBlocks: 'Left lane occupied by disabled scooter; center and right lanes wide open',
          victimCount: 2,
          photoUrl: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80',
          shortNote: 'I am holding traffic to guide AMB-104 directly to the curbside.',
          updatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        },
      },
    ],
    destinationHospitalId: 'hosp-1',
    destinationHospitalName: 'City Metro General Hospital',
    transportingEntity: 'ambulance',
    hospitalReadinessConfirmed: true,
    etaMinutes: 5,
    vitals: {
      bloodPressure: '110/72',
      heartRate: 96,
      spo2: 95,
      gcs: 14,
      respiratoryRate: 20,
      conditionNotes: 'C-spine immobilized, IV saline started, pupil reflex responsive.',
      recordedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      recordedBy: 'AMB-104 Lead Paramedic Roy',
    },
    timeline: [
      { id: 'tl-1', timestamp: '13:08:12', event: 'One-Tap SOS broadcasted by witness', who: 'Witness: Rahul Verma', role: 'witness' },
      { id: 'tl-2', timestamp: '13:08:14', event: 'Dispatcher Alerted at 108 Command; nearby users notified within 3km', who: 'Central Dispatch System', role: 'dispatcher' },
      { id: 'tl-3', timestamp: '13:08:45', event: 'Ambulance AMB-104 Dispatched (ETA 3 mins)', who: 'Dispatcher: Officer Neha', role: 'dispatcher' },
      { id: 'tl-4', timestamp: '13:09:10', event: 'Nearby App User Dr. Kabir Roy accepted "Help at Scene" (0.3 km away)', who: 'Helper: Dr. Kabir Roy', role: 'helper' },
      { id: 'tl-5', timestamp: '13:09:40', event: 'Nearby App User Aarav Sharma accepted "Guide Ambulance" (0.9 km away)', who: 'Helper: Aarav Sharma', role: 'helper' },
      { id: 'tl-6', timestamp: '13:10:30', event: 'Dr. Kabir Roy arrived at scene: Airway cleared, direct pressure applied', who: 'Helper: Dr. Kabir Roy', role: 'helper' },
      { id: 'tl-7', timestamp: '13:11:15', event: 'Ambulance Guide update posted: Lane 1 cleared for AMB-104 entry', who: 'Helper: Aarav Sharma', role: 'helper' },
      { id: 'tl-8', timestamp: '13:13:00', event: 'Ambulance AMB-104 arrived at scene; paramedic began triage assessment', who: 'Paramedic: AMB-104', role: 'paramedic' },
    ],
  },
  {
    id: 'INC-2026-0002',
    callerName: 'Sunita Mehra (Metro Commuter)',
    callerPhone: '+91 98112 44332',
    emergencyType: 'collapse',
    victimsCount: 1,
    severity: 'critical',
    lat: 28.6328,
    lng: 77.2195,
    address: 'Rajiv Chowk Metro Station Gate 3, Connaught Place',
    description: 'Elderly male collapsed on escalator landing. Unresponsive, shallow breathing, pulse weak.',
    photoUrl: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80',
    reportedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    status: 'Dispatcher Alerted',
    helpers: [],
    timeline: [
      { id: 'tl-201', timestamp: '13:14:02', event: 'One-Tap SOS broadcasted by commuter', who: 'Witness: Sunita Mehra', role: 'witness' },
      { id: 'tl-202', timestamp: '13:14:04', event: 'Dispatcher Alerted at 108 Command; broadcast sent to nearby responders', who: 'System Auto-Route', role: 'system' },
    ],
  },
  {
    id: 'INC-2026-0003',
    callerName: 'Vikas Grover (Shop Owner)',
    callerPhone: '+91 98230 77112',
    emergencyType: 'burn',
    victimsCount: 1,
    severity: 'urgent',
    lat: 28.6415,
    lng: 77.2152,
    address: 'Paharganj Main Bazaar, Near Imperial Cinema',
    description: 'Commercial kitchen grease fire flashback. 2nd degree thermal burns across forearms and torso.',
    photoUrl: 'https://images.unsplash.com/photo-1542884748-2b87b36c6b90?auto=format&fit=crop&w=800&q=80',
    reportedAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    status: 'Assessment and Transport',
    assignedAmbulance: {
      id: 'amb-2',
      unitCode: 'AMB-108',
      driverName: 'Vinod Sharma',
      paramedicName: 'Paramedic Sunita',
      phone: '+91 98110 00108',
      type: 'BLS Rapid Care',
      baseLocation: 'Connaught Place Central Hub',
      lat: 28.633,
      lng: 77.216,
      status: 'transporting',
      etaMinutes: 6,
      distanceKm: 1.4,
      equipment: ['Burn Dressing Kits', 'Oxygen'],
    },
    destinationHospitalId: 'hosp-2',
    destinationHospitalName: 'St. Jude Trauma & Cardiac Institute',
    transportingEntity: 'ambulance',
    hospitalReadinessConfirmed: true,
    etaMinutes: 6,
    vitals: {
      bloodPressure: '128/84',
      heartRate: 104,
      spo2: 98,
      gcs: 15,
      respiratoryRate: 20,
      conditionNotes: 'Sterile moist dressings applied, IV cannula placed, pain analgesia initiated.',
      recordedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      recordedBy: 'AMB-108 Paramedic Sunita',
    },
    timeline: [
      { id: 'tl-301', timestamp: '12:51:10', event: 'One-Tap SOS broadcasted', who: 'Witness: Vikas Grover', role: 'witness' },
      { id: 'tl-302', timestamp: '12:51:12', event: 'Dispatcher Alerted at Central Hub', who: 'System', role: 'system' },
      { id: 'tl-303', timestamp: '12:52:00', event: 'Ambulance AMB-108 Dispatched by Dispatcher Neha', who: 'Dispatcher', role: 'dispatcher' },
      { id: 'tl-304', timestamp: '12:58:30', event: 'Ambulance En Route arrived at scene; wound dressings applied', who: 'Paramedic: AMB-108', role: 'paramedic' },
      { id: 'tl-305', timestamp: '13:06:15', event: 'Assessment and Transport initiated toward St. Jude Trauma Institute', who: 'Paramedic Sunita', role: 'paramedic' },
    ],
  },
  {
    id: 'INC-2026-0004',
    callerName: 'Traffic Police Post 4',
    callerPhone: '+91 11 2301 0000',
    emergencyType: 'accident',
    victimsCount: 1,
    severity: 'moderate',
    lat: 28.6129,
    lng: 77.2295,
    address: 'India Gate C-Hexagon / Shahjahan Road',
    description: 'Minor fender bender with neck sprain and glass abrasions. Resolved and discharged from ER.',
    reportedAt: new Date(Date.now() - 190 * 60 * 1000).toISOString(),
    status: 'Closed',
    closedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    closeSummary: 'Patient fully examined in ER, laceration cleaned and dressed, discharged safely in ambulatory condition.',
    destinationHospitalId: 'hosp-1',
    destinationHospitalName: 'City Metro General Hospital',
    hospitalBedAssigned: 'Trauma Observation Bed 4',
    timeline: [
      { id: 'tl-401', timestamp: '10:15:00', event: 'One-Tap SOS broadcasted', who: 'Witness: Police Post 4', role: 'witness' },
      { id: 'tl-402', timestamp: '10:15:30', event: 'Dispatcher Alerted', who: 'System', role: 'system' },
      { id: 'tl-403', timestamp: '10:16:00', event: 'Ambulance AMB-112 Dispatched', who: 'Dispatcher', role: 'dispatcher' },
      { id: 'tl-404', timestamp: '10:24:00', event: 'Hospital Handover confirmed at City Metro General (Bed 4)', who: 'City Metro ER Desk', role: 'hospital' },
      { id: 'tl-405', timestamp: '11:45:00', event: 'Incident Closed by Dispatcher', who: 'Dispatcher: Officer Neha', role: 'dispatcher' },
    ],
  },
];

const INITIAL_NOTIFICATIONS: InAppNotification[] = [
  {
    id: 'notif-1',
    recipientRole: 'patient',
    recipientPatientId: 'pat-1',
    title: 'Your Turn Is Approaching!',
    message: 'Token #C-04 is currently active. Please proceed to Room 4 for Dr. Aris Vance.',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    read: false,
    type: 'queue',
  },
  {
    id: 'notif-2',
    recipientRole: 'doctor',
    recipientDoctorId: 'doc-1',
    title: '⚠️ Critical Allergy Warning',
    message: 'Current patient Sarah Chen (MT-892104) has severe PENICILLIN & NUT anaphylaxis allergies.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    type: 'access',
  },
  {
    id: 'notif-3',
    recipientRole: 'hospital',
    title: '🚨 Code Red: Incoming Trauma Collision',
    message: 'EMS Unit 104 en route with 2 critical victims. ETA 5 minutes. Beds reserved in Trauma Bay.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    type: 'emergency',
  },
];

const INITIAL_BILLS: PaymentBill[] = [
  {
    id: 'INV-2026-001',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-10-24',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    doctorName: 'Dr. Aris Vance, MD',
    category: 'Consultation',
    description: 'Quarterly Cardiology OPD Consultation & ECG Review',
    amount: 800,
    insuranceCovered: 500,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-772910384192',
    paidAt: '2026-10-24T11:30:00Z',
  },
  {
    id: 'INV-2026-002',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-10-25',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    category: 'Lab test',
    description: 'Cardiac Enzyme Profile & Lipid Panel',
    amount: 1450,
    insuranceCovered: 1000,
    status: 'Paid',
    paymentMethod: 'Card',
    transactionRef: 'TXN-992014829',
    paidAt: '2026-10-25T09:15:00Z',
  },
  {
    id: 'INV-2026-003',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-10-28',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    category: 'Medicine',
    description: 'Budesonide Inhaler 200mcg & Montelukast 10mg Refill',
    amount: 920,
    insuranceCovered: 0,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-884102948102',
    paidAt: '2026-10-28T16:45:00Z',
  },
  {
    id: 'INV-2026-004',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-10-29',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    doctorName: 'Dr. Priya Desai, MD',
    category: 'Consultation',
    description: 'Pulmonology Spirometry Evaluation follow-up',
    amount: 750,
    insuranceCovered: 0,
    status: 'Pending',
  },
  {
    id: 'INV-2026-005',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-09-15',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    category: 'Ambulance',
    description: 'Tier-1 Advanced Cardiac Life Support Transport',
    amount: 1200,
    insuranceCovered: 1200,
    status: 'Paid',
    paymentMethod: 'Insurance',
    transactionRef: 'INS-CLM-883921',
    paidAt: '2026-09-15T18:00:00Z',
  },
  {
    id: 'INV-2026-006',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-08-14',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    doctorName: 'Dr. Aris Vance, MD',
    category: 'Consultation',
    description: 'Mid-Year Interventional Cardiology Review & Treadmill Stress Test',
    amount: 2200,
    insuranceCovered: 1000,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-662910482910',
    paidAt: '2026-08-14T11:45:00Z',
  },
  {
    id: 'INV-2026-007',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-08-20',
    hospitalName: 'MediTrack Online Partner Pharmacy',
    hospitalId: 'hosp-1',
    category: 'Medicine',
    description: 'Quarterly Maintenance Pack: Atorvastatin 20mg & Aspirin 75mg',
    amount: 1000,
    insuranceCovered: 0,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-771928401928',
    paidAt: '2026-08-20T15:20:00Z',
  },
  {
    id: 'INV-2026-008',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-07-22',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    category: 'Lab test',
    description: 'Comprehensive Metabolic Panel & Serum Electrolytes',
    amount: 1350,
    insuranceCovered: 500,
    status: 'Paid',
    paymentMethod: 'Card',
    transactionRef: 'TXN-883019283',
    paidAt: '2026-07-22T10:15:00Z',
  },
  {
    id: 'INV-2026-009',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-06-18',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    doctorName: 'Dr. Priya Desai, MD',
    category: 'Consultation',
    description: 'Pulmonology Airway Allergy & Bronchodilator Assessment',
    amount: 900,
    insuranceCovered: 400,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-552910293810',
    paidAt: '2026-06-18T14:00:00Z',
  },
  {
    id: 'INV-2026-010',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-06-25',
    hospitalName: 'MediTrack Online Partner Pharmacy',
    hospitalId: 'hosp-1',
    category: 'Medicine',
    description: 'Budesonide Turbuhaler & Levocetirizine Refill (Tata 1mg)',
    amount: 1500,
    insuranceCovered: 800,
    status: 'Paid',
    paymentMethod: 'Card',
    transactionRef: 'TXN-774019281',
    paidAt: '2026-06-25T16:30:00Z',
  },
  {
    id: 'INV-2026-011',
    patientId: 'pat-1',
    patientName: 'Sarah Chen',
    date: '2026-05-10',
    hospitalName: 'City Metro General Hospital',
    hospitalId: 'hosp-1',
    doctorName: 'Dr. Aris Vance, MD',
    category: 'Consultation',
    description: 'Annual Executive Health Screen & 2D Echocardiography',
    amount: 1600,
    insuranceCovered: 800,
    status: 'Paid',
    paymentMethod: 'UPI',
    transactionRef: 'UPI-441928301928',
    paidAt: '2026-05-10T11:00:00Z',
  },
  {
    id: 'INV-2026-012',
    patientId: 'pat-2',
    patientName: 'Rajesh Patel',
    date: '2026-10-27',
    hospitalName: 'St. Jude Trauma & Cardiac Institute',
    hospitalId: 'hosp-2',
    doctorName: 'Dr. Vikram Malhotra, MS',
    category: 'Surgery',
    description: 'Arthroscopic Meniscal Debridement',
    amount: 45000,
    insuranceCovered: 38000,
    status: 'Paid',
    paymentMethod: 'Insurance',
    transactionRef: 'INS-CLM-901234',
    paidAt: '2026-10-27T14:20:00Z',
  },
];

const INITIAL_DOCTOR_EVENTS: DoctorCalendarEvent[] = [
  // Indian National Holidays for 2026-2027
  { id: 'hol-1', doctorId: 'all', title: 'Republic Day', type: 'holiday', date: '2026-01-26', isHoliday: true, holidayName: 'Republic Day (National Holiday)', color: '#D97706' },
  { id: 'hol-2', doctorId: 'all', title: 'Maha Shivratri / Holi', type: 'holiday', date: '2026-03-04', isHoliday: true, holidayName: 'Holi (Festival of Colours)', color: '#D97706' },
  { id: 'hol-3', doctorId: 'all', title: 'Good Friday', type: 'holiday', date: '2026-04-03', isHoliday: true, holidayName: 'Good Friday', color: '#D97706' },
  { id: 'hol-4', doctorId: 'all', title: 'Independence Day', type: 'holiday', date: '2026-08-15', isHoliday: true, holidayName: 'Independence Day (National Holiday)', color: '#D97706' },
  { id: 'hol-5', doctorId: 'all', title: 'Mahatma Gandhi Jayanti', type: 'holiday', date: '2026-10-02', isHoliday: true, holidayName: 'Gandhi Jayanti (National Holiday)', color: '#D97706' },
  { id: 'hol-6', doctorId: 'all', title: 'Dussehra (Vijayadashami)', type: 'holiday', date: '2026-10-20', isHoliday: true, holidayName: 'Dussehra Festival', color: '#D97706' },
  { id: 'hol-7', doctorId: 'all', title: 'Diwali (Deepavali)', type: 'holiday', date: '2026-11-08', isHoliday: true, holidayName: 'Diwali Festival', color: '#D97706' },
  { id: 'hol-8', doctorId: 'all', title: 'Christmas Day', type: 'holiday', date: '2026-12-25', isHoliday: true, holidayName: 'Christmas', color: '#D97706' },
  { id: 'hol-9', doctorId: 'all', title: 'Republic Day 2027', type: 'holiday', date: '2027-01-26', isHoliday: true, holidayName: 'Republic Day (National Holiday)', color: '#D97706' },
  { id: 'hol-10', doctorId: 'all', title: 'Holi 2027', type: 'holiday', date: '2027-03-22', isHoliday: true, holidayName: 'Holi Festival', color: '#D97706' },
  { id: 'hol-11', doctorId: 'all', title: 'Independence Day 2027', type: 'holiday', date: '2027-08-15', isHoliday: true, holidayName: 'Independence Day (National Holiday)', color: '#D97706' },
  { id: 'hol-12', doctorId: 'all', title: 'Gandhi Jayanti 2027', type: 'holiday', date: '2027-10-02', isHoliday: true, holidayName: 'Gandhi Jayanti', color: '#D97706' },
  { id: 'hol-13', doctorId: 'all', title: 'Diwali 2027', type: 'holiday', date: '2027-10-29', isHoliday: true, holidayName: 'Diwali Festival', color: '#D97706' },
  { id: 'hol-14', doctorId: 'all', title: 'Christmas 2027', type: 'holiday', date: '2027-12-25', isHoliday: true, holidayName: 'Christmas', color: '#D97706' },

  // Clinical Schedule for Dr. Vance (doc-1)
  { id: 'ev-1', doctorId: 'doc-1', title: 'Morning Cardiac OPD Clinic', type: 'shift', date: '2026-10-29', startTime: '09:00 AM', endTime: '01:00 PM', room: 'Cabin 4', color: '#0E7C7B' },
  { id: 'ev-2', doctorId: 'doc-1', title: 'Inpatient ICU Ward Rounds', type: 'shift', date: '2026-10-29', startTime: '02:00 PM', endTime: '03:30 PM', room: 'ICU Block B', color: '#0E7C7B' },
  { id: 'ev-3', doctorId: 'doc-1', title: 'Coronary Angioplasty (David Miller)', type: 'surgery', date: '2026-10-29', startTime: '04:00 PM', endTime: '05:30 PM', patientName: 'David Miller', room: 'Cath Lab 2', color: '#7C3AED' },
  { id: 'ev-4', doctorId: 'doc-1', title: 'Echocardiography Review (Sarah Chen)', type: 'appointment', date: '2026-10-29', startTime: '11:15 AM', endTime: '11:45 AM', patientName: 'Sarah Chen', room: 'Cabin 4', color: '#2563EB' },
  { id: 'ev-5', doctorId: 'doc-1', title: 'Cardiac Emergency On-Call Shift', type: 'shift', date: '2026-10-30', startTime: '08:00 AM', endTime: '08:00 PM', room: 'ER Trauma Command', color: '#D32F2F' },
  { id: 'ev-6', doctorId: 'doc-1', title: 'Pacemaker Implantation Surgery', type: 'surgery', date: '2026-10-31', startTime: '10:00 AM', endTime: '12:00 PM', patientName: 'Vikramaditya Roy', room: 'OT 3', color: '#7C3AED' },
  { id: 'ev-7', doctorId: 'doc-1', title: 'Post-Op Follow-up Clinic', type: 'appointment', date: '2026-11-02', startTime: '09:30 AM', endTime: '01:30 PM', room: 'Cabin 4', color: '#2563EB' },
  { id: 'leave-1', doctorId: 'doc-1', title: 'Dr. Aris Vance on Leave (Annual Cardiology Summit)', type: 'leave', date: '2026-11-04', startTime: 'All Day', endTime: 'All Day', color: '#DC2626' },
];

const INITIAL_DOCTOR_TODOS: DoctorTodo[] = [
  { id: 'todo-1', doctorId: 'doc-1', text: 'Review 24hr Holter monitoring report for Sarah Chen', category: 'Lab follow-up', priority: 'urgent', dueDate: '2026-10-29', completed: true, createdAt: '2026-10-29T08:15:00Z' },
  { id: 'todo-2', doctorId: 'doc-1', text: 'Sign off cardiac enzyme discharge summary for Bed 108', category: 'Paperwork', priority: 'urgent', dueDate: '2026-10-29', completed: true, createdAt: '2026-10-29T08:30:00Z' },
  { id: 'todo-3', doctorId: 'doc-1', text: 'Conduct pre-op checklist for David Miller cath lab procedure', category: 'Rounds', priority: 'urgent', dueDate: '2026-10-29', completed: true, createdAt: '2026-10-29T09:00:00Z' },
  { id: 'todo-4', doctorId: 'doc-1', text: 'Call cardiologist Dr. Neha Sharma for dual-antiplatelet consultation', category: 'Patient call', priority: 'normal', dueDate: '2026-10-29', completed: false, createdAt: '2026-10-29T09:30:00Z' },
  { id: 'todo-5', doctorId: 'doc-1', text: 'Inspect telemetry wave tracings for ICU Bed 4', category: 'Rounds', priority: 'urgent', dueDate: '2026-10-29', completed: false, createdAt: '2026-10-29T10:00:00Z' },
  { id: 'todo-6', doctorId: 'doc-1', text: 'Approve stat antibiotic prescription modification for pat-10', category: 'Paperwork', priority: 'normal', dueDate: '2026-10-29', completed: false, createdAt: '2026-10-29T10:15:00Z' },
  { id: 'todo-7', doctorId: 'doc-1', text: 'Verify quarterly ABHA digital locker sync records', category: 'Paperwork', priority: 'low', dueDate: '2026-10-30', completed: false, createdAt: '2026-10-29T10:30:00Z' },
];

const INITIAL_PHARMACY_ORDERS: PharmacyPurchaseOrder[] = [
  { id: 'PO-2026-101', hospitalId: 'hosp-1', medicineName: 'Atorvastatin 20mg', supplier: 'Sun Pharma Distribution', quantity: 500, unit: 'strips', status: 'approved', requestedAt: '2026-10-26T10:00:00Z', totalCost: 12500 },
  { id: 'PO-2026-102', hospitalId: 'hosp-1', medicineName: 'Normal Saline 0.9% 500ml', supplier: 'Baxter Healthcare', quantity: 200, unit: 'IV bags', status: 'delivered', requestedAt: '2026-10-22T08:30:00Z', totalCost: 8400 },
  { id: 'PO-2026-103', hospitalId: 'hosp-1', medicineName: 'Epinephrine 1mg/ml', supplier: 'Cipla Critical Care', quantity: 50, unit: 'ampoules', status: 'pending', requestedAt: '2026-10-29T07:15:00Z', totalCost: 4500 },
];

class ReactiveStore {
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.state = this.loadInitialState();

    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event) => {
            if (event.data?.type === 'STATE_UPDATED') {
              this.syncFromStorage();
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel not supported in this environment', e);
        }
      }

      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          this.syncFromStorage();
        }
      });

      // Release any expired 10-minute held slots and check 3-minute emergency timeouts on startup and periodically
      this.releaseExpiredHeldSlots();
      this.checkSlotTimeouts();
      setInterval(() => {
        this.releaseExpiredHeldSlots();
        this.checkSlotTimeouts();
      }, 30000);
    }
  }

  private syncFromStorage() {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        this.notify();
      } catch (e) {
        console.error('Failed to parse synchronized state', e);
      }
    }
  }

  private loadInitialState(): AppState {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.bills || !Array.isArray(parsed.bills) || parsed.bills.length === 0) parsed.bills = INITIAL_BILLS;
          if (!parsed.doctorCalendarEvents || !Array.isArray(parsed.doctorCalendarEvents)) parsed.doctorCalendarEvents = INITIAL_DOCTOR_EVENTS;
          if (!parsed.doctorTodos || !Array.isArray(parsed.doctorTodos)) parsed.doctorTodos = INITIAL_DOCTOR_TODOS;
          if (!parsed.pharmacyOrders || !Array.isArray(parsed.pharmacyOrders)) parsed.pharmacyOrders = INITIAL_PHARMACY_ORDERS;
          if (!parsed.simulatedDate) parsed.simulatedDate = '2026-10-30';
          return parsed;
        } catch (e) {
          console.error('Failed to parse stored state, resetting to seed data', e);
        }
      }
    }

    const defaultState: AppState = {
      patients: INITIAL_PATIENTS,
      reports: INITIAL_REPORTS,
      prescriptions: INITIAL_PRESCRIPTIONS,
      accessLogs: INITIAL_ACCESS_LOGS,
      consentRules: INITIAL_CONSENT_RULES,
      hospitals: INITIAL_HOSPITALS,
      doctors: INITIAL_DOCTORS,
      queueTokens: INITIAL_QUEUE,
      emergencies: INITIAL_EMERGENCIES,
      operations: INITIAL_OPERATIONS,
      labOrders: INITIAL_LAB_ORDERS,
      pharmacy: INITIAL_PHARMACY,
      notifications: INITIAL_NOTIFICATIONS,
      wardBeds: INITIAL_WARD_BEDS,
      ambulances: INITIAL_AMBULANCES,
      bills: INITIAL_BILLS,
      doctorCalendarEvents: INITIAL_DOCTOR_EVENTS,
      doctorTodos: INITIAL_DOCTOR_TODOS,
      pharmacyOrders: INITIAL_PHARMACY_ORDERS,
      currentUserRole: 'patient',
      currentUserId: 'pat-1', // Default to Sarah Chen
      simulatedDate: '2026-10-30',
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      } catch (e) {
        console.warn('LocalStorage save failed', e);
      }
    }

    return defaultState;
  }

  public persistAndBroadcast() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        this.channel?.postMessage({ type: 'STATE_UPDATED' });
      } catch (e) {
        console.warn('Failed to persist state', e);
      }
    }
    this.notify();
  }

  public registerDoctor(doctorData: {
    name: string;
    specialization: string;
    hospitalId: string;
    hospitalName?: string;
    email: string;
    experienceYears?: number;
    phone?: string;
    registrationNumber?: string;
  }): Doctor {
    const docNum = this.state.doctors.length + 1;
    const newDocId = `DR-${String(docNum).padStart(3, '0')}`;
    const hosp = this.state.hospitals.find((h) => h.id === doctorData.hospitalId) || this.state.hospitals[0];

    const newDoctor: Doctor = {
      id: newDocId,
      name: doctorData.name.startsWith('Dr.') ? doctorData.name : `Dr. ${doctorData.name}`,
      email: doctorData.email,
      specialization: doctorData.specialization,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      roomNumber: `Room ${docNum + 2}`,
      experienceYears: doctorData.experienceYears || 5,
      status: 'available',
      avgConsultationTimeMinutes: 10,
      approvalStatus: 'pending',
    };

    this.state.doctors = [...this.state.doctors, newDoctor];
    this.persistAndBroadcast();
    return newDoctor;
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Error in state listener:', e);
      }
    });
  }

  public getState(): AppState {
    return this.state;
  }

  public subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Immediate initial fire
    return () => this.listeners.delete(listener);
  }

  public setRole(role: UserRole, userId?: string) {
    this.state.currentUserRole = role;
    if (userId) {
      this.state.currentUserId = userId;
    } else {
      if (role === 'patient') this.state.currentUserId = 'pat-1';
      else if (role === 'doctor') this.state.currentUserId = 'doc-1';
      else if (role === 'hospital' || role === 'receptionist' || role === 'admin') this.state.currentUserId = 'hosp-1';
      else if (role === 'responder') this.state.currentUserId = 'resp-104';
    }
    this.persistAndBroadcast();
  }

  // --- Patient Actions ---
  public registerPatient(patientData: Omit<PatientProfile, 'id' | 'uniquePatientId'>): PatientProfile {
    const existingUniqueIds = this.state.patients.map((p) => p.uniquePatientId);
    const newId = `pat-${Date.now()}`;
    const newUniquePatientId = generateUniquePatientId(existingUniqueIds);

    const newPatient: PatientProfile = {
      ...patientData,
      id: newId,
      uniquePatientId: newUniquePatientId,
    };

    this.state.patients = [newPatient, ...this.state.patients];
    this.state.currentUserId = newId;

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: newId,
      title: 'Welcome to MediTrack DigiLocker!',
      message: `Your Unique Patient ID is ${newUniquePatientId}. Use this to share verified records with doctors.`,
      type: 'system',
    });

    this.persistAndBroadcast();
    return newPatient;
  }

  public uploadMedicalReport(reportData: Omit<MedicalReport, 'id'>): MedicalReport {
    const newReport: MedicalReport = {
      ...reportData,
      id: `rep-${Date.now()}`,
    };
    this.state.reports = [newReport, ...this.state.reports];

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: reportData.patientId,
      title: 'Report Added to Medical Locker',
      message: `"${reportData.title}" was successfully archived.`,
      type: 'lab',
    });

    this.persistAndBroadcast();
    return newReport;
  }

  // Auto-release slots held under payment_pending if 10 minutes have elapsed without payment
  public releaseExpiredHeldSlots(): number {
    const now = Date.now();
    let releasedCount = 0;
    this.state.queueTokens.forEach((q) => {
      if (q.status === 'payment_pending' && q.heldUntil && now > q.heldUntil) {
        q.status = 'cancelled';
        releasedCount++;
        const bill = this.state.bills.find(
          (b) => b.tokenId === q.id || b.appointmentId === q.id || (b.patientId === q.patientId && b.amount === q.fee && b.status === 'Pending')
        );
        if (bill && bill.status === 'Pending') {
          bill.status = 'Refunded';
          bill.description += ' (Held slot released after 10 mins unpaid)';
        }
      }
    });
    if (releasedCount > 0) {
      this.persistAndBroadcast();
    }
    return releasedCount;
  }

  public bookAppointment(params: {
    patientId: string;
    patientName: string;
    uniquePatientId?: string;
    doctorId: string;
    hospitalId: string;
    department: string;
    reason: string;
    shareRecordsConsent?: boolean;
    appointmentDate?: string;
    timeSlot?: string;
    fee?: number;
    patientDetails?: {
      name?: string;
      age?: number;
      gender?: 'Male' | 'Female' | 'Other';
      bloodGroup?: any;
      allergies?: string[];
      phone?: string;
      email?: string;
    };
    paymentChoice?: 'razorpay' | 'pay_at_hospital' | 'upi';
    paymentStatus?: 'paid' | 'pending' | 'pay_at_hospital' | 'pending_verification';
    paymentId?: string;
    isPendingPayment?: boolean;
    utr?: string;
  }): QueueToken {
    // Release any expired held slots first
    this.releaseExpiredHeldSlots();

    let patient = this.state.patients.find((p) => p.id === params.patientId);

    // If patient record doesn't exist, throw error and never auto-create
    if (!patient) {
      throw new Error(`Patient record not found for ID "${params.patientId}". Please register or log in with a valid patient account.`);
    }

    const doctor = this.state.doctors.find((d) => d.id === params.doctorId);
    const dateToBook = params.appointmentDate || new Date().toISOString().split('T')[0];
    const slotToBook = params.timeSlot || '10:00 AM';

    // Prevent double booking of the exact same slot for the doctor
    const doubleBooked = this.state.queueTokens.some(
      (q) =>
        q.doctorId === params.doctorId &&
        (q.appointmentDate === dateToBook || (!q.appointmentDate && dateToBook === new Date().toISOString().split('T')[0])) &&
        q.timeSlot === slotToBook &&
        q.status !== 'cancelled' &&
        !(q.status === 'payment_pending' && q.heldUntil && Date.now() > q.heldUntil)
    );

    if (doubleBooked) {
      throw new Error(`This time slot (${slotToBook}) on ${dateToBook} is already booked for ${doctor?.name || 'this doctor'}. Please choose another slot.`);
    }

    // If paying via UPI, validate UTR uniqueness and format
    if (params.paymentChoice === 'upi') {
      if (!params.utr || !/^\d{12}$/.test(params.utr.trim())) {
        throw new Error('Please enter a valid 12-digit numeric UPI Transaction Reference (UTR).');
      }
      const trimmedUtr = params.utr.trim();
      const duplicateUtr = this.state.bills.some(
        (b) => b.utr === trimmedUtr || (b.transactionRef && b.transactionRef === trimmedUtr)
      );
      if (duplicateUtr) {
        throw new Error(`UTR "${trimmedUtr}" has already been submitted or processed for another transaction. Duplicate UTR rejected.`);
      }
    }

    const deptPrefix = params.department.charAt(0).toUpperCase();

    // Format clean token like C-04
    const existingDeptTokens = this.state.queueTokens.filter(
      (q) => q.doctorId === params.doctorId || q.department === params.department
    );
    const tokenSeq = existingDeptTokens.length + 1;
    const tokenNum = `${deptPrefix}-${String(tokenSeq).padStart(2, '0')}`;

    const doctorQueue = this.state.queueTokens.filter(
      (q) => q.doctorId === params.doctorId && (q.status === 'waiting' || q.status === 'in_consultation')
    );
    const peopleAhead = doctorQueue.length;
    const estWait = peopleAhead * 8; // 8 minutes per consultation
    const consultationFee = params.fee || doctor?.consultationFee || 500;

    const aptId = `APT-2026-${Date.now().toString().slice(-4)}`;

    // Determine initial status based on paymentChoice & isPendingPayment
    let tokenStatus: QueueToken['status'] = 'waiting';
    let payStatus: QueueToken['paymentStatus'] = params.paymentStatus || (params.paymentChoice === 'pay_at_hospital' ? 'pay_at_hospital' : 'paid');
    let heldUntil: number | undefined = undefined;

    if (params.paymentChoice === 'upi') {
      tokenStatus = 'payment_pending';
      payStatus = 'pending_verification';
      heldUntil = Date.now() + 30 * 60 * 1000; // Hold slot for 30 minutes for manual UPI verification
    } else if (params.isPendingPayment) {
      tokenStatus = 'payment_pending';
      payStatus = 'pending';
      heldUntil = Date.now() + 10 * 60 * 1000; // Hold slot for 10 minutes
    } else if (params.paymentChoice === 'pay_at_hospital') {
      tokenStatus = 'waiting';
      payStatus = 'pay_at_hospital';
    } else if (params.paymentId) {
      tokenStatus = 'waiting';
      payStatus = 'paid';
    }

    const newToken: QueueToken = {
      id: aptId,
      appointmentId: aptId,
      tokenNumber: tokenNum,
      patientId: patient.id,
      patientName: params.patientName,
      uniquePatientId: patient.uniquePatientId,
      doctorId: params.doctorId,
      doctorName: doctor?.name || 'Assigned Physician',
      department: params.department,
      hospitalId: params.hospitalId,
      status: tokenStatus,
      paymentStatus: payStatus,
      paymentId: params.paymentId,
      heldUntil,
      reason: params.reason,
      priority: 'normal',
      createdAt: new Date().toISOString(),
      estimatedWaitMinutes: estWait,
      roomNumber: doctor?.roomNumber || 'Cabin 1',
      appointmentDate: dateToBook,
      timeSlot: slotToBook,
      fee: consultationFee,
    };

    this.state.queueTokens = [...this.state.queueTokens, newToken];

    // Automatically create consultation bill in Payments
    const hospObj = this.state.hospitals.find((h) => h.id === params.hospitalId);
    const billStatus: BillStatus =
      params.paymentChoice === 'upi'
        ? 'Pending Verification'
        : payStatus === 'paid'
        ? 'Paid'
        : 'Pending';

    const billMethod: PaymentMethod =
      params.paymentChoice === 'upi'
        ? 'UPI'
        : payStatus === 'paid'
        ? 'Razorpay'
        : payStatus === 'pay_at_hospital'
        ? 'Cash'
        : 'Razorpay';

    const newBill: PaymentBill = {
      id: `INV-2026-${String(this.state.bills.length + 1).padStart(3, '0')}`,
      patientId: patient.id,
      patientName: params.patientName,
      date: dateToBook,
      hospitalName: hospObj?.name || 'City Metro General Hospital',
      hospitalId: params.hospitalId,
      doctorName: doctor?.name || 'Assigned Physician',
      category: 'Consultation',
      description: `OPD Consultation: ${params.reason} (${params.department} - ${slotToBook})${
        params.paymentChoice === 'upi'
          ? ' [Manual UPI - UTR ' + params.utr + ']'
          : payStatus === 'pay_at_hospital'
          ? ' [Pay at Hospital]'
          : ''
      }`,
      amount: consultationFee,
      insuranceCovered: Math.min(500, Math.floor(consultationFee * 0.6)),
      status: billStatus,
      paymentMethod: billMethod,
      transactionRef: params.paymentChoice === 'upi' ? params.utr : (params.paymentId || (payStatus === 'paid' ? `RZP-${Date.now()}` : undefined)),
      utr: params.paymentChoice === 'upi' ? params.utr : undefined,
      heldUntil: params.paymentChoice === 'upi' ? heldUntil : undefined,
      paidAt: payStatus === 'paid' ? new Date().toISOString() : undefined,
      tokenId: aptId,
      appointmentId: aptId,
      paymentId: params.paymentId,
    };
    this.state.bills = [newBill, ...this.state.bills];

    // Register with server ledger
    fetch('/api/bills/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newBill.id,
        amount: newBill.amount,
        status: newBill.status,
        patientName: newBill.patientName,
        description: newBill.description,
        utr: newBill.utr,
      }),
    }).catch(() => {});

    if (params.paymentChoice === 'upi') {
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: patient.id,
        title: 'UPI Payment Submitted • Pending Verification',
        message: `Your payment of ₹${consultationFee} with UTR ${params.utr} has been submitted. Token #${tokenNum} slot is held for 30 minutes while hospital administration verifies the payment.`,
        type: 'queue',
      });

      this.addNotification({
        recipientRole: 'hospital',
        title: 'New Manual UPI Payment for Verification',
        message: `Patient ${params.patientName} (${patient.uniquePatientId}) submitted UPI UTR #${params.utr} for ₹${consultationFee} (Bill ${newBill.id}). Verification required.`,
        type: 'queue',
      });
    } else if (tokenStatus === 'waiting') {
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: patient.id,
        title: 'Appointment Booked & Token Issued',
        message: `Token #${tokenNum} issued for ${doctor?.name || 'Doctor'} at ${hospObj?.name || 'Hospital'}. Slot: ${dateToBook} at ${slotToBook}.`,
        type: 'queue',
      });

      this.addNotification({
        recipientRole: 'doctor',
        recipientDoctorId: params.doctorId,
        title: 'New Patient Booked in Queue',
        message: `${params.patientName} (${patient.uniquePatientId}) booked for ${slotToBook} on ${dateToBook}. Reason: ${params.reason}`,
        type: 'queue',
      });
    } else {
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: patient.id,
        title: 'Slot Held: Complete Payment',
        message: `Your slot (${dateToBook} at ${slotToBook}) with ${doctor?.name || 'Doctor'} is held for 10 minutes. Please complete payment to confirm your queue token.`,
        type: 'queue',
      });
    }

    this.persistAndBroadcast();
    return newToken;
  }

  // Confirm appointment when payment succeeds via Razorpay
  public confirmAppointmentPayment(tokenId: string, paymentId: string, method: PaymentMethod = 'Razorpay'): { token: QueueToken; bill?: PaymentBill } {
    const token = this.state.queueTokens.find((q) => q.id === tokenId || q.appointmentId === tokenId);
    if (!token) throw new Error('Appointment not found');

    token.status = 'waiting';
    token.paymentStatus = 'paid';
    token.paymentId = paymentId;
    token.heldUntil = undefined;

    // Update associated bill
    const bill = this.state.bills.find(
      (b) => b.tokenId === token.id || b.appointmentId === token.id || (b.patientId === token.patientId && b.amount === token.fee && b.status === 'Pending')
    );

    if (bill) {
      bill.status = 'Paid';
      bill.paymentMethod = method;
      bill.transactionRef = paymentId;
      bill.paymentId = paymentId;
      bill.paidAt = new Date().toISOString();
      bill.tokenId = token.id;
      bill.appointmentId = token.id;
    }

    const hospObj = this.state.hospitals.find((h) => h.id === token.hospitalId);

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: token.patientId,
      title: 'Payment Successful • Token Confirmed',
      message: `Payment of ₹${token.fee} confirmed (ID: ${paymentId}). Token #${token.tokenNumber} is now active for ${token.doctorName} at ${hospObj?.name || 'Hospital'}.`,
      type: 'queue',
    });

    this.addNotification({
      recipientRole: 'doctor',
      recipientDoctorId: token.doctorId,
      title: 'New Paid Patient in Queue',
      message: `${token.patientName} confirmed consultation for ${token.timeSlot} on ${token.appointmentDate}. Fee: ₹${token.fee} via ${method}.`,
      type: 'queue',
    });

    this.persistAndBroadcast();
    return { token, bill };
  }

  // Confirm appointment for Pay at Hospital
  public confirmPayAtHospital(tokenId: string): QueueToken {
    const token = this.state.queueTokens.find((q) => q.id === tokenId || q.appointmentId === tokenId);
    if (!token) throw new Error('Appointment not found');

    token.status = 'waiting';
    token.paymentStatus = 'pay_at_hospital';
    token.heldUntil = undefined;

    const bill = this.state.bills.find(
      (b) => b.tokenId === token.id || b.appointmentId === token.id || (b.patientId === token.patientId && b.amount === token.fee && b.status === 'Pending')
    );

    if (bill) {
      bill.status = 'Pending';
      bill.paymentMethod = 'Cash';
      if (!bill.description.includes('[Pay at Hospital]')) {
        bill.description += ' [Pay at Hospital]';
      }
    }

    this.persistAndBroadcast();
    return token;
  }

  public cancelAppointment(tokenId: string, reason?: string): QueueToken | undefined {
    const token = this.state.queueTokens.find((q) => q.id === tokenId);
    if (!token) return undefined;

    token.status = 'cancelled';

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: token.patientId,
      title: 'Appointment Cancelled',
      message: `Your appointment #${token.tokenNumber} with ${token.doctorName} was successfully cancelled.`,
      type: 'queue',
    });

    this.addNotification({
      recipientRole: 'doctor',
      recipientDoctorId: token.doctorId,
      title: 'Patient Cancelled Appointment',
      message: `Appointment #${token.tokenNumber} for ${token.patientName} was cancelled by patient.`,
      type: 'queue',
    });

    this.persistAndBroadcast();
    return token;
  }

  public rescheduleAppointment(tokenId: string, newDate: string, newTimeSlot: string): QueueToken {
    const token = this.state.queueTokens.find((q) => q.id === tokenId);
    if (!token) throw new Error('Appointment not found');

    const doctor = this.state.doctors.find((d) => d.id === token.doctorId);

    // Prevent double booking on new date/slot
    const doubleBooked = this.state.queueTokens.some(
      (q) =>
        q.id !== tokenId &&
        q.doctorId === token.doctorId &&
        q.appointmentDate === newDate &&
        q.timeSlot === newTimeSlot &&
        q.status !== 'cancelled'
    );

    if (doubleBooked) {
      throw new Error(`Time slot ${newTimeSlot} on ${newDate} is already booked for ${doctor?.name || 'this doctor'}.`);
    }

    token.appointmentDate = newDate;
    token.timeSlot = newTimeSlot;
    token.status = 'waiting';

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: token.patientId,
      title: 'Appointment Rescheduled',
      message: `Your appointment #${token.tokenNumber} with ${token.doctorName} has been moved to ${newDate} at ${newTimeSlot}.`,
      type: 'queue',
    });

    this.addNotification({
      recipientRole: 'doctor',
      recipientDoctorId: token.doctorId,
      title: 'Appointment Rescheduled',
      message: `${token.patientName} rescheduled token #${token.tokenNumber} to ${newDate} at ${newTimeSlot}.`,
      type: 'queue',
    });

    this.persistAndBroadcast();
    return token;
  }

  // --- Daily Medicine Tracking & Streak Simulation Methods ---
  public getSimulatedDate(): string {
    return this.state.simulatedDate || '2026-10-30';
  }

  public setSimulatedDate(dateStr: string) {
    this.state.simulatedDate = dateStr;
    this.persistAndBroadcast();
  }

  // Simulate next day (clearly labeled test tool for testing daily reset, missed doses, and streaks)
  public simulateNextDay(): { newDate: string; missedCount: number; completedMedsCount: number } {
    const oldDate = this.getSimulatedDate();
    const newDate = addDaysToDate(oldDate, 1);
    this.state.simulatedDate = newDate;

    let missedCount = 0;
    let completedMedsCount = 0;

    this.state.patients.forEach((patient) => {
      if (!patient.currentMedicines) return;

      let patientMissedAny = false;
      const missedMedNames: string[] = [];

      patient.currentMedicines.forEach((med) => {
        if (med.status === 'completed') return;

        med.doseHistory = med.doseHistory || {};
        med.doseHistory[oldDate] = med.doseHistory[oldDate] || {};
        const slots = med.timeSlots || ['Morning', 'Night'];

        // 1. Doses still 'Pending' from yesterday become 'Missed'
        slots.forEach((slot) => {
          const existingLog = med.doseHistory![oldDate][slot];
          if (!existingLog || existingLog.status === 'Pending') {
            med.doseHistory![oldDate][slot] = {
              slot,
              status: 'Missed',
              note: 'Dose window expired without confirmation',
            };
            missedCount++;
            patientMissedAny = true;
            if (!missedMedNames.includes(med.name)) {
              missedMedNames.push(med.name);
            }
          }
        });

        // 2. Decrement supply
        if (med.daysLeft !== undefined && med.daysLeft > 0) {
          med.daysLeft = Math.max(0, med.daysLeft - 1);
        }

        // 3. Check if prescribed duration has ended
        if (med.endDate && newDate > med.endDate) {
          med.status = 'completed';
          completedMedsCount++;
          this.addNotification({
            recipientRole: 'patient',
            recipientPatientId: patient.id,
            title: `🎉 Course Completed: ${med.name}`,
            message: `You have completed the prescribed course for ${med.name}. Daily reminders have stopped.`,
            type: 'access',
          });
        }

        // 4. Initialize fresh new day with 'Pending' doses
        med.doseHistory[newDate] = med.doseHistory[newDate] || {};
        slots.forEach((slot) => {
          med.doseHistory![newDate][slot] = {
            slot,
            status: 'Pending',
            scheduledTime: slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM',
          };
        });

        // Reset takenToday for the new day
        med.takenToday = { Morning: false, Afternoon: false, Night: false };
      });

      if (patientMissedAny) {
        this.addNotification({
          recipientRole: 'patient',
          recipientPatientId: patient.id,
          title: `⚠️ Missed Dose Alert`,
          message: `Scheduled dose(s) for ${missedMedNames.join(', ')} were missed on ${oldDate}. Streak reset to 0.`,
          type: 'access',
        });
      }

      // Morning reminder for active medicines
      const activeCount = patient.currentMedicines.filter((m) => m.status !== 'completed').length;
      if (activeCount > 0) {
        this.addNotification({
          recipientRole: 'patient',
          recipientPatientId: patient.id,
          title: `🌅 Morning Medicine Reminder`,
          message: `Good morning! You have ${activeCount} active medicine(s) scheduled for today (${newDate}).`,
          type: 'access',
        });
      }
    });

    this.persistAndBroadcast();
    return { newDate, missedCount, completedMedsCount };
  }

  // Mark today's dose (only today's doses can be marked; checks late window)
  public markPatientDose(
    patientId: string,
    medicineIdOrName: string,
    slot: DoseSlot,
    status: 'Taken' | 'Skipped'
  ): { success: boolean; status: DoseStatus; message: string } {
    const patient = this.state.patients.find((p) => p.id === patientId);
    if (!patient || !patient.currentMedicines) {
      return { success: false, status: 'Pending', message: 'Patient not found' };
    }

    const med = patient.currentMedicines.find(
      (m) => m.id === medicineIdOrName || m.name.toLowerCase() === medicineIdOrName.toLowerCase()
    );
    if (!med) {
      return { success: false, status: 'Pending', message: 'Medicine not found' };
    }

    const curDate = this.getSimulatedDate();
    med.doseHistory = med.doseHistory || {};
    med.doseHistory[curDate] = med.doseHistory[curDate] || {};

    let finalStatus: DoseStatus = status;
    const currentHour = new Date().getHours();
    // Marked after window saved as 'Taken late'
    if (status === 'Taken') {
      if (slot === 'Morning' && currentHour >= 12) {
        finalStatus = 'Taken late';
      } else if (slot === 'Afternoon' && currentHour >= 18) {
        finalStatus = 'Taken late';
      }
    }

    const markedTimeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    med.doseHistory[curDate][slot] = {
      slot,
      status: finalStatus,
      markedAt: markedTimeStr,
      scheduledTime: slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM',
    };

    med.takenToday = med.takenToday || {};
    med.takenToday[slot] = finalStatus === 'Taken' || finalStatus === 'Taken late';

    // Check if all today's doses are now taken
    const adherence = this.getPatientAdherence(patientId);
    if (adherence.todayCompletedCount === adherence.todayTotalCount && adherence.todayTotalCount > 0) {
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: patientId,
        title: '🌟 All Today\'s Doses Completed!',
        message: `Great job! You took all your scheduled doses for today. Your streak is now ${adherence.currentStreak} day(s)!`,
        type: 'access',
      });
    }

    this.persistAndBroadcast();
    return {
      success: true,
      status: finalStatus,
      message: `${med.name} ${slot} dose marked as ${finalStatus}`,
    };
  }

  // Backward compatibility alias for toggleMedicineDose
  public toggleMedicineDose(
    patientId: string,
    medicineName: string,
    slot: 'Morning' | 'Afternoon' | 'Night',
    status: 'taken' | 'skipped'
  ) {
    this.markPatientDose(patientId, medicineName, slot, status === 'taken' ? 'Taken' : 'Skipped');
  }

  // Let patient add their own medicines manually
  public addPatientMedicine(
    patientId: string,
    medicineData: {
      name: string;
      dosage: string;
      frequency: string;
      timeSlots: DoseSlot[];
      durationDays?: number;
      instructions?: string;
    }
  ): CurrentMedicine | null {
    const patient = this.state.patients.find((p) => p.id === patientId);
    if (!patient) return null;

    patient.currentMedicines = patient.currentMedicines || [];
    const curDate = this.getSimulatedDate();
    const duration = medicineData.durationDays || 30;
    const endDate = addDaysToDate(curDate, duration);

    const newMed: CurrentMedicine = {
      id: `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: medicineData.name,
      dosage: medicineData.dosage,
      strength: medicineData.dosage,
      frequency: medicineData.frequency,
      duration: `${duration} days`,
      instructions: medicineData.instructions || 'Take as instructed',
      source: 'manual',
      prescribedBy: `Added manually by you on ${curDate}`,
      prescribedDate: curDate,
      startDate: curDate,
      endDate,
      status: 'active',
      shape: 'round',
      color: '#0E7C7B',
      timeSlots: medicineData.timeSlots,
      daysLeft: duration,
      totalDays: duration,
      doseHistory: {
        [curDate]: Object.fromEntries(
          medicineData.timeSlots.map((slot) => [
            slot,
            {
              slot,
              status: 'Pending' as DoseStatus,
              scheduledTime: slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM',
            },
          ])
        ) as Partial<Record<DoseSlot, DoseLog>>,
      },
      takenToday: { Morning: false, Afternoon: false, Night: false },
    };

    patient.currentMedicines.push(newMed);

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: patient.id,
      title: 'Medicine Added',
      message: `${newMed.name} added to your daily schedule.`,
      type: 'access',
    });

    this.persistAndBroadcast();
    return newMed;
  }

  // Calculate patient streak, adherence percentage (7 & 30 days), and history
  public getPatientAdherence(patientId: string): MedicationAdherenceStats {
    const patient = this.state.patients.find((p) => p.id === patientId);
    const curDate = this.getSimulatedDate();
    if (!patient || !patient.currentMedicines) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        adherenceRate7Days: 100,
        adherenceRate30Days: 100,
        todayCompletedCount: 0,
        todayTotalCount: 0,
        history7Days: [],
        history30Days: [],
      };
    }

    const activeMeds = patient.currentMedicines.filter((m) => m.status !== 'completed');

    // Build 30-day history records from curDate backwards
    const history30Days: DayAdherenceRecord[] = [];
    for (let i = 29; i >= 0; i--) {
      const targetDate = addDaysToDate(curDate, -i);
      const dateObj = new Date(targetDate + 'T12:00:00Z');
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const dayDoses: DayAdherenceRecord['doses'] = [];
      let scheduledCount = 0;
      let takenCount = 0;
      let missedCount = 0;
      let lateOrSkippedCount = 0;

      activeMeds.forEach((med) => {
        const medStart = med.startDate || '2026-01-01';
        const medEnd = med.endDate || '2099-12-31';
        if (targetDate < medStart || targetDate > medEnd) return;

        const slots = med.timeSlots || ['Morning', 'Night'];
        slots.forEach((slot) => {
          scheduledCount++;
          const doseLog = med.doseHistory?.[targetDate]?.[slot];
          let status: DoseStatus = doseLog?.status || (targetDate === curDate ? 'Pending' : 'Missed');

          if (targetDate === curDate && med.takenToday?.[slot]) {
            status = 'Taken';
          }

          if (status === 'Taken') takenCount++;
          else if (status === 'Taken late' || status === 'Skipped') {
            lateOrSkippedCount++;
            if (status === 'Taken late') takenCount++;
          } else if (status === 'Missed') {
            missedCount++;
          }

          dayDoses.push({
            medicineName: med.name,
            slot,
            status,
            markedAt: doseLog?.markedAt,
          });
        });
      });

      let dayStatus: DayAdherenceRecord['status'] = 'none';
      if (scheduledCount > 0) {
        if (missedCount > 0) {
          dayStatus = 'missed'; // red
        } else if (lateOrSkippedCount > 0) {
          dayStatus = 'skipped'; // yellow
        } else if (takenCount === scheduledCount) {
          dayStatus = 'taken'; // green
        } else if (targetDate === curDate) {
          dayStatus = takenCount > 0 ? 'skipped' : 'none';
        }
      }

      history30Days.push({
        date: targetDate,
        formattedDate,
        dayOfWeek,
        allTaken: scheduledCount > 0 && takenCount === scheduledCount,
        hasMissed: missedCount > 0,
        hasLateOrSkipped: lateOrSkippedCount > 0,
        status: dayStatus,
        doses: dayDoses,
      });
    }

    const history7Days = history30Days.slice(-7);

    // Adherence rates
    const countTaken7 = history7Days.reduce(
      (acc, d) => acc + d.doses.filter((x) => x.status === 'Taken' || x.status === 'Taken late').length,
      0
    );
    const countTotal7 = history7Days.reduce((acc, d) => acc + d.doses.length, 0);
    const adherenceRate7Days = countTotal7 > 0 ? Math.round((countTaken7 / countTotal7) * 100) : 100;

    const countTaken30 = history30Days.reduce(
      (acc, d) => acc + d.doses.filter((x) => x.status === 'Taken' || x.status === 'Taken late').length,
      0
    );
    const countTotal30 = history30Days.reduce((acc, d) => acc + d.doses.length, 0);
    const adherenceRate30Days = countTotal30 > 0 ? Math.round((countTaken30 / countTotal30) * 100) : 100;

    // Streak calculation:
    // Consecutive days backwards where EVERY scheduled dose was taken.
    let currentStreak = 0;
    const todayRecord = history30Days[29];
    if (todayRecord && todayRecord.doses.length > 0 && todayRecord.allTaken) {
      currentStreak++;
    }

    // Iterate backwards starting from yesterday (index 28 down to 0)
    for (let idx = 28; idx >= 0; idx--) {
      const rec = history30Days[idx];
      if (rec.doses.length === 0) continue;
      if (rec.allTaken) {
        currentStreak++;
      } else {
        break; // missed day resets streak
      }
    }

    // Best streak historical
    let bestStreak = currentStreak;
    let running = 0;
    for (const rec of history30Days) {
      if (rec.doses.length > 0) {
        if (rec.allTaken) {
          running++;
          if (running > bestStreak) bestStreak = running;
        } else {
          running = 0;
        }
      }
    }

    // Contextual missed message
    let missedMessage: string | undefined;
    const yesterdayRecord = history30Days[28];
    if (yesterdayRecord && yesterdayRecord.hasMissed) {
      const missedDose = yesterdayRecord.doses.find((d) => d.status === 'Missed');
      if (missedDose) {
        missedMessage = `You missed yesterday's ${missedDose.slot} dose of ${missedDose.medicineName}.`;
      } else {
        missedMessage = `You missed yesterday's scheduled dose.`;
      }
    } else if (todayRecord && todayRecord.hasMissed) {
      missedMessage = `You missed a scheduled dose today.`;
    }

    const todayCompletedCount = todayRecord
      ? todayRecord.doses.filter((d) => d.status === 'Taken' || d.status === 'Taken late').length
      : 0;
    const todayTotalCount = todayRecord ? todayRecord.doses.length : 0;

    return {
      currentStreak,
      bestStreak,
      adherenceRate7Days,
      adherenceRate30Days,
      missedMessage,
      todayCompletedCount,
      todayTotalCount,
      history7Days,
      history30Days,
    };
  }

  // --- Consent & Access Control ---
  public grantConsent(patientId: string, doctorId: string) {
    const doctor = this.state.doctors.find((d) => d.id === doctorId);
    const existingRule = this.state.consentRules.find(
      (c) => c.patientId === patientId && c.doctorId === doctorId
    );

    if (existingRule) {
      existingRule.status = 'active';
    } else {
      this.state.consentRules.push({
        id: `cs-${Date.now()}`,
        patientId,
        doctorId,
        doctorName: doctor?.name || 'Doctor',
        hospitalName: doctor?.hospitalName || 'Hospital',
        grantedAt: new Date().toISOString(),
        status: 'active',
        accessCount: 0,
      });
    }

    this.addNotification({
      recipientRole: 'doctor',
      recipientDoctorId: doctorId,
      title: 'Consent Granted',
      message: `Patient has authorized access to view their Medical Locker.`,
      type: 'access',
    });

    this.persistAndBroadcast();
  }

  public revokeConsent(patientId: string, doctorId: string) {
    const existingRule = this.state.consentRules.find(
      (c) => c.patientId === patientId && c.doctorId === doctorId
    );
    if (existingRule) {
      existingRule.status = 'revoked';
      this.persistAndBroadcast();
    }
  }

  public recordDoctorLockerAccess(params: {
    patientId: string;
    doctorId: string;
    doctorName: string;
    hospitalId: string;
    hospitalName: string;
    purpose: string;
    accessType: 'routine' | 'emergency_break_glass';
    reason?: string;
  }) {
    const log: AccessLog = {
      id: `log-${Date.now()}`,
      ...params,
      timestamp: new Date().toISOString(),
    };
    this.state.accessLogs = [log, ...this.state.accessLogs];

    // Update patient's "last viewed by doctor"
    const patient = this.state.patients.find((p) => p.id === params.patientId);
    if (patient) {
      patient.lastViewedByDoctor = {
        doctorId: params.doctorId,
        doctorName: params.doctorName,
        hospitalName: params.hospitalName,
        timestamp: new Date().toISOString(),
      };
    }

    // Increment consent access count if routine
    const rule = this.state.consentRules.find(
      (c) => c.patientId === params.patientId && c.doctorId === params.doctorId
    );
    if (rule) {
      rule.accessCount += 1;
    }

    if (params.accessType === 'emergency_break_glass') {
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: params.patientId,
        title: '🚨 Emergency Break-Glass Locker Access Notice',
        message: `${params.doctorName} at ${params.hospitalName} accessed critical medical information under emergency protocol. Reason: "${params.reason}"`,
        type: 'access',
      });
    }

    this.persistAndBroadcast();
  }

  // --- Doctor Actions ---
  public callNextPatient(doctorId: string) {
    const doctor = this.state.doctors.find((d) => d.id === doctorId);
    if (!doctor) return;

    // Mark current 'in_consultation' as done
    const currentActive = this.state.queueTokens.find(
      (q) => q.doctorId === doctorId && q.status === 'in_consultation'
    );
    if (currentActive) {
      currentActive.status = 'done';
    }

    // Find next 'waiting' patient
    const waitingTokens = this.state.queueTokens.filter(
      (q) => q.doctorId === doctorId && q.status === 'waiting'
    );

    if (waitingTokens.length > 0) {
      const nextPatient = waitingTokens[0];
      nextPatient.status = 'in_consultation';
      doctor.currentToken = nextPatient.tokenNumber;
      const cabinLabel = doctor.roomNumber.includes('Cabin') || doctor.roomNumber.includes('Room')
        ? doctor.roomNumber
        : `Cabin ${doctor.roomNumber}`;

      // Alert the called patient (Turn)
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: nextPatient.patientId,
        title: `It is your turn, please proceed to ${cabinLabel}`,
        message: `Token #${nextPatient.tokenNumber}: It is now your turn. Please enter ${cabinLabel}.`,
        type: 'queue',
      });

      // Alert patient when 2 people are ahead (e.g. index 2 in waiting list)
      if (waitingTokens.length > 2) {
        const twoAheadPatient = waitingTokens[2];
        this.addNotification({
          recipientRole: 'patient',
          recipientPatientId: twoAheadPatient.patientId,
          title: `Start moving towards ${cabinLabel}`,
          message: `Token #${twoAheadPatient.tokenNumber}: 2 people ahead. Please start moving towards ${cabinLabel} now.`,
          type: 'queue',
        });
      }

      // Alert patient when 1 person is ahead (index 1)
      if (waitingTokens.length > 1) {
        const oneAheadPatient = waitingTokens[1];
        this.addNotification({
          recipientRole: 'patient',
          recipientPatientId: oneAheadPatient.patientId,
          title: `You are next in line at ${cabinLabel}`,
          message: `Token #${oneAheadPatient.tokenNumber}: Only 1 patient ahead. Please wait right outside ${cabinLabel}.`,
          type: 'queue',
        });
      }
    } else {
      doctor.status = 'available';
      doctor.currentToken = undefined;
    }

    this.persistAndBroadcast();
  }

  public savePrescription(prescriptionData: Omit<Prescription, 'id'>): Prescription {
    const newPr: Prescription = {
      ...prescriptionData,
      id: `pr-${Date.now()}`,
    };
    this.state.prescriptions = [newPr, ...this.state.prescriptions];

    const patient = this.state.patients.find((p) => p.id === prescriptionData.patientId);
    const curDate = this.getSimulatedDate();

    if (patient) {
      patient.currentMedicines = patient.currentMedicines || [];

      prescriptionData.medicines.forEach((m) => {
        // Parse duration in days
        let durationDays = 14;
        const durMatch = (m.duration || '').match(/(\d+)\s*(day|week|month)/i);
        if (durMatch) {
          const val = parseInt(durMatch[1], 10);
          const unit = durMatch[2].toLowerCase();
          if (unit.startsWith('day')) durationDays = val;
          else if (unit.startsWith('week')) durationDays = val * 7;
          else if (unit.startsWith('month')) durationDays = val * 30;
        }

        const endDate = addDaysToDate(curDate, durationDays);

        // Parse frequency into timeSlots
        const freqLower = (m.frequency || '').toLowerCase();
        let timeSlots: DoseSlot[] = ['Morning', 'Night'];
        if (freqLower.includes('tid') || freqLower.includes('three') || freqLower.includes('3 times')) {
          timeSlots = ['Morning', 'Afternoon', 'Night'];
        } else if (freqLower.includes('bid') || freqLower.includes('twice') || freqLower.includes('2 times') || freqLower.includes('2 puffs')) {
          timeSlots = ['Morning', 'Night'];
        } else if (freqLower.includes('bedtime') || freqLower.includes('night') || freqLower.includes('evening')) {
          timeSlots = ['Night'];
        } else if (freqLower.includes('morning')) {
          timeSlots = ['Morning'];
        } else if (freqLower.includes('afternoon') || freqLower.includes('noon')) {
          timeSlots = ['Afternoon'];
        }

        // Pill shape & color heuristic
        let shape: 'round' | 'capsule' | 'oval' = 'round';
        let color = '#0E7C7B';
        const nameLower = m.name.toLowerCase();
        if (nameLower.includes('inhaler') || nameLower.includes('spray')) {
          shape = 'capsule';
          color = '#0284C7';
        } else if (nameLower.includes('capsule') || nameLower.includes('gel')) {
          shape = 'capsule';
          color = '#D97706';
        } else if (nameLower.includes('syrup') || nameLower.includes('liquid')) {
          shape = 'oval';
          color = '#7C3AED';
        }

        // Avoid duplicates if same medicine is already active (update it instead)
        const existing = patient.currentMedicines.find(
          (cm) => cm.name.trim().toLowerCase() === m.name.trim().toLowerCase()
        );

        if (existing) {
          existing.dosage = m.dose;
          existing.strength = m.dose;
          existing.frequency = m.frequency;
          existing.duration = m.duration;
          existing.instructions = m.instructions;
          existing.source = 'prescribed';
          existing.prescribedBy = `Prescribed by Dr. ${prescriptionData.doctorName} on ${curDate}`;
          existing.prescribedDate = curDate;
          existing.startDate = curDate;
          existing.endDate = endDate;
          existing.status = 'active';
          existing.timeSlots = timeSlots;
          existing.daysLeft = durationDays;
          existing.totalDays = durationDays;
          existing.doseHistory = existing.doseHistory || {};
          existing.doseHistory[curDate] = existing.doseHistory[curDate] || {};
          timeSlots.forEach((slot) => {
            if (!existing.doseHistory![curDate][slot]) {
              existing.doseHistory![curDate][slot] = {
                slot,
                status: 'Pending',
                scheduledTime: slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM',
              };
            }
          });
        } else {
          const newMedId = `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const newMed: CurrentMedicine = {
            id: newMedId,
            name: m.name,
            dosage: m.dose,
            strength: m.dose,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions,
            source: 'prescribed',
            prescribedBy: `Prescribed by Dr. ${prescriptionData.doctorName} on ${curDate}`,
            prescribedDate: curDate,
            startDate: curDate,
            endDate,
            status: 'active',
            shape,
            color,
            timeSlots,
            daysLeft: durationDays,
            totalDays: durationDays,
            doseHistory: {
              [curDate]: Object.fromEntries(
                timeSlots.map((slot) => [
                  slot,
                  {
                    slot,
                    status: 'Pending' as DoseStatus,
                    scheduledTime: slot === 'Morning' ? '08:00 AM' : slot === 'Afternoon' ? '01:00 PM' : '09:00 PM',
                  },
                ])
              ) as Partial<Record<DoseSlot, DoseLog>>,
            },
            takenToday: { Morning: false, Afternoon: false, Night: false },
          };
          patient.currentMedicines.push(newMed);
        }
      });

      // Notify the patient ("Dr. X added N medicines")
      this.addNotification({
        recipientRole: 'patient',
        recipientPatientId: prescriptionData.patientId,
        title: 'Prescription Added to Medications',
        message: `Dr. ${prescriptionData.doctorName} added ${prescriptionData.medicines.length} medicine(s) to your daily tracker.`,
        type: 'access',
      });
    }

    // If lab tests were ordered, create lab orders
    if (prescriptionData.labTestsOrdered && prescriptionData.labTestsOrdered.length > 0) {
      prescriptionData.labTestsOrdered.forEach((test) => {
        this.state.labOrders.push({
          id: `lab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          patientId: prescriptionData.patientId,
          patientName: prescriptionData.patientName,
          uniquePatientId: prescriptionData.uniquePatientId,
          doctorName: prescriptionData.doctorName,
          hospitalId: 'hosp-1',
          testName: test,
          category: 'Diagnostic Order',
          orderedAt: new Date().toISOString(),
          status: 'ordered',
        });
      });
    }

    this.persistAndBroadcast();
    return newPr;
  }

  // --- Hospital Staff & Admin Actions ---
  public updateWardBedStatus(bedId: string, status: WardBedData['status']) {
    const bed = this.state.wardBeds.find((b) => b.id === bedId);
    if (bed) {
      bed.status = status;
      this.persistAndBroadcast();
    }
  }

  public updateBedCount(hospitalId: string, bedKey: keyof Hospital['beds'], delta: number) {
    const hosp = this.state.hospitals.find((h) => h.id === hospitalId);
    if (hosp) {
      const current = hosp.beds[bedKey];
      hosp.beds[bedKey] = Math.max(0, current + delta);
      this.persistAndBroadcast();
    }
  }

  public setQueueStatus(tokenId: string, status: QueueToken['status']) {
    const token = this.state.queueTokens.find((q) => q.id === tokenId);
    if (token) {
      token.status = status;
      this.persistAndBroadcast();
    }
  }

  public restockMedicine(pharmacyId: string, amount: number = 50) {
    const item = this.state.pharmacy.find((p) => p.id === pharmacyId);
    if (item) {
      item.stock += amount;
      this.addNotification({
        recipientRole: 'hospital',
        title: 'Pharmacy Restocked',
        message: `${item.name} restocked (+${amount} ${item.unit}). New stock: ${item.stock}`,
        type: 'system',
      });
      this.persistAndBroadcast();
    }
  }

  public updateLabOrderStatus(orderId: string, status: LabOrder['status']) {
    const order = this.state.labOrders.find((l) => l.id === orderId);
    if (order) {
      order.status = status;
      if (status === 'uploaded_to_locker') {
        // Automatically create report in locker
        this.uploadMedicalReport({
          patientId: order.patientId,
          title: `Diagnostic Lab: ${order.testName}`,
          category: 'Pathology',
          date: new Date().toISOString().split('T')[0],
          doctorName: order.doctorName,
          hospitalName: 'City Metro Pathology Lab',
          fileUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
          fileType: 'pdf',
          summary: `Official laboratory findings for ${order.testName}. Verified and signed off by Chief Pathologist.`,
        });
      }
      this.persistAndBroadcast();
    }
  }

  // --- Emergency Response Flow & 8-Step Lifecycle Actions ---

  // Helper to format clean HH:MM:SS timestamps
  private formatTimestamp(): string {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }

  // STEP 1: WITNESS REPORT - One-Tap SOS
  // Big "One-Tap SOS" button: auto-captures GPS, creates INC-2026-XXXX, immediately transitions to 'Dispatcher Alerted'
  public triggerOneTapSOS(data: {
    lat: number;
    lng: number;
    address?: string;
    callerName?: string;
    callerPhone?: string;
    emergencyType?: EmergencyCase['emergencyType'];
  }): { caseItem: EmergencyCase; isDuplicate: boolean } {
    const existingIncidents = this.state.emergencies;
    const now = Date.now();
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    // Deduplication check: within ~160 meters and 10 minutes
    const existing = existingIncidents.find((emg) => {
      const ageMs = now - new Date(emg.reportedAt).getTime();
      if (ageMs > TEN_MINUTES_MS) return false;
      const dist = getDistanceInMeters(emg.lat, emg.lng, data.lat, data.lng);
      return dist <= 160 && emg.status !== 'Closed';
    });

    if (existing) {
      existing.confidenceCount = (existing.confidenceCount || 1) + 1;
      const witnessPhone = data.callerPhone || '+91 98100 00000';
      existing.confirmations = existing.confirmations || [];
      existing.confirmations.push({ callerPhone: witnessPhone, timestamp: new Date().toISOString() });

      existing.timeline = existing.timeline || [];
      existing.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: 'Corroborating SOS report received (+1 confirmation)',
        who: data.callerName || 'Nearby Witness',
        role: 'witness',
      });

      this.addNotification({
        recipientRole: 'all',
        title: `🚨 Incident Corroborated (+1 SOS)`,
        message: `Emergency at ${existing.address} verified by another witness. Confidence level: ${existing.confidenceCount}`,
        type: 'emergency',
      });

      this.persistAndBroadcast();
      return { isDuplicate: true, caseItem: existing };
    }

    // Determine next sequential INC ID: INC-2026-000X
    const incNums = existingIncidents
      .map((e) => {
        const match = e.id.match(/INC-2026-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextSeq = incNums.length > 0 ? Math.max(...incNums) + 1 : 1;
    const nextId = `INC-2026-${String(nextSeq).padStart(4, '0')}`;

    const callerName = data.callerName || 'Citizen Witness';
    const callerPhone = data.callerPhone || '+91 98100 11223';
    const emergencyType = data.emergencyType || 'accident';
    const address = data.address || 'Connaught Place Outer Circle, New Delhi';

    const timestampStr = this.formatTimestamp();

    const newCase: EmergencyCase = {
      id: nextId,
      callerName,
      callerPhone,
      emergencyType,
      victimsCount: 1,
      severity: 'critical',
      lat: data.lat,
      lng: data.lng,
      address,
      description: 'One-Tap SOS broadcasted. Awaiting supplementary witness details.',
      reportedAt: new Date().toISOString(),
      confidenceCount: 1,
      confirmations: [{ callerPhone, timestamp: new Date().toISOString() }],
      status: 'Dispatcher Alerted', // STEP 1 -> STEP 2: Instant alert to dispatcher & nearby track
      helpers: [],
      responders: [],
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          timestamp: timestampStr,
          event: 'One-Tap SOS broadcasted from device GPS',
          who: callerName,
          role: 'witness',
          details: `Coordinates: ${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`,
        },
        {
          id: `tl-${Date.now()}-2`,
          timestamp: timestampStr,
          event: 'Dispatcher Alerted & Dual Tracks Activated',
          who: 'MediTrack Smart Dispatch Engine',
          role: 'system',
          details: 'Broadcasting to nearest emergency fleet and nearby app users within 3 km',
        },
      ],
    };

    this.state.emergencies = [newCase, ...this.state.emergencies];

    this.addNotification({
      recipientRole: 'all',
      title: `🚨 HIGH PRIORITY: One-Tap SOS at ${address}`,
      message: `Incident #${nextId}: ${emergencyType.toUpperCase()} broadcasted. Dispatcher alerted & nearby civilian helpers notified.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
    return { isDuplicate: false, caseItem: newCase };
  }

  // STEP 1 OPTIONAL DETAILS: Witness adds photo, note, victim count AFTER SOS is sent
  public updateIncidentAfterSOS(
    caseId: string,
    details: {
      description?: string;
      photoUrl?: string;
      victimsCount?: number;
      emergencyType?: EmergencyCase['emergencyType'];
      severity?: EmergencyCase['severity'];
      callerName?: string;
      callerPhone?: string;
    }
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    if (details.description) emg.description = details.description;
    if (details.photoUrl) emg.photoUrl = details.photoUrl;
    if (details.victimsCount !== undefined) emg.victimsCount = details.victimsCount;
    if (details.emergencyType) emg.emergencyType = details.emergencyType;
    if (details.severity) emg.severity = details.severity;
    if (details.callerName) emg.callerName = details.callerName;
    if (details.callerPhone) emg.callerPhone = details.callerPhone;

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: 'Witness provided supplementary scene details',
      who: emg.callerName || 'Witness',
      role: 'witness',
      details: `${emg.victimsCount} victim(s), Type: ${emg.emergencyType}. ${details.description ? `Note: "${details.description}"` : ''}`,
    });

    this.addNotification({
      recipientRole: 'responder',
      title: `📸 Supplementary Scene Info for #${emg.id}`,
      message: `Witness submitted updated details: ${emg.victimsCount} victim(s), ${emg.emergencyType}.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // STEP 2 - TRACK A: DISPATCHER ASSIGNS & DISPATCHES AMBULANCE
  public dispatchAmbulance(caseId: string, ambulanceId: string) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    const amb = this.state.ambulances.find((a) => a.id === ambulanceId);
    if (!emg || !amb) return;

    // Mark ambulance status
    amb.status = 'dispatched';

    // Link assigned ambulance to incident
    emg.assignedAmbulance = {
      ...amb,
      dispatchedAt: new Date().toISOString(),
      status: 'dispatched',
    };

    emg.claimedSlots = emg.claimedSlots || {};
    emg.claimedSlots.ambulance = {
      claimedBy: amb.paramedicName,
      unitCode: amb.unitCode,
      timestamp: new Date().toISOString(),
    };

    // Update status to 'Ambulance Dispatched' and then 'Ambulance En Route'
    emg.status = 'Ambulance En Route';
    emg.etaMinutes = amb.etaMinutes;

    // Also populate legacy responder list
    this.addResponderToEmergency(caseId, {
      name: `${amb.unitCode} (${amb.paramedicName})`,
      type: 'Ambulance',
      phone: amb.phone,
      distanceKm: amb.distanceKm,
      etaMinutes: amb.etaMinutes,
      vehicle: amb.type,
      equipment: amb.equipment,
    });

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Ambulance Dispatched & En Route: ${amb.unitCode}`,
      who: 'Dispatcher Command',
      role: 'dispatcher',
      details: `${amb.type} crew (${amb.paramedicName}, Driver ${amb.driverName}). ETA: ${amb.etaMinutes} mins (${amb.distanceKm} km).`,
    });

    this.addNotification({
      recipientRole: 'all',
      title: `🚑 Ambulance En Route: ${amb.unitCode}`,
      message: `${amb.unitCode} dispatched to ${emg.address}. ETA ${amb.etaMinutes} mins.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // STEP 2 - TRACK B: NEARBY APP USER ACCEPTS ONE OF THREE ASSISTANCE OPTIONS
  // Options: 'help_scene' | 'transport_victim' | 'guide_ambulance'
  // MULTIPLE users can accept, and each can choose a different option.
  public helperAcceptOption(
    caseId: string,
    helperData: {
      id?: string;
      name: string;
      phone?: string;
      roleOption: HelperRoleOption;
      distanceKm?: number;
      etaMinutes?: number;
      location?: { lat: number; lng: number };
      accuracy?: number;
      vehicleDetails?: string;
      hospitalId?: string;
      hospitalName?: string;
      sceneNotes?: string;
      landmarks?: string;
      roadBlocks?: string;
      victimCountEstimate?: number;
      photoUrl?: string;
    }
  ): IncidentHelper | null {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return null;

    emg.helpers = emg.helpers || [];
    emg.responders = emg.responders || [];

    const helperId = helperData.id || `hlp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const distanceKm =
      helperData.distanceKm ??
      (helperData.location
        ? Number((getDistanceInMeters(helperData.location.lat, helperData.location.lng, emg.lat, emg.lng) / 1000).toFixed(2))
        : Number((Math.random() * 1.5 + 0.3).toFixed(1)));
    const etaMinutes = helperData.etaMinutes ?? Math.max(1, Math.round(distanceKm * 3));

    let helperStatus: IncidentHelper['status'] = 'accepted';
    if (helperData.roleOption === 'transport_victim') {
      helperStatus = 'transporting';
    }

    const newHelper: IncidentHelper = {
      id: helperId,
      name: helperData.name,
      phone: helperData.phone || '+91 98711 00223',
      roleOption: helperData.roleOption,
      distanceKm,
      etaMinutes,
      acceptedAt: new Date().toISOString(),
      status: helperStatus,
      location: helperData.location,
      accuracy: helperData.accuracy,
      lastLocationUpdate: new Date().toISOString(),
      vehicleDetails: helperData.vehicleDetails,
      transportHospitalId: helperData.hospitalId,
      transportHospitalName: helperData.hospitalName,
      sceneNotes: helperData.sceneNotes,
      landmarks: helperData.landmarks,
      roadBlocks: helperData.roadBlocks,
      victimCountEstimate: helperData.victimCountEstimate,
      photoUrl: helperData.photoUrl,
    };

    emg.helpers.push(newHelper);

    // Keep lifecycle status updated if still in earlier stages
    if (emg.status === 'Reported' || emg.status === 'Dispatcher Alerted') {
      emg.status = 'Helpers Responding';
    }

    // Add to legacy responders
    const respType = helperData.roleOption === 'transport_victim' ? 'Volunteer' : 'Civilian';
    this.addResponderToEmergency(caseId, {
      name: helperData.name,
      type: respType,
      phone: helperData.phone,
      distanceKm,
      etaMinutes,
      vehicle: helperData.vehicleDetails || (helperData.roleOption === 'transport_victim' ? 'Private Car / Cab' : undefined),
      hasVehicle: helperData.roleOption === 'transport_victim',
      notes: `Role: ${helperData.roleOption.replace('_', ' ').toUpperCase()}`,
      location: helperData.location,
    });

    emg.timeline = emg.timeline || [];

    if (helperData.roleOption === 'help_scene') {
      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: `Nearby helper accepted: Help at Scene`,
        who: helperData.name,
        role: 'civilian_helper',
        details: `Navigating to scene (${distanceKm} km, ETA ${etaMinutes} mins). Reviewing Safe Assistance instructions.`,
      });
      this.addNotification({
        recipientRole: 'all',
        title: `🤝 Helper Responding: ${helperData.name}`,
        message: `${helperData.name} is on foot/bike heading to scene to provide safe first aid assistance.`,
        type: 'emergency',
      });
    } else if (helperData.roleOption === 'transport_victim') {
      emg.destinationHospitalId = helperData.hospitalId;
      emg.destinationHospitalName = helperData.hospitalName;
      emg.etaMinutes = etaMinutes;

      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: `Civilian Transport Initiated to ${helperData.hospitalName}`,
        who: helperData.name,
        role: 'civilian_helper',
        details: `Safety declaration confirmed: Appropriate to move victim. Vehicle: ${helperData.vehicleDetails || 'Personal Vehicle'}. Heading to ${helperData.hospitalName}.`,
      });

      // Notify chosen hospital's Incoming Emergencies page!
      this.addNotification({
        recipientRole: 'hospital',
        title: `🚨 INCOMING CIVILIAN TRANSPORT: ${emg.emergencyType.toUpperCase()}`,
        message: `Civilian helper ${helperData.name} is transporting victim to ${helperData.hospitalName}. ETA: ${etaMinutes} mins. Prepare ER reception.`,
        type: 'emergency',
      });
    } else if (helperData.roleOption === 'guide_ambulance') {
      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: `Helper guiding ambulance route & scene details`,
        who: helperData.name,
        role: 'civilian_helper',
        details: `Shared landmark: ${helperData.landmarks || 'Near crossing'}. Roadblocks: ${helperData.roadBlocks || 'None reported'}.`,
      });
      this.addNotification({
        recipientRole: 'responder',
        title: `🧭 Route Guidance Shared by ${helperData.name}`,
        message: `Landmark: ${helperData.landmarks || 'Exact corner'}. Dispatcher & En-route ambulance notified.`,
        type: 'emergency',
      });
    }

    this.persistAndBroadcast();
    return newHelper;
  }

  // Helper marks "Arrived" at scene
  public helperMarkArrived(caseId: string, helperId: string, notes?: string) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg || !emg.helpers) return;

    const helper = emg.helpers.find((h) => h.id === helperId);
    if (helper) {
      helper.status = 'arrived';
      helper.arrivedAt = new Date().toISOString();
      if (notes) helper.sceneNotes = notes;

      emg.timeline = emg.timeline || [];
      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: `Helper arrived at scene`,
        who: helper.name,
        role: 'civilian_helper',
        details: notes || 'Providing scene safety and reassurance.',
      });

      this.addNotification({
        recipientRole: 'all',
        title: `📍 Helper Arrived at Scene`,
        message: `${helper.name} has arrived at the accident location and is providing assistance.`,
        type: 'emergency',
      });

      this.persistAndBroadcast();
    }
  }

  // Helper marks "Assistance given"
  public helperMarkAssistanceGiven(caseId: string, helperId: string) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg || !emg.helpers) return;

    const helper = emg.helpers.find((h) => h.id === helperId);
    if (helper) {
      helper.status = 'assistance_given';

      emg.timeline = emg.timeline || [];
      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: `Safe assistance provided by helper`,
        who: helper.name,
        role: 'civilian_helper',
        details: 'First aid applied / area stabilized. Standing by for ambulance.',
      });

      this.addNotification({
        recipientRole: 'all',
        title: `✅ Scene Assistance Completed`,
        message: `${helper.name} completed initial first aid and secured the scene.`,
        type: 'emergency',
      });

      this.persistAndBroadcast();
    }
  }

  // Guide Ambulance: update dispatcher & ambulance crew with scene info
  public guideAmbulanceUpdate(
    caseId: string,
    helperId: string,
    updates: {
      exactSpot?: string;
      landmarks?: string;
      roadBlocks?: string;
      victimCountEstimate?: number;
      notes?: string;
      photoUrl?: string;
    }
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    const helper = emg.helpers?.find((h) => h.id === helperId);
    if (helper) {
      if (updates.landmarks) helper.landmarks = updates.landmarks;
      if (updates.roadBlocks) helper.roadBlocks = updates.roadBlocks;
      if (updates.victimCountEstimate) helper.victimCountEstimate = updates.victimCountEstimate;
      if (updates.notes) helper.sceneNotes = updates.notes;
      if (updates.photoUrl) helper.photoUrl = updates.photoUrl;
    }

    if (updates.victimCountEstimate) emg.victimsCount = updates.victimCountEstimate;
    if (updates.photoUrl) emg.photoUrl = updates.photoUrl;

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: 'Live Route Guidance & Scene Update Posted',
      who: helper ? helper.name : 'Civilian Guide',
      role: 'civilian_helper',
      details: `Landmarks: ${updates.landmarks || '—'} | Roadblocks: ${updates.roadBlocks || 'None'} | Victims: ${updates.victimCountEstimate || emg.victimsCount}. ${updates.notes || ''}`,
    });

    this.addNotification({
      recipientRole: 'responder',
      title: `🧭 Real-time Route Guidance for #${emg.id}`,
      message: `Landmark: ${updates.landmarks || 'Updated'}. Clear approach path posted to Paramedic unit.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // STEP 3: PROFESSIONAL ASSESSMENT & TRANSPORT (Paramedic Enters Vitals)
  public updateParamedicVitals(
    caseId: string,
    vitals: EmergencyVitals,
    conditionNotes?: string
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    emg.vitals = {
      ...emg.vitals,
      ...vitals,
      recordedAt: new Date().toISOString(),
    };
    emg.status = 'Assessment and Transport';

    const who = emg.assignedAmbulance ? `Paramedic (${emg.assignedAmbulance.paramedicName})` : 'Paramedic Crew';
    const vitalsStr = `BP ${vitals.bloodPressure || '—'}, HR ${vitals.heartRate || '—'} bpm, SpO2 ${vitals.spo2 || '—'}%, GCS ${vitals.gcs || '—'}/15`;

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Professional Assessment & Vitals Recorded`,
      who,
      role: 'paramedic',
      details: `${vitalsStr}. ${conditionNotes ? `Notes: ${conditionNotes}` : ''}`,
    });

    // Sync vitals to destination hospital
    if (emg.destinationHospitalId) {
      this.addNotification({
        recipientRole: 'hospital',
        title: `🩺 Telemetry Synced: ${emg.emergencyType.toUpperCase()}`,
        message: `Inbound vitals: ${vitalsStr}. Emergency bay alert refreshed.`,
        type: 'emergency',
      });
    }

    this.persistAndBroadcast();
  }

  // STEP 3: HOSPITAL HANDOVER (Hospital confirms receiving, bed assigned)
  public hospitalHandover(
    caseId: string,
    hospitalId: string,
    hospitalName: string,
    bedAssigned: string
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    emg.destinationHospitalId = hospitalId;
    emg.destinationHospitalName = hospitalName;
    emg.hospitalBedAssigned = bedAssigned;
    emg.status = 'Hospital Handover';
    emg.arrivedAtHospitalAt = new Date().toISOString();

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Hospital Handover Complete`,
      who: `${hospitalName} Trauma Desk`,
      role: 'hospital',
      details: `Patient admitted to ${bedAssigned}. Bed assigned and clinical handover finalized.`,
    });

    this.addNotification({
      recipientRole: 'all',
      title: `🏥 Handover Confirmed at ${hospitalName}`,
      message: `Victim safely received into ${bedAssigned}. Clinical team has assumed primary care.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // STEP 3: CLOSE INCIDENT (Dispatcher closes, summary and timeline saved to History)
  public closeIncident(caseId: string, summary?: string) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    emg.status = 'Closed';
    emg.closedAt = new Date().toISOString();
    emg.closeSummary = summary || 'Incident successfully managed, patient received appropriate clinical treatment, scene secured.';

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: 'Incident Officially Closed & Archived to History',
      who: 'Dispatcher Command',
      role: 'dispatcher',
      details: emg.closeSummary,
    });

    this.addNotification({
      recipientRole: 'all',
      title: `✅ Incident #${emg.id} Closed`,
      message: `Incident resolved and full timeline archived to History.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // Backward compatibility: reportEmergency
  public reportEmergency(data: {
    callerName: string;
    callerPhone: string;
    emergencyType: EmergencyCase['emergencyType'];
    victimsCount: number;
    severity: EmergencyCase['severity'];
    lat: number;
    lng: number;
    address: string;
    description: string;
    photoUrl?: string;
  }): { isDuplicate: boolean; caseItem: EmergencyCase } {
    const res = this.triggerOneTapSOS({
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      callerName: data.callerName,
      callerPhone: data.callerPhone,
      emergencyType: data.emergencyType,
    });

    if (!res.isDuplicate) {
      this.updateIncidentAfterSOS(res.caseItem.id, {
        description: data.description,
        photoUrl: data.photoUrl,
        victimsCount: data.victimsCount,
        emergencyType: data.emergencyType,
        severity: data.severity,
      });
    }

    return res;
  }

  // Multi-Responder Help Action (Civilian, Volunteer, Ambulance)
  public addResponderToEmergency(
    caseId: string,
    responder: {
      name: string;
      type: 'Civilian' | 'Ambulance' | 'Volunteer';
      phone?: string;
      distanceKm?: number;
      etaMinutes?: number;
      vehicle?: string;
      hasVehicle?: boolean;
      equipment?: string[];
      notes?: string;
      location?: { lat: number; lng: number };
    }
  ): IncidentResponder | null {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return null;

    if (!emg.responders) {
      emg.responders = [];
    }

    const dist = responder.distanceKm ?? Number((Math.random() * 2 + 0.4).toFixed(1));
    const eta = responder.etaMinutes ?? Math.max(2, Math.round(dist * 3));

    const newResponder: IncidentResponder = {
      id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: responder.name,
      type: responder.type,
      phone: responder.phone || '+91 98100 00000',
      distanceKm: dist,
      etaMinutes: eta,
      acceptedAt: new Date().toISOString(),
      vehicle: responder.vehicle || (responder.type === 'Ambulance' ? 'ALS Ambulance' : 'Private transport'),
      hasVehicle: responder.hasVehicle ?? (responder.type === 'Ambulance' || responder.type === 'Volunteer'),
      equipment: responder.equipment || (responder.type === 'Ambulance' ? ['Oxygen', 'Stretcher', 'Defibrillator'] : ['First Aid Kit']),
      notes: responder.notes,
      location: responder.location || {
        lat: emg.lat + (Math.random() * 0.008 - 0.004),
        lng: emg.lng + (Math.random() * 0.008 - 0.004),
      },
    };

    emg.responders.push(newResponder);

    // Update primary responder references for legacy compatibility
    emg.responderId = newResponder.id;
    emg.responderName = emg.responders.map((r) => r.name).join(', ');
    emg.responderPhone = newResponder.phone;
    if (newResponder.location) {
      emg.responderLocation = newResponder.location;
    }

    this.persistAndBroadcast();
    return newResponder;
  }

  // Live real-time location update (called by watchPosition throttle 3-5s)
  public updateResponderLocation(
    caseId: string,
    responderOrHelperId: string,
    location: { lat: number; lng: number },
    accuracy?: number
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    // Update top-level incident responderLocation
    emg.responderLocation = location;

    // Update in responders list
    emg.responders = emg.responders || [];
    const r = emg.responders.find(
      (resp) => resp.id === responderOrHelperId || resp.name === responderOrHelperId
    );
    if (r) {
      r.location = location;
      const meters = getDistanceInMeters(location.lat, location.lng, emg.lat, emg.lng);
      r.distanceKm = Number((meters / 1000).toFixed(2));
      r.etaMinutes = Math.max(1, Math.round(r.distanceKm * 3));
    }

    // Update in helpers list
    emg.helpers = emg.helpers || [];
    const h = emg.helpers.find(
      (hlp) => hlp.id === responderOrHelperId || hlp.name === responderOrHelperId
    );
    if (h) {
      h.location = location;
      h.accuracy = accuracy;
      h.lastLocationUpdate = new Date().toISOString();
      const meters = getDistanceInMeters(location.lat, location.lng, emg.lat, emg.lng);
      h.distanceKm = Number((meters / 1000).toFixed(2));
      h.etaMinutes = Math.max(1, Math.round(h.distanceKm * 3));
    }

    // Also update ambulance if unit matches
    if (
      emg.assignedAmbulance &&
      (emg.assignedAmbulance.id === responderOrHelperId ||
        emg.assignedAmbulance.unitCode === responderOrHelperId ||
        emg.assignedAmbulance.paramedicName === responderOrHelperId)
    ) {
      emg.assignedAmbulance.lat = location.lat;
      emg.assignedAmbulance.lng = location.lng;
    }

    this.persistAndBroadcast();
  }

  // Legacy single responder helper
  public responderAcceptEmergency(caseId: string, responderId: string, responderName: string, responderPhone: string) {
    this.addResponderToEmergency(caseId, {
      name: responderName,
      type: 'Ambulance',
      phone: responderPhone,
      hasVehicle: true,
    });
  }

  // Update incident status
  public updateEmergencyStatus(
    caseId: string,
    status: EmergencyCase['status'],
    destinationHospitalId?: string,
    destinationHospitalName?: string
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    emg.status = status;
    if (destinationHospitalId) emg.destinationHospitalId = destinationHospitalId;
    if (destinationHospitalName) emg.destinationHospitalName = destinationHospitalName;

    const statusStr = String(status);
    if (statusStr === 'Assessment and Transport' || statusStr === 'Victim Picked Up') {
      emg.pickedUpAt = emg.pickedUpAt || new Date().toISOString();
    }
    if ((statusStr === 'Hospital Handover' || statusStr === 'At Hospital' || statusStr === 'arrived') && !emg.arrivedAtHospitalAt) {
      emg.arrivedAtHospitalAt = new Date().toISOString();
    }
    if (statusStr === 'Closed' && !emg.closedAt) {
      emg.closedAt = new Date().toISOString();
    }

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Status updated to ${status}`,
      who: 'System Coordinator',
      role: 'system',
    });

    this.addNotification({
      recipientRole: 'all',
      title: `Incident Status: ${String(status).toUpperCase()}`,
      message: `Incident #${emg.id} (${emg.emergencyType}) transitioned to status: ${status}.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
  }

  // Hospital Choice & Notification with ETA & Vitals
  public selectDestinationHospital(
    caseId: string,
    hospitalId: string,
    etaMinutes: number,
    vitals?: EmergencyVitals
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    const hosp = this.state.hospitals.find((h) => h.id === hospitalId);
    if (emg && hosp) {
      emg.destinationHospitalId = hospitalId;
      emg.destinationHospitalName = hosp.name;
      emg.etaMinutes = etaMinutes;
      if (vitals) {
        emg.vitals = { ...emg.vitals, ...vitals, recordedAt: new Date().toISOString() };
      }

      this.addNotification({
        recipientRole: 'hospital',
        title: `🚨 CODE RED ALERT: Inbound ${emg.emergencyType.toUpperCase()}`,
        message: `${emg.victimsCount} victim(s) en route to ${hosp.name}. ETA: ${etaMinutes} mins. Prepare trauma bay.`,
        type: 'emergency',
      });

      this.persistAndBroadcast();
    }
  }

  // Update victim vitals (BP, HR, SpO2, GCS)
  public updateVictimVitals(caseId: string, vitals: EmergencyVitals) {
    this.updateParamedicVitals(caseId, vitals);
  }

  // Hospital locks beds
  public confirmHospitalReadiness(caseId: string, reservedBeds: { emergency: number; icu: number }) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (emg && emg.destinationHospitalId) {
      emg.hospitalReadinessConfirmed = true;
      emg.bedsReserved = reservedBeds;

      const hosp = this.state.hospitals.find((h) => h.id === emg.destinationHospitalId);
      if (hosp) {
        hosp.beds.emergencyOccupied = Math.min(
          hosp.beds.emergencyTotal,
          hosp.beds.emergencyOccupied + reservedBeds.emergency
        );
        hosp.beds.icuOccupied = Math.min(hosp.beds.icuTotal, hosp.beds.icuOccupied + reservedBeds.icu);
      }

      emg.timeline = emg.timeline || [];
      emg.timeline.push({
        id: `tl-${Date.now()}`,
        timestamp: this.formatTimestamp(),
        event: 'Hospital Bed Readiness Confirmed',
        who: `${emg.destinationHospitalName} Trauma Admin`,
        role: 'hospital',
        details: `Locked ${reservedBeds.emergency} Emergency Bed(s) & ${reservedBeds.icu} ICU Bed(s).`,
      });

      this.addNotification({
        recipientRole: 'all',
        title: `🏥 Hospital Trauma Team Ready!`,
        message: `${emg.destinationHospitalName} has locked ${reservedBeds.emergency} Emergency Bed(s) & ${reservedBeds.icu} ICU Bed(s). Trauma team standby.`,
        type: 'emergency',
      });

      this.persistAndBroadcast();
    }
  }

  public markEmergencyArrived(caseId: string) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (emg) {
      emg.status = 'Hospital Handover';
      emg.arrivedAtHospitalAt = new Date().toISOString();
      this.addNotification({
        recipientRole: 'all',
        title: `✅ Patient Admitted to Emergency Care`,
        message: `Victims from ${emg.emergencyType} at ${emg.address} safely handed over to ER team.`,
        type: 'emergency',
      });
      this.persistAndBroadcast();
    }
  }

  public issueQueueToken(params: {
    patientId: string;
    patientName: string;
    doctorId: string;
    doctorName?: string;
    hospitalId: string;
    hospitalName?: string;
    reason: string;
  }): QueueToken {
    const doctor = this.state.doctors.find((d) => d.id === params.doctorId);
    const patient = this.state.patients.find((p) => p.id === params.patientId);
    return this.bookAppointment({
      patientId: params.patientId,
      patientName: params.patientName,
      uniquePatientId: patient?.uniquePatientId || 'PT00234',
      doctorId: params.doctorId,
      hospitalId: params.hospitalId,
      department: doctor?.specialization || 'General OPD',
      reason: params.reason,
    });
  }

  // --- Notification Helpers ---
  public addNotification(notif: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotif: InAppNotification = {
      ...notif,
      id: `nt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.state.notifications = [newNotif, ...this.state.notifications.slice(0, 49)];
  }

  public markNotificationAsRead(id: string) {
    const notif = this.state.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.persistAndBroadcast();
    }
  }

  public markAllNotificationsAsRead() {
    this.state.notifications.forEach((n) => (n.read = true));
    this.persistAndBroadcast();
  }

  // --- Phase 4: Payment Actions ---
  public payBill(billId: string, method: PaymentMethod, ref?: string): PaymentBill | null {
    const bill = this.state.bills.find((b) => b.id === billId);
    if (!bill) return null;

    bill.status = 'Paid';
    bill.paymentMethod = method;
    bill.transactionRef = ref || `${method.toUpperCase()}-${Date.now().toString().slice(-8)}`;
    bill.paidAt = new Date().toISOString();

    // If this bill is linked to a held appointment token in payment_pending, activate the token
    const linkedToken = this.state.queueTokens.find(
      (q) =>
        (bill.tokenId && (q.id === bill.tokenId || q.appointmentId === bill.tokenId)) ||
        (bill.appointmentId && (q.id === bill.appointmentId || q.appointmentId === bill.appointmentId)) ||
        (q.patientId === bill.patientId && q.fee === bill.amount && q.status === 'payment_pending')
    );

    if (linkedToken && linkedToken.status === 'payment_pending') {
      linkedToken.status = 'waiting';
      linkedToken.paymentStatus = 'paid';
      linkedToken.paymentId = bill.transactionRef;
      linkedToken.heldUntil = undefined;

      this.addNotification({
        recipientRole: 'doctor',
        recipientDoctorId: linkedToken.doctorId,
        title: 'New Paid Patient in Queue',
        message: `${linkedToken.patientName} completed consultation fee payment of ₹${linkedToken.fee}. Token #${linkedToken.tokenNumber} is active.`,
        type: 'queue',
      });
    }

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: bill.patientId,
      title: 'Payment Confirmed & Receipt Ready',
      message: `Invoice #${bill.id} (₹${bill.amount}) settled via ${method}. Receipt Ref: ${bill.transactionRef}`,
      type: 'system',
      category: 'payment',
    });

    this.persistAndBroadcast();
    return bill;
  }

  // Rate limiter map for manual UPI submissions (userId -> timestamps)
  private upiSubmissions: Map<string, number[]> = new Map();

  // Manual UPI Submission (Step 4 & Pay Now)
  // Validates 12-digit UTR, verifies global uniqueness, puts bill into "Pending Verification", holds slot for 30 mins
  public submitManualUpiPayment(params: {
    billId: string;
    utr: string;
    patientId: string;
  }): { success: boolean; bill: PaymentBill; message: string } {
    const cleanUtr = params.utr.trim();

    // 1. Validate 12-digit format
    if (!/^\d{12}$/.test(cleanUtr)) {
      throw new Error('Invalid UTR number. The UTR must be exactly 12 numeric digits from your UPI transaction receipt.');
    }

    // 2. Check rate limit (max 4 submissions per 60 seconds per user)
    const now = Date.now();
    const userTimes = this.upiSubmissions.get(params.patientId) || [];
    const recentTimes = userTimes.filter((t) => now - t < 60000);
    if (recentTimes.length >= 4) {
      throw new Error('Too many verification requests. Please wait a minute before submitting again.');
    }
    recentTimes.push(now);
    this.upiSubmissions.set(params.patientId, recentTimes);

    // 3. Check uniqueness across all bills (reject duplicate UTR)
    const isDuplicate = this.state.bills.some(
      (b) => (b.utr === cleanUtr || b.transactionRef === cleanUtr) && b.id !== params.billId
    );
    if (isDuplicate) {
      throw new Error(`Duplicate UTR detected: Transaction reference ${cleanUtr} has already been submitted for another invoice. Please verify your receipt.`);
    }

    // 4. Find the bill
    const bill = this.state.bills.find((b) => b.id === params.billId);
    if (!bill) {
      throw new Error(`Bill record "${params.billId}" not found.`);
    }

    // 5. Update bill to "Pending Verification" (never Paid) with 30-minute hold
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    const holdUntil = now + THIRTY_MINUTES_MS;

    bill.status = 'Pending Verification';
    bill.paymentMethod = 'UPI';
    bill.utr = cleanUtr;
    bill.transactionRef = cleanUtr;
    bill.heldUntil = holdUntil;
    bill.rejectionReason = undefined;

    // 6. Hold linked appointment slot for 30 minutes
    const linkedToken = this.state.queueTokens.find(
      (q) =>
        (bill.tokenId && (q.id === bill.tokenId || q.appointmentId === bill.tokenId)) ||
        (bill.appointmentId && (q.id === bill.appointmentId || q.appointmentId === bill.appointmentId)) ||
        (q.patientId === bill.patientId && q.fee === bill.amount && q.status === 'payment_pending')
    );

    if (linkedToken) {
      linkedToken.status = 'payment_pending';
      linkedToken.paymentStatus = 'pending_verification';
      linkedToken.heldUntil = holdUntil;
    }

    // 7. Notify Hospital Admin
    this.addNotification({
      recipientRole: 'admin',
      title: 'New Manual UPI Payment Pending Verification',
      message: `Patient ${bill.patientName} submitted UTR ${cleanUtr} for invoice #${bill.id} (₹${bill.amount}). Verification required in Payments Ledger.`,
      type: 'system',
      category: 'payment',
    });

    // 8. Notify Patient
    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: bill.patientId,
      title: 'UPI Payment Submitted for Verification',
      message: `Your UTR ${cleanUtr} for Invoice #${bill.id} (₹${bill.amount}) was submitted. Your OPD slot is held for 30 minutes while Hospital Admin reviews the transaction.`,
      type: 'system',
      category: 'payment',
    });

    // 9. Sync bill status with server
    if (typeof window !== 'undefined') {
      fetch('/api/bills/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bill.id,
          amount: bill.amount,
          patientId: bill.patientId,
          status: 'Pending Verification',
        }),
      }).catch(() => {});
    }

    this.persistAndBroadcast();
    return {
      success: true,
      bill,
      message: 'UTR submitted successfully. Your payment is pending administrative verification. Slot is held for 30 minutes.',
    };
  }

  // Hospital Admin Approves Manual UPI Payment
  public approveManualUpiPayment(billId: string, adminName: string = 'Hospital Billing Admin'): PaymentBill {
    const bill = this.state.bills.find((b) => b.id === billId);
    if (!bill) throw new Error(`Bill #${billId} not found`);

    bill.status = 'Paid';
    bill.verifiedBy = adminName;
    bill.verifiedAt = new Date().toISOString();
    bill.paidAt = new Date().toISOString();
    bill.heldUntil = undefined;
    bill.rejectionReason = undefined;

    // Confirm linked appointment token
    const linkedToken = this.state.queueTokens.find(
      (q) =>
        (bill.tokenId && (q.id === bill.tokenId || q.appointmentId === bill.tokenId)) ||
        (bill.appointmentId && (q.id === bill.appointmentId || q.appointmentId === bill.appointmentId)) ||
        (q.patientId === bill.patientId && q.fee === bill.amount)
    );

    if (linkedToken) {
      linkedToken.status = 'waiting';
      linkedToken.paymentStatus = 'paid';
      linkedToken.paymentId = bill.utr || bill.transactionRef;
      linkedToken.heldUntil = undefined;

      this.addNotification({
        recipientRole: 'doctor',
        recipientDoctorId: linkedToken.doctorId,
        title: 'New Paid Patient in Queue',
        message: `${linkedToken.patientName} consultation confirmed after UPI verification (₹${linkedToken.fee}). Token #${linkedToken.tokenNumber} is active.`,
        type: 'queue',
      });
    }

    // Notify Patient of Approval
    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: bill.patientId,
      title: 'Payment Approved & Appointment Confirmed',
      message: `Your UPI payment for Invoice #${bill.id} (UTR: ${bill.utr || bill.transactionRef}) has been verified and approved by ${adminName}. Receipt is available in your Billing Ledger.`,
      type: 'system',
      category: 'payment',
    });

    // Sync to server
    if (typeof window !== 'undefined') {
      fetch('/api/bills/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bill.id,
          amount: bill.amount,
          patientId: bill.patientId,
          status: 'Paid',
        }),
      }).catch(() => {});
    }

    this.persistAndBroadcast();
    return bill;
  }

  // Hospital Admin Rejects Manual UPI Payment with reason
  public rejectManualUpiPayment(billId: string, reason: string, adminName: string = 'Hospital Billing Admin'): PaymentBill {
    const bill = this.state.bills.find((b) => b.id === billId);
    if (!bill) throw new Error(`Bill #${billId} not found`);

    bill.status = 'Pending';
    bill.rejectionReason = reason || 'Transaction could not be verified in hospital bank statement';
    bill.verifiedBy = adminName;
    bill.verifiedAt = new Date().toISOString();
    bill.heldUntil = undefined;

    // Update linked appointment token
    const linkedToken = this.state.queueTokens.find(
      (q) =>
        (bill.tokenId && (q.id === bill.tokenId || q.appointmentId === bill.tokenId)) ||
        (bill.appointmentId && (q.id === bill.appointmentId || q.appointmentId === bill.appointmentId)) ||
        (q.patientId === bill.patientId && q.fee === bill.amount)
    );

    if (linkedToken) {
      linkedToken.paymentStatus = 'pending';
    }

    // Notify Patient of Rejection with reason
    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: bill.patientId,
      title: 'UPI Payment Verification Rejected',
      message: `Your UPI payment for #${bill.id} (UTR: ${bill.utr || 'N/A'}) was rejected by ${adminName}. Reason: ${bill.rejectionReason}. Please resubmit a valid 12-digit UTR or pay via Razorpay.`,
      type: 'system',
      category: 'payment',
    });

    // Sync to server
    if (typeof window !== 'undefined') {
      fetch('/api/bills/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bill.id,
          amount: bill.amount,
          patientId: bill.patientId,
          status: 'Pending',
        }),
      }).catch(() => {});
    }

    this.persistAndBroadcast();
    return bill;
  }

  public addBill(billData: Omit<PaymentBill, 'id'>): PaymentBill {
    const newBill: PaymentBill = {
      ...billData,
      id: `INV-2026-${String(this.state.bills.length + 1).padStart(3, '0')}`,
    };
    this.state.bills = [newBill, ...this.state.bills];

    // Sync new bill to server
    if (typeof window !== 'undefined') {
      fetch('/api/bills/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newBill.id,
          amount: newBill.amount,
          patientId: newBill.patientId,
          status: newBill.status,
        }),
      }).catch(() => {});
    }

    this.persistAndBroadcast();
    return newBill;
  }

  // --- Phase 5: Doctor Portal Methods ---
  public approveDoctor(doctorId: string) {
    const doc = this.state.doctors.find((d) => d.id === doctorId);
    if (doc) {
      doc.approvalStatus = 'approved';
      this.addNotification({
        recipientRole: 'doctor',
        recipientDoctorId: doctorId,
        title: 'Clinical Credentials Approved',
        message: `Welcome Dr. ${doc.name}! Your medical license and hospital credentials have been approved by Admin.`,
        type: 'system',
      });
      this.persistAndBroadcast();
    }
  }

  public addDoctorCalendarEvent(eventData: Omit<DoctorCalendarEvent, 'id'>): DoctorCalendarEvent {
    const newEvent: DoctorCalendarEvent = {
      ...eventData,
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.state.doctorCalendarEvents = [...this.state.doctorCalendarEvents, newEvent];
    this.persistAndBroadcast();
    return newEvent;
  }

  public updateDoctorCalendarEventDate(eventId: string, newDate: string) {
    const ev = this.state.doctorCalendarEvents.find((e) => e.id === eventId);
    if (ev) {
      ev.date = newDate;
      this.persistAndBroadcast();
    }
  }

  public addDoctorTodo(todoData: Omit<DoctorTodo, 'id' | 'createdAt'>): DoctorTodo {
    const newTodo: DoctorTodo = {
      ...todoData,
      id: `todo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    this.state.doctorTodos = [newTodo, ...this.state.doctorTodos];
    this.persistAndBroadcast();
    return newTodo;
  }

  public toggleDoctorTodo(todoId: string) {
    const todo = this.state.doctorTodos.find((t) => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      this.persistAndBroadcast();
    }
  }

  public deleteDoctorTodo(todoId: string) {
    this.state.doctorTodos = this.state.doctorTodos.filter((t) => t.id !== todoId);
    this.persistAndBroadcast();
  }

  // --- Phase 6: Pharmacy Actions ---
  public reorderPharmacyPatient(
    patientId: string,
    medicineName: string,
    quantity: number,
    daysToAdd: number = 30,
    pharmacySource: string = 'Tata 1mg'
  ): PaymentBill {
    const patient = this.state.patients.find((p) => p.id === patientId);
    const existingMed = patient?.currentMedicines.find(
      (m) => m.name.toLowerCase() === medicineName.toLowerCase()
    );

    if (existingMed) {
      existingMed.daysLeft = (existingMed.daysLeft || 0) + daysToAdd;
      existingMed.totalDays = Math.max(existingMed.totalDays || 30, existingMed.daysLeft);
    }

    const estimatedAmount = Math.max(150, quantity * 45);
    const newBill = this.addBill({
      patientId,
      patientName: patient?.name || 'Patient',
      date: new Date().toISOString().split('T')[0],
      hospitalName: 'MediTrack Online Partner Pharmacy',
      hospitalId: 'hosp-1',
      category: 'Medicine',
      description: `Pharmacy Reorder: ${medicineName} (${quantity} units via ${pharmacySource})`,
      amount: estimatedAmount,
      status: 'Pending',
    });

    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: patientId,
      title: 'Prescription Reorder Initiated',
      message: `${medicineName} reordered via ${pharmacySource}. Medicine bill of ₹${estimatedAmount} created. Days supply updated (+${daysToAdd} days).`,
      type: 'system',
      category: 'payment',
    });

    this.persistAndBroadcast();
    return newBill;
  }

  public createPharmacyPurchaseOrder(
    orderData: Omit<PharmacyPurchaseOrder, 'id' | 'requestedAt'>
  ): PharmacyPurchaseOrder {
    const newOrder: PharmacyPurchaseOrder = {
      ...orderData,
      id: `PO-2026-${String(this.state.pharmacyOrders.length + 104).padStart(3, '0')}`,
      requestedAt: new Date().toISOString(),
    };
    this.state.pharmacyOrders = [newOrder, ...this.state.pharmacyOrders];

    this.addNotification({
      recipientRole: 'hospital',
      title: 'Pharmacy Purchase Request Generated',
      message: `Purchase request ${newOrder.id} for ${newOrder.quantity} ${newOrder.unit} of ${newOrder.medicineName} submitted to ${newOrder.supplier}.`,
      type: 'system',
    });

    this.persistAndBroadcast();
    return newOrder;
  }

  // --- Phase 3: Emergency Assistance Slot Claiming & Real-Time Auto Cancellation ---
  public claimAssistanceSlot(
    caseId: string,
    slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance',
    claimer: {
      id: string;
      name: string;
      role: string;
      unitCode?: string;
      hospitalName?: string;
      hospitalId?: string;
      vehicleDetails?: string;
      sceneNotes?: string;
      landmarks?: string;
      roadBlocks?: string;
      victimCountEstimate?: number;
      location?: { lat: number; lng: number };
      accuracy?: number;
      distanceKm?: number;
      etaMinutes?: number;
    }
  ): { success: boolean; message: string; helper?: IncidentHelper } {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return { success: false, message: 'Incident not found' };

    emg.claimedSlots = emg.claimedSlots || {};
    const timestampStr = this.formatTimestamp();

    if (slotType === 'ambulance') {
      if (emg.claimedSlots.ambulance) {
        return { success: false, message: `Ambulance dispatch slot already claimed by ${emg.claimedSlots.ambulance.claimedBy}` };
      }
      const unitCode = claimer.unitCode || 'AMB-104';
      emg.claimedSlots.ambulance = {
        claimedBy: claimer.name,
        unitCode,
        timestamp: new Date().toISOString(),
      };
      if (!emg.assignedAmbulance) {
        const matchingAmb = this.state.ambulances.find((a) => a.unitCode === unitCode) || this.state.ambulances[0];
        if (matchingAmb) {
          matchingAmb.status = 'dispatched';
          emg.assignedAmbulance = {
            ...matchingAmb,
            unitCode,
            paramedicName: claimer.name,
            dispatchedAt: new Date().toISOString(),
            status: 'dispatched',
          };
          emg.status = 'Ambulance En Route';
        }
      }
    } else if (slotType === 'transport') {
      if (emg.claimedSlots.transport) {
        return { success: false, message: `Victim transport slot already claimed by ${emg.claimedSlots.transport.claimedBy}` };
      }
      emg.claimedSlots.transport = {
        claimedBy: claimer.name,
        helperId: claimer.id,
        timestamp: new Date().toISOString(),
        hospitalName: claimer.hospitalName,
      };
    } else if (slotType === 'help_scene') {
      emg.claimedSlots.scene = emg.claimedSlots.scene || [];
      if (emg.claimedSlots.scene.length >= 2) {
        return { success: false, message: 'Maximum 2 helpers already claimed Help at Scene' };
      }
      emg.claimedSlots.scene.push({
        claimedBy: claimer.name,
        helperId: claimer.id,
        timestamp: new Date().toISOString(),
      });
    } else if (slotType === 'guide_ambulance') {
      if (emg.claimedSlots.guide) {
        return { success: false, message: `Ambulance route guide slot already claimed by ${emg.claimedSlots.guide.claimedBy}` };
      }
      emg.claimedSlots.guide = {
        claimedBy: claimer.name,
        helperId: claimer.id,
        timestamp: new Date().toISOString(),
      };
    }

    // Call the corresponding helper registration
    const roleOptMap: Record<string, HelperRoleOption> = {
      help_scene: 'help_scene',
      transport: 'transport_victim',
      guide_ambulance: 'guide_ambulance',
    };

    let createdHelper: IncidentHelper | null = null;
    if (slotType !== 'ambulance') {
      createdHelper = this.helperAcceptOption(caseId, {
        id: claimer.id,
        name: claimer.name,
        roleOption: roleOptMap[slotType] || 'help_scene',
        location: claimer.location,
        accuracy: claimer.accuracy,
        hospitalId: claimer.hospitalId,
        hospitalName: claimer.hospitalName,
        vehicleDetails: claimer.vehicleDetails,
        sceneNotes: claimer.sceneNotes,
        landmarks: claimer.landmarks,
        roadBlocks: claimer.roadBlocks,
        victimCountEstimate: claimer.victimCountEstimate,
      });
    }

    // AUDIT LOG IN INCIDENT TIMELINE
    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: timestampStr,
      event: `Slot Claimed: ${slotType.replace('_', ' ').toUpperCase()}`,
      who: claimer.name,
      role: claimer.role === 'paramedic' ? 'paramedic' : claimer.role === 'dispatcher' ? 'dispatcher' : 'civilian_helper',
      details: `First accept wins rule applied. Claimed by ${claimer.name} (${claimer.role}). Other pending user alerts for this slot auto-cancelled.`,
    });

    // UPDATE NOTIFICATIONS FOR ALL OTHER USERS (First accept wins auto cancellation)
    this.state.notifications.forEach((n) => {
      if (n.caseId === caseId && n.slotType === slotType) {
        n.title = `Slot Taken: ${slotType.replace('_', ' ').toUpperCase()}`;
        n.message = `Assistance slot has been claimed by ${claimer.name} (${claimer.role}).`;
        n.isCancelled = true;
        n.claimedBy = claimer.name;
      }
    });

    this.persistAndBroadcast();
    return { success: true, message: 'Slot claimed successfully', helper: createdHelper || undefined };
  }

  // Cancel assistance slot and re-broadcast
  public cancelAssistanceSlot(
    caseId: string,
    slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance',
    claimerId: string,
    reason: string = 'Responder cancelled'
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    if (slotType === 'ambulance') {
      emg.claimedSlots = { ...emg.claimedSlots, ambulance: undefined };
      emg.assignedAmbulance = undefined;
    } else if (slotType === 'transport') {
      emg.claimedSlots = { ...emg.claimedSlots, transport: undefined };
    } else if (slotType === 'help_scene') {
      if (emg.claimedSlots?.scene) {
        emg.claimedSlots.scene = emg.claimedSlots.scene.filter((s) => s.helperId !== claimerId);
      }
    } else if (slotType === 'guide_ambulance') {
      emg.claimedSlots = { ...emg.claimedSlots, guide: undefined };
    }

    // Remove helper if exists
    if (emg.helpers) {
      emg.helpers = emg.helpers.filter((h) => h.id !== claimerId);
    }

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Assistance Slot Reopened (${slotType})`,
      who: 'System Engine',
      role: 'system',
      details: `${reason}. Re-broadcasting notification to nearby responders.`,
    });

    this.rebroadcastSlot(caseId, slotType, 'Automated Timeout / Cancel');
  }

  // Rebroadcast open or cancelled slot
  public rebroadcastSlot(
    caseId: string,
    slotType: 'ambulance' | 'transport' | 'help_scene' | 'guide_ambulance',
    initiatedBy: string = 'Dispatcher'
  ) {
    const emg = this.state.emergencies.find((e) => e.id === caseId);
    if (!emg) return;

    const slotLabelMap: Record<string, string> = {
      ambulance: 'Ambulance Dispatch Slot',
      transport: 'Victim Transport Slot',
      help_scene: 'Help at Scene Slot (First Aid)',
      guide_ambulance: 'Ambulance Route Guide Slot',
    };

    emg.timeline = emg.timeline || [];
    emg.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: this.formatTimestamp(),
      event: `Assistance Request Re-broadcasted: ${slotLabelMap[slotType] || slotType}`,
      who: initiatedBy,
      role: 'dispatcher',
      details: `Re-broadcasting to registered nearby users within 3 km. First accept wins.`,
    });

    this.addNotification({
      recipientRole: slotType === 'ambulance' ? 'responder' : 'all',
      title: `🚨 Re-broadcast: ${slotLabelMap[slotType] || 'Assistance Needed'}`,
      message: `Open slot for ${emg.emergencyType} at ${emg.address}. First accept claims response slot.`,
      type: 'emergency',
      category: 'emergency',
      caseId,
      slotType,
    });

    this.persistAndBroadcast();
  }

  // 3-Minute arrival check
  public checkSlotTimeouts() {
    const now = Date.now();
    const THREE_MINS_MS = 3 * 60 * 1000;

    this.state.emergencies.forEach((emg) => {
      if (emg.status === 'Closed' || emg.status === 'Hospital Handover') return;

      emg.helpers?.forEach((h) => {
        if (h.status === 'accepted' || h.status === 'transporting') {
          const acceptedTime = new Date(h.acceptedAt).getTime();
          if (now - acceptedTime > THREE_MINS_MS && !h.arrivedAt) {
            // Reopen slot due to 3-minute timeout!
            const slot = h.roleOption === 'transport_victim' ? 'transport' : h.roleOption === 'help_scene' ? 'help_scene' : 'guide_ambulance';
            this.cancelAssistanceSlot(emg.id, slot, h.id, `Helper ${h.name} did not mark arrived within 3 minutes`);
          }
        }
      });
    });
  }

  // --- Ambulance Fleet & Operations Helpers ---
  public updateAmbulanceStatus(
    ambulanceId: string,
    status: AmbulanceUnit['status'],
    lat?: number,
    lng?: number,
    etaMinutes?: number,
    distanceKm?: number
  ) {
    const amb = this.state.ambulances.find((a) => a.id === ambulanceId);
    if (!amb) return;

    amb.status = status;
    if (lat !== undefined) amb.lat = lat;
    if (lng !== undefined) amb.lng = lng;
    if (etaMinutes !== undefined) amb.etaMinutes = etaMinutes;
    if (distanceKm !== undefined) amb.distanceKm = distanceKm;

    // Also update any emergency that has this ambulance assigned
    const emg = this.state.emergencies.find((e) => e.assignedAmbulance?.id === ambulanceId);
    if (emg && emg.assignedAmbulance) {
      emg.assignedAmbulance.status = status;
      if (lat !== undefined) emg.assignedAmbulance.lat = lat;
      if (lng !== undefined) emg.assignedAmbulance.lng = lng;
      if (etaMinutes !== undefined) {
        emg.assignedAmbulance.etaMinutes = etaMinutes;
        emg.etaMinutes = etaMinutes;
      }
      if (distanceKm !== undefined) emg.assignedAmbulance.distanceKm = distanceKm;

      if (status === 'at_scene' && emg.status !== 'Assessment and Transport') {
        emg.status = 'Assessment and Transport';
      }
    }

    this.persistAndBroadcast();
  }

  // Simulate ambulance movement along a vector towards target coordinates
  public stepAmbulanceMovement(ambulanceId: string, targetLat: number, targetLng: number, speedFactor: number = 0.15) {
    const amb = this.state.ambulances.find((a) => a.id === ambulanceId);
    if (!amb) return;

    const deltaLat = (targetLat - amb.lat) * speedFactor;
    const deltaLng = (targetLng - amb.lng) * speedFactor;

    amb.lat += deltaLat;
    amb.lng += deltaLng;

    const distMeters = getDistanceInMeters(amb.lat, amb.lng, targetLat, targetLng);
    amb.distanceKm = Number((distMeters / 1000).toFixed(2));
    amb.etaMinutes = Math.max(1, Math.round(amb.distanceKm * 2.5));

    // Also sync assigned emergency if any
    const emg = this.state.emergencies.find((e) => e.assignedAmbulance?.id === ambulanceId);
    if (emg && emg.assignedAmbulance) {
      emg.assignedAmbulance.lat = amb.lat;
      emg.assignedAmbulance.lng = amb.lng;
      emg.assignedAmbulance.distanceKm = amb.distanceKm;
      emg.assignedAmbulance.etaMinutes = amb.etaMinutes;
      emg.etaMinutes = amb.etaMinutes;
    }

    this.persistAndBroadcast();
  }

  // Book an ambulance directly for a patient with pickup, destination, and auto-dispatch
  public bookAmbulance(params: {
    callerName: string;
    callerPhone: string;
    pickupAddress: string;
    lat: number;
    lng: number;
    emergencyType: EmergencyCase['emergencyType'];
    severity?: EmergencyCase['severity'];
    destinationHospitalId?: string;
    description?: string;
    preferredAmbulanceId?: string;
  }): { caseItem: EmergencyCase; assignedAmbulance: AmbulanceUnit } {
    const defaultHosp = this.state.hospitals[0];
    const targetHospId = params.destinationHospitalId || defaultHosp.id;
    const targetHosp = this.state.hospitals.find((h) => h.id === targetHospId) || defaultHosp;

    // Trigger SOS to get case
    const sosRes = this.triggerOneTapSOS({
      lat: params.lat,
      lng: params.lng,
      address: params.pickupAddress,
      callerName: params.callerName,
      callerPhone: params.callerPhone,
      emergencyType: params.emergencyType,
    });

    const emg = sosRes.caseItem;
    emg.destinationHospitalId = targetHosp.id;
    emg.destinationHospitalName = targetHosp.name;
    emg.severity = params.severity || 'critical';
    if (params.description) emg.description = params.description;

    // Find nearest available ambulance or pick preferred
    let chosenAmb = params.preferredAmbulanceId
      ? this.state.ambulances.find((a) => a.id === params.preferredAmbulanceId)
      : null;

    if (!chosenAmb) {
      const avail = this.state.ambulances.filter((a) => a.status === 'available');
      if (avail.length > 0) {
        // pick nearest
        avail.sort((a, b) => {
          const distA = getDistanceInMeters(a.lat, a.lng, params.lat, params.lng);
          const distB = getDistanceInMeters(b.lat, b.lng, params.lat, params.lng);
          return distA - distB;
        });
        chosenAmb = avail[0];
      } else {
        chosenAmb = this.state.ambulances[0];
      }
    }

    this.dispatchAmbulance(emg.id, chosenAmb.id);

    this.addNotification({
      recipientRole: 'all',
      title: `🚑 Ambulance Booked: ${chosenAmb.unitCode}`,
      message: `Unit ${chosenAmb.unitCode} dispatched for ${params.callerName} at ${params.pickupAddress}. En route to ${targetHosp.name}.`,
      type: 'emergency',
    });

    this.persistAndBroadcast();
    return { caseItem: emg, assignedAmbulance: chosenAmb };
  }

  // Direct bed allocation helper for AI Assistant & Bed manager
  public allocateBedDirect(params: {
    bedId?: string;
    patientId?: string;
    patientName?: string;
    status?: WardBedData['status'];
    hospitalId?: string;
    bedType?: 'general' | 'icu' | 'emergency';
  }): boolean {
    if (params.bedId) {
      const bed = this.state.wardBeds.find((b) => b.id === params.bedId);
      if (bed) {
        bed.status = params.status || 'occupied';
        if (params.patientId) bed.patientId = params.patientId;
        if (params.patientName) bed.patientName = params.patientName;
        this.persistAndBroadcast();
        return true;
      }
    }

    // Allocate first available bed in wardBeds matching type
    const availableBed = this.state.wardBeds.find(
      (b) => b.status === 'available' && (!params.bedType || b.type.toLowerCase().includes(params.bedType.toLowerCase()))
    );

    if (availableBed) {
      availableBed.status = params.status || 'occupied';
      if (params.patientId) availableBed.patientId = params.patientId;
      if (params.patientName) availableBed.patientName = params.patientName;
      this.persistAndBroadcast();
      return true;
    }

    // Otherwise increment occupied count in hospital
    const hosp = params.hospitalId
      ? this.state.hospitals.find((h) => h.id === params.hospitalId)
      : this.state.hospitals[0];

    if (hosp) {
      const key = (params.bedType || 'emergency') === 'icu' ? 'icuOccupied' : (params.bedType || 'emergency') === 'general' ? 'generalOccupied' : 'emergencyOccupied';
      hosp.beds[key] = Math.min(hosp.beds[key] + 1, 999);
      this.persistAndBroadcast();
      return true;
    }

    return false;
  }

  // Direct Lab order helper
  public orderLabTestDirect(params: {
    patientId: string;
    patientName?: string;
    testName: string;
    category?: string;
    doctorName?: string;
    hospitalId?: string;
  }): LabOrder {
    const patient = this.state.patients.find((p) => p.id === params.patientId) || this.state.patients[0];
    const newOrder: LabOrder = {
      id: `lab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: patient.id,
      patientName: params.patientName || patient.name,
      uniquePatientId: patient.uniquePatientId,
      doctorName: params.doctorName || 'Dr. Aris Vance, MD',
      hospitalId: params.hospitalId || 'hosp-1',
      testName: params.testName,
      category: params.category || 'Diagnostic Test',
      orderedAt: new Date().toISOString(),
      status: 'ordered',
    };

    this.state.labOrders = [newOrder, ...this.state.labOrders];
    this.addNotification({
      recipientRole: 'patient',
      recipientPatientId: patient.id,
      title: `Lab Test Ordered: ${params.testName}`,
      message: `Diagnostic request submitted by ${newOrder.doctorName}. Sample collection scheduled.`,
      type: 'system',
    });

    this.persistAndBroadcast();
    return newOrder;
  }

  public resetToDefaultSeed() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.state = this.loadInitialState();
    this.notify();
  }
}

export const appStore = new ReactiveStore();

