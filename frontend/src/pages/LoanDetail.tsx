import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle, Wallet, Download, Printer } from 'lucide-react';
import client from '../api/client';
import type { Loan } from '../types';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import { exportPDF } from '../utils/exportUtils';

function printRepaymentCard(loan: any) {
  const freq = (loan.emi_frequency as string).toUpperCase();
  const freqTamil: Record<string, string> = {
    MONTHLY: 'மாதாந்திர', WEEKLY: 'வார', DAILY: 'தினசரி',
  };

  const schedule: any[] = loan.schedule || [];
  const totalPrincipal = schedule.reduce((s: number, r: any) => s + (r.principal || 0), 0);
  const totalInterest  = schedule.reduce((s: number, r: any) => s + (r.interest  || 0), 0);
  const totalAmount    = totalPrincipal + totalInterest;

  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

  const rows = schedule.map((r: any) => `
    <tr>
      <td>${r.installment_no}</td>
      <td>${r.due_date || ''}</td>
      <td>${fmt(r.principal)}</td>
      <td>${fmt(r.interest)}</td>
      <td><strong>${fmt(r.emi_amount)}</strong></td>
      <td class="sign-cell"></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Repayment Card – ${loan.loan_no}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Noto Sans Tamil', Arial, sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
    padding: 10mm;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1a2c5b;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  .header img { width: 36px; height: 36px; object-fit: contain; }
  .header-text .name-ta { font-size: 12px; font-weight: 700; letter-spacing: 0.3px; }
  .header-text .name-en { font-size: 11px; font-weight: 600; letter-spacing: 1px; }
  .meta { margin-bottom: 8px; }
  .meta table { width: 100%; border-collapse: collapse; }
  .meta td { padding: 2px 4px; font-size: 11px; }
  .meta td:first-child { width: 38%; color: #444; }
  .meta td:last-child { font-weight: 600; border-bottom: 1px solid #555; width: 62%; }
  .loan-amount { text-align: right; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
  .card-title {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: 2px solid #1a2c5b;
    padding: 5px;
    margin-bottom: 0;
    background: #f0f4ff;
  }
  table.schedule {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  table.schedule th, table.schedule td {
    border: 1px solid #555;
    padding: 3px 4px;
    text-align: center;
  }
  table.schedule thead tr { background: #1a2c5b; color: #fff; }
  table.schedule thead th { font-size: 10px; letter-spacing: 0.3px; }
  table.schedule .sign-cell { width: 14%; min-height: 18px; }
  table.schedule tbody tr:nth-child(even) { background: #f8f8ff; }
  table.schedule tfoot tr { background: #e8edf7; font-weight: 700; }
  table.schedule tfoot td { font-size: 11px; }
  .loan-no { text-align: right; font-size: 10px; color: #666; margin-bottom: 4px; }
  @media print {
    body { padding: 6mm; }
    @page { size: A4 portrait; margin: 8mm; }
  }
</style>
</head>
<body>

<div class="loan-no">Loan No: <strong>${loan.loan_no}</strong></div>

<div class="header">
  <img src="/images/logo.png" onerror="this.style.display='none'" />
  <div class="header-text">
    <div class="name-ta">SPS குரூப் ஆஃப் பவுன்டேசன்</div>
    <div class="name-en">SPS GROUP OF FOUNDATION</div>
  </div>
</div>

<div class="meta">
  <table>
    <tr>
      <td>தேதி (Date)</td>
      <td>${loan.disbursement_date || loan.start_date || ''}</td>
    </tr>
    <tr>
      <td>உறுப்பினர் பெயர்</td>
      <td>${loan.customer_name || ''}</td>
    </tr>
    <tr>
      <td>மையத்தின் பெயர்</td>
      <td>${loan.center_name || ''}</td>
    </tr>
    <tr>
      <td>கடன் தொகை</td>
      <td>₹${fmt(loan.amount)} /-</td>
    </tr>
  </table>
</div>

<div class="card-title">
  REPAYMENT கடன் விபரம் (${freqTamil[freq] || freq} – ${freq})
</div>

<table class="schedule">
  <thead>
    <tr>
      <th style="width:7%">S.No.</th>
      <th style="width:16%">DATE</th>
      <th style="width:17%">PRINCIPAL<br/>அசல்</th>
      <th style="width:17%">INTEREST<br/>வட்டி</th>
      <th style="width:17%">TOTAL<br/>மொத்தம்</th>
      <th style="width:26%">SIGN.</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2" style="text-align:right; padding-right:6px;">மொத்தம் / Total</td>
      <td>${fmt(totalPrincipal)}</td>
      <td>${fmt(totalInterest)}</td>
      <td>${fmt(totalAmount)}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const { data: loan, isLoading } = useQuery<Loan>({
    queryKey: ['loan', id],
    queryFn: () => client.get(`/loans/${id}`).then(r => r.data),
  });

  const approve = useMutation({
    mutationFn: () => client.put(`/loans/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loan', id] }),
  });

  const reject = useMutation({
    mutationFn: () => client.put(`/loans/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loan', id] }),
  });

  if (isLoading) return <PageLoader />;
  if (!loan) return <div className="text-center py-12 text-slate-400">Loan not found.</div>;

  const progress = loan.total_payable ? Math.min(100, ((loan.total_paid || 0) / loan.total_payable) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:bg-white hover:text-navy-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-title">{loan.loan_no}</h1>
            <p className="text-sm text-slate-500">{loan.customer_name} • {loan.center_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={loan.status} />
          <button
            onClick={() => printRepaymentCard(loan)}
            className="btn-secondary text-xs py-1.5"
            title="Print Repayment Passbook"
          >
            <Printer className="w-3.5 h-3.5" /> Print Repayment Card
          </button>
          {isAdmin && loan.status === 'pending' && (
            <>
              <button onClick={() => approve.mutate()} disabled={approve.isPending} className="btn-primary">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => reject.mutate()} disabled={reject.isPending} className="btn-danger">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </>
          )}
          {loan.status === 'active' && (
            <button onClick={() => navigate(`/collections?loan_id=${loan.id}`)} className="btn-gold">
              <Wallet className="w-4 h-4" /> Collect Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Loan Amount', value: `₹${loan.amount?.toLocaleString()}`, color: 'text-navy-900' },
          { label: 'EMI Amount', value: `₹${loan.emi_amount?.toLocaleString()}`, color: 'text-navy-900' },
          { label: 'Total Paid', value: `₹${loan.total_paid?.toLocaleString() || 0}`, color: 'text-emerald-700' },
          { label: 'Outstanding', value: `₹${((loan.total_payable || 0) - (loan.total_paid || 0)).toLocaleString()}`, color: 'text-orange-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-navy-900">Repayment Progress</span>
          <span className="text-slate-500">{loan.paid_installments || 0} / {loan.total_installments} installments</span>
        </div>
        <div className="bg-slate-100 rounded-full h-3">
          <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>₹{loan.total_paid?.toLocaleString()} paid</span>
          <span>{progress.toFixed(1)}%</span>
          <span>₹{loan.total_payable?.toLocaleString()} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Loan info */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Loan Details</h3>
          <dl className="space-y-2.5 text-sm">
            {[
              ['Interest Rate', `${loan.interest_rate}% (${loan.interest_type})`],
              ['Frequency', loan.emi_frequency],
              ['Duration', `${loan.duration} ${loan.duration_unit}`],
              ['Disbursement Date', loan.disbursement_date || '—'],
              ['EMI Start Date', loan.start_date],
              ['End Date', loan.end_date || '—'],
              ['Total Payable', `₹${loan.total_payable?.toLocaleString()}`],
              ['Total Interest', `₹${loan.total_interest?.toLocaleString()}`],
              ['Processing Fee', `₹${loan.processing_fee || 0}`],
              ['Penalty/Day', `₹${loan.penalty_per_day || 0}`],
              ['Approved By', loan.approved_by_name || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-50 pb-2 last:border-0">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-navy-800 capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* EMI Schedule */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">EMI Schedule</h3>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="table-header sticky top-0">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Due Date</th>
                <th className="px-2 py-2 text-right">EMI</th>
                <th className="px-2 py-2 text-right">Paid</th>
                <th className="px-2 py-2">Status</th>
              </tr></thead>
              <tbody>
                {loan.schedule?.map(s => (
                  <tr key={s.id} className="table-row">
                    <td className="px-2 py-1.5 text-center">{s.installment_no}</td>
                    <td className="px-2 py-1.5">{s.due_date}</td>
                    <td className="px-2 py-1.5 text-right">₹{s.emi_amount?.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700">₹{s.paid_amount?.toLocaleString() || 0}</td>
                    <td className="px-2 py-1.5"><Badge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Collections */}
      {loan.collections && loan.collections.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy-900">Collection History</h3>
            <button
              className="btn-secondary text-xs py-1.5"
              onClick={() => exportPDF(`Loan Ledger ${loan.loan_no}`, [
                { header: 'Receipt', dataKey: 'receipt_no' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Mode', dataKey: 'payment_mode' },
                { header: 'Date', dataKey: 'payment_date' },
                { header: 'Type', dataKey: 'payment_type' },
                { header: 'Collected By', dataKey: 'collected_by_name' },
              ], loan.collections || [])}
            >
              <Download size={13} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left px-3 py-2">Receipt No</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Collected By</th>
              </tr></thead>
              <tbody>
                {loan.collections.map((c: any) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-3 py-2">
                      <Link to={`/receipt/${c.id}`} className="font-mono text-xs text-navy-700 hover:underline">{c.receipt_no}</Link>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">₹{c.amount?.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 capitalize">{c.payment_mode}</td>
                    <td className="px-3 py-2 text-xs">{c.payment_date}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-500">{c.collected_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
