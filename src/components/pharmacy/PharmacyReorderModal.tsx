import React, { useState } from 'react';
import { ExternalLink, Check, ShoppingBag, ShieldCheck, Truck, Sparkles, X } from 'lucide-react';
import { appStore } from '../../services/store';

export interface PharmacyOption {
  id: '1mg' | 'pharmeasy' | 'apollo' | 'netmeds';
  name: string;
  tagline: string;
  badge: string;
  logoBg: string;
  textColor: string;
  borderHover: string;
  getSearchUrl: (medicine: string) => string;
}

export const PHARMACY_PROVIDERS: PharmacyOption[] = [
  {
    id: '1mg',
    name: 'Tata 1mg',
    tagline: 'Trusted e-pharmacy • 15-20% off • Lab tests & doctor consultations',
    badge: 'Express Delivery',
    logoBg: 'bg-red-50 text-red-600 border-red-200',
    textColor: 'text-red-700',
    borderHover: 'hover:border-red-400',
    getSearchUrl: (med) => `https://www.1mg.com/search/all?name=${encodeURIComponent(med)}`,
  },
  {
    id: 'pharmeasy',
    name: 'PharmEasy',
    tagline: 'Flat discounts on prescription medicines • Cashbacks & doorstep delivery',
    badge: 'Best Prices',
    logoBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-700',
    borderHover: 'hover:border-emerald-400',
    getSearchUrl: (med) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(med)}`,
  },
  {
    id: 'apollo',
    name: 'Apollo Pharmacy',
    tagline: "India's largest retail pharmacy network • 2-hour rapid delivery from 6,000+ stores",
    badge: '2-Hour Express',
    logoBg: 'bg-orange-50 text-orange-600 border-orange-200',
    textColor: 'text-orange-700',
    borderHover: 'hover:border-orange-400',
    getSearchUrl: (med) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(med)}`,
  },
  {
    id: 'netmeds',
    name: 'Netmeds',
    tagline: 'India Ki Pharmacy • Certified generic & specialty formulations delivered nationwide',
    badge: 'Verified Stock',
    logoBg: 'bg-teal-50 text-[#0E7C7B] border-teal-200',
    textColor: 'text-[#0E7C7B]',
    borderHover: 'hover:border-teal-400',
    getSearchUrl: (med) => `https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(med)}`,
  },
];

interface PharmacyReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    name: string;
    dosage?: string;
    code?: string;
    cat?: string;
    currentStock?: number;
    unitPrice?: number;
  };
  patientId?: string;
  isHospitalInventory?: boolean;
  hospitalId?: string;
  onOrderPlaced?: (result: {
    providerName: string;
    quantity: number;
    status: string;
    orderId?: string;
  }) => void;
}

export const PharmacyReorderModal: React.FC<PharmacyReorderModalProps> = ({
  isOpen,
  onClose,
  item,
  patientId = 'pat-1',
  isHospitalInventory = false,
  hospitalId = 'hosp-1',
  onOrderPlaced,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<PharmacyOption['id']>('1mg');
  const [quantity, setQuantity] = useState<number>(isHospitalInventory ? 100 : 30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    providerName: string;
    orderId: string;
    amount: number;
  } | null>(null);

  if (!isOpen) return null;

  const activeProvider = PHARMACY_PROVIDERS.find((p) => p.id === selectedProvider) || PHARMACY_PROVIDERS[0];
  const unitPrice = item.unitPrice || (isHospitalInventory ? 45 : 12);
  const totalAmount = quantity * unitPrice;

  const handleConfirmOrder = () => {
    setIsSubmitting(true);

    // 1. Open the search URL in a new tab
    const searchUrl = activeProvider.getSearchUrl(item.name);
    try {
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked, continuing in app', e);
    }

    // 2. Save order record with a status in the app
    let generatedOrderId = '';
    if (isHospitalInventory) {
      // Save hospital procurement purchase order
      const po = appStore.createPharmacyPurchaseOrder({
        hospitalId,
        medicineName: item.name,
        supplier: activeProvider.name,
        quantity,
        unit: 'units',
        status: 'approved',
        totalCost: totalAmount,
      });
      generatedOrderId = po.id;
    } else {
      // Save patient medicine reorder (which also creates a bill in Payments page!)
      const bill = appStore.reorderPharmacyPatient(
        patientId,
        item.name,
        quantity,
        30, // +30 days course
        activeProvider.name
      );
      generatedOrderId = bill.id;
    }

    setSuccessInfo({
      providerName: activeProvider.name,
      orderId: generatedOrderId,
      amount: totalAmount,
    });

    setIsSubmitting(false);

    if (onOrderPlaced) {
      onOrderPlaced({
        providerName: activeProvider.name,
        quantity,
        status: 'Order Placed (External Store Opened)',
        orderId: generatedOrderId,
      });
    }
  };

  const handleFinish = () => {
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0E7C7B] flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isHospitalInventory ? 'Hospital Formulary Procurement' : 'Prescription Medicine Reorder'}
              </h3>
              <p className="text-xs text-slate-500">
                Select partner pharmacy network & checkout in one click
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {successInfo ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Order Placed & Search Tab Opened!</h4>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                We opened <strong className="text-slate-900">{successInfo.providerName}</strong> in a new tab searching for{' '}
                <strong className="text-slate-900">{item.name}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-left space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Record ID:</span>
                <span className="font-bold text-slate-900">{successInfo.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item:</span>
                <span className="font-bold text-slate-900">{item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity:</span>
                <span className="font-bold text-slate-900">{quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Total:</span>
                <span className="font-bold text-emerald-700">₹{successInfo.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-teal-700">Order Placed (Bill Generated)</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Bill automatically added to Patient Payments page</span>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-2.5 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-semibold text-xs transition-colors shadow-xs"
            >
              Done & Return to App
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4 text-xs">
            {/* Medicine details badge */}
            <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider block">
                  Medicine to Reorder
                </span>
                <span className="text-sm font-bold text-slate-900">{item.name}</span>
                {item.dosage && (
                  <span className="text-xs text-slate-500 ml-2">({item.dosage})</span>
                )}
              </div>
              {item.code && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-900">
                  {item.code}
                </span>
              )}
            </div>

            {/* Choose Pharmacy */}
            <div>
              <label className="block font-bold text-slate-800 mb-2">
                Choose Partner Pharmacy Platform:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PHARMACY_PROVIDERS.map((provider) => {
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <div
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0E7C7B] bg-teal-50/40 shadow-xs'
                          : `border-slate-200 bg-white ${provider.borderHover}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-xs ${provider.textColor}`}>
                          {provider.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {provider.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {provider.tagline}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quantity and Price */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <label className="block font-bold text-slate-700">Order Quantity</label>
                <span className="text-[11px] text-slate-500">
                  {isHospitalInventory ? 'Units / strips for formulary' : 'Course quantity (+30 days)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(isHospitalInventory ? 10 : 5, q - (isHospitalInventory ? 20 : 10)))}
                  className="w-7 h-7 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded p-1"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + (isHospitalInventory ? 20 : 10))}
                  className="w-7 h-7 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Estimated Total Calculation */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-slate-600">Estimated Total (Inclusive of Taxes):</span>
              <span className="text-base font-bold font-mono text-slate-900">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>

            {/* External Tab Notice */}
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
              <ExternalLink className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Clicking <strong>Proceed to {activeProvider.name}</strong> will search for{' '}
                <em>{item.name}</em> on {activeProvider.name} in a new tab for seamless ordering, and save the order &amp; billing record in MediTrack.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmOrder}
                className="px-5 py-2 rounded-lg bg-[#0E7C7B] hover:bg-[#0c6b6a] text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>Proceed to {activeProvider.name}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
