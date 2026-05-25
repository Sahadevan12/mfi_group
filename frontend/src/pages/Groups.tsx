import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Users, ChevronRight, Search,
  UserCog, Crown, Phone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Group, Center, Customer } from '../types';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';

const emptyForm = { name: '', center_id: '', description: '', leader_id: '' };

export default function Groups() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [centerFilter, setCenterFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');

  // Debounce — 500ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Data fetches ──
  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ['groups', centerFilter, search],
    queryFn: () => client.get('/groups', {
      params: {
        ...(centerFilter ? { center_id: centerFilter } : {}),
        ...(search ? { search } : {}),
      }
    }).then(r => r.data),
  });

  const { data: centers } = useQuery<Center[]>({
    queryKey: ['centers'],
    queryFn: () => client.get('/centers').then(r => r.data),
  });

  // Fetch customers for the selected center (for leader picker)
  const { data: centerCustomers } = useQuery<Customer[]>({
    queryKey: ['customers-for-center', form.center_id],
    queryFn: () =>
      client.get('/customers', { params: { center_id: form.center_id, limit: 200 } })
        .then(r => r.data.customers || r.data),
    enabled: !!form.center_id && modal,
  });

  // Filter customers by leader search text
  const filteredCustomers = useMemo(() =>
    (centerCustomers || []).filter(c =>
      !leaderSearch ||
      c.name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
      c.mobile?.includes(leaderSearch)
    ), [centerCustomers, leaderSearch]);

  const selectedLeader = centerCustomers?.find(c => c.id === form.leader_id);

  // ── Mutations ──
  const save = useMutation({
    mutationFn: (data: any) =>
      editing ? client.put(`/groups/${editing.id}`, data) : client.post('/groups', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); closeModal(); },
  });

  const del = useMutation({
    mutationFn: (id: string) => client.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });

  // ── Modal helpers ──
  const openModal = (g?: Group) => {
    setEditing(g || null);
    setForm(g ? {
      name: g.name,
      center_id: g.center_id,
      description: g.description || '',
      leader_id: g.leader_id || '',
    } : emptyForm);
    setLeaderSearch('');
    setModal(true);
  };
  const closeModal = () => {
    setModal(false);
    setEditing(null);
    setForm(emptyForm);
    setLeaderSearch('');
  };

  const set = (key: keyof typeof emptyForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">{groups?.length || 0} groups</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 w-44" placeholder="Search groups..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <select className="input w-44" value={centerFilter} onChange={e => setCenterFilter(e.target.value)}>
            <option value="">All Centers</option>
            {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {isAdmin && (
            <button onClick={() => openModal()} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Group
            </button>
          )}
        </div>
      </div>

      {/* Group Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups?.map(g => (
          <div key={g.id}
            className="card hover:shadow-card-hover transition-shadow cursor-pointer group"
            onClick={() => navigate(`/collections/group/${g.id}`)}>

            {/* Card top */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-200 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-gold-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900 group-hover:text-navy-700">{g.name}</h3>
                  <p className="text-xs text-slate-500">{g.center_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {isAdmin && (
                  <>
                    <button onClick={() => openModal(g)}
                      className="p-1.5 text-slate-400 hover:text-navy-800 hover:bg-slate-100 rounded-lg">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Delete group?')) del.mutate(g.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-navy-400 transition-colors" />
              </div>
            </div>

            {/* Group Leader badge */}
            {g.leader_name && (
              <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800 truncate">{g.leader_name}</p>
                  {g.leader_mobile && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <Phone size={9} />{g.leader_mobile}
                    </p>
                  )}
                </div>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-amber-400 flex-shrink-0">
                  Leader
                </span>
              </div>
            )}

            {/* Card footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50"
              onClick={e => e.stopPropagation()}>
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {g.customer_count || 0} members
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/groups/${g.id}/members`)}
                  className="text-xs text-slate-500 hover:text-navy-700 flex items-center gap-1 hover:underline"
                >
                  <UserCog size={12} /> Manage
                </button>
                <span className="text-xs text-navy-600 font-medium hover:underline cursor-pointer"
                  onClick={() => navigate(`/collections/group/${g.id}`)}>
                  Collect →
                </span>
              </div>
            </div>
          </div>
        ))}

        {(!groups || groups.length === 0) && (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No groups found.</p>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modal} onClose={closeModal} title={editing ? 'Edit Group' : 'Add Group'}
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </>
        }>
        <div className="space-y-4">

          {/* Group Name */}
          <div>
            <label className="label">Group Name *</label>
            <input className="input" value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Mahalakshmi Group" />
          </div>

          {/* Center */}
          <div>
            <label className="label">Center *</label>
            <select className="input" value={form.center_id}
              onChange={e => { set('center_id', e.target.value); set('leader_id', ''); setLeaderSearch(''); }}>
              <option value="">Select center</option>
              {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Group description..." />
          </div>

          {/* ── Group Leader ── */}
          <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-800">Group Leader</span>
              <span className="text-xs text-amber-500 ml-auto">Optional</span>
            </div>

            {!form.center_id ? (
              <p className="text-xs text-amber-600 italic">Select a center first to choose a leader</p>
            ) : (
              <>
                {/* Currently selected leader chip */}
                {selectedLeader && (
                  <div className="flex items-center justify-between bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{selectedLeader.name}</p>
                      <p className="text-xs text-amber-600">{selectedLeader.mobile}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { set('leader_id', ''); setLeaderSearch(''); }}
                      className="text-xs text-amber-500 hover:text-red-600 font-medium ml-3 flex-shrink-0">
                      Remove
                    </button>
                  </div>
                )}

                {/* Search + dropdown */}
                {!form.leader_id && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-8 text-sm"
                        placeholder="Search customer by name or mobile..."
                        value={leaderSearch}
                        onChange={e => setLeaderSearch(e.target.value)}
                      />
                    </div>
                    {leaderSearch && (
                      <div className="border border-slate-200 rounded-lg bg-white shadow-sm max-h-44 overflow-y-auto divide-y divide-slate-50">
                        {filteredCustomers.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">No customers found</p>
                        ) : (
                          filteredCustomers.slice(0, 8).map(c => (
                            <button key={c.id} type="button"
                              onClick={() => { set('leader_id', c.id); setLeaderSearch(''); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-amber-50 transition-colors">
                              <p className="text-sm font-medium text-navy-900">{c.name}</p>
                              <p className="text-xs text-slate-400">{c.mobile}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {!leaderSearch && centerCustomers && centerCustomers.length > 0 && (
                      <p className="text-xs text-slate-400 text-center py-1">
                        {centerCustomers.length} customers in this center — type to search
                      </p>
                    )}
                    {!leaderSearch && centerCustomers && centerCustomers.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-1">
                        No customers in this center yet
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </Modal>
    </div>
  );
}
