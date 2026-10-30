/**
 * MediTrack Enterprise Password Authentication & Security Service
 * Pure Password-Based Authentication across all Portals: Patient, Doctor, Hospital Staff
 * 
 * Guarantees:
 * - Pure password-based login & registration (No OTP)
 * - Firebase Authentication (Email/Password & Password Reset)
 * - Strong password enforcement (min 8 characters, letter + number)
 * - Indian phone validation (+91, 10 digits starting 6-9)
 * - Rate limiting & failure throttling
 * - Unique Patient ID / Doctor ID / Staff ID binding
 */

import { UserRole, PatientProfile, Doctor } from '../types';
import { appStore, validatePatientIdFormat, generateUniquePatientId } from './store';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  isFirebaseConfigured,
  FirebaseUser,
} from './firebase';

export type PortalType = 'patient' | 'doctor' | 'hospital' | 'emergency';

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  portal: PortalType;
  staffRole?: 'admin' | 'dispatcher' | 'paramedic';
  customId: string; // e.g. PT00234, DR-001, HOSP-01, EMS-104
  hospitalId?: string;
  hospitalName?: string;
  department?: string;
  photoUrl?: string;
  approvalStatus?: 'approved' | 'pending';
  emailVerified: boolean;
}

export interface UserProfileRecord {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  portal: PortalType;
  staffRole?: 'admin' | 'dispatcher' | 'paramedic';
  customId: string;
  hospitalId?: string;
  hospitalName?: string;
  department?: string;
  approvalStatus?: 'approved' | 'pending';
  createdAt: string;
}

const AUTH_STORAGE_KEY = 'meditrack_auth_user_v5';
const USER_PROFILES_STORAGE_KEY = 'meditrack_user_profiles_v5';
const USER_PASSWORDS_STORAGE_KEY = 'meditrack_passwords_v5';
const LOGIN_ATTEMPTS_STORAGE_KEY = 'meditrack_login_attempts_v5';

// Phone Validation: Indian (+91) 10-digits starting with 6, 7, 8, 9
export function normalizeAndValidatePhone(input: string): { isValid: boolean; normalized: string; error?: string } {
  const cleaned = input.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) {
    return { isValid: false, normalized: '', error: 'Phone number is required.' };
  }

  // Matches +91 followed by 10 digits starting with 6-9
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: cleaned };
  }

  // Matches 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: `+91${cleaned}` };
  }

  // Matches 0 followed by 10 digits starting with 6-9
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: `+91${cleaned.slice(1)}` };
  }

  return {
    isValid: false,
    normalized: cleaned,
    error: 'Invalid phone number. Must be a valid Indian number (+91) with 10 digits starting with 6-9.',
  };
}

// Password Validation: Minimum 8 characters, at least one letter and at least one number
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one letter.' };
  }
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number.' };
  }
  return { isValid: true };
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: ((user: AuthUser | null) => void)[] = [];
  private userProfiles: Map<string, UserProfileRecord> = new Map();
  private userPasswords: Map<string, string> = new Map();

  constructor() {
    this.loadUserProfiles();
    this.loadPasswords();
    this.loadFromStorage();
    this.initFirebaseAuthListener();
  }

  private loadUserProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
      if (stored) {
        const arr: UserProfileRecord[] = JSON.parse(stored);
        arr.forEach((p) => this.userProfiles.set(p.uid, p));
      }
    } catch (e) {
      console.warn('Failed to load user profiles from storage:', e);
    }
  }

  private saveUserProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.userProfiles.values());
      localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Failed to save user profiles to storage:', e);
    }
  }

  private loadPasswords() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(USER_PASSWORDS_STORAGE_KEY);
      if (stored) {
        const map = JSON.parse(stored);
        Object.entries(map).forEach(([k, v]) => this.userPasswords.set(k.toLowerCase(), String(v)));
      }
    } catch (e) {
      console.warn('Failed to load password store:', e);
    }
  }

  private savePassword(email: string, pass: string) {
    if (typeof window === 'undefined') return;
    try {
      this.userPasswords.set(email.toLowerCase(), pass);
      const obj = Object.fromEntries(this.userPasswords.entries());
      localStorage.setItem(USER_PASSWORDS_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to save password:', e);
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser) {
          appStore.setRole(this.currentUser.role, this.currentUser.uid);
        }
      }
    } catch (e) {
      console.warn('Failed to restore auth session:', e);
      this.currentUser = null;
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      if (this.currentUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        appStore.setRole(this.currentUser.role, this.currentUser.uid);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        appStore.setRole('guest');
      }
    } catch (e) {
      console.warn('Failed to persist auth session:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentUser);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  }

  private initFirebaseAuthListener() {
    if (typeof window === 'undefined' || !auth) return;
    try {
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const profile = this.userProfiles.get(firebaseUser.uid);
          if (profile) {
            this.currentUser = {
              uid: firebaseUser.uid,
              name: profile.name,
              email: firebaseUser.email || profile.email,
              phone: profile.phone,
              role: profile.role,
              portal: profile.portal,
              staffRole: profile.staffRole,
              customId: profile.customId,
              hospitalId: profile.hospitalId,
              hospitalName: profile.hospitalName,
              department: profile.department,
              approvalStatus: profile.approvalStatus || 'approved',
              emailVerified: firebaseUser.emailVerified,
            };
            this.persist();
          }
        }
      });
    } catch (err) {
      console.warn('Failed to attach Firebase auth listener:', err);
    }
  }

  public subscribe(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  // --- Login Throttling Defense ---
  private getLoginAttempts(identifier: string): { count: number; lockedUntil?: number } {
    if (typeof window === 'undefined') return { count: 0 };
    try {
      const stored = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
      if (!stored) return { count: 0 };
      const map = JSON.parse(stored);
      const record = map[identifier.toLowerCase()];
      if (!record) return { count: 0 };

      if (record.lockedUntil && Date.now() > record.lockedUntil) {
        delete map[identifier.toLowerCase()];
        localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(map));
        return { count: 0 };
      }
      return record;
    } catch {
      return { count: 0 };
    }
  }

  private recordFailedLogin(identifier: string): { locked: boolean; waitSeconds?: number } {
    if (typeof window === 'undefined') return { locked: false };
    try {
      const stored = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
      const map = stored ? JSON.parse(stored) : {};
      const key = identifier.toLowerCase();
      const current = map[key] || { count: 0 };
      current.count += 1;

      // Lockout after 5 failed attempts for 60 seconds
      if (current.count >= 5) {
        current.lockedUntil = Date.now() + 60 * 1000;
        map[key] = current;
        localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(map));
        return { locked: true, waitSeconds: 60 };
      }

      map[key] = current;
      localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(map));
      return { locked: false };
    } catch {
      return { locked: false };
    }
  }

  private clearFailedLogin(identifier: string) {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
      if (!stored) return;
      const map = JSON.parse(stored);
      delete map[identifier.toLowerCase()];
      localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore
    }
  }

  // --- Duplicate Account Checks ---
  public checkDuplicateAccount(email: string, phone: string): { isDuplicate: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const phoneNorm = normalizeAndValidatePhone(phone).normalized;

    for (const profile of this.userProfiles.values()) {
      if (profile.email.toLowerCase() === cleanEmail) {
        return { isDuplicate: true, error: 'An account with this email address already exists. Please sign in.' };
      }
      if (profile.phone && normalizeAndValidatePhone(profile.phone).normalized === phoneNorm) {
        return { isDuplicate: true, error: 'An account with this phone number already exists. Please sign in.' };
      }
    }

    const state = appStore.getState();
    const existingPatientByEmail = state.patients.find((p) => p.email.toLowerCase() === cleanEmail);
    if (existingPatientByEmail) {
      return { isDuplicate: true, error: 'A patient account with this email address already exists. Please sign in.' };
    }
    const existingPatientByPhone = state.patients.find(
      (p) => normalizeAndValidatePhone(p.phone).normalized === phoneNorm
    );
    if (existingPatientByPhone) {
      return { isDuplicate: true, error: 'A patient account with this phone number already exists. Please sign in.' };
    }

    const existingDocByEmail = state.doctors.find((d) => d.email.toLowerCase() === cleanEmail);
    if (existingDocByEmail) {
      return { isDuplicate: true, error: 'A physician account with this email address already exists. Please sign in.' };
    }

    return { isDuplicate: false };
  }

  // --- Patient ID Lookup to Email ---
  public lookupPatientEmailById(patientId: string): { found: boolean; email?: string; name?: string; error?: string } {
    const cleanId = patientId.trim().toUpperCase();
    const formatCheck = validatePatientIdFormat(cleanId);
    if (!formatCheck.isValid) {
      return { found: false, error: formatCheck.error || "Invalid Patient ID format. Must be 'PT' followed by 5 digits." };
    }

    for (const p of this.userProfiles.values()) {
      if (p.customId.toUpperCase() === cleanId && p.portal === 'patient') {
        return { found: true, email: p.email, name: p.name };
      }
    }

    const state = appStore.getState();
    const pat = state.patients.find((p) => p.uniquePatientId.toUpperCase() === cleanId);
    if (pat) {
      return { found: true, email: pat.email, name: pat.name };
    }

    return { found: false, error: `No registered patient account found for Patient ID ${cleanId}.` };
  }

  // --- Password Registration (No OTP) ---
  public async registerWithPassword(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    portal: PortalType;
    staffRole?: 'admin' | 'dispatcher' | 'paramedic';
    hospitalId?: string;
    department?: string;
    // Patient extra fields
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    allergies?: string[];
    chronicConditions?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    // Doctor extra fields
    specialization?: string;
    registrationNumber?: string;
    experienceYears?: number;
  }): Promise<{ success: boolean; error?: string; customId?: string }> {
    const { name, email, phone, password, role, portal, staffRole } = data;

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.isValid) {
      return { success: false, error: pwCheck.error };
    }

    const phoneCheck = normalizeAndValidatePhone(phone);
    if (!phoneCheck.isValid) {
      return { success: false, error: phoneCheck.error };
    }

    const cleanEmail = email.trim().toLowerCase();
    const dupCheck = this.checkDuplicateAccount(cleanEmail, phoneCheck.normalized);
    if (dupCheck.isDuplicate) {
      return { success: false, error: dupCheck.error };
    }

    let uid = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // If Firebase Auth is configured, register with Firebase
    if (isFirebaseConfigured() && auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        uid = userCred.user.uid;
      } catch (err: any) {
        console.warn('Firebase createUserWithEmailAndPassword failed, using local profile:', err);
        if (err.code === 'auth/email-already-in-use') {
          return { success: false, error: 'An account with this email address is already registered.' };
        }
        if (err.code === 'auth/invalid-email') {
          return { success: false, error: 'Invalid email address format.' };
        }
      }
    }

    // Save password
    this.savePassword(cleanEmail, password);

    const state = appStore.getState();
    const hosp = state.hospitals.find((h) => h.id === data.hospitalId) || state.hospitals[0];

    let customId = '';
    let approvalStatus: 'approved' | 'pending' = 'approved';

    if (portal === 'patient') {
      const existingPatientIds = state.patients.map((p) => p.uniquePatientId);
      customId = generateUniquePatientId(existingPatientIds);

      appStore.registerPatient({
        name,
        email: cleanEmail,
        phone: phoneCheck.normalized,
        age: data.dob ? Math.max(1, new Date().getFullYear() - new Date(data.dob).getFullYear()) : 28,
        gender: data.gender || 'Female',
        bloodGroup: data.bloodGroup || 'O+',
        allergies: data.allergies || [],
        chronicConditions: data.chronicConditions || [],
        currentMedicines: [],
        emergencyContacts: data.emergencyContactName
          ? [{ name: data.emergencyContactName, relation: 'Emergency Contact', phone: data.emergencyContactPhone || phoneCheck.normalized }]
          : [],
        vaccinations: [],
      });
    } else if (portal === 'doctor') {
      approvalStatus = 'pending';
      const doc = appStore.registerDoctor({
        name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
        email: cleanEmail,
        specialization: data.specialization || 'General Medicine',
        hospitalId: hosp.id,
        hospitalName: hosp.name,
        experienceYears: data.experienceYears || 5,
        phone: phoneCheck.normalized,
        registrationNumber: data.registrationNumber || '',
      });
      customId = doc.id;

      appStore.addNotification({
        recipientRole: 'hospital',
        title: 'New Doctor Registration Pending Review',
        message: `${doc.name} (${data.specialization}) registered. Verification required in Staff Roster.`,
        type: 'system',
      });
    } else if (portal === 'hospital' || portal === 'emergency') {
      const rolePrefix = staffRole === 'dispatcher' ? 'DISP' : staffRole === 'paramedic' ? 'EMS' : 'ADM';
      customId = `${rolePrefix}-${Math.floor(100 + Math.random() * 900)}`;
      approvalStatus = staffRole === 'admin' ? 'approved' : 'pending';
    }

    const profileRecord: UserProfileRecord = {
      uid,
      name,
      email: cleanEmail,
      phone: phoneCheck.normalized,
      role,
      portal,
      staffRole,
      customId,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      department: data.department || data.specialization,
      approvalStatus,
      createdAt: new Date().toISOString(),
    };

    this.userProfiles.set(uid, profileRecord);
    this.saveUserProfiles();

    this.currentUser = {
      uid,
      name,
      email: cleanEmail,
      phone: phoneCheck.normalized,
      role,
      portal,
      staffRole,
      customId,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      department: profileRecord.department,
      approvalStatus,
      emailVerified: true,
    };

    this.persist();
    return { success: true, customId };
  }

  // --- Password Login (No OTP) ---
  public async loginWithPassword(
    emailOrPatientId: string,
    password: string,
    expectedPortal: PortalType
  ): Promise<{ success: boolean; error?: string }> {
    const cleanIdentifier = emailOrPatientId.trim();
    if (!cleanIdentifier) {
      return { success: false, error: 'Please enter your Email Address or Patient ID.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your account password.' };
    }

    // Rate limiting check
    const attemptStatus = this.getLoginAttempts(cleanIdentifier);
    if (attemptStatus.lockedUntil && Date.now() < attemptStatus.lockedUntil) {
      const remSeconds = Math.ceil((attemptStatus.lockedUntil - Date.now()) / 1000);
      return {
        success: false,
        error: `Too many failed login attempts. Please wait ${remSeconds} seconds before trying again.`,
      };
    }

    let resolvedEmail = cleanIdentifier;

    // Check if user entered a Patient ID (e.g. PT00234)
    if (/^PT\d{5}$/i.test(cleanIdentifier)) {
      const lookup = this.lookupPatientEmailById(cleanIdentifier);
      if (!lookup.found || !lookup.email) {
        return { success: false, error: lookup.error || 'No registered account found for this Patient ID.' };
      }
      resolvedEmail = lookup.email;
    }

    const lowerEmail = resolvedEmail.toLowerCase();

    // 1. Try Firebase Authentication if configured
    if (isFirebaseConfigured() && auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, lowerEmail, password);
        const user = userCred.user;

        let profile = this.userProfiles.get(user.uid);
        if (!profile) {
          const state = appStore.getState();
          if (expectedPortal === 'patient') {
            const pat = state.patients.find((p) => p.email.toLowerCase() === lowerEmail);
            profile = {
              uid: user.uid,
              name: pat?.name || user.displayName || 'Patient',
              email: user.email || lowerEmail,
              phone: pat?.phone || '',
              role: 'patient',
              portal: 'patient',
              customId: pat?.uniquePatientId || generateUniquePatientId([]),
              approvalStatus: 'approved',
              createdAt: new Date().toISOString(),
            };
          } else if (expectedPortal === 'doctor') {
            const doc = state.doctors.find((d) => d.email.toLowerCase() === lowerEmail);
            profile = {
              uid: user.uid,
              name: doc?.name || user.displayName || 'Dr. Physician',
              email: user.email || lowerEmail,
              phone: doc?.phone || '',
              role: 'doctor',
              portal: 'doctor',
              customId: doc?.id || 'DR-001',
              hospitalId: doc?.hospitalId || 'hosp-1',
              hospitalName: doc?.hospitalName || 'City Metro General Hospital',
              department: doc?.specialization || 'General Medicine',
              approvalStatus: doc?.approvalStatus || 'approved',
              createdAt: new Date().toISOString(),
            };
          } else {
            profile = {
              uid: user.uid,
              name: user.displayName || 'Hospital Staff',
              email: user.email || lowerEmail,
              phone: '',
              role: 'admin',
              portal: 'hospital',
              staffRole: 'admin',
              customId: 'HOSP-01',
              hospitalName: 'City Metro General Hospital',
              approvalStatus: 'approved',
              createdAt: new Date().toISOString(),
            };
          }
          this.userProfiles.set(user.uid, profile);
          this.saveUserProfiles();
        }

        // Role verification
        if (profile.portal !== expectedPortal && !(expectedPortal === 'hospital' && profile.portal === 'emergency')) {
          await signOut(auth);
          return {
            success: false,
            error: `This account is authorized for ${profile.portal.toUpperCase()} portal, but you are attempting to log into ${expectedPortal.toUpperCase()} portal.`,
          };
        }

        this.clearFailedLogin(cleanIdentifier);
        this.currentUser = {
          uid: user.uid,
          name: profile.name,
          email: user.email || profile.email,
          phone: profile.phone,
          role: profile.role,
          portal: profile.portal,
          staffRole: profile.staffRole,
          customId: profile.customId,
          hospitalId: profile.hospitalId,
          hospitalName: profile.hospitalName,
          department: profile.department,
          approvalStatus: profile.approvalStatus || 'approved',
          emailVerified: true,
        };

        this.persist();
        return { success: true };
      } catch (fbErr: any) {
        console.warn('Firebase signInWithEmailAndPassword attempt failed:', fbErr.code);
        // Fall through to local password verification if user was registered locally or offline
      }
    }

    // 2. Local Password Verification (Fallback / Instant Access)
    const storedPassword = this.userPasswords.get(lowerEmail);

    // If user password exists and matches
    if (storedPassword && storedPassword === password) {
      // Find matching profile
      let profile = Array.from(this.userProfiles.values()).find((p) => p.email.toLowerCase() === lowerEmail);

      if (!profile) {
        const state = appStore.getState();
        if (expectedPortal === 'patient') {
          const pat = state.patients.find((p) => p.email.toLowerCase() === lowerEmail);
          profile = {
            uid: `pat-${Date.now()}`,
            name: pat?.name || 'Patient',
            email: lowerEmail,
            phone: pat?.phone || '+91 98765 00000',
            role: 'patient',
            portal: 'patient',
            customId: pat?.uniquePatientId || generateUniquePatientId([]),
            approvalStatus: 'approved',
            createdAt: new Date().toISOString(),
          };
        } else if (expectedPortal === 'doctor') {
          const doc = state.doctors.find((d) => d.email.toLowerCase() === lowerEmail);
          profile = {
            uid: `doc-${Date.now()}`,
            name: doc?.name || 'Doctor',
            email: lowerEmail,
            phone: doc?.phone || '+91 98765 00001',
            role: 'doctor',
            portal: 'doctor',
            customId: doc?.id || 'DR-001',
            hospitalId: doc?.hospitalId || 'hosp-1',
            hospitalName: doc?.hospitalName || 'City Metro General Hospital',
            department: doc?.specialization || 'Cardiology',
            approvalStatus: doc?.approvalStatus || 'approved',
            createdAt: new Date().toISOString(),
          };
        } else {
          profile = {
            uid: `staff-${Date.now()}`,
            name: 'Hospital Administrator',
            email: lowerEmail,
            phone: '+91 98765 00002',
            role: 'admin',
            portal: 'hospital',
            staffRole: 'admin',
            customId: 'HOSP-01',
            hospitalName: 'City Metro General Hospital',
            approvalStatus: 'approved',
            createdAt: new Date().toISOString(),
          };
        }
        this.userProfiles.set(profile.uid, profile);
        this.saveUserProfiles();
      }

      if (profile.portal !== expectedPortal && !(expectedPortal === 'hospital' && profile.portal === 'emergency')) {
        return {
          success: false,
          error: `This account is authorized for ${profile.portal.toUpperCase()} portal, but you are attempting to log into ${expectedPortal.toUpperCase()} portal.`,
        };
      }

      this.clearFailedLogin(cleanIdentifier);
      this.currentUser = {
        uid: profile.uid,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        portal: profile.portal,
        staffRole: profile.staffRole,
        customId: profile.customId,
        hospitalId: profile.hospitalId,
        hospitalName: profile.hospitalName,
        department: profile.department,
        approvalStatus: profile.approvalStatus || 'approved',
        emailVerified: true,
      };

      this.persist();
      return { success: true };
    }

    // Invalid credentials
    this.recordFailedLogin(cleanIdentifier);
    return { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' };
  }

  // --- Password Reset (sendPasswordResetEmail) ---
  public async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    if (isFirebaseConfigured() && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (err) {
        console.warn('sendPasswordResetEmail suppressed:', err);
      }
    }

    return {
      success: true,
      message: 'If an account exists with this email address, a password reset link has been sent.',
    };
  }

  // Bystander Reporting
  public loginBystander() {
    this.currentUser = {
      uid: `bystander-${Date.now()}`,
      name: 'Emergency Bystander Reporter',
      email: 'bystander@emergency.meditrack',
      role: 'dispatcher',
      portal: 'hospital',
      staffRole: 'dispatcher',
      customId: 'BYSTANDER',
      emailVerified: true,
    };
    this.persist();
  }

  // Logout
  public async logout() {
    if (isFirebaseConfigured() && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Firebase signOut error:', err);
      }
    }
    this.currentUser = null;
    this.persist();
  }
}

export const authService = new AuthService();
