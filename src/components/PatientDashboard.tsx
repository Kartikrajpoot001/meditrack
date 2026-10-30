import React, { useState } from 'react';
import {
  User,
  ShieldAlert,
  Calendar,
  FileText,
  Pill,
  Hospital,
  Copy,
  Check,
  QrCode,
  Upload,
  Plus,
  ExternalLink,
  X,
  Phone,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { AppState, appStore } from '../services/store';
import { PatientProfile, MedicalReport } from '../types';
import { PatientAnatomyView } from './3d/PatientAnatomyView';

import { Language } from '../i18n/translations';

interface PatientDashboardProps {
  appState: AppState;
  onOpenEmergency: () => void;
  lang?: Language;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  appState,
  onOpenEmergency,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // New report form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState<MedicalReport['category']>('Blood Test');
  const [reportDoctor, setReportDoctor] = useState('Dr. Aris Vance, MD');
  const [reportSummary, setReportSummary] = useState('');

  // Active patient profile (Sarah Chen: PT00234 by default)
  const patient: PatientProfile =
    appState.patients.find((p) => p.id === appState.currentUserId) || appState.patients[0];

  const reports = appState.reports.filter((r) => r.patientId === patient.id);
  const myQueueTokens = appState.queueTokens.filter(
    (q) => q.patientId === patient.id && (q.status === 'waiting' || q.status === 'in_consultation')
  );

  const handleCopyId = () => {
    navigator.clipboard.writeText(patient.uniquePatientId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUploadReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle) return;

    appStore.uploadMedicalReport({
      patientId: patient.id,
      title: reportTitle,
      category: reportCategory,
      date: new Date().toISOString().split('T')[0],
      doctorName: reportDoctor,
      hospitalName: 'City Metro General Hospital',
      fileUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
      fileType: reportCategory === 'Radiology' ? 'image' : 'pdf',
      summary: reportSummary || 'Routine laboratory testing recorded in MediTrack Locker.',
    });

    setReportTitle('');
    setReportSummary('');
    setShowUploadModal(false);
  };

  const nextAppointment = myQueueTokens[0];

  return (
    <div className="space-y-6">
      {/* 1. Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Good morning, {patient.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Patient Medical Locker and Care Overview • ID: {patient.uniquePatientId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyId}
            className="px-3 py-1.5 bg-white border border-[#E3E8EB] hover:bg-slate-50 rounded-[6px] text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="px-3 py-1.5 bg-white border border-[#E3E8EB] hover:bg-slate-50 rounded-[6px] text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            <span>Show QR Code</span>
          </button>
        </div>
      </div>

      {/* 2. Top Row: Profile Card & Emergency Card (with 3D anatomical model) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Card (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E3E8EB] rounded-[8px] p-5">
          <div className="flex items-center justify-between border-b border-[#E3E8EB] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[6px] bg-[#F4F7F8] border border-[#E3E8EB] flex items-center justify-center font-semibold text-slate-700 text-xs">
                {patient.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{patient.name}</h2>
                <div className="text-xs text-slate-500">
                  {patient.gender}, {patient.age} yrs • Blood Group: <strong className="text-slate-800">{patient.bloodGroup}</strong>
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-medium bg-[#F4F7F8] px-2.5 py-1 rounded-[4px] border border-[#E3E8EB] text-slate-700">
              {patient.uniquePatientId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-400 font-medium">Contact Phone</div>
              <div className="font-semibold text-slate-800 mt-0.5">{patient.phone}</div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Email Address</div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{patient.email}</div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Chronic Conditions</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {patient.chronicConditions.join(', ') || 'None reported'}
              </div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Primary Emergency Contact</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {patient.emergencyContacts[0]?.name} ({patient.emergencyContacts[0]?.phone})
              </div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Vaccination Status</div>
              <div className="font-semibold text-emerald-700 mt-0.5">Up to date (Covishield Booster)</div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Last Attending Doctor</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {patient.lastViewedByDoctor?.doctorName || 'Dr. Aris Vance'}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Card with 3D Anatomy Visualizer (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E3E8EB] rounded-[8px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E3E8EB] pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D32F2F]" />
              <h3 className="text-sm font-semibold text-slate-900">Emergency & Allergy Card</h3>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#D32F2F] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Critical Vitals
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* 3D Model Container: Fixed height, rotates slowly, pauses on hover */}
            <div className="shrink-0 bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] p-1">
              <PatientAnatomyView className="w-28 h-28" primaryColor="#D32F2F" />
            </div>

            {/* Blood group and allergies beside model as plain text */}
            <div className="flex-1 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 uppercase text-[10px] font-semibold block">Blood Group</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{patient.bloodGroup}</span>
              </div>

              <div>
                <span className="text-slate-400 uppercase text-[10px] font-semibold block">Documented Allergies</span>
                <div className="mt-1 space-y-1">
                  {patient.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="inline-block bg-rose-50 text-[#D32F2F] border border-rose-200 px-2 py-0.5 rounded-[4px] text-xs font-semibold mr-1 mb-1"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E3E8EB] flex items-center justify-between text-xs">
            <span className="text-slate-500">Emergency Hotline: 108</span>
            <button
              onClick={onOpenEmergency}
              className="text-[#D32F2F] hover:underline font-semibold"
            >
              Report Emergency Incident
            </button>
          </div>
        </div>
      </div>

      {/* 3. Next Appointment Card */}
      <div className="bg-white border border-[#E3E8EB] rounded-[8px] p-5">
        <div className="flex items-center justify-between mb-3 border-b border-[#E3E8EB] pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0E7C7B]" />
            <h3 className="text-sm font-semibold text-slate-900">Next Scheduled Appointment</h3>
          </div>
          {nextAppointment && (
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium">
              Token #{nextAppointment.tokenNumber} Active
            </span>
          )}
        </div>

        {nextAppointment ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-slate-400">Doctor</div>
              <div className="font-semibold text-slate-800 mt-0.5">{nextAppointment.doctorName}</div>
              <div className="text-[11px] text-slate-500">{nextAppointment.department}</div>
            </div>

            <div>
              <div className="text-slate-400">Facility & Room</div>
              <div className="font-semibold text-slate-800 mt-0.5">{nextAppointment.roomNumber}</div>
              <div className="text-[11px] text-slate-500">City Metro General Hospital</div>
            </div>

            <div>
              <div className="text-slate-400">Status & Wait Time</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {nextAppointment.status === 'in_consultation' ? 'Now Calling' : `~${nextAppointment.estimatedWaitMinutes} mins`}
              </div>
              <div className="text-[11px] text-slate-500">
                {nextAppointment.status === 'in_consultation' ? 'Please proceed to room' : 'Waiting in clinic lounge'}
              </div>
            </div>

            <div>
              <div className="text-slate-400">Chief Complaint</div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{nextAppointment.reason}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-2">
            No pending appointments scheduled for today. Contact hospital reception to book a consultation slot.
          </div>
        )}
      </div>

      {/* 4. Two Columns: Recent Reports & Current Medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Reports Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E3E8EB] rounded-[8px] p-5">
          <div className="flex items-center justify-between mb-3 border-b border-[#E3E8EB] pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0E7C7B]" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Diagnostic Reports</h3>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-[#0E7C7B] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Upload Report
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[#E3E8EB]">
              <thead>
                <tr className="text-slate-400 font-medium">
                  <th className="pb-2 font-normal">Report Title</th>
                  <th className="pb-2 font-normal">Category</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Physician</th>
                  <th className="pb-2 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E8EB] text-slate-700">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-900 pr-2">{rep.title}</td>
                    <td className="py-2.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {rep.category}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-slate-500">{rep.date}</td>
                    <td className="py-2.5 text-slate-600 truncate max-w-[120px]">{rep.doctorName}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="text-[#0E7C7B] hover:underline font-medium cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Medicines (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E3E8EB] rounded-[8px] p-5">
          <div className="flex items-center justify-between mb-3 border-b border-[#E3E8EB] pb-2">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#0E7C7B]" />
              <h3 className="text-sm font-semibold text-slate-900">Current Medications</h3>
            </div>
            <span className="text-xs text-slate-400">
              {patient.currentMedicines.length} Prescribed
            </span>
          </div>

          <div className="divide-y divide-[#E3E8EB] text-xs">
            {patient.currentMedicines.map((med, i) => (
              <div key={i} className="py-2.5">
                <div className="font-semibold text-slate-900">{med.name}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Dose: {med.dosage} • Frequency: {med.frequency}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Nearby Hospitals Row */}
      <div className="bg-white border border-[#E3E8EB] rounded-[8px] p-5">
        <div className="flex items-center justify-between mb-3 border-b border-[#E3E8EB] pb-2">
          <div className="flex items-center gap-2">
            <Hospital className="w-4 h-4 text-[#0E7C7B]" />
            <h3 className="text-sm font-semibold text-slate-900">Nearby Network Hospitals & Emergency Capacity</h3>
          </div>
          <span className="text-xs text-slate-400">Live Hospital Telemetry</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appState.hospitals.map((hosp) => (
            <div
              key={hosp.id}
              className="p-3.5 bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 text-sm">{hosp.name}</h4>
                  <span className="bg-white border border-[#E3E8EB] px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">
                    {hosp.code}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">{hosp.address}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#E3E8EB] flex items-center justify-between text-[11px]">
                <div className="space-x-3">
                  <span>
                    Emergency Beds:{' '}
                    <strong className="text-emerald-700">
                      {hosp.beds.emergencyTotal - hosp.beds.emergencyOccupied} Vacant
                    </strong>
                  </span>
                  <span>
                    ICU Beds:{' '}
                    <strong className="text-slate-800">
                      {hosp.beds.icuTotal - hosp.beds.icuOccupied} Vacant
                    </strong>
                  </span>
                </div>

                <a
                  href={`tel:${hosp.emergencyHelpline}`}
                  className="font-medium text-[#D32F2F] hover:underline"
                >
                  Helpline: {hosp.emergencyHelpline}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-[8px] p-6 max-w-sm w-full border border-[#E3E8EB] text-center shadow-md relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-slate-900">Patient QR Code</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Scan at reception or hospital kiosk to verify identity and consent.
            </p>

            <div className="p-3 bg-[#F4F7F8] rounded-[6px] border border-[#E3E8EB] inline-block mb-3">
              <svg className="w-40 h-40" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="white" />
                <rect x="10" y="10" width="25" height="25" fill="#0B2F3A" />
                <rect x="15" y="15" width="15" height="15" fill="white" />
                <rect x="18" y="18" width="9" height="9" fill="#0E7C7B" />
                <rect x="65" y="10" width="25" height="25" fill="#0B2F3A" />
                <rect x="70" y="15" width="15" height="15" fill="white" />
                <rect x="73" y="18" width="9" height="9" fill="#0E7C7B" />
                <rect x="10" y="65" width="25" height="25" fill="#0B2F3A" />
                <rect x="15" y="70" width="15" height="15" fill="white" />
                <rect x="18" y="73" width="9" height="9" fill="#0E7C7B" />
                <rect x="42" y="15" width="6" height="6" fill="#0B2F3A" />
                <rect x="52" y="15" width="6" height="6" fill="#0B2F3A" />
                <rect x="42" y="42" width="16" height="16" fill="#0B2F3A" />
                <rect x="46" y="46" width="8" height="8" fill="white" />
                <rect x="65" y="42" width="6" height="6" fill="#0B2F3A" />
                <rect x="75" y="42" width="6" height="6" fill="#0B2F3A" />
                <rect x="15" y="42" width="6" height="6" fill="#0B2F3A" />
                <rect x="42" y="65" width="6" height="16" fill="#0B2F3A" />
                <rect x="75" y="65" width="12" height="12" fill="#0B2F3A" />
              </svg>
            </div>

            <div className="font-mono text-sm font-bold text-slate-800">{patient.uniquePatientId}</div>
            <div className="text-[11px] text-slate-400 mt-1">DigiLocker Authenticated</div>
          </div>
        </div>
      )}

      {/* Report Viewer Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-[8px] p-6 max-w-lg w-full border border-[#E3E8EB] shadow-md relative">
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[10px] uppercase font-semibold text-[#0E7C7B] bg-slate-100 px-2 py-0.5 rounded">
              {selectedReport.category}
            </span>
            <h3 className="text-base font-semibold text-slate-900 mt-1">{selectedReport.title}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {selectedReport.date} • {selectedReport.doctorName}
            </p>

            <div className="my-3 p-3 bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] text-xs text-slate-700">
              <strong>Clinical Summary:</strong> {selectedReport.summary}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[6px] text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-[8px] p-6 max-w-md w-full border border-[#E3E8EB] shadow-md relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Upload Report to Locker</h3>

            <form onSubmit={handleUploadReport} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Report Title</label>
                <input
                  type="text"
                  required
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. Complete Blood Count, Chest X-Ray"
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as any)}
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                >
                  <option value="Blood Test">Blood Test</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pathology">Pathology</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Clinical Summary</label>
                <textarea
                  rows={2}
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Brief laboratory notes or impression..."
                  className="w-full bg-[#F4F7F8] border border-[#E3E8EB] rounded-[6px] px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 rounded-[6px] text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0E7C7B] hover:bg-[#0a6463] text-white px-4 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer"
                >
                  Save to Locker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
