import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, UserCheck, Phone, TrendingUp } from 'lucide-react';
import client from '../api/client';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';

const emptyForm = { name: '', email: '', phone: '', address: '', password: '' };

export default function Staff() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdStaff, setPwdStaff] = useState<any>(null);
  const [newPwd, setNewPwd] = useState('');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => client.get('/staff').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? client.put(`/staff/${editing.id}`, d) : client.post('/staff', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); closeModal(); },
  });

  const resetPwd = useMutation({
    mutationFn: ({ id, password }: any) => client.put(`/staff/${id}/reset-password`, { password }),
    onSuccess: () => { setPwdModal(false); setNewPwd(''); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: any) => client.put(`/staff/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const openModal = (s?: any) => {
    setEditing(s || null);
    setForm(s ? { name: s.name, email: s.email, phone: s.phone || '', address: s.address || '', password: '' } : emptyForm);
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); setForm(emptyForm); };
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="text-sm text-slate-500">{staff?.length || 0} staff members</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff?.map((s: any) => (
          <div key={s.id} className="card hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-800 flex items-center justify-center">
                  <span className="text-white font-bold">{s.name?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900">{s.name}</h3>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
              </div>
              <span className={s.is_active ? 'badge-active' : 'badge-closed'}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {s.phone && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <Phone className="w-3.5 h-3.5" />{s.phone}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 my-3">
              <div className="text-center">
                <p className="text-lg font-bold text-navy-900">{s.assigned_centers}</p>
                <p className="text-xs text-slate-400">Centers</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-700">₹{((s.month_amount || 0)/1000).toFixed(1)}K</p>
                <p className="text-xs text-slate-400">This Month</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-navy-900">{s.total_collections}</p>
                <p className="text-xs text-slate-400">Collections</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => openModal(s)} className="btn-secondary flex-1 text-xs py-1.5">
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => { setPwdStaff(s); setPwdModal(true); }} className="btn-secondary text-xs py-1.5 px-3">
                Reset PWD
              </button>
              <button
                onClick={() => toggleActive.mutate({ id: s.id, is_active: s.is_active ? 0 : 1 })}
                className={`text-xs py-1.5 px-3 rounded-lg border transition-colors ${
                  s.is_active ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                {s.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
        {(!staff || staff.length === 0) && (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No staff found.</p>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={closeModal} title={editing ? 'Edit Staff' : 'Add Staff Member'}
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} disabled={!!editing} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          {!editing && (
            <div><label className="label">Password *</label><input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} /></div>
          )}
        </div>
      </Modal>

      <Modal open={pwdModal} onClose={() => setPwdModal(false)} title="Reset Password"
        footer={
          <>
            <button onClick={() => setPwdModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => resetPwd.mutate({ id: pwdStaff?.id, password: newPwd })} className="btn-primary">Reset</button>
          </>
        }>
        <div>
          <p className="text-sm text-slate-500 mb-3">Reset password for <strong>{pwdStaff?.name}</strong></p>
          <label className="label">New Password</label>
          <input type="password" className="input" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" />
        </div>
      </Modal>
    </div>
  );
}
