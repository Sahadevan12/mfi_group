import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, CreditCard, Wallet, AlertTriangle,
  TrendingUp, TrendingDown, Clock, CheckCircle2, UserCheck, Wifi, WifiOff,
  Banknote, PiggyBank, Activity, Landmark
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import client from '../api/client';
import type { DashboardStats } from '../types';
import { PageLoader } from '../components/ui/Spinner';
import { useSSE } from '../hooks/useSSE';
import { useAuthStore } from '../store/authStore';

const SSE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/dashboard/live';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-navy-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function fmtCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  gradient: string;
  iconBg: string;
  badge?: string;
  badgeColor?: string;
  decoration?: string;
  highlighted?: boolean;
}

function SummaryCard({ icon: Icon, label, value, sub, gradient, iconBg, badge, badgeColor, decoration, highlighted }: SummaryCardProps) {
  return (
    <div className={`
      relative overflow-hidden rounded-2xl p-5 cursor-default
      ${gradient}
      ${highlighted
        ? 'shadow-2xl shadow-blue-900/40 ring-2 ring-white/30 scale-[1.02]'
        : 'shadow-lg shadow-black/20'
      }
      hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30
      transition-all duration-300 ease-out
      border border-white/15
    `}>
      {/* Glass shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

      {/* Decorative blurred circles */}
      <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl opacity-30 ${decoration || 'bg-white/20'}`} />
      <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full blur-3xl opacity-20 bg-white/10" />

      {/* Content */}
      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shadow-lg backdrop-blur-sm`}>
            <Icon size={22} className="text-white drop-shadow" />
          </div>
          {badge && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${badgeColor || 'bg-white/20 text-white'}`}>
              {badge}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{label}</p>

        {/* Value */}
        <p className={`font-black text-white tracking-tight leading-none mb-2 ${highlighted ? 'text-3xl' : 'text-2xl'}`}>
          {value}
        </p>

        {/* Sub */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
          <p className="text-white/60 text-xs">{sub}</p>
        </div>
      </div>
    </div>
  );
}

const COLORS = ['#1e3a5f', '#f59e0b', '#10b981', '#ef4444'];

export default function Dashboard() {
  // SSE for real-time updates
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const { data: sseStats, connected } = useSSE(SSE_URL);

  const { data: initialStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => client.get('/dashboard/stats').then(r => r.data),
    // Only refetch if SSE is not connected (fallback)
    refetchInterval: connected ? false : 60000,
  });

  // Merge: prefer SSE data, fall back to polling
  const stats: DashboardStats | null = sseStats || initialStats || null;

  const { data: trend } = useQuery({
    queryKey: ['monthly-trend'],
    queryFn: () => client.get('/dashboard/monthly-trend').then(r => r.data),
  });

  const { data: recentCollections } = useQuery({
    queryKey: ['recent-collections'],
    queryFn: () => client.get('/dashboard/recent-collections').then(r => r.data),
  });

  const { data: agentStats } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: () => client.get('/dashboard/agent-stats').then(r => r.data),
  });

  const { data: centerStats } = useQuery({
    queryKey: ['center-stats'],
    queryFn: () => client.get('/dashboard/center-stats').then(r => r.data),
  });

  if (statsLoading && !sseStats) return <PageLoader />;
  if (!stats) return <PageLoader />;

  const s = stats;
  const loanData = [
    { name: 'Active', value: s.activeLoans },
    { name: 'Pending', value: s.pendingLoans },
    { name: 'Overdue', value: s.overdueLoans },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {connected ? 'Live' : 'Polling'}
        </div>
      </div>

      {/* ── Premium Summary Cards (Admin only) ── */}
      {isAdmin && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1 — Principal */}
        <SummaryCard
          icon={Landmark}
          label="Principal"
          value={fmtCurrency(s.totalPrincipal)}
          sub={`${s.totalCustomers} active members`}
          gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800"
          iconBg="bg-white/20"
          badge="ACTIVE"
          badgeColor="bg-emerald-400/30 text-emerald-200"
          decoration="bg-blue-300"
        />

        {/* 2 — Outstanding */}
        <SummaryCard
          icon={Activity}
          label="Outstanding"
          value={fmtCurrency(s.totalOutstanding)}
          sub="Total balance remaining"
          gradient="bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700"
          iconBg="bg-white/20"
          badge="DUE"
          badgeColor="bg-red-400/30 text-red-200"
          decoration="bg-violet-300"
        />

        {/* 3 — Total Interest */}
        <SummaryCard
          icon={TrendingUp}
          label="Total Interest"
          value={fmtCurrency(s.totalInterest)}
          sub="Projected interest income"
          gradient="bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600"
          iconBg="bg-white/20"
          badge="PROFIT"
          badgeColor="bg-emerald-400/30 text-emerald-200"
          decoration="bg-cyan-300"
        />

        {/* 4 — Total Amount (Highlighted) */}
        <SummaryCard
          icon={Banknote}
          label="Total Amount"
          value={fmtCurrency(s.totalDisbursed)}
          sub="Total loans disbursed"
          gradient="bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900"
          iconBg="bg-amber-400/30"
          badge="PORTFOLIO"
          badgeColor="bg-amber-400/30 text-amber-200"
          decoration="bg-blue-400"
          highlighted
        />
      </div>}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Customers" value={s.totalCustomers} sub={`${s.totalCenters} Centers`} color="bg-navy-800" />
        <StatCard icon={CreditCard} label="Active Loans" value={s.activeLoans} sub={`${s.pendingLoans} pending approval`} color="bg-emerald-500" />
        <StatCard icon={Wallet} label="Today's Collection" value={fmt(s.totalCollection)} sub={`₹${(s.monthCollection/1000).toFixed(1)}K this month`} color="bg-gold-500" />
        <StatCard icon={AlertTriangle} label="Overdue Loans" value={s.overdueLoans} sub={`${fmt(s.pendingAmount)} pending`} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Total Collected" value={fmt(s.totalCollectionAll)} sub="All time" color="bg-indigo-500" />
        <StatCard icon={Clock} label="Pending Amount" value={fmt(s.pendingAmount)} sub="Due & overdue" color="bg-orange-500" />
        <StatCard icon={UserCheck} label="Total Staff" value={s.totalStaff} sub="Collection agents" color="bg-violet-500" />
        <StatCard icon={CheckCircle2} label="Collection Rate" value={
          s.totalCollectionAll > 0 ? `${Math.min(100, Math.round(s.totalCollectionAll / (s.totalCollectionAll + s.pendingAmount) * 100))}%` : '0%'
        } sub="Overall efficiency" color="bg-teal-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Collection trend */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-4">Monthly Collection Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend || []}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Collection']} />
              <Area type="monotone" dataKey="total" stroke="#1e3a5f" strokeWidth={2} fill="url(#cg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Loan status pie */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Loan Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={loanData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {loanData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {loanData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-navy-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent collections */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Recent Collections</h3>
          <div className="space-y-2">
            {(recentCollections || []).slice(0, 6).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-700 text-xs font-bold">{c.customer_name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{c.customer_name}</p>
                    <p className="text-xs text-slate-500">{c.receipt_no} • {c.collected_by_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700">+₹{c.amount?.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{c.payment_date}</p>
                </div>
              </div>
            ))}
            {(!recentCollections || recentCollections.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No collections today</p>
            )}
          </div>
        </div>

        {/* Agent stats */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Agent Performance</h3>
          {agentStats && agentStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agentStats.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Collected']} />
                <Bar dataKey="month_amount" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="This Month" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No agent data</p>
          )}
        </div>
      </div>

      {/* Center stats */}
      {centerStats && centerStats.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Center-wise Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-3 py-2">Center</th>
                  <th className="text-right px-3 py-2">Customers</th>
                  <th className="text-right px-3 py-2">Active Loans</th>
                  <th className="text-right px-3 py-2">Total Collected</th>
                </tr>
              </thead>
              <tbody>
                {centerStats.map((c: any) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-navy-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.area}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.customer_count}</td>
                    <td className="px-3 py-2.5 text-right">{c.active_loans}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">₹{c.total_collected?.toLocaleString()}</td>
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
