import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Centers from './pages/Centers';
import Groups from './pages/Groups';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Loans from './pages/Loans';
import LoanDetail from './pages/LoanDetail';
import NewLoan from './pages/NewLoan';
import Collections from './pages/Collections';
import GroupCollection from './pages/GroupCollection';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import BackupSettings from './pages/BackupSettings';
import GroupMembers from './pages/GroupMembers';
import CustomerPortal from './pages/CustomerPortal';
import Receipt from './pages/Receipt';

function ProtectedRoute({ children, allowCustomer = false }: { children: React.ReactNode; allowCustomer?: boolean }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  // Redirect customers to portal unless allowCustomer is true
  if (user?.role === 'customer' && !allowCustomer) return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

function AdminOrStaffRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (user?.role === 'customer') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Customer Portal — standalone, no sidebar */}
        <Route path="/portal" element={
          isAuthenticated() && user?.role === 'customer' ? <CustomerPortal /> : <Navigate to="/login" replace />
        } />

        {/* Receipt — standalone page for printing */}
        <Route path="/receipt/:id" element={
          <ProtectedRoute allowCustomer><Receipt /></ProtectedRoute>
        } />

        {/* Main app layout */}
        <Route path="/" element={<AdminOrStaffRoute><AppLayout /></AdminOrStaffRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="centers" element={<Centers />} />
          <Route path="groups" element={<Groups />} />
          <Route path="groups/:id/members" element={<GroupMembers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="loans" element={<Loans />} />
          <Route path="loans/new" element={<NewLoan />} />
          <Route path="loans/:id" element={<LoanDetail />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/group/:groupId" element={<GroupCollection />} />
          <Route path="staff" element={<Staff />} />
          <Route path="reports" element={<Reports />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="backup" element={<BackupSettings />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated() ? (user?.role === 'customer' ? '/portal' : '/dashboard') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
