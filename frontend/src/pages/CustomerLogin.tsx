import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = mobile.trim();
    if (clean.length !== 10 || !/^\d{10}$/.test(clean)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/portal/login', { mobile: clean });
      setAuth(data.user, data.token);
      navigate('/portal', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Mobile number not found. Please contact your branch.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 flex flex-col items-center justify-center px-4">

      {/* Card */}
      <div className="w-full max-w-sm">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <img
              src="/images/logo.png"
              alt="SPS Group"
              className="w-10 h-10 object-contain"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">SPS Group</h1>
          <p className="text-navy-300 text-sm mt-1">of Foundation</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-7">
          <h2 className="text-lg font-bold text-navy-900 mb-1">Customer Portal</h2>
          <p className="text-slate-500 text-sm mb-6">
            Enter your registered mobile number to view your loan details
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Mobile Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  <Phone size={16} className="text-slate-400" />
                  <span className="text-slate-400 text-sm font-medium border-r border-slate-200 pr-2">+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={mobile}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setMobile(val);
                    if (error) setError('');
                  }}
                  className={`w-full pl-24 pr-4 py-3 border rounded-xl text-base font-medium tracking-widest outline-none transition-all
                    ${error
                      ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
                      : 'border-slate-200 focus:border-navy-500 focus:ring-2 focus:ring-navy-100'
                    }`}
                  autoFocus
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-red-600 text-xs leading-snug">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || mobile.length !== 10}
              className="w-full flex items-center justify-center gap-2 bg-navy-800 hover:bg-navy-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Verifying…</>
              ) : (
                <>View My Details <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        {/* Staff login link */}
        <p className="text-center mt-5 text-navy-400 text-xs">
          Are you staff?{' '}
          <a href="/login" className="text-navy-200 hover:text-white underline underline-offset-2 transition-colors">
            Staff Login
          </a>
        </p>
      </div>
    </div>
  );
}
