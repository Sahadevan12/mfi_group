import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CreditCard, Calendar, Receipt, LogOut,
  TrendingUp, AlertCircle, CheckCircle, Clock, Download
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { exportReceiptPDF } from '../utils/exportUtils';
import client from '../api/client';

type PortalTab = 'overview' | 'loans' | 'payments' | 'schedule';

export default function CustomerPortal() {
  const { user, logout } = useAuthStore();
  const handleLogout = () => { logout(); window.location.href = '/customer-login'; };
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['portal-profile'],
    queryFn: async () => {
      const { data } = await client.get('/portal/profile');
      return data;
    },
  });

  const { data: loans } = useQuery({
    queryKey: ['portal-loans'],
    queryFn: async () => {
      const { data } = await client.get('/portal/loans');
      return data;
    },
  });

  const { data: nextDue } = useQuery({
    queryKey: ['portal-next-due'],
    queryFn: async () => {
      const { data } = await client.get('/portal/next-due');
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ['portal-payments'],
    queryFn: async () => {
      const { data } = await client.get('/portal/payments?limit=50');
      return data;
    },
    enabled: activeTab === 'payments',
  });

  const { data: schedule } = useQuery({
    queryKey: ['portal-schedule', selectedLoan],
    queryFn: async () => {
      const { data } = await client.get(`/portal/loans/${selectedLoan}/schedule`);
      return data;
    },
    enabled: !!selectedLoan && activeTab === 'schedule',
  });

  const activeLoans = (loans || []).filter((l: any) => l.status === 'active');
  const closedLoans = (loans || []).filter((l: any) => l.status === 'closed');

  const handleReceiptDownload = async (paymentId: string) => {
    const { data } = await client.get(`/portal/receipt/${paymentId}`);
    exportReceiptPDF(data);
  };

  const tabs: { key: PortalTab; label: string; Icon: any }[] = [
    { key: 'overview', label: 'Overview', Icon: TrendingUp },
    { key: 'loans', label: 'My Loans', Icon: CreditCard },
    { key: 'schedule', label: 'Schedule', Icon: Calendar },
    { key: 'payments', label: 'Payments', Icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-navy-900 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">SPS Group MFI</h1>
            <p className="text-navy-300 text-sm">Customer Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.name || user?.name}</p>
              <p className="text-xs text-navy-300">{profile?.group_name || 'Member'}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === key ? 'bg-navy-800 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Profile Card */}
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-navy-100 flex items-center justify-center text-2xl font-bold text-navy-700">
                  {profile?.photo ? (
                    <img src={profile.photo} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    profile?.name?.charAt(0)
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-navy-900 text-lg">{profile?.name}</h2>
                  <p className="text-slate-500 text-sm">{profile?.mobile}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{profile?.center_name} • {profile?.group_name}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center">
                <p className="text-2xl font-bold text-navy-900">{activeLoans.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Active Loans</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-emerald-600">{closedLoans.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Closed Loans</p>
              </div>
            </div>

            {/* Next Due */}
            {nextDue && nextDue.length > 0 && (
              <div className="space-y-2">
                <h3 className="section-title">Upcoming / Overdue EMIs</h3>
                {nextDue.map((due: any) => {
                  const isOverdue = due.days_overdue > 0;
                  return (
                    <div key={due.id} className={`card border-l-4 ${isOverdue ? 'border-red-500' : 'border-amber-400'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">
                            Installment #{due.installment_no} — {due.loan_no}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Due: {format(new Date(due.due_date), 'dd MMM yyyy')}
                          </p>
                          {isOverdue && (
                            <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
                              <AlertCircle size={12} /> {due.days_overdue} days overdue
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-navy-900">₹ {Number(due.emi_amount - due.paid_amount).toLocaleString('en-IN')}</p>
                          <p className="text-xs text-slate-400">remaining</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <div className="space-y-4 animate-fadeIn">
            {(loans || []).map((loan: any) => (
              <div key={loan.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-navy-900">{loan.loan_no}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      loan.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      loan.status === 'closed' ? 'bg-slate-100 text-slate-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{loan.status}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl text-navy-900">₹ {Number(loan.amount).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400">Loan Amount</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-xs text-slate-400">EMI Amount</p>
                    <p className="font-semibold">₹ {Number(loan.emi_amount).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Frequency</p>
                    <p className="font-semibold capitalize">{loan.emi_frequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Paid</p>
                    <p className="font-semibold text-emerald-600">₹ {Number(loan.total_paid).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Remaining</p>
                    <p className="font-semibold text-amber-600">₹ {Number(loan.total_payable - loan.total_paid).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (loan.total_paid / loan.total_payable) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-right">
                  {Math.round((loan.total_paid / loan.total_payable) * 100)}% paid
                </p>

                <button
                  className="btn-secondary text-xs w-full mt-3"
                  onClick={() => { setSelectedLoan(loan.id); setActiveTab('schedule'); }}
                >
                  <Calendar size={14} /> View Schedule
                </button>
              </div>
            ))}
            {(loans || []).length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
                <p>No loans found</p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Loan selector */}
            <div>
              <label className="label">Select Loan</label>
              <select
                className="input"
                value={selectedLoan || ''}
                onChange={e => setSelectedLoan(e.target.value)}
              >
                <option value="">-- Select a loan --</option>
                {(loans || []).map((l: any) => (
                  <option key={l.id} value={l.id}>{l.loan_no} — ₹{Number(l.amount).toLocaleString('en-IN')}</option>
                ))}
              </select>
            </div>

            {schedule && (
              <div className="card p-0 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {schedule.map((inst: any) => (
                    <div key={inst.id} className={`px-4 py-3 ${inst.status === 'paid' ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            inst.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            inst.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {inst.status === 'paid' ? <CheckCircle size={16} /> :
                             inst.status === 'overdue' ? <AlertCircle size={16} /> :
                             inst.status === 'partial' ? <Clock size={16} /> :
                             inst.installment_no}
                          </div>
                          <div>
                            <p className="text-sm font-medium">EMI #{inst.installment_no}</p>
                            <p className="text-xs text-slate-500">Due: {format(new Date(inst.due_date), 'dd MMM yyyy')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">₹ {Number(inst.emi_amount).toLocaleString('en-IN')}</p>
                          {inst.paid_amount > 0 && inst.status !== 'paid' && (
                            <p className="text-xs text-emerald-600">Paid: ₹{Number(inst.paid_amount).toLocaleString('en-IN')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!selectedLoan && (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a loan to view its schedule</p>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-3 animate-fadeIn">
            <h3 className="section-title">Payment History</h3>
            {(payments || []).map((pay: any) => (
              <div key={pay.id} className="card flex items-start gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{pay.loan_no}</p>
                      <p className="text-xs text-slate-500">{pay.receipt_no} • {pay.payment_mode}</p>
                      <p className="text-xs text-slate-400">{format(new Date(pay.payment_date), 'dd MMM yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">₹ {Number(pay.amount).toLocaleString('en-IN')}</p>
                      {pay.penalty_paid > 0 && (
                        <p className="text-xs text-red-500">+₹{Number(pay.penalty_paid).toLocaleString('en-IN')} penalty</p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleReceiptDownload(pay.id)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-navy-600 transition-colors shrink-0"
                  title="Download Receipt"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
            {(!payments || payments.length === 0) && (
              <div className="text-center py-12 text-slate-400">
                <Receipt size={36} className="mx-auto mb-3 opacity-30" />
                <p>No payment history</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
