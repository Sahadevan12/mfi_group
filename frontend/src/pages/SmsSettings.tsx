import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Send, MessageSquare, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function getHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

const defaultTemplates = {
  template_due_reminder: 'Dear {name}, your EMI of Rs.{amount} for loan {loan_no} is due on {date}. Please pay on time. -SPS Group',
  template_payment_success: 'Dear {name}, payment of Rs.{amount} received for loan {loan_no}. Receipt: {receipt}. -SPS Group',
  template_loan_approved: 'Dear {name}, your loan of Rs.{amount} (Loan No: {loan_no}) has been approved. EMI: Rs.{emi}/{freq}. -SPS Group',
  template_overdue: 'Dear {name}, your EMI for loan {loan_no} is overdue by {days} days. Amt due: Rs.{amount}. Please contact us. -SPS Group',
};

export default function SmsSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider: 'fast2sms',
    api_key: '',
    sender_id: 'FSTSMS',
    is_active: false,
    ...defaultTemplates,
  });
  const [testMobile, setTestMobile] = useState('');
  const [testMsg, setTestMsg] = useState('Test message from SPS Group MFI.');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');

  const { data: settings } = useQuery({
    queryKey: ['sms-settings'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/sms/settings`, { headers: getHeaders() });
      return data;
    },
  });

  useEffect(() => {
    if (settings) setForm({ ...form, ...settings, is_active: !!settings.is_active });
  }, [settings]);

  const { data: logsData } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/sms/logs?limit=50`, { headers: getHeaders() });
      return data;
    },
    enabled: activeTab === 'logs',
  });

  const saveSettings = useMutation({
    mutationFn: () => axios.put(`${API}/sms/settings`, form, { headers: getHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms-settings'] }),
  });

  const sendTest = useMutation({
    mutationFn: () => axios.post(`${API}/sms/test`, { mobile: testMobile, message: testMsg }, { headers: getHeaders() }),
    onSuccess: (res) => setTestResult({ success: res.data.success, message: res.data.message }),
    onError: () => setTestResult({ success: false, message: 'Failed to send test SMS' }),
  });

  const sendDueReminders = useMutation({
    mutationFn: () => axios.post(`${API}/sms/send-due-reminders`, { days: 3 }, { headers: getHeaders() }),
  });

  const sendOverdueAlerts = useMutation({
    mutationFn: () => axios.post(`${API}/sms/send-overdue-alerts`, {}, { headers: getHeaders() }),
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h1 className="page-title">SMS Settings</h1>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs py-1.5"
            onClick={() => sendDueReminders.mutate()}
            disabled={sendDueReminders.isPending}
          >
            <Send size={14} /> Due Reminders
          </button>
          <button
            className="btn-secondary text-xs py-1.5"
            onClick={() => sendOverdueAlerts.mutate()}
            disabled={sendOverdueAlerts.isPending}
          >
            <Send size={14} /> Overdue Alerts
          </button>
        </div>
      </div>

      {(sendDueReminders.data || sendOverdueAlerts.data) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          {sendDueReminders.data?.data?.message || sendOverdueAlerts.data?.data?.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['settings', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-white shadow text-navy-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Provider Config */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-navy-900 flex items-center gap-2">
              <MessageSquare size={18} /> Provider Configuration
            </h2>

            <div>
              <label className="label">Provider</label>
              <select className="input" value={form.provider}
                onChange={e => {
                  const p = e.target.value;
                  setForm({ ...form, provider: p, sender_id: p === 'fast2sms' ? 'FSTSMS' : 'SPSGRP' });
                }}>
                <option value="fast2sms">Fast2SMS — ₹0.10/SMS (No DLT needed ✓)</option>
                <option value="msg91">MSG91 — ₹0.15/SMS (DLT required)</option>
                <option value="twilio">Twilio — International</option>
              </select>
            </div>

            {/* Provider-specific info box */}
            {form.provider === 'fast2sms' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-emerald-800">Fast2SMS Setup (3 steps):</p>
                <ol className="list-decimal list-inside space-y-1 text-emerald-700">
                  <li>Go to <strong>fast2sms.com</strong> → Sign Up (free)</li>
                  <li>Dashboard → <strong>Dev API</strong> → Copy API Key</li>
                  <li>Paste API Key below → Enable → Save</li>
                </ol>
                <p className="text-emerald-600 pt-1">✓ Quick route — no DLT registration needed · ₹0.10–₹0.16/SMS</p>
              </div>
            )}
            {form.provider === 'msg91' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                ⚠️ MSG91 requires <strong>DLT registration</strong> before SMS delivery. Register at trai.gov.in first.
              </div>
            )}

            <div>
              <label className="label">
                API Key
                {form.provider === 'twilio' && <span className="text-slate-400 normal-case ml-1">(format: accountSid:authToken)</span>}
              </label>
              <input
                type="password"
                className="input"
                value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                placeholder={
                  form.provider === 'fast2sms' ? 'Paste Fast2SMS API Key here' :
                  form.provider === 'msg91'    ? 'Enter MSG91 Auth Key' :
                  'Enter accountSid:authToken'
                }
              />
            </div>

            <div>
              <label className="label">
                Sender ID
                {form.provider === 'fast2sms' && <span className="text-slate-400 normal-case ml-1">(FSTSMS for quick route)</span>}
              </label>
              <input
                className={`input ${form.provider === 'fast2sms' ? 'bg-slate-50 text-slate-400' : ''}`}
                value={form.sender_id}
                readOnly={form.provider === 'fast2sms'}
                onChange={e => setForm({ ...form, sender_id: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm font-medium">{form.is_active ? 'SMS Enabled' : 'SMS Disabled'}</span>
            </div>

            <button
              className="btn-primary w-full"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              <Save size={16} /> {saveSettings.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            {saveSettings.isSuccess && <p className="text-emerald-600 text-sm text-center">✓ Settings saved</p>}
          </div>

          {/* Test SMS */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-navy-900">Test SMS</h2>
            <div>
              <label className="label">Mobile Number</label>
              <input className="input" value={testMobile} onChange={e => setTestMobile(e.target.value)} placeholder="91XXXXXXXXXX" />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input" rows={3} value={testMsg} onChange={e => setTestMsg(e.target.value)} />
            </div>
            <button
              className="btn-gold w-full"
              onClick={() => { setTestResult(null); sendTest.mutate(); }}
              disabled={sendTest.isPending || !testMobile}
            >
              <Send size={16} /> {sendTest.isPending ? 'Sending...' : 'Send Test SMS'}
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="card space-y-4 lg:col-span-2">
            <h2 className="font-semibold text-navy-900">Message Templates</h2>
            <p className="text-xs text-slate-500">Variables: {'{name}'}, {'{amount}'}, {'{loan_no}'}, {'{date}'}, {'{receipt}'}, {'{emi}'}, {'{freq}'}, {'{days}'}</p>

            {([
              { key: 'template_due_reminder', label: 'Due Reminder' },
              { key: 'template_payment_success', label: 'Payment Success' },
              { key: 'template_loan_approved', label: 'Loan Approved' },
              { key: 'template_overdue', label: 'Overdue Alert' },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <textarea
                  className="input"
                  rows={2}
                  value={(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1">{(form as any)[key]?.length || 0} chars</p>
              </div>
            ))}

            <button
              className="btn-primary"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              <Save size={16} /> Save Templates
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">SMS Logs</h2>
            <button className="btn-secondary text-xs py-1" onClick={() => qc.invalidateQueries({ queryKey: ['sms-logs'] })}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left">Mobile</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Message</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(logsData?.logs || []).map((log: any) => (
                  <tr key={log.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs">{log.mobile}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{log.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{log.message}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                        log.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {format(new Date(log.created_at), 'dd/MM HH:mm')}
                    </td>
                  </tr>
                ))}
                {(!logsData?.logs?.length) && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No SMS logs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
