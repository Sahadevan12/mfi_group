import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Save, Lock, User, Bell } from 'lucide-react';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Settings() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', address: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saved, setSaved] = useState('');

  const updateProfile = useMutation({
    mutationFn: (d: any) => client.put('/auth/profile', d),
    onSuccess: () => { setSaved('profile'); setTimeout(() => setSaved(''), 2000); },
  });

  const changePwd = useMutation({
    mutationFn: (d: any) => client.put('/auth/change-password', d),
    onSuccess: () => { setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' }); setSaved('pwd'); setTimeout(() => setSaved(''), 2000); },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="page-title">Settings</h1>

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-navy-700" />
          <h2 className="font-semibold text-navy-900">Profile</h2>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-slate-50 text-slate-400" value={user?.email || ''} disabled />
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input bg-slate-50 text-slate-400 capitalize" value={user?.role || ''} disabled />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => updateProfile.mutate(profile)} disabled={updateProfile.isPending} className="btn-primary">
              <Save className="w-4 h-4" /> {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
            </button>
            {saved === 'profile' && <span className="text-sm text-emerald-600">✓ Saved!</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-navy-700" />
          <h2 className="font-semibold text-navy-900">Change Password</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwd.currentPassword} onChange={e => setPwd(p => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwd.newPassword} onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className="input" value={pwd.confirmPassword} onChange={e => setPwd(p => ({ ...p, confirmPassword: e.target.value }))} />
          </div>
          {changePwd.isError && <p className="text-sm text-red-600">{(changePwd.error as any)?.response?.data?.error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (pwd.newPassword !== pwd.confirmPassword) return alert('Passwords do not match');
                changePwd.mutate(pwd);
              }}
              disabled={changePwd.isPending}
              className="btn-primary"
            >
              <Lock className="w-4 h-4" /> {changePwd.isPending ? 'Updating...' : 'Update Password'}
            </button>
            {saved === 'pwd' && <span className="text-sm text-emerald-600">✓ Password updated!</span>}
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-navy-700" />
          <h2 className="font-semibold text-navy-900">Company Information</h2>
        </div>
        <dl className="space-y-2 text-sm">
          {[
            ['Company', 'SPS Group of Foundation'],
            ['Type', 'Microfinance Institution (MFI)'],
            ['Version', '1.0.0'],
            ['System', 'Group Loan Management Software'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium text-navy-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
