import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Database, Download, Trash2, Plus, RefreshCw, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function getHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function BackupSettings() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/backup/list`, { headers: getHeaders() });
      return data;
    },
  });

  const createBackup = useMutation({
    mutationFn: () => axios.post(`${API}/backup/create`, {}, { headers: getHeaders() }),
    onMutate: () => setCreating(true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); setCreating(false); },
    onError: () => setCreating(false),
  });

  const deleteBackup = useMutation({
    mutationFn: (filename: string) => axios.delete(`${API}/backup/${filename}`, { headers: getHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const handleDownload = (filename: string) => {
    const a = document.createElement('a');
    a.download = filename;
    fetch(`${API}/backup/download/${filename}`, { headers: getHeaders() as any })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Backup & Restore</h1>
          <p className="text-sm text-slate-500 mt-0.5">Database backups are created automatically every day at 9 AM</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => createBackup.mutate()}
          disabled={creating}
        >
          {creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {createBackup.isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          ✓ Backup created: {createBackup.data?.data?.filename}
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Backup Schedule</p>
          <ul className="space-y-0.5 text-blue-600">
            <li>• <strong>Auto backup:</strong> Daily at 9:00 AM (last 7 kept)</li>
            <li>• <strong>Manual backup:</strong> On-demand via "Create Backup" button</li>
            <li>• Download the .db file and store it in a safe location</li>
          </ul>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Backup History</h2>
          <button className="btn-secondary text-xs py-1" onClick={() => qc.invalidateQueries({ queryKey: ['backups'] })}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-7 h-7 border-4 border-navy-800 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(backups || []).map((b: any) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                  <Database size={20} className="text-navy-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{b.filename}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500">{formatBytes(b.file_size)}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(b.created_at), 'dd MMM yyyy, hh:mm a')}
                    </span>
                    {b.created_by_name && (
                      <>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{b.created_by_name}</span>
                      </>
                    )}
                    {b.filename.startsWith('auto_') && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">auto</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(b.filename)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <Download size={14} /> Download
                  </button>
                  <button
                    onClick={() => { if (window.confirm('Delete this backup?')) deleteBackup.mutate(b.filename); }}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {(!backups || backups.length === 0) && (
              <div className="text-center py-12 text-slate-400">
                <Database size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No backups yet</p>
                <p className="text-sm mt-1">Create your first backup now</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
