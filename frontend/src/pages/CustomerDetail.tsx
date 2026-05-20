import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Phone, MapPin, CreditCard, CheckCircle2, Upload,
  FileText, Trash2, Eye, UserCheck, Camera, FilePlus
} from 'lucide-react';
import client from '../api/client';
import type { Customer } from '../types';
import Badge from '../components/ui/Badge';
import { PhoneLink } from '../components/ui/PhoneLink';
import { PageLoader } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function getHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

const DOC_TYPES = ['Aadhaar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving License', 'Bank Passbook', 'Salary Slip', 'Income Proof', 'Photo', 'Other'];

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('Aadhaar Card');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [portalCreated, setPortalCreated] = useState<any>(null);

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => client.get(`/customers/${id}`).then(r => r.data),
  });

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await axios.post(`${API}/upload/photo`, fd, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } });
      await client.put(`/customers/${id}`, { ...customer, photo: data.url });
      qc.invalidateQueries({ queryKey: ['customer', id] });
    } catch (e) { alert('Photo upload failed'); }
    setUploadingPhoto(false);
  };

  const uploadDoc = async (file: File) => {
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('doc_type', docType);
      await axios.post(`${API}/upload/document/${id}`, fd, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['customer', id] });
    } catch (e) { alert('Document upload failed'); }
    setUploadingDoc(false);
  };

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => axios.delete(`${API}/upload/document/${docId}`, { headers: getHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', id] }),
  });

  const createPortal = useMutation({
    mutationFn: () => client.post(`/customers/${id}/create-portal`, {}),
    onSuccess: (res) => setPortalCreated(res.data),
  });

  if (isLoading) return <PageLoader />;
  if (!customer) return <div className="text-center py-12 text-slate-400">Customer not found.</div>;

  const activeLoans = customer.loans?.filter((l: any) => l.status === 'active') || [];
  const totalPaid = activeLoans.reduce((s: number, l: any) => s + (l.total_paid || 0), 0);
  const totalOutstanding = activeLoans.reduce((s: number, l: any) => s + l.total_payable - (l.total_paid || 0), 0);
  const documents = (customer as any).documents || [];

  // Separate KYC docs from other docs
  const aadhaarDoc = documents.find((d: any) => d.doc_type === 'aadhaar_card');
  const panDoc = documents.find((d: any) => d.doc_type === 'pan_card');
  const otherDocs = documents.filter((d: any) => d.doc_type !== 'aadhaar_card' && d.doc_type !== 'pan_card');

  const isImage = (mime: string) => mime?.startsWith('image/');

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:bg-white hover:text-navy-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="page-title">{customer.name}</h1>
        {isAdmin && !customer.user_id && (
          <button className="btn-secondary text-xs py-1.5 ml-auto" onClick={() => createPortal.mutate()}>
            <UserCheck size={14} /> Create Portal Access
          </button>
        )}
      </div>

      {portalCreated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-700">✓ Portal access created</p>
          <p className="text-emerald-600 mt-1">
            Login: <strong>{portalCreated.login}</strong> &nbsp;|&nbsp; Password: <strong>{portalCreated.password}</strong>
          </p>
          <p className="text-xs text-emerald-500 mt-1">Customer can log in at the portal. Share credentials securely.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile Card */}
        <div className="card">
          <div className="flex flex-col items-center text-center mb-4">
            {/* Photo */}
            <div className="relative w-20 h-20 rounded-full mb-3 group">
              {customer.photo ? (
                <img src={customer.photo} alt={customer.name}
                  className="w-full h-full rounded-full object-cover border-2 border-navy-200" />
              ) : (
                <div className="w-full h-full rounded-full bg-navy-800 flex items-center justify-center border-2 border-navy-200">
                  <span className="text-white text-2xl font-bold">{customer.name.charAt(0)}</span>
                </div>
              )}
              {isAdminOrStaff && (
                <button
                  onClick={() => photoRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Camera size={20} className="text-white" />
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </div>
            {uploadingPhoto && <p className="text-xs text-navy-600 animate-pulse">Uploading...</p>}
            <h2 className="text-lg font-bold text-navy-900">{customer.name}</h2>
            <p className="text-sm text-slate-500">{customer.center_name} • {customer.group_name}</p>
            <span className={`mt-2 ${customer.is_active ? 'badge-active' : 'badge-closed'}`}>
              {customer.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <PhoneLink phone={customer.mobile} className="font-medium" />
              {customer.alt_mobile && (
                <><span className="text-slate-300">/</span>
                <PhoneLink phone={customer.alt_mobile} className="text-slate-500 text-xs" /></>
              )}
            </div>
            {customer.address && (
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}</span>
              </div>
            )}
            {customer.aadhaar && <div className="text-xs text-slate-400">Aadhaar: {customer.aadhaar}</div>}
            {customer.dob && <div className="text-xs text-slate-400">DOB: {customer.dob}</div>}
          </div>

          {customer.nominee_name && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">NOMINEE</p>
              <p className="text-sm text-navy-800">{customer.nominee_name}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                {customer.nominee_relation}
                {customer.nominee_mobile && <><span>•</span><PhoneLink phone={customer.nominee_mobile} iconSize={10} /></>}
              </p>
            </div>
          )}

          {customer.guarantor_name && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">GUARANTOR</p>
              <p className="text-sm text-navy-800">{customer.guarantor_name}</p>
              <PhoneLink phone={customer.guarantor_mobile} className="text-xs" iconSize={10} />
            </div>
          )}

          {/* KYC Documents */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">KYC DOCUMENTS</p>
            <div className="grid grid-cols-2 gap-2">
              {/* Aadhaar */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <p className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 border-b border-slate-200">
                  AADHAAR
                </p>
                {aadhaarDoc ? (
                  <div className="relative group">
                    {isImage(aadhaarDoc.mime_type) ? (
                      <img src={aadhaarDoc.filepath} alt="Aadhaar" className="w-full h-24 object-cover" />
                    ) : (
                      <div className="h-24 flex flex-col items-center justify-center bg-red-50 gap-1">
                        <FileText size={22} className="text-red-400" />
                        <span className="text-[10px] text-red-500">PDF</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <a href={aadhaarDoc.filepath} target="_blank" rel="noreferrer"
                        className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-navy-800 hover:bg-white">
                        <Eye size={13} />
                      </a>
                      {isAdminOrStaff && (
                        <button onClick={() => { if (window.confirm('Delete Aadhaar?')) deleteDoc.mutate(aadhaarDoc.id); }}
                          className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-red-600 hover:bg-white">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-24 flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-1">
                    <CheckCircle2 size={18} className="opacity-40" />
                    <span className="text-[10px]">Not uploaded</span>
                  </div>
                )}
              </div>

              {/* PAN */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <p className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 border-b border-slate-200">
                  PAN CARD
                </p>
                {panDoc ? (
                  <div className="relative group">
                    {isImage(panDoc.mime_type) ? (
                      <img src={panDoc.filepath} alt="PAN" className="w-full h-24 object-cover" />
                    ) : (
                      <div className="h-24 flex flex-col items-center justify-center bg-red-50 gap-1">
                        <FileText size={22} className="text-red-400" />
                        <span className="text-[10px] text-red-500">PDF</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <a href={panDoc.filepath} target="_blank" rel="noreferrer"
                        className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-navy-800 hover:bg-white">
                        <Eye size={13} />
                      </a>
                      {isAdminOrStaff && (
                        <button onClick={() => { if (window.confirm('Delete PAN?')) deleteDoc.mutate(panDoc.id); }}
                          className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-red-600 hover:bg-white">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-24 flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-1">
                    <CheckCircle2 size={18} className="opacity-40" />
                    <span className="text-[10px]">Not uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Other Documents */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500">OTHER DOCUMENTS ({otherDocs.length})</p>
              {isAdminOrStaff && (
                <button onClick={() => docRef.current?.click()} disabled={uploadingDoc}
                  className="text-xs text-navy-600 hover:text-navy-800 flex items-center gap-1 font-medium">
                  <FilePlus size={13} /> Upload
                </button>
              )}
            </div>
            {isAdminOrStaff && (
              <div className="mb-3">
                <select className="input text-xs" value={docType} onChange={e => setDocType(e.target.value)}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input ref={docRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
                {uploadingDoc && <p className="text-xs text-navy-600 animate-pulse mt-1">Uploading...</p>}
              </div>
            )}
            <div className="space-y-2">
              {otherDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.doc_type}</p>
                    <p className="text-xs text-slate-400 truncate">{doc.original_name}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={doc.filepath} target="_blank" rel="noreferrer"
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-navy-700">
                      <Eye size={13} />
                    </a>
                    {isAdminOrStaff && (
                      <button onClick={() => { if (window.confirm('Delete document?')) deleteDoc.mutate(doc.id); }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {otherDocs.length === 0 && <p className="text-xs text-slate-400">No other documents uploaded.</p>}
            </div>
          </div>
        </div>

        {/* Stats + Loans */}
        <div className="lg:col-span-2 space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-navy-900">{customer.loans?.length || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Total Loans</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-emerald-700">₹{(totalPaid / 1000).toFixed(1)}K</p>
              <p className="text-xs text-slate-500 mt-1">Total Paid</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-orange-600">₹{(totalOutstanding / 1000).toFixed(1)}K</p>
              <p className="text-xs text-slate-500 mt-1">Outstanding</p>
            </div>
          </div>

          {/* Loans */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-navy-900">Loan History</h3>
              <Link to={`/loans/new?customer_id=${customer.id}`} className="btn-primary text-xs py-1.5">
                <CreditCard className="w-3.5 h-3.5" /> New Loan
              </Link>
            </div>
            {customer.loans && customer.loans.length > 0 ? (
              <div className="space-y-3">
                {customer.loans.map((loan: any) => (
                  <Link key={loan.id} to={`/loans/${loan.id}`}
                    className="block p-3 rounded-lg border border-slate-100 hover:border-navy-200 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-navy-800 text-sm">{loan.loan_no}</span>
                      <Badge status={loan.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                      <div><span className="text-slate-400">Amount</span><br />₹{loan.amount?.toLocaleString('en-IN')}</div>
                      <div><span className="text-slate-400">EMI</span><br />₹{loan.emi_amount?.toLocaleString('en-IN')}/{loan.emi_frequency}</div>
                      <div><span className="text-slate-400">Paid</span><br />
                        <span className="text-emerald-700 font-medium">₹{loan.total_paid?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="mt-2 bg-slate-100 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{
                        width: `${Math.min(100, ((loan.total_paid || 0) / loan.total_payable) * 100)}%`
                      }} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No loans found.</p>
            )}
          </div>

          {/* Recent collections */}
          <div className="card">
            <h3 className="font-semibold text-navy-900 mb-4">Recent Collections</h3>
            {customer.collections && customer.collections.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="text-left px-3 py-2">Receipt</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Mode</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2 hidden md:table-cell">By</th>
                  </tr></thead>
                  <tbody>
                    {customer.collections.map((c: any) => (
                      <tr key={c.id} className="table-row">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link to={`/receipt/${c.id}`} className="hover:underline text-navy-700">{c.receipt_no}</Link>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">₹{c.amount?.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 hidden sm:table-cell text-xs text-slate-500 capitalize">{c.payment_mode}</td>
                        <td className="px-3 py-2 text-xs">{c.payment_date}</td>
                        <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-500">{c.collected_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No collections yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
