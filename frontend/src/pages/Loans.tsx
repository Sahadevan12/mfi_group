import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Eye, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Loan } from '../types';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';

export default function Loans() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['loans', search, status, page],
    queryFn: () => client.get('/loans', { params: { search, status, page, limit: 15 } }).then(r => r.data),
  });

  if (isLoading && !data) return <PageLoader />;

  const loans: Loan[] = data?.loans || [];
  const total: number = data?.total || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Loans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} loans</p>
        </div>
        <button onClick={() => navigate('/loans/new')} className="btn-primary">
          <Plus className="w-4 h-4" /> New Loan
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search loan no, customer name..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3">Loan No.</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Amount</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">EMI</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Progress</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map(l => {
                const progress = l.total_payable ? Math.min(100, ((l.total_paid || 0) / l.total_payable) * 100) : 0;
                return (
                  <tr key={l.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-700">{l.loan_no}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy-900">{l.customer_name}</p>
                      <p className="text-xs text-slate-400">{l.center_name}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-right">
                      <p className="font-semibold">₹{l.amount?.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{l.interest_rate}% {l.interest_type}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-right">
                      <p>₹{l.emi_amount?.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 capitalize">{l.emi_frequency}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{progress.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{l.paid_installments || 0}/{l.total_installments} EMIs</p>
                    </td>
                    <td className="px-4 py-3"><Badge status={l.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => navigate(`/loans/${l.id}`)}
                        className="p-1.5 text-slate-400 hover:text-navy-800 hover:bg-slate-100 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loans.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No loans found.</p>
            </div>
          )}
        </div>
        {Math.ceil(total / 15) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Showing {loans.length} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Prev</button>
              <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
