import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  User,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Printer,
  X,
  AlertCircle,
  QrCode,
  Smartphone,
  ChevronRight,
  FileText,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { AppState, appStore } from '../../services/store';
import { PaymentBill, PatientProfile, BillCategory, BillStatus, PaymentMethod } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { openRazorpayCheckout } from '../../services/razorpay';

interface PatientPaymentsPageProps {
  appState: AppState;
  patient: PatientProfile;
  onNavigate?: (pageId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Consultation: '#0E7C7B',
  Medicine: '#2563EB',
  'Lab test': '#7C3AED',
  Surgery: '#DC2626',
  Ambulance: '#D97706',
  Room: '#059669',
};

export const PatientPaymentsPage: React.FC<PatientPaymentsPageProps> = ({
  appState,
  patient,
  onNavigate,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals
  const [payingBill, setPayingBill] = useState<PaymentBill | null>(null);
  const [receiptBill, setReceiptBill] = useState<PaymentBill | null>(null);

  // Pay Now Modal State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [utrInput, setUtrInput] = useState('');
  const [utrError, setUtrError] = useState('');
  const [upiSubmittedNotice, setUpiSubmittedNotice] = useState<string | null>(null);
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState<{
    billId: string;
    txnRef: string;
    amount: number;
  } | null>(null);

  const upiId = (import.meta as any).env?.VITE_UPI_ID || 'meditrack@icici';
  const upiName = (import.meta as any).env?.VITE_UPI_NAME || 'MediTrack Healthcare';

  // Patient Bills
  const allPatientBills = useMemo(() => {
    return (appState.bills || []).filter(
      (b) => b.patientId === patient.id || b.patientName.toLowerCase() === patient.name.toLowerCase()
    );
  }, [appState.bills, patient.id, patient.name]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let spentMonth = 0;
    let spentYear = 0;
    let pendingDues = 0;
    let insuranceClaimed = 0;

    allPatientBills.forEach((b) => {
      const billDate = new Date(b.date);
      const isThisYear = billDate.getFullYear() === currentYear;
      const isThisMonth = isThisYear && billDate.getMonth() === currentMonth;

      if (b.status === 'Paid') {
        const netPaid = Math.max(0, b.amount - (b.insuranceCovered || 0));
        if (isThisMonth) spentMonth += netPaid;
        if (isThisYear) spentYear += netPaid;
      } else if (b.status === 'Pending') {
        const netPending = Math.max(0, b.amount - (b.insuranceCovered || 0));
        pendingDues += netPending;
      }

      if (b.insuranceCovered) {
        insuranceClaimed += b.insuranceCovered;
      }
    });

    return { spentMonth, spentYear, pendingDues, insuranceClaimed };
  }, [allPatientBills]);

  // Monthly Bar Chart Data (Last 6 Months: May to Oct 2026)
  const monthlyChartData = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthMap: Record<string, { month: string; amount: number; insurance: number }> = {
      May: { month: 'May 2026', amount: 1600, insurance: 800 },
      Jun: { month: 'Jun 2026', amount: 2400, insurance: 1200 },
      Jul: { month: 'Jul 2026', amount: 1850, insurance: 500 },
      Aug: { month: 'Aug 2026', amount: 3200, insurance: 1500 },
      Sep: { month: 'Sep 2026', amount: 2120, insurance: 1200 },
      Oct: { month: 'Oct 2026', amount: 0, insurance: 0 },
    };

    allPatientBills.forEach((b) => {
      const bDate = new Date(b.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mName = monthNames[bDate.getMonth()];
      if (monthMap[mName] && b.status === 'Paid') {
        const netPaid = Math.max(0, b.amount - (b.insuranceCovered || 0));
        monthMap[mName].amount += netPaid;
        monthMap[mName].insurance += b.insuranceCovered || 0;
      }
    });

    return months.map((m) => monthMap[m]);
  }, [allPatientBills]);

  // Category Donut Chart Data
  const categoryChartData = useMemo(() => {
    const catTotals: Record<string, number> = {};

    allPatientBills.forEach((b) => {
      const cat = b.category || 'Consultation';
      catTotals[cat] = (catTotals[cat] || 0) + b.amount;
    });

    return Object.entries(catTotals).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || '#64748B',
    }));
  }, [allPatientBills]);

  // Filtered Bills for the Table
  const filteredBills = useMemo(() => {
    return allPatientBills.filter((bill) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        bill.hospitalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bill.doctorName && bill.doctorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        bill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || bill.category === selectedCategory;

      const matchesStatus =
        selectedStatus === 'All' || bill.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allPatientBills, searchQuery, selectedCategory, selectedStatus]);

  // Handle Payment Submission (Manual UPI or Razorpay Online)
  const handleExecutePayment = async () => {
    if (!payingBill) return;
    setUtrError('');
    setIsProcessingPay(true);

    const netPayable = Math.max(0, payingBill.amount - (payingBill.insuranceCovered || 0));

    if (paymentMethod === 'UPI') {
      const cleanUtr = utrInput.trim();
      if (!/^\d{12}$/.test(cleanUtr)) {
        setUtrError('Please enter a valid 12-digit numeric UTR number from your payment app.');
        setIsProcessingPay(false);
        return;
      }

      try {
        appStore.submitManualUpiPayment({
          billId: payingBill.id,
          utr: cleanUtr,
          patientId: patient.id,
        });

        setIsProcessingPay(false);
        setUpiSubmittedNotice(`UTR ${cleanUtr} submitted! Your payment is under hospital administrative review (slot held for 30 minutes).`);
        setTimeout(() => {
          setPayingBill(null);
          setUpiSubmittedNotice(null);
          setUtrInput('');
        }, 3000);
      } catch (err: any) {
        setUtrError(err.message || 'Failed to submit UTR for verification.');
        setIsProcessingPay(false);
      }
    } else {
      // Razorpay Online Flow
      try {
        await openRazorpayCheckout({
          billId: payingBill.id,
          amountInRupees: netPayable,
          patientName: patient.name,
          patientEmail: patient.email,
          patientPhone: patient.phone,
          description: `Payment for ${payingBill.description} (${payingBill.id})`,
          onSuccess: (paymentResult) => {
            const paid = appStore.payBill(payingBill.id, 'Razorpay', paymentResult.razorpay_payment_id);
            setIsProcessingPay(false);
            setPayingBill(null);
            if (paid) {
              setReceiptBill(paid);
            }
          },
          onFailure: (err) => {
            setUtrError(err?.message || 'Razorpay payment was not completed or could not be verified on server.');
            setIsProcessingPay(false);
          },
          onDismiss: () => {
            setIsProcessingPay(false);
          },
        });
      } catch (err: any) {
        setUtrError(err.message || 'Could not initiate Razorpay checkout.');
        setIsProcessingPay(false);
      }
    }
  };

  // Download Receipt as HTML / Print
  const handleDownloadReceipt = (bill: PaymentBill) => {
    const netPaid = Math.max(0, bill.amount - (bill.insuranceCovered || 0));
    const receiptContent = `
======================================================
           MEDITRACK DIGITAL HEALTHCARE INVOICE
               ABHA / Ayushman Bharat Verified
======================================================
Invoice ID      : ${bill.id}
Date            : ${bill.date}
Hospital        : ${bill.hospitalName}
Attending Doctor: ${bill.doctorName || 'Assigned Specialist'}
------------------------------------------------------
PATIENT DETAILS:
Name            : ${patient.name}
Patient ID      : ${patient.uniquePatientId}
Age / Gender    : ${patient.age} / ${patient.gender}
Blood Group     : ${patient.bloodGroup}
Phone           : ${patient.phone}
------------------------------------------------------
BILLING DETAILS:
Category        : ${bill.category}
Description     : ${bill.description}
Gross Amount    : INR ${bill.amount.toLocaleString()}
Insurance TPA   : - INR ${(bill.insuranceCovered || 0).toLocaleString()}
------------------------------------------------------
NET AMOUNT PAID : INR ${netPaid.toLocaleString()}
Payment Status  : ${bill.status.toUpperCase()}
Payment Method  : ${bill.paymentMethod || 'UPI / Digital'}
Transaction Ref : ${bill.transactionRef || 'SYSTEM-GENERATED'}
Paid At         : ${bill.paidAt ? new Date(bill.paidAt).toLocaleString() : new Date().toLocaleString()}
======================================================
This is a computer-generated tax invoice verified by
MediTrack ABHA locker under Indian Digital Health Mission.
======================================================
`;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${bill.id}_${patient.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#0E7C7B]" />
            <span>Medical Expense Tracker &amp; Billing Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time outpatient consultations, pharmacy orders, lab invoices, and cashless insurance claims.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics.pendingDues > 0 && (
            <button
              onClick={() => {
                const firstPending = allPatientBills.find((b) => b.status === 'Pending');
                if (firstPending) setPayingBill(firstPending);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>Pay Pending Dues (₹{metrics.pendingDues.toLocaleString()})</span>
            </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate('book-appointment')}
              className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
            >
              Book OPD Slot
            </button>
          )}
        </div>
      </div>

      {/* 2. Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spent this month */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Spent This Month</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E7C7B] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            ₹{metrics.spentMonth.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-700 font-medium">
            <span>October 2026 OPD &amp; Pharmacy</span>
          </div>
        </div>

        {/* Spent this year */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Spent This Year</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            ₹{metrics.spentYear.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>Annual Total (Jan – Dec 2026)</span>
          </div>
        </div>

        {/* Pending Dues */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pending Dues</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-700">
            ₹{metrics.pendingDues.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
            {metrics.pendingDues > 0 ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Action required: unpaid invoices
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                All medical bills settled
              </span>
            )}
          </div>
        </div>

        {/* Insurance Claimed */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Insurance Claimed</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-purple-700">
            ₹{metrics.insuranceClaimed.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>TPA Cashless Coverage (Star / ABHA)</span>
          </div>
        </div>
      </div>

      {/* 3. Visual Charts Grid (Monthly Bar Chart & Category Donut Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Bar Chart (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Medical Spending Trend</h3>
              <p className="text-[11px] text-slate-500">
                Expenditure over past 6 months (Net Out-of-Pocket vs Insurance)
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              FY 2026-27
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `₹${Number(value).toLocaleString()}`,
                    name === 'amount' ? 'Out of Pocket' : 'Insurance Covered',
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="amount" name="amount" fill="#0E7C7B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="insurance" name="insurance" fill="#A7F3D0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#0E7C7B]" />
              <span>Out-of-Pocket Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#A7F3D0]" />
              <span>TPA Insurance Claim</span>
            </div>
          </div>
        </div>

        {/* Category Donut Chart (1 column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Expenses by Category</h3>
            <p className="text-[11px] text-slate-500">Distribution across consultations, pharmacy &amp; labs</p>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            {categoryChartData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-slate-700">{cat.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">₹{cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Transactions Ledger Table with Filters */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0E7C7B] flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transaction History</h3>
              <span className="text-[11px] text-slate-500">
                {filteredBills.length} of {allPatientBills.length} records matching filters
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search hospital, doctor, bill #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0E7C7B]"
            >
              <option value="All">All Categories</option>
              <option value="Consultation">Consultation</option>
              <option value="Medicine">Medicine</option>
              <option value="Lab test">Lab test</option>
              <option value="Surgery">Surgery</option>
              <option value="Ambulance">Ambulance</option>
              <option value="Room">Room</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0E7C7B]"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Hospital</th>
                <th className="py-3 px-4">Attending Doctor</th>
                <th className="py-3 px-4">Category &amp; Item</th>
                <th className="py-3 px-4">Gross &amp; Net Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No billing records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const netAmount = Math.max(0, bill.amount - (bill.insuranceCovered || 0));
                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {bill.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{bill.hospitalName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Invoice #{bill.id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {bill.doctorName ? (
                          <div className="font-medium text-slate-900">{bill.doctorName}</div>
                        ) : (
                          <span className="text-slate-400 italic">OPD / Clinical Desk</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[bill.category] || '#0E7C7B'}15`,
                              color: CATEGORY_COLORS[bill.category] || '#0E7C7B',
                            }}
                          >
                            {bill.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 max-w-xs truncate">
                          {bill.description}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">
                          ₹{netAmount.toLocaleString()}
                        </div>
                        {bill.insuranceCovered && bill.insuranceCovered > 0 ? (
                          <div className="text-[10px] text-purple-600">
                            (Gross: ₹{bill.amount.toLocaleString()} - TPA: ₹{bill.insuranceCovered.toLocaleString()})
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        {bill.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Paid
                          </span>
                        ) : bill.status === 'Pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {bill.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {bill.status === 'Pending' ? (
                            <button
                              onClick={() => {
                                setPayingBill(bill);
                                setPaySuccessMsg(null);
                              }}
                              className="px-3 py-1 rounded bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <button
                              onClick={() => setReceiptBill(bill)}
                              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#0E7C7B]" />
                              <span>Receipt</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadReceipt(bill)}
                            title="Download invoice slip"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: Mock Pay Now */}
      {payingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0E7C7B] flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Hospital Payment Gateway</h3>
                  <p className="text-xs text-slate-500">Invoice #{payingBill.id}</p>
                </div>
              </div>
              <button
                onClick={() => setPayingBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paySuccessMsg ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Payment Successful!</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Invoice <strong>#{paySuccessMsg.billId}</strong> of ₹{paySuccessMsg.amount.toLocaleString()} was settled.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Ref:</span>
                    <span className="font-bold text-slate-900">{paySuccessMsg.txnRef}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hospital:</span>
                    <span className="font-bold text-slate-900">{payingBill.hospitalName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-emerald-700">Settled (Digital Stamp Verified)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (receiptBill) handleDownloadReceipt(receiptBill);
                    }}
                    className="flex-1 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Receipt</span>
                  </button>
                  <button
                    onClick={() => {
                      setPayingBill(null);
                      setPaySuccessMsg(null);
                    }}
                    className="flex-1 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4 text-xs">
                {/* Bill Breakdown Box */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Clinical Service:</span>
                    <span className="font-semibold text-slate-900 text-right">{payingBill.description}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Hospital:</span>
                    <span className="font-medium text-slate-800">{payingBill.hospitalName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Amount:</span>
                    <span className="font-mono font-medium">₹{payingBill.amount.toLocaleString()}</span>
                  </div>
                  {payingBill.insuranceCovered && payingBill.insuranceCovered > 0 ? (
                    <div className="flex justify-between text-purple-700 font-semibold">
                      <span>TPA Insurance Deduction:</span>
                      <span className="font-mono">- ₹{payingBill.insuranceCovered.toLocaleString()}</span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Net Payable Total:</span>
                    <span className="font-mono text-base font-black text-emerald-700">
                      ₹{Math.max(0, payingBill.amount - (payingBill.insuranceCovered || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'UPI', label: 'Manual UPI (QR & UTR)', icon: QrCode, desc: 'Zero fees • Instant QR' },
                      { id: 'Razorpay', label: 'Razorpay Online', icon: CreditCard, desc: 'Cards, NetBanking, Gateways' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as any);
                          setUtrError('');
                        }}
                        className={`p-3 rounded-lg border-2 flex flex-col items-start gap-1 cursor-pointer transition-all ${
                          paymentMethod === m.id
                            ? 'border-[#0E7C7B] bg-teal-50/50 text-[#0E7C7B] font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <m.icon className="w-4 h-4" />
                          <span className="text-xs font-bold">{m.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback notices */}
                {upiSubmittedNotice && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span>Submitted for Administrative Review</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{upiSubmittedNotice}</p>
                  </div>
                )}

                {utrError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{utrError}</span>
                  </div>
                )}

                {/* Method 1: Manual UPI Details with QR Code */}
                {paymentMethod === 'UPI' && !upiSubmittedNotice && (() => {
                  const netPayable = Math.max(0, payingBill.amount - (payingBill.insuranceCovered || 0));
                  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${netPayable}&cu=INR&tn=${encodeURIComponent(payingBill.id)}`;

                  return (
                    <div className="p-4 bg-teal-50/40 border border-teal-200 rounded-lg space-y-3.5">
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-lg border border-teal-100">
                        <div className="p-2 bg-white rounded border border-slate-200 shadow-xs shrink-0 flex flex-col items-center">
                          <QRCodeSVG value={upiUrl} size={130} level="M" />
                          <span className="text-[9px] text-slate-400 font-mono mt-1">Scan via any UPI App</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Verified Institutional Payee
                          </span>
                          <div className="font-bold text-slate-900 text-sm mt-1">{upiName}</div>
                          <div className="text-slate-600 text-[11px]">
                            UPI VPA: <strong className="font-mono text-slate-900">{upiId}</strong>
                          </div>
                          <div className="text-slate-600 text-[11px]">
                            Exact Amount: <strong className="font-mono text-emerald-700 font-bold">₹{netPayable.toLocaleString()}</strong>
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            Invoice Reference: <span className="font-mono">{payingBill.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pay with UPI App Mobile Button */}
                      <a
                        href={upiUrl}
                        className="w-full text-center px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Pay with UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                      </a>

                      {/* 12-digit UTR Input */}
                      <div className="pt-2 border-t border-teal-200/80 space-y-1">
                        <label className="block font-bold text-slate-800 text-xs">
                          Enter 12-Digit Transaction UTR / Ref Number *
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={utrInput}
                          onChange={(e) => {
                            setUtrInput(e.target.value.replace(/\D/g, '').slice(0, 12));
                            setUtrError('');
                          }}
                          placeholder="e.g. 529184029182"
                          className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-sm tracking-widest font-bold text-slate-900 focus:outline-none focus:border-[#0E7C7B]"
                        />
                        <p className="text-[10px] text-slate-500">
                          After paying, enter the 12-digit numeric reference from your banking app. The bill status will show &quot;Pending Verification&quot; and hold your slot for 30 minutes until approved by Hospital Admin.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Method 2: Razorpay Gateway Details */}
                {paymentMethod === 'Razorpay' && !upiSubmittedNotice && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="font-bold text-slate-900">Razorpay Digital Payment Gateway</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Pay securely with Debit Card, Credit Card, Net Banking, or UPI through official Razorpay checkout.
                      Orders and cryptographic signatures are validated directly on the server before marking paid.
                    </p>
                    <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <span>Server Bill ID:</span>
                      <strong className="text-slate-800">{payingBill.id}</strong>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setPayingBill(null);
                      setUtrError('');
                      setUpiSubmittedNotice(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {!upiSubmittedNotice && (
                    <button
                      type="button"
                      disabled={isProcessingPay || (paymentMethod === 'UPI' && utrInput.trim().length !== 12)}
                      onClick={handleExecutePayment}
                      className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessingPay ? (
                        <span>Processing...</span>
                      ) : paymentMethod === 'UPI' ? (
                        <span>Submit 12-Digit UTR for Verification</span>
                      ) : (
                        <span>
                          Launch Razorpay (₹{Math.max(0, payingBill.amount - (payingBill.insuranceCovered || 0)).toLocaleString()})
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: Downloadable Official Receipt */}
      {receiptBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E7C7B]" />
                <span className="text-sm font-bold text-slate-900">Hospital Medical Tax Invoice</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadReceipt(receiptBill)}
                  className="px-2.5 py-1 rounded bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>
                <button
                  onClick={() => setReceiptBill(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Paper */}
            <div className="p-6 space-y-4 text-xs font-sans bg-white border border-slate-100 m-3 rounded-lg shadow-inner">
              {/* Institution Header */}
              <div className="text-center pb-3 border-b border-slate-200">
                <div className="font-black text-sm tracking-wide text-slate-900 uppercase">
                  {receiptBill.hospitalName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  NABH &amp; JCI Accredited Medical Centre • GSTIN: 07AAAAC1234F1Z5
                </div>
                <div className="text-[10px] text-teal-800 font-semibold mt-1">
                  National Digital Health Mission (NDHM) • ABHA Electronic Health Verified
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 p-3 rounded border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500 block">Invoice Number:</span>
                  <span className="font-bold text-slate-900">{receiptBill.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date of Service:</span>
                  <span className="font-bold text-slate-900">{receiptBill.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Patient Name:</span>
                  <span className="font-bold text-slate-900">{patient.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">ABHA Patient ID:</span>
                  <span className="font-bold text-slate-900">{patient.uniquePatientId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Attending Doctor:</span>
                  <span className="font-bold text-slate-900">{receiptBill.doctorName || 'Attending Specialist'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department / Cat:</span>
                  <span className="font-bold text-slate-900">{receiptBill.category}</span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-2">Description</th>
                      <th className="p-2">SAC Code</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr>
                      <td className="p-2 font-medium text-slate-800">{receiptBill.description}</td>
                      <td className="p-2 font-mono text-slate-500">999312</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        ₹{receiptBill.amount.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-2 text-[11px] border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Invoice Total:</span>
                  <span className="font-mono">₹{receiptBill.amount.toLocaleString()}</span>
                </div>
                {receiptBill.insuranceCovered && receiptBill.insuranceCovered > 0 ? (
                  <div className="flex justify-between text-purple-700 font-semibold">
                    <span>TPA Cashless Insurance Settlement:</span>
                    <span className="font-mono">- ₹{receiptBill.insuranceCovered.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-800 font-bold text-xs pt-1 border-t border-slate-200">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono text-emerald-700 font-black">
                    ₹{Math.max(0, receiptBill.amount - (receiptBill.insuranceCovered || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Digital Seal */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-500">
                <div>
                  <div>Payment Mode: <strong>{receiptBill.paymentMethod || 'UPI / Online'}</strong></div>
                  <div>Txn Ref: <strong className="font-mono">{receiptBill.transactionRef || 'UPI-984129841'}</strong></div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">✓ DIGITALLY SIGNED &amp; VERIFIED</div>
                  <div>Authorized Hospital Accounts Desk</div>
                </div>
              </div>
            </div>

            {/* Footer Close */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setReceiptBill(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
