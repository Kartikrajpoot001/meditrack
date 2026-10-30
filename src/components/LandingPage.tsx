import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowRight,
  User,
  Stethoscope,
  Building2,
  Ambulance,
  Phone,
  Moon,
  ShieldAlert,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { UserRole } from '../types';
import { Language } from '../i18n/translations';
import { PortalType } from './auth/PortalLoginPage';

interface LandingPageProps {
  onSelectRole: (role: UserRole, userId?: string) => void;
  onOpenPortalLogin: (portal: PortalType) => void;
  onOpenEmergency: () => void;
  onOpenSimulator: () => void;
  onOpenAssistant?: () => void;
  lang: Language;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenPortalLogin,
  onOpenEmergency,
  onOpenSimulator,
  onOpenAssistant,
}) => {
  // Live Clock in IST
  const [timeString, setTimeString] = useState('08:07 PM IST');
  const [dateString, setDateString] = useState('Oct 29, 2026');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeFormatted = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const dateFormatted = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setTimeString(`${timeFormatted} IST`);
      setDateString(dateFormatted);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F7F8] flex flex-col justify-between font-sans text-slate-800 selection:bg-teal-500 selection:text-white">
      {/* 1. TOP BAR (Matching screenshot exactly) */}
      <header className="bg-white border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0B1F2D] flex items-center justify-center text-teal-400 shadow-sm">
              <Activity className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-slate-900 text-base tracking-tight">MediTrack</span>
                <span className="font-bold text-[#0E7C7B] text-base">Nexus</span>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">
                Enterprise Clinical EHR & Emergency Dispatch
              </div>
            </div>
          </div>

          {/* Right Status & Controls */}
          <div className="flex items-center gap-4">
            {/* Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>All Regional Nodes Online</span>
            </div>

            {/* Live IST Time */}
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-xs font-bold text-slate-900 font-mono">{timeString}</div>
              <div className="text-[10px] text-slate-500 font-medium">{dateString}</div>
            </div>

            {/* Help Desk Button */}
            <button
              onClick={onOpenSimulator}
              className="px-3 py-1.5 bg-[#F1F5F9] hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              Help Desk
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO GATEWAY (Matching screenshot) */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 sm:py-14 max-w-7xl mx-auto w-full">
        {/* Gateway Directory Badge */}
        <div className="mb-3">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#0E7C7B] bg-[#E6FFFA] border border-[#B2F5EA] px-3 py-1 rounded-full shadow-2xs">
            Single Sign-On Access Directory
          </span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B1F2D] text-center tracking-tight max-w-4xl">
          Institutional Medical Gateway
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-xs sm:text-sm text-slate-600 text-center max-w-2xl leading-relaxed">
          Unified point of access for patients, outpatient physicians, hospital ward managers, and emergency dispatch teams.
        </p>

        {/* ACTION BUTTONS: ONE-TAP SOS, LIVE AMBULANCE MAP, AI ASSISTANT */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenEmergency}
            className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <ShieldAlert className="w-4 h-4 text-white" />
            <span>ONE-TAP SOS (WITNESS REPORT)</span>
          </button>

          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer border border-sky-500"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI Operations Assistant</span>
            </button>
          )}
        </div>

        {/* 3. THREE GATEWAY PORTAL CARDS */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {/* Card 1: Patient Portal */}
          <div
            onClick={() => onOpenPortalLogin('patient')}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col justify-between hover:shadow-lg hover:border-teal-500 transition-all cursor-pointer group"
          >
            <div>
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#E6FFFA] text-[#0E7C7B] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <User className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-2">Patient Portal</h2>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[48px]">
                Personal EHR health locker, real-time cabin wait queue tokens, appointment booking, & visual pill schedules.
              </p>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPortalLogin('patient');
                }}
                className="w-full bg-[#0B1F2D] hover:bg-[#152E42] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <span>Access Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Doctor Station */}
          <div
            onClick={() => onOpenPortalLogin('doctor')}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col justify-between hover:shadow-lg hover:border-teal-500 transition-all cursor-pointer group"
          >
            <div>
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-2">Doctor Station</h2>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[48px]">
                OPD queue caller, patient chart reviewer, consultation notes, diagnosis logging, and e-prescriptions.
              </p>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPortalLogin('doctor');
                }}
                className="w-full bg-[#0B1F2D] hover:bg-[#152E42] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <span>Access Station</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Hospital Staff (Admin, Dispatcher, Paramedic) */}
          <div
            onClick={() => onOpenPortalLogin('hospital')}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col justify-between hover:shadow-lg hover:border-teal-500 transition-all cursor-pointer group"
          >
            <div>
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-2">Hospital Staff</h2>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[48px]">
                Unified operational console for Facility Administrators, Central Emergency Dispatchers, and Field Paramedic units.
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">Hospital Admin</span>
                <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-100">Dispatcher</span>
                <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded border border-teal-100">Paramedic</span>
              </div>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPortalLogin('hospital');
                }}
                className="w-full bg-[#0B1F2D] hover:bg-[#152E42] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <span>Access Staff Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 4. BOTTOM FLOATING/FIXED STATUS BAR (Matching screenshot exactly) */}
      <footer className="bg-[#0B1F2D] text-white px-4 sm:px-8 py-3 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Left: CityCare Emergency Network */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-rose-300">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">CityCare Emergency Response Network</div>
              <div className="text-[11px] text-slate-400">
                Toll-Free Dispatch: <span className="text-white font-mono font-semibold">108</span> / <span className="text-white font-mono font-semibold">+91 98112 34567</span>
              </div>
            </div>
          </div>

          {/* Center: Weather & Barometric Status */}
          <div className="hidden lg:flex items-center gap-6 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-amber-300" />
              <div>
                <span className="font-bold text-white">21°C</span>
                <span className="ml-1.5 text-slate-400">Clear Night • Regional Hub</span>
              </div>
            </div>
            <div className="border-l border-slate-700 pl-4">
              AQI Index: <strong className="text-emerald-400 font-mono">42 (Optimal)</strong>
              <div className="text-[10px] text-slate-400">ICU Ward Barometric: Standard</div>
            </div>
          </div>

          {/* Right: Bystander Civilian SOS Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenEmergency}
              className="bg-[#D32F2F] hover:bg-red-700 text-white font-black text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer shadow-md shadow-red-900/40 transition-all hover:scale-105"
            >
              <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
              <span>One-Tap SOS</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
