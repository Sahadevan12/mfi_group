import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Save, Users, History } from 'lucide-react';
import { format } from 'date-fns';
import client from '../api/client';
import { PageLoader } from '../components/ui/Spinner';

const today = new Date().toISOString().split('T')[0];

export default function GroupCollection() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'collect' | 'history'>('collect');
  const [payments, setPayments] = useState<Record<string, { amount: string; mode: string; paid: boolean }>>({});
  const [paymentDate, setPaymentDate] = useState(today);
  const [historyStart, setHistoryStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [historyEnd, setHistoryEnd] = useState(today);

  const { data: group, isLoading } = useQuery({
    queryKey: ['group-collection', groupId],
    queryFn: () => client.get(`/groups/${groupId}/collection`).then(r => r.data),
  });

  const { data: groupInfo } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => client.get(`/groups/${groupId}`).then(r => r.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['group-history', groupId, historyStart, historyEnd],
    queryFn: () => client.get(`/groups/${groupId}/history`, { params: { start_date: historyStart, end_date: historyEnd } }).then(r => r.data),
    enabled: activeTab === 'history',
  });

  const bulkCollect = useMutation({
    mutationFn: (collections: any[]) => client.post('/collections/bulk', { collections }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-dues'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate('/collections');
    },
  });

  const setPayment = (customerId: string, key: 'amount' | 'mode' | 'paid', value: string | boolean) => {
    setPayments(p => ({
      ...p,
      [customerId]: { ...p[customerId], [key]: value }
    }));
  };

  const initPayment = (customer: any) => {
    const def = { amount: String(customer.due_amount || customer.emi_amount || ''), mode: 'cash', paid: false };
    setPayments(p => ({ ...p, [customer.id]: p[customer.id] || def }));
  };

  const handleSave = () => {
    const collections = (group || [])
      .filter((c: any) => payments[c.id]?.paid && payments[c.id]?.amount)
      .map((c: any) => ({
        loan_id: c.loan_id,
        customer_id: c.id,
        schedule_id: c.schedule_id,
        amount: parseFloat(payments[c.id].amount),
        payment_date: paymentDate,
        payment_mode: payments[c.id].mode,
      }));

    if (collections.length === 0) return alert('No payments selected');
    bulkCollect.mutate(collections);
  };

  const paidCount = Object.values(payments).filter(p => p.paid).length;
  const totalAmount = Object.entries(payments)
    .filter(([, p]) => p.paid && p.amount)
    .reduce((s, [, p]) => s + parseFloat(p.amount || '0'), 0);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:bg-white hover:text-navy-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="page-title">Group Collection</h1>
          <p className="text-sm text-slate-500">{groupInfo?.name || ''} • {groupInfo?.center_name || ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('collect')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'collect' ? 'bg-white shadow text-navy-800' : 'text-slate-500'}`}>
          <Users size={14} className="inline mr-1.5" />Collect
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white shadow text-navy-800' : 'text-slate-500'}`}>
          <History size={14} className="inline mr-1.5" />History
        </button>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex gap-3 flex-wrap">
            <div><label className="label">From</label><input type="date" className="input" value={historyStart} onChange={e => setHistoryStart(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} /></div>
          </div>
          {historyData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center"><p className="text-lg font-bold text-emerald-700">₹{(historyData.summary?.total_amount || 0).toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">Total Collected</p></div>
              <div className="card text-center"><p className="text-lg font-bold text-navy-900">{historyData.summary?.transactions || 0}</p><p className="text-xs text-slate-500">Transactions</p></div>
              <div className="card text-center"><p className="text-lg font-bold text-navy-900">{historyData.summary?.unique_customers || 0}</p><p className="text-xs text-slate-500">Customers</p></div>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Receipt</th>
              </tr></thead>
              <tbody>
                {(historyData?.history || []).map((h: any) => (
                  <tr key={h.id} className="table-row">
                    <td className="px-4 py-2.5 text-xs text-slate-500">{format(new Date(h.payment_date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-2.5"><p className="font-medium text-sm">{h.customer_name}</p><p className="text-xs text-slate-400">{h.loan_no}</p></td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">₹{h.amount?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell font-mono text-xs text-slate-400">{h.receipt_no}</td>
                  </tr>
                ))}
                {(!historyData?.history?.length) && <tr><td colSpan={4} className="text-center py-8 text-slate-400">No collections in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collect Tab */}
      {activeTab === 'collect' && <>
      {/* Summary bar */}
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div><span className="text-slate-500">Members: </span><strong>{group?.length || 0}</strong></div>
          <div><span className="text-slate-500">Paid: </span><strong className="text-emerald-700">{paidCount}</strong></div>
          <div><span className="text-slate-500">Total: </span><strong className="text-navy-900">₹{totalAmount.toLocaleString()}</strong></div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-38" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
        </div>
      </div>

      {/* Mark all paid button */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const all: typeof payments = {};
            group?.forEach((c: any) => {
              all[c.id] = { amount: String(c.due_amount || c.emi_amount || ''), mode: 'cash', paid: true };
            });
            setPayments(all);
          }}
          className="btn-secondary text-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mark All Paid
        </button>
        <button onClick={() => setPayments({})} className="btn-secondary text-sm text-red-500">
          Clear All
        </button>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {(group || []).map((customer: any) => {
          const p = payments[customer.id];
          const isPaid = p?.paid;

          if (!p) {
            setTimeout(() => initPayment(customer), 0);
          }

          return (
            <div
              key={customer.id}
              className={`card transition-all ${isPaid ? 'border-emerald-200 bg-emerald-50/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <label className="mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded accent-emerald-600"
                    checked={isPaid || false}
                    onChange={e => setPayment(customer.id, 'paid', e.target.checked)}
                  />
                </label>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-navy-900">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.mobile}</p>
                    </div>
                    {customer.loan_id ? (
                      <div className="text-right">
                        <p className="text-sm font-bold text-navy-900">₹{customer.due_amount || customer.emi_amount}</p>
                        <p className="text-xs text-slate-400 capitalize">{customer.emi_frequency}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">No active loan</span>
                    )}
                  </div>

                  {isPaid && customer.loan_id && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div>
                        <label className="label">Amount (₹)</label>
                        <input
                          type="number"
                          className="input"
                          value={p?.amount || ''}
                          onChange={e => setPayment(customer.id, 'amount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Mode</label>
                        <select className="input" value={p?.mode || 'cash'}
                          onChange={e => setPayment(customer.id, 'mode', e.target.value)}>
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {(!group || group.length === 0) && (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No members in this group.</p>
          </div>
        )}
      </div>

      {/* Save button */}
      {paidCount > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={bulkCollect.isPending}
            className="btn-primary w-full justify-center py-3 text-base shadow-xl"
          >
            {bulkCollect.isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> Save {paidCount} Collections — ₹{totalAmount.toLocaleString('en-IN')}</>
            )}
          </button>
        </div>
      )}
      </>}
    </div>
  );
}
