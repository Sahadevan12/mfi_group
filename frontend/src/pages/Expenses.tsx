import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Receipt } from 'lucide-react';
import client from '../api/client';
import type { Expense } from '../types';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';

const today = new Date().toISOString().split('T')[0];
const monthStart = today.substring(0, 7) + '-01';

const CATEGORIES = ['Salary', 'Office Rent', 'Utilities', 'Travel', 'Stationery', 'Miscellaneous', 'Marketing', 'IT/Technology'];

const emptyForm = { category: '', amount: '', description: '', expense_date: today };

export default function Expenses() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', startDate, endDate],
    queryFn: () => client.get('/expenses', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
  });

  const add = useMutation({
    mutationFn: (d: any) => client.post('/expenses', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setModal(false); setForm(emptyForm); },
  });

  const del = useMutation({
    mutationFn: (id: string) => client.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const expenses: Expense[] = data?.expenses || [];
  const total: number = data?.total || 0;
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Group by category
  const byCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500">Track business expenses</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div><label className="label">From</label><input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Summary */}
        <div className="card md:col-span-1">
          <h3 className="font-semibold text-navy-900 mb-4">Summary</h3>
          <div className="text-3xl font-bold text-red-600 mb-1">₹{total.toLocaleString()}</div>
          <p className="text-xs text-slate-400 mb-4">Total expenses</p>
          <div className="space-y-2">
            {Object.entries(byCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{cat}</span>
                <span className="font-medium text-navy-800">₹{amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="md:col-span-2 card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Description</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="table-row">
                    <td className="px-4 py-3 text-xs">{e.expense_date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">₹{e.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">{e.description}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { if (confirm('Delete expense?')) del.mutate(e.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No expenses in this period.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Expense"
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => add.mutate(form)} disabled={add.isPending} className="btn-primary">
              {add.isPending ? 'Adding...' : 'Add Expense'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="label">Category *</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
