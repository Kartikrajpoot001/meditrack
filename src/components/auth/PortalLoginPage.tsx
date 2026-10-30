import React, { useState } from 'react';
import {
  ArrowLeft,
  FolderHeart,
  Stethoscope,
  Building2,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import {
  authService,
  PortalType,
  normalizeAndValidatePhone,
  validatePasswordStrength,
} from '../../services/auth';
export type { PortalType };

interface PortalLoginPageProps {
  portal: PortalType;
  onBackToGateway: () => void;
  onLoginSuccess: (portal: PortalType) => void;
  onBystanderReport: () => void;
}

export const PortalLoginPage: React.FC<PortalLoginPageProps> = ({
  portal,
  onBackToGateway,
  onLoginSuccess,
  onBystanderReport,
}) => {
  // Navigation Modes: 'login' | 'register' | 'forgot_password'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');

  // Hospital Staff Role Choice
  const [staffRole, setStaffRole] = useState<'admin' | 'dispatcher' | 'paramedic'>('admin');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // --- LOGIN FORM STATES ---
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Patient ID (PT00234)
  const [loginPassword, setLoginPassword] = useState('');

  // --- FORGOT PASSWORD STATES ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState<string | null>(null);

  // --- REGISTRATION FORM STATES ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Patient Fields
  const [regPatientDob, setRegPatientDob] = useState('1998-05-20');
  const [regPatientGender, setRegPatientGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [regPatientBloodGroup, setRegPatientBloodGroup] = useState<
    'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
  >('O+');
  const [regPatientAllergies, setRegPatientAllergies] = useState('');
  const [regPatientChronic, setRegPatientChronic] = useState('');
  const [regPatientContactName, setRegPatientContactName] = useState('');
  const [regPatientContactPhone, setRegPatientContactPhone] = useState('');

  // Doctor Fields
  const [regDocSpec, setRegDocSpec] = useState('Cardiology');
  const [regDocRegNum, setRegDocRegNum] = useState('');
  const [regDocHospitalId, setRegDocHospitalId] = useState('hosp-1');
  const [regDocExp, setRegDocExp] = useState(5);

  // Staff Fields
  const [regStaffHospitalId, setRegStaffHospitalId] = useState('hosp-1');

  // Registration Completed Modal State
  const [registeredCustomId, setRegisteredCustomId] = useState<string | null>(null);

  // Portal metadata styling
  const meta = {
    patient: {
      title: 'Patient Portal',
      subtitle: 'Sign in with your Email Address or Unique Patient ID and Password',
      icon: FolderHeart,
      badge: 'Secure Patient Access',
      themeBorder: 'border-teal-500',
      themeBg: 'bg-teal-50',
      themeText: 'text-teal-700',
    },
    doctor: {
      title: 'Doctor Clinical Station',
      subtitle: 'Sign in with your registered physician credentials',
      icon: Stethoscope,
      badge: 'NABH Clinical Verification',
      themeBorder: 'border-blue-500',
      themeBg: 'bg-blue-50',
      themeText: 'text-blue-700',
    },
    hospital: {
      title: 'Hospital Staff Operations',
      subtitle: 'Facility Administration, Emergency Dispatch & Field Paramedic Console',
      icon: Building2,
      badge: 'Hospital Staff Security',
      themeBorder: 'border-emerald-500',
      themeBg: 'bg-emerald-50',
      themeText: 'text-emerald-700',
    },
    emergency: {
      title: 'Hospital Staff Operations',
      subtitle: 'Central Dispatch Command & Field Telemetry',
      icon: Building2,
      badge: 'Emergency Response Hub',
      themeBorder: 'border-rose-500',
      themeBg: 'bg-rose-50',
      themeText: 'text-rose-700',
    },
  }[portal] || {
    title: 'Hospital Staff Operations',
    subtitle: 'Sign in to access operational modules',
    icon: Building2,
    badge: 'Verified Access',
    themeBorder: 'border-teal-500',
    themeBg: 'bg-teal-50',
    themeText: 'text-teal-700',
  };

  const IconComponent = meta.icon;

  const switchMode = (mode: 'login' | 'register' | 'forgot_password') => {
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessMessage('');
    setForgotSuccessNotice(null);
    setRegisteredCustomId(null);
  };

  // ==========================================
  // 1. LOGIN HANDLER (Password only)
  // ==========================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanId = loginIdentifier.trim();
    if (!cleanId) {
      setErrorMessage(
        portal === 'patient'
          ? 'Please enter your registered Email Address or Patient ID (e.g. PT00234).'
          : 'Please enter your registered Email Address.'
      );
      return;
    }

    if (!loginPassword) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.loginWithPassword(cleanId, loginPassword, portal);
      if (result.success) {
        onLoginSuccess(portal);
      } else {
        setErrorMessage(result.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. FORGOT PASSWORD HANDLER (Email Reset)
  // ==========================================
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setForgotSuccessNotice(null);

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.sendPasswordReset(cleanEmail);
      setForgotSuccessNotice(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. REGISTRATION HANDLER (Password only, No OTP)
  // ==========================================
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regName.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const phoneCheck = normalizeAndValidatePhone(regPhone);
    if (!phoneCheck.isValid) {
      setErrorMessage(phoneCheck.error || 'Invalid Indian mobile number.');
      return;
    }

    const pwCheck = validatePasswordStrength(regPassword);
    if (!pwCheck.isValid) {
      setErrorMessage(pwCheck.error || 'Password must be at least 8 characters with a letter and a number.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (portal === 'doctor' && !regDocRegNum.trim()) {
      setErrorMessage('Medical Registration Number is required for doctor accounts.');
      return;
    }

    const dupCheck = authService.checkDuplicateAccount(regEmail, regPhone);
    if (dupCheck.isDuplicate) {
      setErrorMessage(dupCheck.error || 'An account with this email or phone already exists.');
      return;
    }

    setLoading(true);
    try {
      const regData: any = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: phoneCheck.normalized,
        password: regPassword,
        role: portal === 'patient' ? 'patient' : portal === 'doctor' ? 'doctor' : staffRole,
        portal,
        staffRole: portal === 'hospital' || portal === 'emergency' ? staffRole : undefined,
      };

      if (portal === 'patient') {
        regData.dob = regPatientDob;
        regData.gender = regPatientGender;
        regData.bloodGroup = regPatientBloodGroup;
        regData.allergies = regPatientAllergies
          ? regPatientAllergies.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        regData.chronicConditions = regPatientChronic
          ? regPatientChronic.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        regData.emergencyContactName = regPatientContactName.trim();
        regData.emergencyContactPhone = regPatientContactPhone.trim();
      } else if (portal === 'doctor') {
        regData.specialization = regDocSpec;
        regData.registrationNumber = regDocRegNum.trim();
        regData.hospitalId = regDocHospitalId;
        regData.experienceYears = Number(regDocExp) || 5;
      } else {
        regData.hospitalId = regStaffHospitalId;
      }

      const res = await authService.registerWithPassword(regData);
      if (res.success) {
        setRegisteredCustomId(res.customId || 'ACTIVE');
      } else {
        setErrorMessage(res.error || 'Could not complete registration.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F8] flex flex-col justify-between font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-[#E3E8EB] px-6 py-4 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToGateway}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Gateway</span>
          </button>

          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Password Authentication
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-[#E3E8EB] shadow-lg overflow-hidden">
          {/* Card Header */}
          <div className="bg-[#0B1F2D] text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-teal-400">
                  <IconComponent className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{meta.title}</h1>
                  <p className="text-xs text-slate-300 mt-0.5 max-w-sm">{meta.subtitle}</p>
                </div>
              </div>

              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-teal-300 border border-white/10">
                {meta.badge}
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 border-b border-[#E3E8EB] bg-slate-50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-3 text-center transition-colors cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 border-b-2 border-teal-600 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In with Password
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-3 text-center transition-colors cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-slate-900 border-b-2 border-teal-600 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Feedback Notifications */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* ======================================================== */}
            {/* MODE 1: LOGIN (Password only)                            */}
            {/* ======================================================== */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Hospital Staff Sub-role Selection */}
                {(portal === 'hospital' || portal === 'emergency') && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Staff Operating Role *</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setStaffRole('admin')}
                        className={`p-2.5 rounded-lg border text-xs font-bold text-center cursor-pointer transition-all ${
                          staffRole === 'admin'
                            ? 'bg-teal-50 border-teal-600 text-teal-800 ring-2 ring-teal-500/20'
                            : 'bg-white border-[#E3E8EB] text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Facility Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffRole('dispatcher')}
                        className={`p-2.5 rounded-lg border text-xs font-bold text-center cursor-pointer transition-all ${
                          staffRole === 'dispatcher'
                            ? 'bg-rose-50 border-rose-600 text-rose-800 ring-2 ring-rose-500/20'
                            : 'bg-white border-[#E3E8EB] text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Dispatcher
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffRole('paramedic')}
                        className={`p-2.5 rounded-lg border text-xs font-bold text-center cursor-pointer transition-all ${
                          staffRole === 'paramedic'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'bg-white border-[#E3E8EB] text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Paramedic
                      </button>
                    </div>
                  </div>
                )}

                {/* Email / Patient ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {portal === 'patient'
                      ? 'Email Address or Unique Patient ID (e.g. PT00234) *'
                      : 'Registered Email Address *'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      {portal === 'patient' ? <User className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder={
                        portal === 'patient'
                          ? 'name@example.com or PT00234'
                          : 'physician@hospital.org'
                      }
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Account Password *</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot_password')}
                      className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#0B1F2D] hover:bg-[#152E42] disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to {meta.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* MODE 2: FORGOT PASSWORD                                  */}
            {/* ======================================================== */}
            {authMode === 'forgot_password' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered account email. A secure password reset link will be sent to your inbox.
                </div>

                {forgotSuccessNotice ? (
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs space-y-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed font-medium">{forgotSuccessNotice}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Registered Email Address *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-9 pr-3 py-2.5 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="flex-1 py-2.5 border border-[#E3E8EB] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Send Reset Link</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* MODE 3: REGISTRATION (Password only, No OTP)             */}
            {/* ======================================================== */}
            {authMode === 'register' && (
              <div>
                {registeredCustomId ? (
                  /* Registration Complete Confirmation */
                  <div className="text-center py-6 space-y-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-900">Account Successfully Created!</h2>
                      <p className="text-xs text-slate-600 max-w-sm mx-auto">
                        Your account credentials and password have been saved. You can now use your email and password to log in anytime.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-[#E3E8EB] inline-block text-center space-y-1">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {portal === 'patient'
                          ? 'YOUR UNIQUE PATIENT ID'
                          : portal === 'doctor'
                          ? 'YOUR DOCTOR ID'
                          : 'STAFF IDENTIFIER'}
                      </div>
                      <div className="text-2xl font-black font-mono text-teal-800 tracking-wider">
                        {registeredCustomId}
                      </div>
                    </div>

                    {portal === 'doctor' && (
                      <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left">
                        <strong>Approval Notice:</strong> Your physician credentials have been submitted. An administrator at City Metro General Hospital will review and activate your prescription authority shortly.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onLoginSuccess(portal)}
                      className="w-full py-3 bg-[#0B1F2D] hover:bg-[#152E42] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>Proceed to {meta.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Registration Form */
                  <form onSubmit={handleRegistrationSubmit} className="space-y-4">
                    {/* Hospital Staff Sub-role Selection */}
                    {(portal === 'hospital' || portal === 'emergency') && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Staff Operating Role *</label>
                        <select
                          value={staffRole}
                          onChange={(e) => setStaffRole(e.target.value as any)}
                          className="w-full p-2.5 text-xs bg-white rounded-lg border border-[#E3E8EB] font-medium"
                        >
                          <option value="admin">Facility Administrator</option>
                          <option value="dispatcher">Central Emergency Dispatcher</option>
                          <option value="paramedic">Field Ambulance Paramedic</option>
                        </select>
                      </div>
                    )}

                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Sarah Chen or Dr. Aris Vance"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {/* Email & Phone Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="name@domain.com"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone (+91) *</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-4 h-4" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password & Confirm Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Password (Min 8 chars, letter + number) *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type="password"
                            required
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-[#E3E8EB] focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ROLE-SPECIFIC FIELDS: PATIENT */}
                    {portal === 'patient' && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-[#E3E8EB] space-y-3">
                        <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                          Medical Locker Details
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date of Birth</label>
                            <input
                              type="date"
                              value={regPatientDob}
                              onChange={(e) => setRegPatientDob(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gender</label>
                            <select
                              value={regPatientGender}
                              onChange={(e) => setRegPatientGender(e.target.value as any)}
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                            >
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Blood Group</label>
                            <select
                              value={regPatientBloodGroup}
                              onChange={(e) => setRegPatientBloodGroup(e.target.value as any)}
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
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
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Known Drug/Food Allergies
                            </label>
                            <input
                              type="text"
                              value={regPatientAllergies}
                              onChange={(e) => setRegPatientAllergies(e.target.value)}
                              placeholder="e.g. Penicillin, Peanuts"
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Emergency Contact Name & Phone
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                value={regPatientContactName}
                                onChange={(e) => setRegPatientContactName(e.target.value)}
                                placeholder="Contact Name"
                                className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                              />
                              <input
                                type="tel"
                                value={regPatientContactPhone}
                                onChange={(e) => setRegPatientContactPhone(e.target.value)}
                                placeholder="+91 Phone"
                                className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ROLE-SPECIFIC FIELDS: DOCTOR */}
                    {portal === 'doctor' && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-[#E3E8EB] space-y-3">
                        <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                          Physician Clinical Accreditation
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Specialization *</label>
                            <select
                              value={regDocSpec}
                              onChange={(e) => setRegDocSpec(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                            >
                              <option value="Cardiology">Cardiology</option>
                              <option value="General Medicine">General Medicine</option>
                              <option value="Emergency Trauma">Emergency Trauma</option>
                              <option value="Orthopedics">Orthopedics</option>
                              <option value="Pediatrics">Pediatrics</option>
                              <option value="Neurology">Neurology</option>
                              <option value="Pulmonology">Pulmonology</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Medical Council Reg. Number *
                            </label>
                            <input
                              type="text"
                              required
                              value={regDocRegNum}
                              onChange={(e) => setRegDocRegNum(e.target.value)}
                              placeholder="e.g. MCI-2021-9874"
                              className="w-full px-2 py-1.5 text-xs bg-white rounded border border-[#E3E8EB]"
                            />
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 italic">
                          Note: Newly registered physician accounts require verification and approval by the Hospital Administrator before entering Active Duty.
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account with Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Footer Bystander Emergency Option */}
          <div className="bg-slate-50 border-t border-[#E3E8EB] p-4 text-center">
            <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <span>Witnessing an acute accident?</span>
              <button
                type="button"
                onClick={onBystanderReport}
                className="text-red-700 hover:text-red-800 font-bold underline cursor-pointer"
              >
                One-Tap Civilian Report (No login required)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
