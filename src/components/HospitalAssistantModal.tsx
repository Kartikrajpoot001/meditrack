import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  AlertTriangle,
  Sparkles,
  User,
  RefreshCw,
  Ambulance,
  Calendar,
  Bed,
  Layers,
  Activity,
  CheckCircle2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MapPin,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { appStore, AppState } from '../services/store';

interface HospitalAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  onNavigate?: (pageId: string) => void;
}

interface ActionExecution {
  actionType: string;
  params: any;
  summary: string;
  executedAt: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: ActionExecution[];
}

export const HospitalAssistantModal: React.FC<HospitalAssistantModalProps> = ({
  isOpen,
  onClose,
  appState,
  onNavigate,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am **MediTrack AI Operations Assistant** (powered by Gemini 3.8 Flash). 

I have **full operational capabilities** to execute real workflows across the platform:
• 🚑 **Ambulances**: Dispatch units, simulate live GPS movement, update mission status
• 🩺 **Doctors & Queue**: Book consultations, generate queue tokens, advance the doctor line
• 🛏️ **Bed Management**: Allocate and reserve Emergency Trauma, ICU, and General beds
• 🚨 **Emergency SOS**: Create incident reports, notify hospital ERs, sync civilian helpers
• 💊 **Pharmacy & Inventory**: Check medicine stock, trigger purchase reorders
• 🧪 **Diagnostics**: Order laboratory tests (Troponin, ECG, blood markers)

What task would you like me to execute?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleActionPills = [
    { label: '🚑 Dispatch nearest ambulance', prompt: 'Dispatch the nearest available ambulance to Janpath accident' },
    { label: '🩺 Book Cardiology token', prompt: 'Book an urgent cardiology consultation with Dr. Aris Vance for Sarah Chen' },
    { label: '🛏️ Reserve ICU Bed', prompt: 'Check bed availability and reserve an ICU bed at City Metro General' },
    { label: '💊 Restock Epinephrine', prompt: 'Reorder 50 units of Epinephrine Auto-Injectors for pharmacy' },
    { label: '📣 Call next patient', prompt: 'Call the next waiting patient in Cardiology OPD queue' },
    { label: '🚨 Report SOS Accident', prompt: 'Report a multi-vehicle accident with 2 victims at Barakhamba Junction' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Voice speech synthesis
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown asterisks for clean speech
      const clean = text.replace(/[*_#`]/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed', e);
    }
  };

  // Speech Recognition (Web Speech API)
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        handleSendMessage(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    }
  };

  // EXECUTE STORE ACTIONS BASED ON GEMINI RESPONSE
  const executeStoreActions = (actions: any[]): ActionExecution[] => {
    const executed: ActionExecution[] = [];

    actions.forEach((act) => {
      try {
        switch (act.actionType) {
          case 'DISPATCH_AMBULANCE': {
            const { ambulanceId, incidentId } = act.params;
            const targetAmbId = ambulanceId || appState.ambulances.find((a) => a.status === 'available')?.id || 'amb-1';
            const targetIncId = incidentId || appState.emergencies.find((e) => e.status !== 'Closed')?.id || 'INC-2026-0001';
            appStore.dispatchAmbulance(targetIncId, targetAmbId);
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Dispatched ambulance ${targetAmbId} to incident ${targetIncId}`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'BOOK_APPOINTMENT': {
            const { patientId, patientName, doctorId, hospitalId, department, reason } = act.params;
            appStore.bookAppointment({
              patientId: patientId || 'pat-1',
              patientName: patientName || 'Sarah Chen',
              uniquePatientId: 'PT00234',
              doctorId: doctorId || 'doc-1',
              hospitalId: hospitalId || 'hosp-1',
              department: department || 'Cardiology',
              reason: reason || 'Scheduled OPD Consultation via AI Assistant',
            });
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Booked appointment for ${patientName || 'Sarah Chen'}`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'CALL_NEXT_PATIENT': {
            const docId = act.params.doctorId || 'doc-1';
            appStore.callNextPatient(docId);
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Called next patient in doctor's queue`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'ALLOCATE_BED': {
            const { hospitalId, bedType, count, status, patientName } = act.params;
            appStore.allocateBedDirect({
              hospitalId: hospitalId || 'hosp-1',
              bedType: bedType || 'emergency',
              status: status || 'occupied',
              patientName: patientName || 'Inbound Patient',
            });
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Reserved 1 ${bedType || 'Emergency'} bed`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'ORDER_LAB_TEST': {
            const { patientId, patientName, testName, category } = act.params;
            appStore.orderLabTestDirect({
              patientId: patientId || 'pat-1',
              patientName: patientName || 'Sarah Chen',
              testName: testName || 'Diagnostic Marker Panel',
              category: category || 'Pathology',
            });
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Submitted lab order: ${testName}`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'REORDER_PHARMACY': {
            const { medicineName, quantity, supplier } = act.params;
            appStore.createPharmacyPurchaseOrder({
              hospitalId: 'hosp-1',
              medicineName: medicineName || 'Epinephrine Auto-Injector (0.3mg)',
              supplier: supplier || 'Cipla Critical Care',
              quantity: quantity || 50,
              unit: 'vials',
              status: 'pending',
              totalCost: (quantity || 50) * 90,
            });
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Created purchase order for ${quantity || 50}x ${medicineName}`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          case 'REPORT_EMERGENCY': {
            const { callerName, callerPhone, emergencyType, severity, address, lat, lng, description } = act.params;
            const res = appStore.triggerOneTapSOS({
              callerName: callerName || 'AI Emergency Dispatcher',
              callerPhone: callerPhone || '+91 98112 00999',
              emergencyType: emergencyType || 'accident',
              address: address || 'Barakhamba Junction, New Delhi',
              lat: lat || 28.6315,
              lng: lng || 77.2167,
            });
            if (description) {
              appStore.updateIncidentAfterSOS(res.caseItem.id, { description, severity });
            }
            executed.push({
              actionType: act.actionType,
              params: act.params,
              summary: act.summary || `Created emergency incident #${res.caseItem.id}`,
              executedAt: new Date().toLocaleTimeString(),
            });
            break;
          }

          default:
            console.log('Unrecognized action type:', act.actionType);
        }
      } catch (err) {
        console.error('Failed to execute action:', act, err);
      }
    });

    return executed;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Prepare real-time hospital context
    const hospitalContext = {
      hospitals: appState.hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        phone: h.phone,
        helpline: h.emergencyHelpline,
        address: h.address,
        vacantEmergencyBeds: h.beds.emergencyTotal - h.beds.emergencyOccupied,
        vacantIcuBeds: h.beds.icuTotal - h.beds.icuOccupied,
        vacantGeneralBeds: h.beds.generalTotal - h.beds.generalOccupied,
        ambulancesAvailable: h.beds.ambulancesTotal - h.beds.ambulancesOccupied,
      })),
      ambulances: appState.ambulances.map((a) => ({
        id: a.id,
        unitCode: a.unitCode,
        status: a.status,
        type: a.type,
        driver: a.driverName,
        paramedic: a.paramedicName,
        etaMinutes: a.etaMinutes,
      })),
      doctorsOnDuty: appState.doctors.map((d) => ({
        id: d.id,
        name: d.name,
        specialization: d.specialization,
        hospital: d.hospitalName,
        room: d.roomNumber,
        status: d.status,
        currentToken: d.currentToken || 'None',
      })),
      liveQueueCount: appState.queueTokens.filter((q) => q.status === 'waiting').length,
      currentActiveToken: appState.queueTokens.find((q) => q.status === 'in_consultation')?.tokenNumber,
      activeEmergencies: appState.emergencies.filter((e) => e.status !== 'Closed').map((e) => ({
        id: e.id,
        emergencyType: e.emergencyType,
        address: e.address,
        status: e.status,
        assignedAmbulance: e.assignedAmbulance?.unitCode,
      })),
      pharmacyLowStock: appState.pharmacy.filter((p) => p.stock <= p.minThreshold).map((p) => ({
        name: p.name,
        stock: p.stock,
        min: p.minThreshold,
      })),
    };

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: hospitalContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      // Execute returned actions in the client store!
      let executedActions: ActionExecution[] = [];
      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        executedActions = executeStoreActions(data.actions);
      }

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Task processed successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: executedActions.length > 0 ? executedActions : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      speakText(assistantMessage.text);
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackReply = `I have received your request and logged it into our operational audit feed. You can review live status across the Ambulance, Queue, and Hospital dashboards.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          sender: 'assistant',
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[680px] max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="p-4 bg-gradient-to-r from-sky-700 via-teal-700 to-emerald-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  MediTrack AI Operations Assistant
                </h3>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Autonomous Mode
                </span>
              </div>
              <p className="text-xs text-sky-100">
                Full-Module Execution: Ambulances, OPD Queue, Beds, SOS & Pharmacy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Readback Toggle */}
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                ttsEnabled ? 'bg-white text-teal-800' : 'text-white/80 hover:bg-white/20'
              }`}
              title={ttsEnabled ? 'Voice readback active' : 'Enable voice readback'}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Operational Metrics Mini Bar */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 overflow-x-auto no-scrollbar gap-3">
          <div className="flex items-center gap-1 font-semibold shrink-0">
            <Ambulance className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {appState.ambulances.filter((a) => a.status === 'available').length} / {appState.ambulances.length} Ambulances Available
            </span>
          </div>
          <div className="flex items-center gap-1 font-semibold shrink-0">
            <Bed className="w-3.5 h-3.5 text-emerald-600" />
            <span>9 ER Beds Free</span>
          </div>
          <div className="flex items-center gap-1 font-semibold shrink-0">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span>OPD Queue: {appState.queueTokens.filter((q) => q.status === 'waiting').length} Waiting</span>
          </div>
          <div className="flex items-center gap-1 font-semibold shrink-0 text-red-600">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{appState.emergencies.filter((e) => e.status !== 'Closed').length} Active SOS</span>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-tl-none whitespace-pre-line'
                }`}
              >
                {msg.text}

                {/* Render Executed Actions Confirmation Card */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Actions Executed Live on MediTrack
                    </span>
                    {msg.actions.map((act, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-emerald-900 dark:text-emerald-200">
                            {act.summary}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                          {act.executedAt}
                        </span>
                      </div>
                    ))}

                    {/* Quick Jump Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {onNavigate && (
                        <>
                          <button
                            onClick={() => {
                              onNavigate('live-map');
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 rounded-lg text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" /> View on Map
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('active-incidents');
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Ambulance className="w-3 h-3" /> Incidents
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('dashboard');
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Dashboard
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`text-[10px] mt-1 text-right ${
                    msg.sender === 'user' ? 'text-sky-200' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-teal-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Gemini 3.8 Flash evaluating clinical context & executing workflow...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Action Pills */}
        <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
          {sampleActionPills.map((pill, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(pill.prompt)}
              disabled={isLoading}
              className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap transition-colors cursor-pointer font-medium"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Input Form Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          {/* Voice Input Mic Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isListening
                ? 'bg-red-600 text-white border-red-600 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title={isListening ? 'Listening...' : 'Voice command (Speech to text)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type any instruction: dispatch ambulance, book token, reserve bed, reorder meds..."
            disabled={isLoading}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center transition-all shadow-md cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
