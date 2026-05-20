import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { Printer, Download, ArrowLeft, CheckCircle } from 'lucide-react';
import { exportReceiptPDF } from '../utils/exportUtils';
import { useAuthStore } from '../store/authStore';
import { PhoneLink } from '../components/ui/PhoneLink';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const token = useAuthStore.getState().token;
      const { data } = await axios.get(`${API}/collections/receipt/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Receipt not found</p>
          <button onClick={() => navigate(-1)} className="btn-primary">Go Back</button>
        </div>
      </div>
    );
  }

  const handlePrint = () => window.print();

  const handleDownload = () => exportReceiptPDF(receipt);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      {/* Action bar - hidden on print */}
      <div className="no-print max-w-sm mx-auto mb-4 flex gap-2">
        <button onClick={() => navigate(-1)} className="btn-secondary flex-1">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handlePrint} className="btn-primary flex-1">
          <Printer size={16} /> Print
        </button>
        <button onClick={handleDownload} className="btn-gold flex-1">
          <Download size={16} /> PDF
        </button>
      </div>

      {/* Receipt card */}
      <div id="receipt-content" className="receipt-paper max-w-sm mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 text-white text-center py-5 px-4">
          <h1 className="text-lg font-bold">SPS Group of Foundation</h1>
          <p className="text-navy-300 text-xs mt-0.5">Microfinance Management</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">Payment Confirmed</span>
          </div>
        </div>

        {/* Receipt Number Banner */}
        <div className="bg-gold-500/10 border-b border-gold-200 px-4 py-2 text-center">
          <p className="text-xs text-slate-500">Receipt Number</p>
          <p className="text-base font-bold text-navy-900 font-mono">{receipt.receipt_no}</p>
        </div>

        {/* Details */}
        <div className="px-4 py-4 space-y-3">
          <ReceiptRow label="Customer" value={receipt.customer_name} />
          <ReceiptRow label="Mobile" value={receipt.mobile} isPhone />
          <ReceiptRow label="Loan No." value={receipt.loan_no} />
          {receipt.center_name && <ReceiptRow label="Center" value={receipt.center_name} />}
          <ReceiptRow label="Payment Date" value={format(new Date(receipt.payment_date), 'dd MMMM yyyy')} />
          <ReceiptRow label="Payment Mode" value={receipt.payment_mode?.toUpperCase()} />
          <ReceiptRow label="Payment Type" value={receipt.payment_type?.toUpperCase()} />
        </div>

        <div className="mx-4 border-t border-dashed border-slate-300" />

        {/* Amount section */}
        <div className="px-4 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">EMI Amount</span>
            <span className="text-sm font-semibold">₹ {Number(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {receipt.penalty_paid > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">Penalty</span>
              <span className="text-sm font-semibold text-red-600">₹ {Number(receipt.penalty_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex items-center justify-between bg-navy-900 text-white rounded-lg px-3 py-2.5 mt-2">
            <span className="font-semibold">Total Paid</span>
            <span className="text-lg font-bold">
              ₹ {(Number(receipt.amount) + Number(receipt.penalty_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="mx-4 border-t border-dashed border-slate-300" />

        {/* Footer */}
        <div className="px-4 py-4 text-center space-y-1">
          <p className="text-xs text-slate-500">Collected by: <span className="font-medium text-slate-700">{receipt.collected_by_name}</span></p>
          <p className="text-xs text-slate-400 mt-2">Thank you for your timely payment!</p>
          <p className="text-xs text-slate-400">This is a computer-generated receipt.</p>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, isPhone }: { label: string; value: string; isPhone?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      {isPhone
        ? <PhoneLink phone={value} className="text-sm font-medium" />
        : <span className="text-sm font-medium text-slate-800 text-right max-w-[60%]">{value}</span>
      }
    </div>
  );
}
