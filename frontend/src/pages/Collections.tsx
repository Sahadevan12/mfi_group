import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, CheckCircle2, Save, Search, Printer, FileDown, Sheet,
  AlertTriangle, ChevronDown, Receipt, XCircle, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import client from '../api/client';
import type { Center, Group, Collection } from '../types';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import { PhoneLink } from '../components/ui/PhoneLink';

const today = new Date().toISOString().split('T')[0];

interface BillingRow {
  customer_id: string;
  customer_name: string;
  mobile: string;
  loan_id: string;
  loan_no: string;
  emi_amount: number;
  emi_frequency: string;
  penalty_per_day: number;
  schedule_id: string | null;
  due_date: string | null;
  due_amount: number | null;
  days_overdue: number;
  schedule_status: string | null;
  // local state
  selected: boolean;
  amount: string;
  penalty_paid: string;
  notes: string;
}

export default function Collections() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<'billing' | 'history'>('billing');

  // ── Billing tab state ──
  const [centerFilter, setCenterFilter] = useState('');
  const [groupId, setGroupId] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [globalMode, setGlobalMode] = useState('cash');
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [submitted, setSubmitted] = useState<{ count: number; total: number } | null>(null);
  const [billSearch, setBillSearch] = useState('');
  // Capture rows at submit time so the receipt can reference them after state resets
  const pendingRowsRef = useRef<BillingRow[]>([]);

  // ── History tab state ──
  const [historyDate, setHistoryDate] = useState(today);
  const [historySearch, setHistorySearch] = useState('');
  const [historyCenterId, setHistoryCenterId] = useState('');
  const [historyGroupId, setHistoryGroupId] = useState('');

  // ── Data fetches ──
  const { data: centers } = useQuery<Center[]>({
    queryKey: ['centers'],
    queryFn: () => client.get('/centers').then(r => r.data),
  });

  // For staff: auto-set centerFilter to their own center as soon as centers load
  useEffect(() => {
    if (!isAdmin && centers && !centerFilter) {
      const staffCenter = centers.find(c => c.staff_id === user?.id);
      if (staffCenter) setCenterFilter(staffCenter.id);
    }
  }, [centers, isAdmin]);

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups', centerFilter],
    queryFn: () => client.get('/groups', { params: { center_id: centerFilter } }).then(r => r.data),
    enabled: !!centerFilter,
  });

  const { data: sheetData, isLoading: sheetLoading, refetch: refetchSheet } = useQuery<any[]>({
    queryKey: ['group-sheet', groupId],
    queryFn: () => client.get('/collections/group-sheet', { params: { group_id: groupId } }).then(r => r.data),
    enabled: !!groupId,
  });

  // Initialise billing rows whenever group-sheet data arrives / refreshes
  useEffect(() => {
    if (!sheetData) return;
    setRows(sheetData.map((r: any) => ({
      ...r,
      selected: false,
      amount: String(r.due_amount || r.emi_amount || ''),
      penalty_paid: r.days_overdue > 0 ? String(Math.round(r.days_overdue * (r.penalty_per_day || 0))) : '0',
      notes: '',
    })));
    setSubmitted(null);
  }, [sheetData]);

  // Groups available in the history filter (all groups visible to this user, optionally filtered by center)
  const { data: historyGroups } = useQuery<Group[]>({
    queryKey: ['groups-history', historyCenterId],
    queryFn: () =>
      client.get('/groups', { params: historyCenterId ? { center_id: historyCenterId } : {} })
        .then(r => r.data),
    enabled: tab === 'history',
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['collections-history', historyDate, historyGroupId, historyCenterId],
    queryFn: () => client.get('/collections', {
      params: {
        ...(historyDate     ? { date: historyDate }           : {}),
        ...(historyGroupId  ? { group_id: historyGroupId }    : {}),
        ...(historyCenterId && !historyGroupId ? { center_id: historyCenterId } : {}),
        limit: 200,
      },
    }).then(r => r.data),
    enabled: tab === 'history',
  });

  // ── Receipt generator ──
  // Format "2026-05-20" → "20 May 2026"
  const fmtDate = (d: string) => {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const dt = new Date(d);
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const printGroupReceipt = (
    rows: BillingRow[],
    serverResults: { customer_id: string; receipt_no: string }[],
    groupName: string,
    date: string,
    mode: string,
    staffName: string,
  ) => {
    const modeLabel: Record<string, string> = {
      cash: 'CASH', upi: 'UPI', bank_transfer: 'BANK TRANSFER', cheque: 'CHEQUE',
    };
    const batchNo = `GRP${date.replace(/-/g, '')}${Date.now().toString().slice(-4)}`;
    const grandTotal   = rows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
    const grandPenalty = rows.reduce((s, r) => s + parseFloat(r.penalty_paid || '0'), 0);
    const collectorMobile = user?.phone || '—';

    // Customer rows table
    const tableRows = rows.map((r, i) => {
      const amt = parseFloat(r.amount || '0');
      const pen = parseFloat(r.penalty_paid || '0');
      return `<tr>
        <td style="text-align:center;color:#94a3b8">${i + 1}</td>
        <td><strong>${r.customer_name}</strong><br/><span style="font-size:10px;color:#94a3b8">${r.mobile || ''}</span></td>
        <td style="font-family:monospace;font-size:11px;color:#475569">${r.loan_no || '—'}</td>
        <td style="text-align:right;font-weight:600">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        ${grandPenalty > 0 ? `<td style="text-align:right;color:#dc2626;font-size:11px">${pen > 0 ? '₹ ' + pen.toLocaleString('en-IN') : '—'}</td>` : ''}
      </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Group Collection Receipt – ${groupName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:24px 16px}
.receipt{background:#fff;border-radius:14px;overflow:hidden;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.13)}
/* Header */
.hdr{background:#0f1f3d;color:#fff;text-align:center;padding:20px 16px}
.org{font-size:19px;font-weight:800;letter-spacing:.2px}
.sub{font-size:11px;color:#94a3b8;margin-top:3px}
.confirmed{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:#34d399}
.confirmed svg{flex-shrink:0}
/* Batch banner */
.batch{background:#fefce8;border-bottom:1px solid #fde68a;text-align:center;padding:10px 16px}
.batch-lbl{font-size:11px;color:#94a3b8}
.batch-no{font-size:15px;font-weight:800;color:#1e293b;font-family:monospace;letter-spacing:.5px;margin-top:2px}
/* Details */
.details{padding:14px 16px}
.row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f8fafc}
.row:last-child{border-bottom:none}
.lbl{font-size:12px;color:#64748b}
.val{font-size:13px;font-weight:600;color:#1e293b;text-align:right;max-width:60%}
/* Divider */
.div{border:none;border-top:1px dashed #cbd5e1;margin:0 16px}
/* Amount */
.amt{padding:14px 16px}
.total-bar{display:flex;justify-content:space-between;align-items:center;background:#0f1f3d;color:#fff;border-radius:9px;padding:13px 16px;margin-top:4px}
.total-bar .tl{font-size:14px;font-weight:600}
.total-bar .tv{font-size:19px;font-weight:800}
/* Footer */
.foot{padding:12px 16px 20px;text-align:center;border-top:1px dashed #cbd5e1;margin:0 16px}
.foot p{font-size:11px;color:#94a3b8;line-height:1.9}
.foot .by{font-size:12px;color:#475569}
.foot strong{color:#334155}
@media print{
  body{background:#fff;padding:0;display:block}
  .receipt{box-shadow:none;border-radius:0;max-width:100%}
  @page{size:A5 portrait;margin:8mm}
}
</style></head><body>
<div class="receipt">

  <div class="hdr">
    <div class="org">SPS Group of Foundation</div>
    <div class="sub">Microfinance Management</div>
    <div class="confirmed">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Payment Confirmed
    </div>
  </div>

  <div class="batch">
    <div class="batch-lbl">Batch Number</div>
    <div class="batch-no">${batchNo}</div>
  </div>

  <div class="details">
    <div class="row"><span class="lbl">No. of Members</span><span class="val">${rows.length}</span></div>
    <div class="row"><span class="lbl">Group</span><span class="val">${groupName}</span></div>
    <div class="row"><span class="lbl">Mobile</span><span class="val">${collectorMobile}</span></div>
    <div class="row"><span class="lbl">Collected By</span><span class="val">${staffName}</span></div>
    <div class="row"><span class="lbl">Payment Date</span><span class="val">${fmtDate(date)}</span></div>
    <div class="row"><span class="lbl">Payment Mode</span><span class="val">${modeLabel[mode] || mode.toUpperCase()}</span></div>
  </div>

  <hr class="div"/>

  <div class="amt">
    <div class="total-bar">
      <span class="tl">Total Paid</span>
      <span class="tv">₹ ${(grandTotal + grandPenalty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>
  </div>

  <div class="foot">
    <p class="by">Collected by: <strong>${staffName}</strong></p>
    <p>Thank you for your timely payment!</p>
    <p>This is a computer-generated receipt.</p>
  </div>

</div>
</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      // Resize window to receipt width so print preview matches content
      const h = win.document.body.scrollHeight + 20;
      win.resizeTo(320, Math.min(h, 800));
      win.print();
    }, 400);
  };

  const bulkCollect = useMutation({
    mutationFn: (cols: any[]) => client.post('/collections/bulk', { collections: cols }),
    onSuccess: (data, vars) => {
      const capturedRows = pendingRowsRef.current;
      const serverResults: { customer_id: string; receipt_no: string }[] =
        data?.data?.results || [];
      const total = vars.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0);
      setSubmitted({ count: vars.length, total });
      // Print individual receipt cards matching screenshot style
      printGroupReceipt(
        capturedRows,
        serverResults,
        selectedGroup?.name || 'Group',
        paymentDate,
        globalMode,
        user?.name || 'Staff',
      );
      qc.invalidateQueries({ queryKey: ['group-sheet', groupId] });
      qc.invalidateQueries({ queryKey: ['collections-history'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      refetchSheet();
    },
  });

  // ── Row helpers ──
  const updateRow = (customerId: string, patch: Partial<BillingRow>) =>
    setRows(rs => rs.map(r => r.customer_id === customerId ? { ...r, ...patch } : r));

  const markAll = (selected: boolean) =>
    setRows(rs => rs.map(r => r.loan_id ? { ...r, selected } : r));

  const selectedRows = rows.filter(r => r.selected && r.loan_id);
  const totalSelected = selectedRows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  const totalPenalty = selectedRows.reduce((s, r) => s + parseFloat(r.penalty_paid || '0'), 0);

  const filteredRows = useMemo(() =>
    rows.filter(r => !billSearch || r.customer_name?.toLowerCase().includes(billSearch.toLowerCase())),
    [rows, billSearch]);

  const selectedGroup = groups?.find(g => g.id === groupId);

  // ── Submit ──
  const handleSubmit = () => {
    if (selectedRows.length === 0) return;
    // Snapshot for the receipt (state might change before onSuccess fires)
    pendingRowsRef.current = [...selectedRows];
    const payload = selectedRows.map(r => ({
      loan_id: r.loan_id,
      customer_id: r.customer_id,
      schedule_id: r.schedule_id || null,
      amount: parseFloat(r.amount),
      penalty_paid: parseFloat(r.penalty_paid || '0'),
      payment_date: paymentDate,
      payment_mode: globalMode,
      notes: r.notes,
    }));
    bulkCollect.mutate(payload);
  };

  // ── History exports ──
  const filteredHistory = (history?.collections || []).filter((c: Collection) =>
    !historySearch ||
    c.customer_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.receipt_no?.toLowerCase().includes(historySearch.toLowerCase())
  );

  const handlePrint = () => {
    const cols = filteredHistory;
    const total = cols.reduce((s: number, c: Collection) => s + (c.amount || 0), 0);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Collections – ${historyDate}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;font-size:13px}
      .hdr{display:flex;justify-content:space-between;margin-bottom:18px}.org{font-size:18px;font-weight:700;color:#1e3a5f}
      .meta{font-size:12px;color:#666;margin-top:4px}.right{text-align:right;font-size:12px;color:#555}
      table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb}.sub{color:#888;font-size:11px}.amt{font-weight:600;color:#065f46}
      .total td{background:#e0f2fe;font-weight:700;border-top:2px solid #1e3a5f}@media print{@page{margin:15mm}}</style>
      </head><body>
      <div class="hdr"><div><div class="org">SPS Group of Foundation</div>
      <div class="meta">Collection Report | ${historyDate} | ${cols.length} transactions</div></div>
      <div class="right">Total<br/><strong style="font-size:16px;color:#1e3a5f">₹${total.toLocaleString('en-IN')}</strong></div></div>
      <table><thead><tr><th>Receipt</th><th>Customer</th><th>Group</th><th>Amount</th><th>Mode</th><th>Collected By</th><th>Date</th></tr></thead>
      <tbody>${cols.map((c: Collection) => `<tr><td>${c.receipt_no}</td><td>${c.customer_name}<br/><span class="sub">${c.loan_no}</span></td>
      <td>${c.group_name || '—'}</td><td class="amt">₹${(c.amount || 0).toLocaleString('en-IN')}</td><td>${c.payment_mode}</td><td>${c.collected_by_name}</td><td>${c.payment_date}</td></tr>`).join('')}
      <tr class="total"><td colspan="3">TOTAL</td><td>₹${total.toLocaleString('en-IN')}</td><td colspan="3">${cols.length} records</td></tr>
      </tbody></table></body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  };

  const handlePDF = () => {
    const cols = filteredHistory;
    const total = cols.reduce((s: number, c: Collection) => s + (c.amount || 0), 0);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.setTextColor(30, 58, 95);
    doc.text('SPS Group of Foundation', 14, 16);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Collection Report  |  ${historyDate}  |  Total: Rs.${total.toLocaleString('en-IN')}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [['Receipt', 'Customer', 'Group', 'Loan No', 'Amount', 'Mode', 'Collected By', 'Date']],
      body: cols.map((c: Collection) => [c.receipt_no, c.customer_name, c.group_name || '—', c.loan_no, `Rs.${c.amount?.toLocaleString()}`, c.payment_mode, c.collected_by_name, c.payment_date]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [30, 58, 95] },
    });
    doc.save(`collections-${historyDate}.pdf`);
  };

  const handleExcel = () => {
    const cols = filteredHistory;
    const total = cols.reduce((s: number, c: Collection) => s + (c.amount || 0), 0);
    const ws = XLSX.utils.aoa_to_sheet([
      ['SPS Group of Foundation — Collection Report'],
      [`Date: ${historyDate}`, '', `Total: Rs.${total.toLocaleString('en-IN')}`],
      [],
      ['Receipt No', 'Customer', 'Group', 'Loan No', 'Amount', 'Mode', 'Collected By', 'Date'],
      ...cols.map((c: Collection) => [c.receipt_no, c.customer_name, c.group_name || '—', c.loan_no, c.amount, c.payment_mode, c.collected_by_name, c.payment_date]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Collections');
    XLSX.writeFile(wb, `collections-${historyDate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="page-title">Group Billing</h1>
        <p className="text-sm text-slate-500">Collect payments group-wise from all members at once</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('billing')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'billing' ? 'bg-white shadow text-navy-800' : 'text-slate-500 hover:text-slate-700'}`}>
          <Users size={14} className="inline mr-1.5" />Group Billing
        </button>
        <button onClick={() => setTab('history')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-white shadow text-navy-800' : 'text-slate-500 hover:text-slate-700'}`}>
          <Receipt size={14} className="inline mr-1.5" />History
        </button>
      </div>

      {/* ═══════════════ BILLING TAB ═══════════════ */}
      {tab === 'billing' && (
        <div className="space-y-4">

          {/* Step 1 — Selectors */}
          <div className="card">
            <p className="section-title mb-3">Select Group & Date</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Center */}
              <div>
                <label className="label">Center</label>
                {isAdmin ? (
                  <select className="input" value={centerFilter}
                    onChange={e => { setCenterFilter(e.target.value); setGroupId(''); setRows([]); setSubmitted(null); }}>
                    <option value="">Select center</option>
                    {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <input className="input bg-slate-50" readOnly
                    value={centers?.find(c => c.staff_id === user?.id)?.name || 'My Center'} />
                )}
              </div>

              {/* Group */}
              <div>
                <label className="label">Group</label>
                <select className="input" value={groupId}
                  onChange={e => { setGroupId(e.target.value); setRows([]); setSubmitted(null); }}
                  disabled={!centerFilter && isAdmin}>
                  <option value="">Select group</option>
                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="label">Collection Date</label>
                <input type="date" className="input" value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)} />
              </div>

              {/* Mode */}
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={globalMode} onChange={e => setGlobalMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 2 — Billing Sheet */}
          {!groupId && (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Select a center and group to load the billing sheet</p>
            </div>
          )}

          {groupId && sheetLoading && <PageLoader />}

          {groupId && !sheetLoading && rows.length > 0 && (
            <div className="space-y-3">
              {/* Success Banner */}
              {submitted && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-emerald-700">
                        {submitted.count} collections saved — ₹{submitted.total.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-emerald-600">Billing sheet refreshed. Select members to collect again.</p>
                    </div>
                  </div>
                  <button onClick={() => setSubmitted(null)} className="text-emerald-400 hover:text-emerald-600">
                    <XCircle size={18} />
                  </button>
                </div>
              )}

              {/* Sheet header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-navy-900 text-base">{selectedGroup?.name}</h2>
                  <p className="text-xs text-slate-500">{rows.length} members · {rows.filter(r => r.loan_id).length} active loans</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="input pl-9 w-48 text-sm" placeholder="Search member..."
                      value={billSearch} onChange={e => setBillSearch(e.target.value)} />
                  </div>
                  <button onClick={() => markAll(true)}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Mark All
                  </button>
                  <button onClick={() => markAll(false)}
                    className="btn-secondary text-xs py-2 px-3 text-red-500 flex items-center gap-1.5">
                    <XCircle size={13} /> Clear
                  </button>
                </div>
              </div>

              {/* Billing Table */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-3 py-3 w-10">
                          <input type="checkbox"
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            checked={filteredRows.filter(r => r.loan_id).every(r => r.selected)}
                            onChange={e => markAll(e.target.checked)} />
                        </th>
                        <th className="px-3 py-3 text-left">Member</th>
                        <th className="px-3 py-3 text-left hidden md:table-cell">Loan No</th>
                        <th className="px-3 py-3 text-right">EMI Due</th>
                        <th className="px-3 py-3 text-center hidden sm:table-cell">Status</th>
                        <th className="px-3 py-3 text-right w-36">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r, idx) => (
                        <tr key={r.customer_id}
                          className={`border-b border-slate-100 transition-colors ${
                            r.selected ? 'bg-emerald-50' :
                            r.days_overdue > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50'
                          }`}>
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center">
                            {r.loan_id ? (
                              <input type="checkbox"
                                className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                checked={r.selected}
                                onChange={e => updateRow(r.customer_id, { selected: e.target.checked })} />
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>

                          {/* Member */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                r.days_overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-navy-100 text-navy-700'
                              }`}>
                                {r.customer_name?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-navy-900 leading-tight">{r.customer_name}</p>
                                <PhoneLink phone={r.mobile} className="text-xs text-slate-400" iconSize={10} />
                              </div>
                            </div>
                          </td>

                          {/* Loan No */}
                          <td className="px-3 py-3 hidden md:table-cell">
                            {r.loan_id ? (
                              <button onClick={() => navigate(`/loans/${r.loan_id}`)}
                                className="text-xs font-mono text-navy-600 hover:underline">
                                {r.loan_no}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          {/* EMI Due */}
                          <td className="px-3 py-3 text-right">
                            {r.loan_id ? (
                              <div>
                                <p className="font-semibold text-navy-900">
                                  ₹{(r.due_amount || r.emi_amount)?.toLocaleString('en-IN')}
                                </p>
                                {r.due_date && (
                                  <p className="text-[10px] text-slate-400">{r.due_date}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">No loan</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            {!r.loan_id ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs">
                                No loan
                              </span>
                            ) : r.days_overdue > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                <AlertTriangle size={10} />{r.days_overdue}d overdue
                              </span>
                            ) : r.days_overdue === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                <Clock size={10} />Due today
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                Upcoming
                              </span>
                            )}
                          </td>

                          {/* Amount input */}
                          <td className="px-3 py-3">
                            {r.selected && r.loan_id ? (
                              <input
                                type="number"
                                className="input text-right font-semibold py-1.5 text-sm w-full"
                                value={r.amount}
                                onChange={e => updateRow(r.customer_id, { amount: e.target.value })}
                                onClick={e => (e.target as HTMLInputElement).select()}
                              />
                            ) : (
                              <div className="text-right">
                                {r.loan_id ? (
                                  <span className="text-sm text-slate-400">
                                    ₹{(r.due_amount || r.emi_amount)?.toLocaleString('en-IN')}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredRows.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No members found</p>
                    </div>
                  )}
                </div>

                {/* Table footer summary */}
                {selectedRows.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-navy-50 border-t border-navy-100">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600">
                        <strong className="text-navy-900">{selectedRows.length}</strong> / {rows.filter(r => r.loan_id).length} selected
                      </span>
                      {totalPenalty > 0 && (
                        <span className="text-xs text-red-600">
                          + ₹{totalPenalty.toLocaleString('en-IN')} penalty
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-navy-900 text-base">
                      Total: ₹{totalSelected.toLocaleString('en-IN')}
                    </div>
                  </div>
                )}
              </div>

              {/* Overdue penalty note */}
              {rows.some(r => r.days_overdue > 0 && r.selected) && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Overdue amounts include principal + accrued penalty. Adjust if needed.
                </p>
              )}
            </div>
          )}

          {groupId && !sheetLoading && rows.length === 0 && !sheetLoading && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No active loan members in this group.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ HISTORY TAB ═══════════════ */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* ── Filters row ── */}
          <div className="card py-3 px-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">

              {/* Date */}
              <div className="flex flex-col gap-1">
                <label className="label mb-0">Date</label>
                <div className="relative">
                  <input type="date" className="input w-40 pr-7" value={historyDate}
                    onChange={e => setHistoryDate(e.target.value)} />
                  {historyDate && (
                    <button onClick={() => setHistoryDate('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Center (admin only) */}
              {isAdmin && (
                <div className="flex flex-col gap-1">
                  <label className="label mb-0">Center</label>
                  <select className="input w-40" value={historyCenterId}
                    onChange={e => { setHistoryCenterId(e.target.value); setHistoryGroupId(''); }}>
                    <option value="">All Centers</option>
                    {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Group */}
              <div className="flex flex-col gap-1">
                <label className="label mb-0">Group</label>
                <select className="input w-44" value={historyGroupId}
                  onChange={e => setHistoryGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {historyGroups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Customer search */}
              <div className="flex flex-col gap-1">
                <label className="label mb-0">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input className="input pl-9 w-48" placeholder="Customer / receipt…"
                    value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                </div>
              </div>

              {/* Active filter chips */}
              <div className="flex items-end gap-1.5 flex-wrap pb-0.5">
                {historyGroupId && (
                  <span className="inline-flex items-center gap-1 bg-navy-100 text-navy-700 text-xs px-2 py-1 rounded-full">
                    {historyGroups?.find(g => g.id === historyGroupId)?.name}
                    <button onClick={() => setHistoryGroupId('')} className="hover:text-red-600 ml-0.5">×</button>
                  </span>
                )}
                {historyDate && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">
                    {historyDate}
                  </span>
                )}
              </div>
            </div>

            {/* Results count + export buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                <strong className="text-navy-900">{filteredHistory.length}</strong> record{filteredHistory.length !== 1 ? 's' : ''}
                {historyGroupId && <span> · {historyGroups?.find(g => g.id === historyGroupId)?.name}</span>}
                {historyDate && <span> · {historyDate}</span>}
              </p>
              <div className="flex gap-2">
                <button onClick={handlePrint} disabled={!filteredHistory.length}
                  className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40 flex items-center gap-1.5">
                  <Printer size={14} /> Print
                </button>
                <button onClick={handlePDF} disabled={!filteredHistory.length}
                  className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40 flex items-center gap-1.5">
                  <FileDown size={14} /> PDF
                </button>
                <button onClick={handleExcel} disabled={!filteredHistory.length}
                  className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40 flex items-center gap-1.5">
                  <Sheet size={14} /> Excel
                </button>
              </div>
            </div>
          </div>

          {historyLoading ? <PageLoader /> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="text-left px-4 py-3">Receipt</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Group</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Mode</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Collected By</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Print</th>
                  </tr></thead>
                  <tbody>
                    {filteredHistory.map((c: Collection) => (
                      <tr key={c.id} className="table-row">
                        <td className="px-4 py-3 font-mono text-xs text-navy-700">{c.receipt_no}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy-900">{c.customer_name}</p>
                          <p className="text-xs text-slate-400">{c.loan_no}</p>
                          <p className="text-xs text-slate-400 lg:hidden">{c.group_name}</p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs font-medium bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">
                            {c.group_name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                          ₹{c.amount?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs capitalize text-slate-500">{c.payment_mode}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">{c.collected_by_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.payment_date}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => navigate(`/receipt/${c.id}`)}
                            title="Print receipt"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-navy-700 hover:bg-navy-50">
                            <Printer size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    {historySearch ? `No results for "${historySearch}"` : 'No collections on this date.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STICKY SUBMIT ═══════════════ */}
      {tab === 'billing' && selectedRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl px-4 pb-4 pointer-events-auto">
            <button
              onClick={handleSubmit}
              disabled={bulkCollect.isPending}
              className="w-full btn-primary py-4 text-base shadow-2xl justify-center gap-3 rounded-2xl"
            >
              {bulkCollect.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save {selectedRows.length} Collections
                  <span className="font-normal opacity-80">·</span>
                  ₹{totalSelected.toLocaleString('en-IN')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Bottom padding for sticky button */}
      {tab === 'billing' && selectedRows.length > 0 && <div className="h-20" />}
    </div>
  );
}
