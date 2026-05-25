import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Building2, Users2, UserCircle, CreditCard,
  Wallet, Users, BarChart3, Receipt, Bell, Settings, LogOut, X,
  Database, Shield
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import client from '../../api/client';

interface NavItem {
  to: string;
  icon: any;
  label: string;
  adminOnly?: boolean;
  badge?: number;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => client.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 30000,
    enabled: !!user && user.role !== 'customer',
  });

  const unreadCount = notifData?.count || 0;

  const navItems: NavItem[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/centers', icon: Building2, label: 'Centers' },
    { to: '/groups', icon: Users2, label: 'Groups' },
    { to: '/customers', icon: UserCircle, label: 'Customers' },
    { to: '/loans', icon: CreditCard, label: 'Loans' },
    { to: '/collections', icon: Wallet, label: 'Collections' },
    { to: '/staff', icon: Users, label: 'Staff', adminOnly: true },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
    { to: '/expenses', icon: Receipt, label: 'Expenses', adminOnly: true },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { to: '/backup', icon: Database, label: 'Backup', adminOnly: true },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(item => !item.adminOnly || user?.role === 'admin');

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        bg-gradient-to-b from-navy-900 to-navy-800
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo.png"
              alt="SPS Group"
              className="w-10 h-10 rounded-lg object-contain bg-white/10 p-0.5"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div className="text-white font-bold text-sm leading-tight">SPS Group</div>
              <div className="text-gold-400 text-xs">of Foundation</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center">
              <span className="text-gold-400 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.name}</div>
              <div className="flex items-center gap-1.5">
                <div className="text-slate-400 text-xs capitalize">{user?.role}</div>
                {user?.role === 'admin' && <Shield size={10} className="text-gold-400" />}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full hover:bg-red-500/20 hover:text-red-300"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
