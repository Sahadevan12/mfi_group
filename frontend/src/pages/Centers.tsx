import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Clock, Users, Search } from 'lucide-react';
import client from '../api/client';
import type { Center, User } from '../types';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyForm = { name: '', meeting_day: '', meeting_time: '', area: '', location: '', staff_id: '' };

export default function Centers() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  const { data: centers, isLoading } = useQuery<Center[]>({
    queryKey: ['centers', search],
    queryFn: () => client.get('/centers', { params: search ? { search } : {} }).then(r => r.data),
  });

  const { data: staff } = useQuery<User[]>({
    queryKey: ['staff-list'],
    queryFn: () => client.get('/staff').then(r => r.data),
    enabled: isAdmin,
  });

  const save = useMutation({
    mutationFn: (data: any) => editing
      ? client.put(`/centers/${editing.id}`, data)
      : client.post('/centers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['centers'] }); closeModal(); },
  });

  const del = useMutation({
    mutationFn: (id: string) => client.delete(`/centers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centers'] }),
  });

  const openModal = (c?: Center) => {
    setEditing(c || null);
    setForm(c ? { name: c.name, meeting_day: c.meeting_day || '', meeting_time: c.meeting_time || '', area: c.area || '', location: c.location || '', staff_id: c.staff_id || '' } : emptyForm);
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); setForm(emptyForm); };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Centers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{centers?.length || 0} active centers</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 w-44" placeholder="Search centers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <button onClick={() => openModal()} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Center
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {centers?.map(c => (
          <div key={c.id} className="card hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">{c.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900">{c.name}</h3>
                  {c.staff_name && <p className="text-xs text-slate-500">{c.staff_name}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => openModal(c)} className="p-1.5 text-slate-400 hover:text-navy-800 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm('Delete this center?')) del.mutate(c.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 mt-3">
              {c.area && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {c.area}{c.location ? `, ${c.location}` : ''}
                </div>
              )}
              {c.meeting_day && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {c.meeting_day} {c.meeting_time && `at ${c.meeting_time}`}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {c.customer_count || 0} customers • {c.group_count || 0} groups
              </div>
            </div>
          </div>
        ))}

        {(!centers || centers.length === 0) && (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No centers found. Add your first center.</p>
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={closeModal}
        title={editing ? 'Edit Center' : 'Add Center'}
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Center Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Anna Nagar Center" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Meeting Day</label>
              <select className="input" value={form.meeting_day} onChange={e => setForm(f => ({ ...f, meeting_day: e.target.value }))}>
                <option value="">Select day</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Meeting Time</label>
              <input type="time" className="input" value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Area</label>
            <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Anna Nagar" />
          </div>
          <div>
            <label className="label">Location / City</label>
            <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Chennai" />
          </div>
          {isAdmin && (
            <div>
              <label className="label">Assigned Staff</label>
              <select className="input" value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                <option value="">Select staff</option>
                {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Building2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
