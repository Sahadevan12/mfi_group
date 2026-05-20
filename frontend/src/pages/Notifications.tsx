import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

const typeIcons: Record<string, any> = {
  info: { Icon: Info, cls: 'text-blue-500 bg-blue-50' },
  success: { Icon: CheckCircle, cls: 'text-emerald-500 bg-emerald-50' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-500 bg-amber-50' },
  error: { Icon: XCircle, cls: 'text-red-500 bg-red-50' },
};

export default function Notifications() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/notifications`, { headers: getAuthHeaders() });
      return data;
    },
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => axios.put(`${API}/notifications/${id}/read`, {}, { headers: getAuthHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => axios.put(`${API}/notifications/read-all`, {}, { headers: getAuthHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => axios.delete(`${API}/notifications/${id}`, { headers: getAuthHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAll = useMutation({
    mutationFn: () => axios.delete(`${API}/notifications/clear-all`, { headers: getAuthHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications || [];
  const unread = data?.unread || 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Notifications</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              {unread} unread
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => markAllRead.mutate()}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {user?.role === 'admin' && notifications.some((n: any) => n.is_read) && (
            <button className="btn-danger text-xs py-1.5 px-3" onClick={() => clearAll.mutate()}>
              <Trash2 size={14} /> Clear read
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No notifications</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif: any) => {
              const { Icon, cls } = typeIcons[notif.type] || typeIcons.info;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${!notif.is_read ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cls}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${!notif.is_read ? 'text-navy-900' : 'text-slate-700'}`}>
                          {notif.title}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                        {notif.link && (
                          <a href={notif.link} className="text-xs text-navy-600 hover:underline mt-1 inline-block">
                            View details →
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => markRead.mutate(notif.id)}
                        title="Mark as read"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => deleteNotif.mutate(notif.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
