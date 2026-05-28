import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Eye, UserCircle, Phone, MapPin, CreditCard,
  Upload, X, FileText, CheckCircle2, ShieldCheck, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Customer, Center, Group } from '../types';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { PhoneLink } from '../components/ui/PhoneLink';

const emptyForm = {
  name: '', mobile: '', alt_mobile: '', address: '', city: '', state: 'Tamil Nadu', pincode: '',
  aadhaar: '', pan: '', dob: '', gender: '',
  nominee_name: '', nominee_relation: '', nominee_mobile: '',
  guarantor_name: '', guarantor_mobile: '', guarantor_address: '',
  center_id: '', group_id: '',
};

interface DocBoxProps {
  label: string;
  file: File | null;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSelect: (f: File | null) => void;
}

function DocBox({ label, file, preview, inputRef, onSelect }: DocBoxProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={e => onSelect(e.target.files?.[0] || null)}
      />
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center gap-2 text-slate-400 hover:border-navy-400 hover:text-navy-600 transition-colors cursor-pointer bg-slate-50 hover:bg-navy-50"
        >
          <Upload className="w-6 h-6" />
          <span className="text-xs font-medium">Click to upload {label}</span>
          <span className="text-xs opacity-60">JPG, PNG, PDF · max 10 MB</span>
        </button>
      ) : (
        <div className="relative border border-slate-200 rounded-xl overflow-hidden">
          {file.type === 'application/pdf' ? (
            <div className="flex items-center gap-3 p-4 bg-slate-50">
              <FileText className="w-9 h-9 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB · PDF</p>
              </div>
            </div>
          ) : (
            <img src={preview} alt={label} className="w-full h-36 object-cover" />
          )}
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100">
            <p className="text-xs text-emerald-600 font-medium">✓ Ready to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search — API call only after 500ms of no typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // OTP verification
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpDemo, setOtpDemo] = useState('');        // shown when SMS not configured
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);       // resend countdown

  // KYC document files
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarPreview, setAadhaarPreview] = useState('');
  const [panPreview, setPanPreview] = useState('');
  const aadhaarRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, centerFilter, page],
    queryFn: () => client.get('/customers', {
      params: { search, center_id: centerFilter, page, limit: 15 }
    }).then(r => r.data),
  });

  const { data: centers } = useQuery<Center[]>({
    queryKey: ['centers'],
    queryFn: () => client.get('/centers').then(r => r.data),
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups', form.center_id],
    queryFn: () => client.get('/groups', { params: { center_id: form.center_id } }).then(r => r.data),
    enabled: !!form.center_id,
  });

  const resetDocs = () => {
    setAadhaarFile(null);
    setPanFile(null);
    setAadhaarPreview('');
    setPanPreview('');
    if (aadhaarRef.current) aadhaarRef.current.value = '';
    if (panRef.current) panRef.current.value = '';
  };

  const resetOtp = () => {
    setOtpSent(false);
    setOtpValue('');
    setOtpVerified(false);
    setOtpDemo('');
    setOtpError('');
    setOtpSuccess('');
    setOtpTimer(0);
  };

  // Countdown timer for resend button
  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  const handleSendOtp = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    if (mobile.length !== 10) { setOtpError('Enter a valid 10-digit mobile number first'); return; }
    setSendingOtp(true);
    setOtpError('');
    setOtpSuccess('');
    setOtpDemo('');
    try {
      const res = await client.post('/verify/send-otp', { mobile });
      setOtpSent(true);
      setOtpTimer(60); // 60s resend cooldown
      if (res.data.demo) {
        setOtpDemo(res.data.otp);
        setOtpSuccess('Demo Mode: SMS not configured. Use the OTP shown below.');
      } else {
        setOtpSuccess(res.data.message);
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.length !== 6) { setOtpError('Enter the 6-digit OTP'); return; }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      await client.post('/verify/verify-otp', { mobile: form.mobile, otp: otpValue });
      setOtpVerified(true);
      setOtpSuccess('✓ Mobile number verified!');
      setOtpError('');
    } catch (err: any) {
      setOtpError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const openModal = (c?: Customer) => {
    setEditing(c || null);
    setForm(c ? {
      name: c.name, mobile: c.mobile, alt_mobile: c.alt_mobile || '',
      address: c.address || '', city: c.city || '', state: c.state || 'Tamil Nadu',
      pincode: c.pincode || '', aadhaar: c.aadhaar || '', pan: c.pan || '',
      dob: c.dob || '', gender: c.gender || '',
      nominee_name: c.nominee_name || '', nominee_relation: c.nominee_relation || '',
      nominee_mobile: c.nominee_mobile || '', guarantor_name: c.guarantor_name || '',
      guarantor_mobile: c.guarantor_mobile || '', guarantor_address: c.guarantor_address || '',
      center_id: c.center_id || '', group_id: c.group_id || '',
    } : emptyForm);
    resetDocs();
    resetOtp();
    // Editing: treat mobile as already verified
    if (c) setOtpVerified(true);
    setSaveError('');
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditing(null);
    setForm(emptyForm);
    resetDocs();
    resetOtp();
    setSaveError('');
  };

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    // Reset OTP if mobile number changes
    if (k === 'mobile' && !editing) resetOtp();
  };

  const handleFileSelect = (type: 'aadhaar' | 'pan', file: File | null) => {
    if (!file) {
      if (type === 'aadhaar') { setAadhaarFile(null); setAadhaarPreview(''); }
      else { setPanFile(null); setPanPreview(''); }
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === 'aadhaar') { setAadhaarFile(file); setAadhaarPreview(url); }
    else { setPanFile(file); setPanPreview(url); }
  };

  const handleSave = async () => {
    if (!form.name.trim())    { setSaveError('Full name is required'); return; }
    if (!form.mobile.trim())  { setSaveError('Mobile number is required'); return; }
    if (!editing && !otpVerified) { setSaveError('Please verify the mobile number with OTP before saving'); return; }
    if (!form.dob)            { setSaveError('Date of Birth is required'); return; }
    if (!form.gender)         { setSaveError('Gender is required'); return; }
    if (!form.aadhaar.trim()) { setSaveError('Aadhaar number is required'); return; }

    if (!form.address.trim()) { setSaveError('Address is required'); return; }

    setSaving(true);
    setSaveError('');
    try {
      let customerId = editing?.id;

      if (editing) {
        await client.put(`/customers/${editing.id}`, form);
      } else {
        const res = await client.post('/customers', form);
        customerId = res.data.id;
      }

      // Upload KYC documents if files were selected
      if (customerId) {
        if (aadhaarFile) {
          const fd = new FormData();
          fd.append('document', aadhaarFile);
          fd.append('doc_type', 'aadhaar_card');
          await client.post(`/upload/document/${customerId}`, fd);
        }
        if (panFile) {
          const fd = new FormData();
          fd.append('document', panFile);
          fd.append('doc_type', 'pan_card');
          await client.post(`/upload/document/${customerId}`, fd);
        }
      }

      qc.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !data) return <PageLoader />;

  const customers: Customer[] = data?.customers || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} customers</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, mobile, Aadhaar..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)} />
        </div>
        <select className="input w-44" value={centerFilter} onChange={e => { setCenterFilter(e.target.value); setPage(1); }}>
          <option value="">All Centers</option>
          {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Center / Group</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Loans</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                        {c.photo ? (
                          <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-navy-700 text-xs font-bold">{c.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-navy-900">{c.name}</p>
                        <PhoneLink phone={c.mobile} className="text-xs md:hidden" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <PhoneLink phone={c.mobile} className="text-sm" />
                    {c.city && <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" />{c.city}
                    </div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-slate-700 text-xs">{c.center_name}</p>
                    <p className="text-slate-400 text-xs">{c.group_name}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CreditCard className="w-3 h-3" />{c.active_loans || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate(`/customers/${c.id}`)}
                      className="p-1.5 text-slate-400 hover:text-navy-800 hover:bg-slate-100 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No customers found.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Showing {customers.length} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Prev</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={closeModal}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="lg"
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary" disabled={saving}>Cancel</button>
            <button onClick={handleSave} disabled={saving || (!editing && !otpVerified)} className="btn-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving...
                </span>
              ) : editing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Error banner */}
          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
              <X className="w-4 h-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          {/* Personal Info */}
          <div>
            <p className="section-title">Personal Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Lakshmi Devi" />
              </div>
              <div className="col-span-2">
                <label className="label">
                  Mobile *
                  {otpVerified && (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    className={`input flex-1 ${otpVerified ? 'border-emerald-400 bg-emerald-50' : ''}`}
                    value={form.mobile}
                    onChange={e => set('mobile', e.target.value)}
                    placeholder="9500012345"
                    maxLength={10}
                    disabled={otpVerified && !editing}
                  />
                  {!editing && !otpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || form.mobile.replace(/\D/g,'').length !== 10 || otpTimer > 0}
                      className="btn-secondary px-3 text-xs whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                      {otpTimer > 0 ? `Resend in ${otpTimer}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  )}
                </div>

                {/* OTP input block */}
                {otpSent && !otpVerified && (
                  <div className="mt-2 space-y-2">
                    {/* Demo OTP display */}
                    {otpDemo && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span className="text-amber-700 text-xs">📵 SMS not configured —</span>
                        <span className="font-mono font-bold text-amber-800 text-base tracking-widest">{otpDemo}</span>
                        <span className="text-amber-600 text-xs">(Demo OTP)</span>
                      </div>
                    )}
                    {otpSuccess && !otpDemo && (
                      <p className="text-xs text-emerald-600">{otpSuccess}</p>
                    )}
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-center font-mono text-lg tracking-[0.4em] font-bold"
                        value={otpValue}
                        onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                        placeholder="• • • • • •"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otpValue.length !== 6}
                        className="btn-primary px-4 text-sm disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Verify
                      </button>
                    </div>
                    {otpError && <p className="text-xs text-red-600">{otpError}</p>}
                  </div>
                )}

                {otpVerified && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mobile verified successfully
                  </p>
                )}
              </div>
              <div>
                <label className="label">Alt Mobile</label>
                <input className="input" value={form.alt_mobile} onChange={e => set('alt_mobile', e.target.value)} />
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input type="date" className={`input ${!form.dob ? 'border-amber-300' : ''}`} value={form.dob} onChange={e => set('dob', e.target.value)} />
              </div>
              <div>
                <label className="label">Gender *</label>
                <select className={`input ${!form.gender ? 'border-amber-300' : ''}`} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option>Female</option><option>Male</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="label">Aadhaar Number *</label>
                <input className={`input ${!form.aadhaar ? 'border-amber-300' : ''}`} value={form.aadhaar} onChange={e => set('aadhaar', e.target.value)} placeholder="1234 5678 9012" />
              </div>
              <div>
                <label className="label">PAN Number</label>
                <input className="input" value={form.pan} onChange={e => set('pan', e.target.value)} placeholder="ABCDE1234F" />
              </div>
            </div>
          </div>

          {/* KYC Documents */}
          <div>
            <p className="section-title">KYC Documents</p>
            <div className="grid grid-cols-2 gap-3">
              <DocBox
                label="Aadhaar Card Photo"
                file={aadhaarFile}
                preview={aadhaarPreview}
                inputRef={aadhaarRef}
                onSelect={f => handleFileSelect('aadhaar', f)}
              />
              <DocBox
                label="PAN Card Photo"
                file={panFile}
                preview={panPreview}
                inputRef={panRef}
                onSelect={f => handleFileSelect('pan', f)}
              />
            </div>
            {editing && (
              <p className="text-xs text-slate-400 mt-2">
                Previously uploaded KYC documents are visible in the Customer Detail page.
                Upload new files here to add more.
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <p className="section-title">Address</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Address *</label>
                <input className={`input ${!form.address ? 'border-amber-300' : ''}`} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Door No, Street" />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Chennai" />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input className="input" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="600001" />
              </div>
            </div>
          </div>

          {/* Center & Group */}
          <div>
            <p className="section-title">Center & Group</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Center</label>
                <select className="input" value={form.center_id} onChange={e => set('center_id', e.target.value)}>
                  <option value="">Select center</option>
                  {centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Group</label>
                <select className="input" value={form.group_id} onChange={e => set('group_id', e.target.value)} disabled={!form.center_id}>
                  <option value="">Select group</option>
                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Nominee */}
          <div>
            <p className="section-title">Nominee Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nominee Name</label><input className="input" value={form.nominee_name} onChange={e => set('nominee_name', e.target.value)} /></div>
              <div><label className="label">Relation</label><input className="input" value={form.nominee_relation} onChange={e => set('nominee_relation', e.target.value)} placeholder="Spouse, Mother..." /></div>
              <div><label className="label">Nominee Mobile</label><input className="input" value={form.nominee_mobile} onChange={e => set('nominee_mobile', e.target.value)} /></div>
            </div>
          </div>

          {/* Guarantor */}
          <div>
            <p className="section-title">Guarantor Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Guarantor Name</label><input className="input" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} /></div>
              <div><label className="label">Guarantor Mobile</label><input className="input" value={form.guarantor_mobile} onChange={e => set('guarantor_mobile', e.target.value)} /></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
