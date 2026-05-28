import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Calculator, CheckCircle2 } from 'lucide-react';
import client from '../api/client';
import type { Customer, EMICalculation } from '../types';

const today = new Date().toISOString().split('T')[0];
const freqToUnit: Record<string, string> = {
  monthly: 'months', weekly: 'weeks', daily: 'days',
};
const freqLabel: Record<string, string> = {
  monthly: 'Months', weekly: 'Weeks', daily: 'Days',
};

const LOAN_TYPES = ['JLG', 'Product'];

const LOAN_REASONS = [
  'சிறுதொழில்',
  'விவசாய கடன்',
  'வீட்டு கடன்',
  'கல்வி கடன்',
  'மருத்துவ செலவு',
  'பொது தேவை',
];

const initForm = {
  customer_id: '', amount: '', interest_amount: '',
  duration: '12', duration_unit: 'months', emi_frequency: 'monthly',
  disbursement_date: today, start_date: today,
  processing_fee: '0', penalty_per_day: '0', notes: '',
  loan_type: 'JLG', loan_reason: '',
};

// Duration units per frequency (for rate derivation)
const durationFactor: Record<string, number> = { months: 12, weeks: 52, days: 365 };

export default function NewLoan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...initForm, customer_id: params.get('customer_id') || '' });
  const [calc, setCalc] = useState<EMICalculation | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: customers } = useQuery<{ customers: Customer[] }>({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => client.get('/customers', { params: { search: customerSearch, limit: 10 } }).then(r => r.data),
    enabled: customerSearch.length > 1,
  });

  const { data: selectedCustomer } = useQuery<Customer>({
    queryKey: ['customer', form.customer_id],
    queryFn: () => client.get(`/customers/${form.customer_id}`).then(r => r.data),
    enabled: !!form.customer_id,
  });

  // Derive annual interest rate (%) from the user-entered total interest amount (flat rate)
  // Formula: rate = (totalInterest / principal) / (duration / annualFactor) × 100
  const getDerivedRate = (): number => {
    const amt = parseFloat(form.amount);
    const intAmt = parseFloat(form.interest_amount);
    const dur = parseFloat(form.duration);
    if (!amt || !intAmt || !dur) return 0;
    const annualFactor = durationFactor[form.duration_unit] || 12;
    const years = dur / annualFactor;
    if (!years) return 0;
    return (intAmt / amt) / years * 100;
  };

  const calculate = async () => {
    if (!form.amount || !form.interest_amount || !form.duration) return;
    const derivedRate = getDerivedRate();
    if (!derivedRate) return;
    const r = await client.get('/loans/calculate', {
      params: {
        amount: form.amount,
        interestRate: derivedRate.toFixed(6),
        interestType: 'flat',
        duration: form.duration,
        durationUnit: form.duration_unit,
        emiFrequency: form.emi_frequency,
        startDate: form.start_date,
      }
    });
    setCalc(r.data);
  };

  useEffect(() => {
    if (form.amount && form.interest_amount && form.duration && form.start_date) {
      const t = setTimeout(calculate, 500);
      return () => clearTimeout(t);
    } else {
      setCalc(null);
    }
  }, [form.amount, form.interest_amount, form.duration, form.duration_unit, form.emi_frequency, form.start_date]);

  const create = useMutation({
    mutationFn: (data: any) => client.post('/loans', data),
    onSuccess: (res) => navigate(`/loans/${res.data.id}`),
  });

  const set = (k: string, v: string) => setForm(f => {
    const updated = { ...f, [k]: v };
    // Auto-sync duration_unit whenever EMI frequency changes
    if (k === 'emi_frequency') updated.duration_unit = freqToUnit[v] || 'months';
    return updated;
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:bg-white hover:text-navy-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="page-title">Create New Loan</h1>
      </div>

      {create.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(create.error as any)?.response?.data?.error || 'Failed to create loan'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="card">
            <p className="section-title">Customer</p>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div>
                  <p className="font-semibold text-navy-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-500">{selectedCustomer.mobile} • {selectedCustomer.center_name}</p>
                </div>
                <button onClick={() => { set('customer_id', ''); setCustomerSearch(''); }}
                  className="text-xs text-red-500 hover:text-red-700">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <input className="input" placeholder="Search customer name or mobile..."
                  value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {customers?.customers && customers.customers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {customers.customers.map(c => (
                      <button key={c.id} onClick={() => set('customer_id', c.id)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <p className="text-sm font-medium text-navy-800">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.mobile} • {c.center_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <p className="section-title">Loan Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Loan Type *</label>
                  <select className="input" value={form.loan_type} onChange={e => set('loan_type', e.target.value)}>
                    {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Loan Reason *</label>
                  <select className="input" value={form.loan_reason} onChange={e => set('loan_reason', e.target.value)}>
                    <option value="">-- தேர்வு செய்யவும் --</option>
                    {LOAN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Loan Amount (₹) *</label>
                <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="50000" />
              </div>
              <div>
                <label className="label">Total Interest Amount (₹) *</label>
                <input
                  type="number"
                  className="input"
                  value={form.interest_amount}
                  onChange={e => set('interest_amount', e.target.value)}
                  placeholder="e.g. 5400"
                />
                {/* Effective rate info */}
                {form.amount && form.interest_amount && form.duration && (() => {
                  const rate = getDerivedRate();
                  if (!rate) return null;
                  return (
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Effective rate:&nbsp;
                      <strong className="text-navy-700">{rate.toFixed(2)}% p.a.</strong>
                      &nbsp;(Flat)
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="label">EMI Frequency</label>
                <select className="input" value={form.emi_frequency} onChange={e => set('emi_frequency', e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <label className="label">
                  No. of Installments *
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-navy-100 text-navy-700 text-[10px] font-semibold normal-case">
                    {freqLabel[form.emi_frequency]}
                  </span>
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.duration}
                  onChange={e => set('duration', e.target.value)}
                  placeholder={form.emi_frequency === 'monthly' ? '12' : form.emi_frequency === 'weekly' ? '25' : '30'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Disbursement Date *</label>
                  <input type="date" className="input" value={form.disbursement_date}
                    onChange={e => set('disbursement_date', e.target.value)} />
                  <p className="text-[10px] text-slate-400 mt-1">Loan amount given on</p>
                </div>
                <div>
                  <label className="label">EMI Start Date *</label>
                  <input type="date" className="input" value={form.start_date}
                    onChange={e => set('start_date', e.target.value)} />
                  <p className="text-[10px] text-slate-400 mt-1">First EMI due on</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Processing Fee (₹)</label>
                  <input type="number" className="input" value={form.processing_fee} onChange={e => set('processing_fee', e.target.value)} />
                </div>
                <div>
                  <label className="label">Penalty / Day (₹)</label>
                  <input type="number" className="input" value={form.penalty_per_day} onChange={e => set('penalty_per_day', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Calculation */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-gold-600" />
              <p className="font-semibold text-navy-900">EMI Calculation</p>
            </div>

            {calc ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'EMI Amount', value: `₹${calc.emiAmount?.toLocaleString()}`, highlight: true },
                    { label: 'Total Installments', value: calc.totalInstallments },
                    { label: 'Total Payable', value: `₹${calc.totalPayable?.toLocaleString()}` },
                    { label: 'Total Interest', value: `₹${calc.totalInterest?.toLocaleString()}` },
                    { label: 'End Date', value: calc.endDate },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className={`p-3 rounded-lg ${highlight ? 'bg-navy-800 text-white' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${highlight ? 'text-white/70' : 'text-slate-500'}`}>{label}</p>
                      <p className={`font-bold text-lg mt-0.5 ${highlight ? 'text-gold-400' : 'text-navy-900'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => setShowSchedule(!showSchedule)}
                  className="btn-secondary w-full justify-center text-sm">
                  {showSchedule ? 'Hide' : 'View'} EMI Schedule ({calc.schedule?.length} entries)
                </button>

                {showSchedule && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead><tr className="table-header sticky top-0">
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Due Date</th>
                        <th className="px-2 py-2 text-right">EMI</th>
                        <th className="px-2 py-2 text-right">Principal</th>
                        <th className="px-2 py-2 text-right">Interest</th>
                        <th className="px-2 py-2 text-right">Balance</th>
                      </tr></thead>
                      <tbody>
                        {calc.schedule?.map(s => (
                          <tr key={s.installmentNo} className="table-row">
                            <td className="px-2 py-1.5 text-center">{s.installmentNo}</td>
                            <td className="px-2 py-1.5">{s.dueDate}</td>
                            <td className="px-2 py-1.5 text-right">₹{s.emiAmount?.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right text-navy-700">₹{s.principal?.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right text-orange-600">₹{s.interest?.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right text-slate-500">₹{s.balance?.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calculator className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Enter loan details to calculate EMI</p>
              </div>
            )}
          </div>

          <button
            onClick={() => create.mutate({
              customer_id:      form.customer_id,
              amount:           form.amount,
              interest_rate:    getDerivedRate().toFixed(6),
              interest_type:    'flat',
              duration:         form.duration,
              duration_unit:    form.duration_unit,
              emi_frequency:    form.emi_frequency,
              disbursement_date: form.disbursement_date,
              start_date:       form.start_date,
              processing_fee:   form.processing_fee,
              penalty_per_day:  form.penalty_per_day,
              notes:            form.notes,
              loan_type:        form.loan_type,
              loan_reason:      form.loan_reason,
            })}
            disabled={!form.customer_id || !calc || create.isPending}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {create.isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Create Loan</>
            )}
          </button>
          <p className="text-xs text-slate-400 text-center">Loan will be created in "Pending" status and requires admin approval.</p>
        </div>
      </div>
    </div>
  );
}
