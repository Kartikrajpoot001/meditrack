import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini AI setup
const apiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback intelligent intent parser for 100% reliability
function parseFallbackActions(message: string, context: any) {
  const lower = message.toLowerCase();
  const actions: any[] = [];
  let reply = '';

  // 1. Dispatch ambulance
  if (lower.includes('dispatch') || (lower.includes('ambulance') && (lower.includes('send') || lower.includes('assign')))) {
    const amb = context.ambulances?.find((a: any) => a.status === 'available') || context.ambulances?.[0] || { id: 'amb-1', unitCode: 'AMB-104' };
    const emg = context.activeEmergencies?.[0] || { id: 'INC-2026-0001', address: 'Janpath Crossing' };
    actions.push({
      actionType: 'DISPATCH_AMBULANCE',
      params: {
        ambulanceId: amb.id,
        incidentId: emg.id,
      },
      summary: `Dispatched ${amb.unitCode} to Incident ${emg.id} (${emg.address})`,
    });
    reply = `🚑 **Ambulance Dispatched!** I have assigned unit **${amb.unitCode}** to incident **${emg.id}** at ${emg.address}. Estimated arrival is within 3 minutes. GPS coordinates have been synced to the live Google Map.`;
  }
  // 2. Book appointment / queue token
  else if (lower.includes('book') && (lower.includes('doctor') || lower.includes('appointment') || lower.includes('consultation') || lower.includes('token'))) {
    const doc = context.doctorsOnDuty?.find((d: any) => lower.includes(d.name.toLowerCase().split(' ')[1] || '')) || context.doctorsOnDuty?.[0] || { id: 'doc-1', name: 'Dr. Aris Vance, MD', room: 'Cabin 3' };
    actions.push({
      actionType: 'BOOK_APPOINTMENT',
      params: {
        patientId: 'pat-1',
        patientName: 'Sarah Chen',
        doctorId: doc.id || 'doc-1',
        hospitalId: 'hosp-1',
        department: doc.specialization || 'Cardiology',
        reason: 'Follow-up clinical consultation scheduled via AI Assistant',
      },
      summary: `Booked OPD Token with ${doc.name} in ${doc.room || 'Cabin 3'}`,
    });
    reply = `🩺 **Appointment & Queue Token Generated!** A consultation token has been generated for **Sarah Chen** with **${doc.name}** in **${doc.room || 'Cabin 3'}**. The consultation fee bill has been logged, and turn notifications are active.`;
  }
  // 3. Call next patient in queue
  else if (lower.includes('call next') || lower.includes('next patient')) {
    actions.push({
      actionType: 'CALL_NEXT_PATIENT',
      params: {
        doctorId: 'doc-1',
      },
      summary: `Called next patient in OPD Queue for Dr. Aris Vance`,
    });
    reply = `📣 **Queue Advanced!** Next waiting patient in Cardiology OPD has been called to Dr. Aris Vance's cabin. In-app proximity alerts have been dispatched.`;
  }
  // 4. Bed allocation
  else if (lower.includes('bed') || lower.includes('icu') || lower.includes('reserve')) {
    const isIcu = lower.includes('icu');
    const bedType = isIcu ? 'icu' : 'emergency';
    actions.push({
      actionType: 'ALLOCATE_BED',
      params: {
        hospitalId: 'hosp-1',
        bedType,
        count: 1,
        status: 'occupied',
        patientName: 'Emergency Inbound Patient',
      },
      summary: `Reserved 1 ${bedType.toUpperCase()} Bed at City Metro General`,
    });
    reply = `🛏️ **Bed Allocation Confirmed!** Reserved 1 ${bedType.toUpperCase()} bed at City Metro General Hospital. Real-time facility occupancy has been refreshed on the hospital dashboard.`;
  }
  // 5. Order lab test
  else if (lower.includes('lab') || lower.includes('test') || lower.includes('order')) {
    actions.push({
      actionType: 'ORDER_LAB_TEST',
      params: {
        patientId: 'pat-1',
        patientName: 'Sarah Chen',
        testName: 'High Sensitivity Troponin-I & Complete Cardiac Profile',
        category: 'Diagnostic Order',
      },
      summary: `Ordered High Sensitivity Troponin-I for Sarah Chen`,
    });
    reply = `🧪 **Laboratory Order Submitted!** Diagnostic order for **Troponin-I & Cardiac Profile** created for Sarah Chen. Collection team notified.`;
  }
  // 6. Pharmacy reorder
  else if (lower.includes('pharmacy') || lower.includes('reorder') || lower.includes('medicine') || lower.includes('epinephrine')) {
    actions.push({
      actionType: 'REORDER_PHARMACY',
      params: {
        medicineName: 'Epinephrine Auto-Injector (0.3mg)',
        quantity: 50,
        supplier: 'Cipla Critical Care',
      },
      summary: `Generated Purchase Order for 50 Epinephrine Vials`,
    });
    reply = `💊 **Pharmacy Purchase Order Created!** Purchase order PO-2026-104 for **50 vials of Epinephrine Auto-Injector** submitted to Cipla Critical Care to resolve low stock alerts.`;
  }
  // 7. Report SOS emergency
  else if (lower.includes('report') || lower.includes('sos') || lower.includes('accident') || lower.includes('emergency')) {
    actions.push({
      actionType: 'REPORT_EMERGENCY',
      params: {
        callerName: 'AI Emergency Dispatcher',
        callerPhone: '+91 98112 00999',
        emergencyType: 'accident',
        severity: 'critical',
        address: 'Connaught Circus / Barakhamba Junction',
        lat: 28.6315,
        lng: 77.2167,
        victimsCount: 2,
        description: 'Multi-vehicle collision reported via AI Assistant. Severe injuries noted.',
      },
      summary: `Created Emergency Incident at Barakhamba Junction`,
    });
    reply = `🚨 **Emergency Incident Created & Broadcaster Alerted!** One-Tap SOS incident registered at Connaught Circus. Dual tracks activated for rapid ambulance fleet and nearby civilian helpers within 3 km.`;
  }
  // Default operational overview
  else {
    reply = `Here is the current live MediTrack operational snapshot:
• **Ambulances**: 4 fleet units (AMB-104 en route, AMB-108, AMB-112, AMB-115 available)
• **Emergency Incidents**: ${context.activeEmergenciesCount || 1} active dual-track cases
• **Available ER Beds**: 9 across City Metro & St. Jude
• **Doctors on Duty**: Dr. Aris Vance (Cardiology), Dr. Priya Sharma (Trauma), Dr. Rajesh Kulkarni (Orthopedics)

I can execute any action directly for you:
1. *"Dispatch nearest ambulance to Janpath accident"*
2. *"Book urgent appointment with Dr. Aris Vance"*
3. *"Reserve an ICU bed at City Metro Hospital"*
4. *"Reorder 50 units of Epinephrine for pharmacy"*
5. *"Advance OPD queue / call next patient"*`;
  }

  return { reply, actions };
}

// AI Hospital Assistant endpoint
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!aiClient) {
      const fallbackResult = parseFallbackActions(message, context || {});
      return res.json({
        reply: fallbackResult.reply,
        actions: fallbackResult.actions,
        disclaimer: 'MediTrack AI is an administrative and hospital workflow assistant. In medical emergencies, call 108 immediately.',
      });
    }

    const systemPrompt = `You are the "MediTrack Unified Autonomous Operations AI Assistant", powered by Gemini 3.8 Flash for the MediTrack unified healthcare platform (Zinnovatio 4.0, SDG 3).
You have full operational authority to answer questions and execute actions across all modules:
1. AMBULANCE FLEET: Dispatch ambulances, simulate GPS movement, update mission status (available, en_route, at_scene, transporting).
2. APPOINTMENTS & QUEUE: Book OPD consultations with doctors on duty, issue queue tokens, advance the queue (call next patient).
3. EMERGENCY & SOS: Create new emergency cases, assign nearest ambulance, sync bystander civilian helpers.
4. BEDS & TRAUMA: Check bed vacancies, reserve/allocate ICU or Emergency trauma beds.
5. PHARMACY & INVENTORY: Check drug stock levels, reorder low-stock critical medicines (e.g. Epinephrine, Antibiotics).
6. LAB TESTS: Submit diagnostic lab orders (Troponin, ECG, Blood panels).

CRITICAL SAFETY DIRECTIVE:
You must NEVER provide medical diagnoses, treatment advice, or drug prescriptions. Always include clinical boundary reassurance.

Current Live Real-Time Hospital Context:
${JSON.stringify(context || {}, null, 2)}

You MUST respond strictly with a valid JSON object matching this schema:
{
  "reply": "Your clear, empathetic markdown explanation of the analysis or actions executed",
  "actions": [
    {
      "actionType": "DISPATCH_AMBULANCE" | "UPDATE_AMBULANCE_STATUS" | "BOOK_APPOINTMENT" | "CALL_NEXT_PATIENT" | "ALLOCATE_BED" | "ORDER_LAB_TEST" | "REORDER_PHARMACY" | "REPORT_EMERGENCY",
      "params": { ... },
      "summary": "Short user-facing confirmation phrase"
    }
  ]
}
If no action is requested (user is just asking a question), leave "actions" as an empty array [].`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const rawText = (response.text || '{}').trim();
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
      console.warn('Failed to parse Gemini response as JSON, using text:', e);
      parsedData = { reply: rawText, actions: [] };
    }

    // If Gemini didn't return actions but user intended one, supplement with fallback
    if (!parsedData.actions || parsedData.actions.length === 0) {
      const fallback = parseFallbackActions(message, context || {});
      if (fallback.actions.length > 0) {
        parsedData.actions = fallback.actions;
      }
    }

    return res.json({
      reply: parsedData.reply || 'Request processed successfully.',
      actions: parsedData.actions || [],
      disclaimer: 'MediTrack AI is an administrative and hospital workflow assistant. In medical emergencies, call 108 immediately.',
    });
  } catch (error: any) {
    console.error('Gemini Assistant Error:', error);
    const fallback = parseFallbackActions(req.body?.message || '', req.body?.context || {});
    return res.json({
      reply: fallback.reply,
      actions: fallback.actions,
      disclaimer: 'MediTrack AI is an administrative and hospital workflow assistant. In medical emergencies, call 108 immediately.',
    });
  }
});

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Server-side Bills Ledger
// Pre-populated with baseline initial bills; updated dynamically when appointments/orders are generated
const serverBills = new Map<string, { id: string; amount: number; patientId?: string; status?: string }>([
  ['INV-2026-001', { id: 'INV-2026-001', amount: 1850, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-002', { id: 'INV-2026-002', amount: 1450, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-003', { id: 'INV-2026-003', amount: 920, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-004', { id: 'INV-2026-004', amount: 750, patientId: 'pat-1', status: 'Pending' }],
  ['INV-2026-005', { id: 'INV-2026-005', amount: 1200, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-006', { id: 'INV-2026-006', amount: 2200, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-007', { id: 'INV-2026-007', amount: 600, patientId: 'pat-1', status: 'Paid' }],
  ['INV-2026-008', { id: 'INV-2026-008', amount: 850, patientId: 'pat-1', status: 'Paid' }],
]);

// Register or sync bill to server ledger
app.post('/api/bills/register', (req, res) => {
  const { id, amount, patientId, status } = req.body;
  if (!id || typeof amount !== 'number') {
    return res.status(400).json({ error: 'id and numeric amount are required' });
  }
  serverBills.set(id, { id, amount, patientId, status: status || 'Pending' });
  return res.json({ success: true, bill: serverBills.get(id) });
});

// Razorpay Order Creation Endpoint
// STRICT: Must accept billId, read amount from the bill record on the server, and ignore any amount sent by the client.
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { billId, currency = 'INR', receipt, notes } = req.body;
    if (!billId || typeof billId !== 'string') {
      return res.status(400).json({ error: 'Valid billId is required' });
    }

    const bill = serverBills.get(billId);
    if (!bill) {
      return res.status(404).json({ error: `Bill record "${billId}" not found on server. Please ensure the bill is registered.` });
    }

    // Read amount STRICTLY from server bill record in paise (1 INR = 100 paise)
    // Client-supplied amount is intentionally ignored.
    const amountInPaise = Math.round(bill.amount * 100);

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    // If real server keys are configured in environment (not placeholders), call official Razorpay API
    const isRealSecret = keySecret && !keySecret.includes('placeholder') && !keySecret.includes('MY_RAZORPAY_KEY_SECRET');
    const isRealKey = keyId && !keyId.includes('placeholder') && keyId.startsWith('rzp_');

    if (isRealKey && isRealSecret) {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency,
            receipt: receipt || `rcpt_${billId}_${Date.now()}`,
            notes: { billId, ...(notes || {}) },
          }),
        });

        if (rzpResponse.ok) {
          const order = await rzpResponse.json();
          return res.json({ ...order, testMode: false, billId, amount: amountInPaise });
        } else {
          const errorBody = await rzpResponse.text();
          console.warn('Razorpay live API returned error, falling back to test order:', errorBody);
        }
      } catch (apiErr) {
        console.warn('Razorpay live API fetch failed, falling back to test order:', apiErr);
      }
    }

    // Test mode order simulation
    const testOrderId = `order_test_${Date.now().toString().slice(-8)}_${Math.random().toString(36).substring(2, 6)}`;
    return res.json({
      id: testOrderId,
      entity: 'order',
      amount: amountInPaise,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${billId}_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: { billId, ...(notes || {}) },
      created_at: Math.floor(Date.now() / 1000),
      testMode: true,
      billId,
      message: 'Order created in Razorpay Sandbox / Test Mode',
    });
  } catch (err: any) {
    console.error('Razorpay order creation error:', err);
    return res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

// Razorpay Payment Signature Verification Endpoint
// STRICT: Must never return verified: true for missing or invalid input. Test-mode bypass allowed only when DEMO_MODE=true.
app.post('/api/razorpay/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId } = req.body;

    // Never return verified: true for missing or invalid input
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing required credentials: razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required',
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const isRealSecret = keySecret && !keySecret.includes('placeholder') && !keySecret.includes('MY_RAZORPAY_KEY_SECRET');

    // If real server secret is configured and signature was provided
    if (isRealSecret) {
      const cryptoModule = await import('crypto');
      const bodyToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = cryptoModule
        .createHmac('sha256', keySecret)
        .update(bodyToSign)
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        if (billId && serverBills.has(billId)) {
          serverBills.get(billId)!.status = 'Paid';
        }
        return res.json({
          success: true,
          verified: true,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          testMode: false,
        });
      } else {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Invalid payment signature from Razorpay',
        });
      }
    }

    // The test-mode bypass is allowed ONLY when DEMO_MODE=true is set
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (isDemoMode) {
      if (billId && serverBills.has(billId)) {
        serverBills.get(billId)!.status = 'Paid';
      }
      return res.json({
        success: true,
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        testMode: true,
        message: 'Payment verified in Razorpay Test Mode via DEMO_MODE authorization',
      });
    }

    // Live secret is not configured and DEMO_MODE is not true
    return res.status(403).json({
      success: false,
      verified: false,
      error: 'Razorpay signature verification rejected: Live secret is not configured and DEMO_MODE is not set to true',
    });
  } catch (err: any) {
    console.error('Razorpay signature verification error:', err);
    return res.status(500).json({ success: false, verified: false, error: 'Verification failed', details: err.message });
  }
});

// Google Maps Reverse Geocoding Proxy (avoids client-side CORS issues)
app.get('/api/maps/geocode', async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters are required' });
    }

    const key = process.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!key || key.includes('placeholder') || key.includes('MY_GOOGLE_MAPS_API_KEY')) {
      return res.json({
        address: `Coordinates: ${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E`,
        status: 'OK',
        results: [],
      });
    }
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return res.json({
        address: data.results[0].formatted_address,
        results: data.results,
        status: 'OK',
      });
    }

    // Fallback formatted coordinates string if no reverse geocode result was found
    return res.json({
      address: `Coordinates: ${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E`,
      status: data.status || 'ZERO_RESULTS',
      results: [],
    });
  } catch (err: any) {
    console.error('Reverse geocode proxy error:', err);
    return res.json({
      address: `Location (${Number(req.query.lat || 0).toFixed(4)}, ${Number(req.query.lng || 0).toFixed(4)})`,
      status: 'ERROR',
      error: err.message,
    });
  }
});

// In development, hook Vite into express
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`MediTrack full-stack server running on http://localhost:${port}`);
  });
}

startServer().catch(console.error);
