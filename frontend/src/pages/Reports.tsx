import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import client from '../api/client';
import { PageLoader } from '../components/ui/Spinner';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportPDF, exportExcel } from '../utils/exportUtils';

const today = new Date().toISOString().split('T')[0];
const monthStart = today.substring(0, 7) + '-01';

// Sunday of current week
function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'pending' | 'defaulters' | 'center' | 'group' | 'agent' | 'pl' | 'cashbook';

function ExportBar({ onPDF, onExcel }: { onPDF: () => void; onExcel: () => void }) {
  return (
    <div className="flex gap-2 justify-end">
      <button className="btn-secondary text-xs py-1.5 px-3" onClick={onPDF}><FileText size={13} /> Export PDF</button>
      <button className="btn-secondary text-xs py-1.5 px-3" onClick={onExcel}><FileSpreadsheet size={13} /> Export Excel</button>
    </div>
  );
}

function DateRangeFilter({ startDate, endDate, onStart, onEnd }: { startDate: string; endDate: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <div className="flex gap-3 flex-wrap">
      <div><label className="label">From</label><input type="date" className="input" value={startDate} onChange={e => onStart(e.target.value)} /></div>
      <div><label className="label">To</label><input type="date" className="input" value={endDate} onChange={e => onEnd(e.target.value)} /></div>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [date, setDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [month, setMonth] = useState(today.substring(0, 7));
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);

  const dailyReport = useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => client.get('/reports/daily-collection', { params: { date } }).then(r => r.data),
    enabled: tab === 'daily',
  });

  const weeklyReport = useQuery({
    queryKey: ['report-weekly', weekStart],
    queryFn: () => client.get('/reports/weekly-collection', { params: { week_start: weekStart } }).then(r => r.data),
    enabled: tab === 'weekly',
  });

  const monthlyReport = useQuery({
    queryKey: ['report-monthly', month],
    queryFn: () => client.get('/reports/monthly-collection', {
      params: { month: month.split('-')[1], year: month.split('-')[0] }
    }).then(r => r.data),
    enabled: tab === 'monthly',
  });

  const pendingReport = useQuery({
    queryKey: ['report-pending'],
    queryFn: () => client.get('/reports/pending-dues').then(r => r.data),
    enabled: tab === 'pending',
  });

  const defaultersReport = useQuery({
    queryKey: ['report-defaulters'],
    queryFn: () => client.get('/reports/defaulters').then(r => r.data),
    enabled: tab === 'defaulters',
  });

  const centerReport = useQuery({
    queryKey: ['report-center', startDate, endDate],
    queryFn: () => client.get('/reports/center-wise', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
    enabled: tab === 'center',
  });

  const groupReport = useQuery({
    queryKey: ['report-group', startDate, endDate],
    queryFn: () => client.get('/reports/group-wise', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
    enabled: tab === 'group',
  });

  const agentReport = useQuery({
    queryKey: ['report-agent', startDate, endDate],
    queryFn: () => client.get('/reports/agent-wise', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
    enabled: tab === 'agent',
  });

  const plReport = useQuery({
    queryKey: ['report-pl', startDate, endDate],
    queryFn: () => client.get('/reports/profit-loss', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
    enabled: tab === 'pl',
  });

  const cashbook = useQuery({
    queryKey: ['report-cashbook', startDate, endDate],
    queryFn: () => client.get('/reports/cashbook', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
    enabled: tab === 'cashbook',
  });

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'pending', label: 'Pending Dues' },
    { key: 'defaulters', label: 'Defaulters' },
    { key: 'center', label: 'Center-wise' },
    { key: 'group', label: 'Group-wise' },
    { key: 'agent', label: 'Agent-wise' },
    { key: 'pl', label: 'Profit & Loss' },
    { key: 'cashbook', label: 'Cash Book' },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-slate-500">Financial reports & analytics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key ? 'border-navy-800 text-navy-800 bg-navy-50' : 'border-transparent text-slate-500 hover:text-navy-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily Report */}
      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
            <ExportBar
              onPDF={() => exportPDF('Daily Collection Report', [
                { header: 'Receipt', dataKey: 'receipt_no' },
                { header: 'Customer', dataKey: 'customer_name' },
                { header: 'Loan No', dataKey: 'loan_no' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Mode', dataKey: 'payment_mode' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Collected By', dataKey: 'collected_by_name' },
              ], dailyReport.data?.details || [], `Daily_${date}`)}
              onExcel={() => exportExcel('Daily Collection', [
                { header: 'Receipt', dataKey: 'receipt_no' },
                { header: 'Customer', dataKey: 'customer_name' },
                { header: 'Loan No', dataKey: 'loan_no' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Mode', dataKey: 'payment_mode' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Collected By', dataKey: 'collected_by_name' },
              ], dailyReport.data?.details || [], `Daily_${date}`)}
            />
          </div>
          {dailyReport.isLoading ? <PageLoader /> : dailyReport.data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Amount', value: `₹${(dailyReport.data.summary?.total_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Transactions', value: dailyReport.data.summary?.total_transactions || 0 },
                  { label: 'Customers Paid', value: dailyReport.data.summary?.customers_paid || 0 },
                  { label: 'Penalty Collected', value: `₹${(dailyReport.data.summary?.total_penalty || 0).toLocaleString('en-IN')}` },
                ].map(({ label, value }) => (
                  <div key={label} className="card"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-navy-900 mt-1">{value}</p></div>
                ))}
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-navy-800">Collection Details — {date}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="table-header">
                      <th className="text-left px-4 py-2">Receipt</th>
                      <th className="text-left px-4 py-2">Customer</th>
                      <th className="text-right px-4 py-2">Amount</th>
                      <th className="text-left px-4 py-2 hidden sm:table-cell">Mode</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Center</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">By</th>
                    </tr></thead>
                    <tbody>
                      {dailyReport.data.details?.map((d: any) => (
                        <tr key={d.receipt_no} className="table-row">
                          <td className="px-4 py-2 font-mono text-xs">{d.receipt_no}</td>
                          <td className="px-4 py-2 font-medium">{d.customer_name}</td>
                          <td className="px-4 py-2 text-right text-emerald-700 font-semibold">₹{d.amount?.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2 hidden sm:table-cell text-xs text-slate-500 capitalize">{d.payment_mode}</td>
                          <td className="px-4 py-2 hidden md:table-cell text-xs">{d.center_name}</td>
                          <td className="px-4 py-2 hidden md:table-cell text-xs">{d.collected_by_name}</td>
                        </tr>
                      ))}
                      {(!dailyReport.data.details?.length) && (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">No collections on this date</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Weekly Report */}
      {tab === 'weekly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <label className="label">Week Starting (Sunday)</label>
              <input type="date" className="input w-44" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            </div>
            <ExportBar
              onPDF={() => exportPDF('Weekly Collection Report', [
                { header: 'Receipt', dataKey: 'receipt_no' },
                { header: 'Date', dataKey: 'payment_date' },
                { header: 'Customer', dataKey: 'customer_name' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Group', dataKey: 'group_name' },
              ], weeklyReport.data?.details || [])}
              onExcel={() => exportExcel('Weekly Collection', [
                { header: 'Receipt', dataKey: 'receipt_no' },
                { header: 'Date', dataKey: 'payment_date' },
                { header: 'Customer', dataKey: 'customer_name' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Group', dataKey: 'group_name' },
              ], weeklyReport.data?.details || [])}
            />
          </div>
          {weeklyReport.isLoading ? <PageLoader /> : weeklyReport.data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card"><p className="text-xs text-slate-500">Total Amount</p><p className="text-xl font-bold text-navy-900">₹{(weeklyReport.data.summary?.total_amount || 0).toLocaleString('en-IN')}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Transactions</p><p className="text-xl font-bold text-navy-900">{weeklyReport.data.summary?.total_transactions || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Customers Paid</p><p className="text-xl font-bold text-navy-900">{weeklyReport.data.summary?.customers_paid || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Period</p><p className="text-sm font-semibold text-navy-900">{weeklyReport.data.from} — {weeklyReport.data.to}</p></div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-navy-900 mb-4">Daily Trend (This Week)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyReport.data.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="payment_date" tick={{ fontSize: 10 }} tickFormatter={d => d.split('-')[2]} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Amount']} />
                    <Bar dataKey="amount" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">By Center</div>
                  <table className="w-full text-sm">
                    <thead><tr className="table-header"><th className="px-4 py-2 text-left">Center</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Txns</th></tr></thead>
                    <tbody>
                      {(weeklyReport.data.byCenter || []).map((c: any) => (
                        <tr key={c.center_name} className="table-row">
                          <td className="px-4 py-2">{c.center_name || 'N/A'}</td>
                          <td className="px-4 py-2 text-right text-emerald-700 font-semibold">₹{c.amount?.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2 text-right">{c.transactions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">By Group</div>
                  <table className="w-full text-sm">
                    <thead><tr className="table-header"><th className="px-4 py-2 text-left">Group</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Txns</th></tr></thead>
                    <tbody>
                      {(weeklyReport.data.byGroup || []).map((g: any) => (
                        <tr key={g.group_name} className="table-row">
                          <td className="px-4 py-2">{g.group_name || 'N/A'}</td>
                          <td className="px-4 py-2 text-right text-emerald-700 font-semibold">₹{g.amount?.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2 text-right">{g.transactions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Monthly Report */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <input type="month" className="input w-44" value={month} onChange={e => setMonth(e.target.value)} />
            <ExportBar
              onPDF={() => exportPDF('Monthly Collection', [
                { header: 'Date', dataKey: 'payment_date' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Transactions', dataKey: 'transactions' },
              ], monthlyReport.data?.daily || [])}
              onExcel={() => exportExcel('Monthly Collection', [
                { header: 'Date', dataKey: 'payment_date' },
                { header: 'Amount', dataKey: 'amount' },
                { header: 'Transactions', dataKey: 'transactions' },
              ], monthlyReport.data?.daily || [])}
            />
          </div>
          {monthlyReport.isLoading ? <PageLoader /> : monthlyReport.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="card"><p className="text-xs text-slate-500">Total Amount</p><p className="text-xl font-bold text-navy-900">₹{(monthlyReport.data.summary?.total_amount || 0).toLocaleString('en-IN')}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Transactions</p><p className="text-xl font-bold text-navy-900">{monthlyReport.data.summary?.transactions || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Unique Customers</p><p className="text-xl font-bold text-navy-900">{monthlyReport.data.summary?.unique_customers || 0}</p></div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-navy-900 mb-4">Daily Collection Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyReport.data.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="payment_date" tick={{ fontSize: 10 }} tickFormatter={d => d.split('-')[2]} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Amount']} />
                    <Bar dataKey="amount" fill="#1e3a5f" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pending Dues */}
      {tab === 'pending' && (
        <div className="space-y-4">
          <ExportBar
            onPDF={() => exportPDF('Pending Dues Report', [
              { header: 'Customer', dataKey: 'customer_name' },
              { header: 'Mobile', dataKey: 'mobile' },
              { header: 'Loan No', dataKey: 'loan_no' },
              { header: 'Pending Amount', dataKey: 'pending_amount' },
              { header: 'Installments', dataKey: 'pending_installments' },
              { header: 'Days Overdue', dataKey: 'max_days_overdue' },
              { header: 'Center', dataKey: 'center_name' },
            ], pendingReport.data?.dues || [])}
            onExcel={() => exportExcel('Pending Dues', [
              { header: 'Customer', dataKey: 'customer_name' },
              { header: 'Mobile', dataKey: 'mobile' },
              { header: 'Loan No', dataKey: 'loan_no' },
              { header: 'Pending Amount', dataKey: 'pending_amount' },
              { header: 'Installments', dataKey: 'pending_installments' },
              { header: 'Days Overdue', dataKey: 'max_days_overdue' },
              { header: 'Center', dataKey: 'center_name' },
            ], pendingReport.data?.dues || [])}
          />
          {pendingReport.isLoading ? <PageLoader /> : pendingReport.data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-xs text-slate-500">Total Pending</p><p className="text-xl font-bold text-orange-600">₹{(pendingReport.data.totalPending || 0).toLocaleString('en-IN')}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Loans Affected</p><p className="text-xl font-bold text-navy-900">{pendingReport.data.count || 0}</p></div>
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="table-header">
                      <th className="text-left px-4 py-2">Customer</th>
                      <th className="text-left px-4 py-2">Loan No</th>
                      <th className="text-right px-4 py-2">Pending Amount</th>
                      <th className="text-right px-4 py-2 hidden sm:table-cell">Installments</th>
                      <th className="text-right px-4 py-2 hidden md:table-cell">Days Overdue</th>
                    </tr></thead>
                    <tbody>
                      {pendingReport.data.dues?.map((d: any) => (
                        <tr key={d.loan_id} className="table-row">
                          <td className="px-4 py-2.5"><p className="font-medium text-navy-900">{d.customer_name}</p><p className="text-xs text-slate-400">{d.mobile}</p></td>
                          <td className="px-4 py-2.5 font-mono text-xs">{d.loan_no}</td>
                          <td className="px-4 py-2.5 text-right text-orange-600 font-semibold">₹{d.pending_amount?.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 text-right hidden sm:table-cell">{d.pending_installments}</td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell"><span className={d.max_days_overdue > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>{d.max_days_overdue}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Defaulters */}
      {tab === 'defaulters' && (
        <div className="space-y-4">
          <ExportBar
            onPDF={() => exportPDF('Defaulters Report', [
              { header: 'Customer', dataKey: 'name' },
              { header: 'Mobile', dataKey: 'mobile' },
              { header: 'Loan No', dataKey: 'loan_no' },
              { header: 'Outstanding', dataKey: 'outstanding' },
              { header: 'Days Overdue', dataKey: 'days_overdue' },
              { header: 'Center', dataKey: 'center_name' },
            ], defaultersReport.data || [])}
            onExcel={() => exportExcel('Defaulters', [
              { header: 'Customer', dataKey: 'name' },
              { header: 'Mobile', dataKey: 'mobile' },
              { header: 'Loan No', dataKey: 'loan_no' },
              { header: 'Outstanding', dataKey: 'outstanding' },
              { header: 'Days Overdue', dataKey: 'days_overdue' },
              { header: 'Center', dataKey: 'center_name' },
            ], defaultersReport.data || [])}
          />
          {defaultersReport.isLoading ? <PageLoader /> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="text-left px-4 py-2">Customer</th>
                    <th className="text-left px-4 py-2 hidden sm:table-cell">Loan</th>
                    <th className="text-right px-4 py-2">Outstanding</th>
                    <th className="text-right px-4 py-2">Days Overdue</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Center</th>
                  </tr></thead>
                  <tbody>
                    {(defaultersReport.data || []).map((d: any) => (
                      <tr key={d.loan_id} className="table-row">
                        <td className="px-4 py-2.5"><p className="font-medium text-navy-900">{d.name}</p><p className="text-xs text-slate-400">{d.mobile}</p></td>
                        <td className="px-4 py-2.5 hidden sm:table-cell font-mono text-xs">{d.loan_no}</td>
                        <td className="px-4 py-2.5 text-right text-red-600 font-semibold">₹{d.outstanding?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right"><span className="badge-overdue">{d.days_overdue} days</span></td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-500">{d.center_name}</td>
                      </tr>
                    ))}
                    {(!defaultersReport.data || defaultersReport.data.length === 0) && (
                      <tr><td colSpan={5} className="text-center py-12 text-slate-400">No defaulters found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Center-wise */}
      {tab === 'center' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
            <ExportBar
              onPDF={() => exportPDF('Center-wise Report', [
                { header: 'Center', dataKey: 'name' },
                { header: 'Area', dataKey: 'area' },
                { header: 'Customers', dataKey: 'customers' },
                { header: 'Active Loans', dataKey: 'active_loans' },
                { header: 'Collected', dataKey: 'collected' },
                { header: 'Pending', dataKey: 'pending_installments' },
              ], centerReport.data || [])}
              onExcel={() => exportExcel('Center-wise', [
                { header: 'Center', dataKey: 'name' },
                { header: 'Area', dataKey: 'area' },
                { header: 'Customers', dataKey: 'customers' },
                { header: 'Active Loans', dataKey: 'active_loans' },
                { header: 'Collected', dataKey: 'collected' },
                { header: 'Pending', dataKey: 'pending_installments' },
              ], centerReport.data || [])}
            />
          </div>
          {centerReport.isLoading ? <PageLoader /> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="text-left px-4 py-2">Center</th>
                    <th className="text-right px-4 py-2">Customers</th>
                    <th className="text-right px-4 py-2">Active Loans</th>
                    <th className="text-right px-4 py-2">Collected</th>
                    <th className="text-right px-4 py-2 hidden sm:table-cell">Pending EMIs</th>
                  </tr></thead>
                  <tbody>
                    {(centerReport.data || []).map((c: any) => (
                      <tr key={c.id} className="table-row">
                        <td className="px-4 py-2.5"><p className="font-medium">{c.name}</p><p className="text-xs text-slate-400">{c.area}</p></td>
                        <td className="px-4 py-2.5 text-right">{c.customers}</td>
                        <td className="px-4 py-2.5 text-right">{c.active_loans}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">₹{c.collected?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right hidden sm:table-cell text-orange-600">{c.pending_installments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group-wise */}
      {tab === 'group' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
            <ExportBar
              onPDF={() => exportPDF('Group-wise Report', [
                { header: 'Group', dataKey: 'group_name' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Members', dataKey: 'members' },
                { header: 'Active Loans', dataKey: 'active_loans' },
                { header: 'Collected', dataKey: 'collected' },
                { header: 'Pending Amt', dataKey: 'pending_amount' },
              ], groupReport.data || [])}
              onExcel={() => exportExcel('Group-wise', [
                { header: 'Group', dataKey: 'group_name' },
                { header: 'Center', dataKey: 'center_name' },
                { header: 'Members', dataKey: 'members' },
                { header: 'Active Loans', dataKey: 'active_loans' },
                { header: 'Collected', dataKey: 'collected' },
                { header: 'Pending Amt', dataKey: 'pending_amount' },
              ], groupReport.data || [])}
            />
          </div>
          {groupReport.isLoading ? <PageLoader /> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="text-left px-4 py-2">Group</th>
                    <th className="text-left px-4 py-2 hidden sm:table-cell">Center</th>
                    <th className="text-right px-4 py-2">Members</th>
                    <th className="text-right px-4 py-2">Active Loans</th>
                    <th className="text-right px-4 py-2">Collected</th>
                    <th className="text-right px-4 py-2 hidden md:table-cell">Pending</th>
                  </tr></thead>
                  <tbody>
                    {(groupReport.data || []).map((g: any) => (
                      <tr key={g.id} className="table-row">
                        <td className="px-4 py-2.5 font-medium">{g.group_name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{g.center_name}</td>
                        <td className="px-4 py-2.5 text-right">{g.members}</td>
                        <td className="px-4 py-2.5 text-right">{g.active_loans}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">₹{g.collected?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-orange-600 hidden md:table-cell">₹{g.pending_amount?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {(!groupReport.data || groupReport.data.length === 0) && (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent-wise */}
      {tab === 'agent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
            <ExportBar
              onPDF={() => exportPDF('Agent-wise Report', [
                { header: 'Agent', dataKey: 'name' },
                { header: 'Collections', dataKey: 'total_collections' },
                { header: 'Total Amount', dataKey: 'total_amount' },
                { header: 'Customers', dataKey: 'unique_customers' },
                { header: 'Working Days', dataKey: 'working_days' },
              ], agentReport.data?.agents || [])}
              onExcel={() => exportExcel('Agent-wise', [
                { header: 'Agent', dataKey: 'name' },
                { header: 'Collections', dataKey: 'total_collections' },
                { header: 'Total Amount', dataKey: 'total_amount' },
                { header: 'Customers', dataKey: 'unique_customers' },
                { header: 'Working Days', dataKey: 'working_days' },
              ], agentReport.data?.agents || [])}
            />
          </div>
          {agentReport.isLoading ? <PageLoader /> : agentReport.data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(agentReport.data.agents || []).map((a: any) => (
                  <div key={a.id} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-navy-900">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">₹{Number(a.total_amount).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-400">{a.total_collections} collections</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-2 py-1.5"><p className="text-slate-400">Customers</p><p className="font-semibold">{a.unique_customers}</p></div>
                      <div className="bg-slate-50 rounded-lg px-2 py-1.5"><p className="text-slate-400">Working Days</p><p className="font-semibold">{a.working_days}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              {agentReport.data.dailyTrend && agentReport.data.dailyTrend.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-navy-900 mb-4">Daily Collection Trend by Agent</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={Object.values(
                      agentReport.data.dailyTrend.reduce((acc: any, d: any) => {
                        if (!acc[d.payment_date]) acc[d.payment_date] = { date: d.payment_date };
                        acc[d.payment_date][d.agent_name] = d.amount;
                        return acc;
                      }, {})
                    )}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.split('-')[2]} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip />
                      {(agentReport.data.agents || []).map((a: any, i: number) => (
                        <Line key={a.id} type="monotone" dataKey={a.name} stroke={['#1e3a5f','#f59e0b','#10b981','#ef4444','#8b5cf6'][i % 5]} dot={false} strokeWidth={2} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Profit & Loss */}
      {tab === 'pl' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
            <ExportBar
              onPDF={() => exportPDF('Profit & Loss', [
                { header: 'Item', dataKey: 'item' },
                { header: 'Amount', dataKey: 'amount' },
              ], plReport.data ? [
                { item: 'Total Collected', amount: plReport.data.income?.total_collected },
                { item: 'Interest Income', amount: plReport.data.income?.interest_income },
                { item: 'Penalty Income', amount: plReport.data.income?.penalty_income },
                { item: 'Processing Fees', amount: plReport.data.income?.processing_fees },
                { item: 'Total Expenses', amount: plReport.data.expenses?.total },
                { item: 'Net Profit', amount: plReport.data.net_profit },
              ] : [])}
              onExcel={() => exportExcel('Profit & Loss', [
                { header: 'Item', dataKey: 'item' },
                { header: 'Amount', dataKey: 'amount' },
              ], plReport.data ? [
                { item: 'Total Collected', amount: plReport.data.income?.total_collected },
                { item: 'Interest Income', amount: plReport.data.income?.interest_income },
                { item: 'Penalty Income', amount: plReport.data.income?.penalty_income },
                { item: 'Processing Fees', amount: plReport.data.income?.processing_fees },
                { item: 'Total Expenses', amount: plReport.data.expenses?.total },
                { item: 'Net Profit', amount: plReport.data.net_profit },
              ] : [])}
            />
          </div>
          {plReport.isLoading ? <PageLoader /> : plReport.data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card border-l-4 border-emerald-500">
                  <p className="text-xs text-slate-500">Gross Income</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{(plReport.data.income?.gross_income || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="card border-l-4 border-red-500">
                  <p className="text-xs text-slate-500">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">₹{(plReport.data.expenses?.total || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className={`card border-l-4 ${plReport.data.net_profit >= 0 ? 'border-navy-600' : 'border-red-600'}`}>
                  <p className="text-xs text-slate-500">Net Profit</p>
                  <p className={`text-2xl font-bold ${plReport.data.net_profit >= 0 ? 'text-navy-800' : 'text-red-600'}`}>
                    ₹{(plReport.data.net_profit || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold text-navy-900 mb-3 text-sm">Income Breakdown</h3>
                  {[
                    { label: 'Total Collected', value: plReport.data.income?.total_collected },
                    { label: 'Interest Income', value: plReport.data.income?.interest_income },
                    { label: 'Penalty Income', value: plReport.data.income?.penalty_income },
                    { label: 'Processing Fees', value: plReport.data.income?.processing_fees },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2 border-b border-slate-50 text-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-semibold text-emerald-700">₹{(value || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h3 className="font-semibold text-navy-900 mb-3 text-sm">Expense Breakdown</h3>
                  {(plReport.data.expenses?.breakdown || []).map((e: any) => (
                    <div key={e.category} className="flex justify-between py-2 border-b border-slate-50 text-sm">
                      <span className="text-slate-600 capitalize">{e.category}</span>
                      <span className="font-semibold text-red-600">₹{e.amount?.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {(!plReport.data.expenses?.breakdown?.length) && (
                    <p className="text-sm text-slate-400 text-center py-3">No expenses in this period</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cash Book */}
      {tab === 'cashbook' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} />
            <ExportBar
              onPDF={() => exportPDF('Cash Book', [
                { header: 'Date', dataKey: 'date' },
                { header: 'Type', dataKey: 'type' },
                { header: 'Amount', dataKey: 'amount' },
              ], [...(cashbook.data?.income || []), ...(cashbook.data?.expenses || [])])}
              onExcel={() => exportExcel('Cash Book', [
                { header: 'Date', dataKey: 'date' },
                { header: 'Type', dataKey: 'type' },
                { header: 'Amount', dataKey: 'amount' },
              ], [...(cashbook.data?.income || []), ...(cashbook.data?.expenses || [])])}
            />
          </div>
          {cashbook.isLoading ? <PageLoader /> : cashbook.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="card"><p className="text-xs text-slate-500">Total Income</p><p className="text-xl font-bold text-emerald-700">₹{cashbook.data.totalIncome?.toLocaleString('en-IN')}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Total Expenses</p><p className="text-xl font-bold text-red-600">₹{cashbook.data.totalExpenses?.toLocaleString('en-IN')}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Net</p><p className={`text-xl font-bold ${cashbook.data.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{cashbook.data.netProfit?.toLocaleString('en-IN')}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold text-navy-900 mb-3 text-sm">Income</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {cashbook.data.income?.map((i: any) => (
                      <div key={i.date} className="flex justify-between text-sm py-1 border-b border-slate-50"><span className="text-slate-500">{i.date}</span><span className="text-emerald-700 font-medium">₹{i.amount?.toLocaleString('en-IN')}</span></div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-navy-900 mb-3 text-sm">Expenses</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {cashbook.data.expenses?.map((e: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-50"><span className="text-slate-500">{e.date} – {e.type}</span><span className="text-red-600 font-medium">₹{e.amount?.toLocaleString('en-IN')}</span></div>
                    ))}
                    {(!cashbook.data.expenses?.length) && <p className="text-sm text-slate-400 text-center py-3">No expenses</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
