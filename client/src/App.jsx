import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import StatusAlert from './components/ui/StatusAlert';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NewRequestPage from './pages/producer/NewRequestPage';
import RecurringOrdersPage from './pages/producer/RecurringOrdersPage';
import ProducerPickupPage from './pages/producer/ProducerPickupPage';
import EarningsPage from './pages/transporter/EarningsPage';
import RecipientEarningsPage from './pages/recipient/RecipientEarningsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCompliancePage from './pages/admin/AdminCompliancePage';
import UserProfilePage from './pages/shared/UserProfilePage';
import OperatorPickupPage from './pages/shared/OperatorPickupPage';
import RequestsPage from './pages/shared/RequestsPage';
import AgendaPage from './pages/shared/AgendaPage';
import ProducerEarningsPage from './pages/producer/ProducerEarningsPage';

function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/auth/login" replace />;
  return children;
}

export default function App() {
  const { loading, sessionError } = useAuth();
  if (loading) return <p role="status" className="p-6">Verifica sessione...</p>;
  if (sessionError) return <div className="p-6"><StatusAlert variant="error">{sessionError}</StatusAlert></div>;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/profile" element={<ProtectedRoute roles={['producer', 'transporter', 'recipient', 'admin']}><UserProfilePage /></ProtectedRoute>} />

      <Route path="/producer" element={<ProtectedRoute roles={['producer']}><Navigate to="/producer/requests" replace /></ProtectedRoute>} />
      <Route path="/producer/requests" element={<ProtectedRoute roles={['producer']}><RequestsPage role="producer" /></ProtectedRoute>} />
      <Route path="/producer/requests/:id" element={<ProtectedRoute roles={['producer']}><ProducerPickupPage /></ProtectedRoute>} />
      <Route path="/producer/requests/:id/edit" element={<ProtectedRoute roles={['producer']}><NewRequestPage /></ProtectedRoute>} />
      <Route path="/producer/agenda" element={<ProtectedRoute roles={['producer']}><AgendaPage role="producer" /></ProtectedRoute>} />
      <Route path="/producer/earnings" element={<ProtectedRoute roles={['producer']}><ProducerEarningsPage /></ProtectedRoute>} />
      <Route path="/producer/new-request" element={<ProtectedRoute roles={['producer']}><NewRequestPage /></ProtectedRoute>} />
      <Route path="/producer/pickups/:id" element={<ProtectedRoute roles={['producer']}><ProducerPickupPage /></ProtectedRoute>} />
      <Route path="/producer/pickups/:id/edit" element={<ProtectedRoute roles={['producer']}><NewRequestPage /></ProtectedRoute>} />
      <Route path="/producer/recurring-orders" element={<ProtectedRoute roles={['producer']}><RecurringOrdersPage /></ProtectedRoute>} />

      <Route path="/transporter" element={<ProtectedRoute roles={['transporter']}><Navigate to="/transporter/requests" replace /></ProtectedRoute>} />
      <Route path="/transporter/requests" element={<ProtectedRoute roles={['transporter']}><RequestsPage role="transporter" /></ProtectedRoute>} />
      <Route path="/transporter/requests/:id" element={<ProtectedRoute roles={['transporter']}><OperatorPickupPage role="transporter" /></ProtectedRoute>} />
      <Route path="/transporter/agenda" element={<ProtectedRoute roles={['transporter']}><AgendaPage role="transporter" /></ProtectedRoute>} />
      <Route path="/transporter/pickups/:id" element={<ProtectedRoute roles={['transporter']}><OperatorPickupPage role="transporter" /></ProtectedRoute>} />
      <Route path="/transporter/notifications" element={<ProtectedRoute roles={['transporter']}><Navigate to="/transporter/requests?status=action" replace /></ProtectedRoute>} />
      <Route path="/transporter/opportunities" element={<ProtectedRoute roles={['transporter']}><Navigate to="/transporter/requests?status=action" replace /></ProtectedRoute>} />
      <Route path="/transporter/planning" element={<ProtectedRoute roles={['transporter']}><Navigate to="/transporter/agenda" replace /></ProtectedRoute>} />
      <Route path="/transporter/jobs" element={<ProtectedRoute roles={['transporter']}><Navigate to="/transporter/requests?status=agreement" replace /></ProtectedRoute>} />
      <Route path="/transporter/fleet" element={<ProtectedRoute roles={['transporter']}><Navigate to="/profile#technical" replace /></ProtectedRoute>} />
      <Route path="/transporter/authorizations" element={<ProtectedRoute roles={['transporter']}><Navigate to="/profile#technical" replace /></ProtectedRoute>} />
      <Route path="/transporter/earnings" element={<ProtectedRoute roles={['transporter']}><EarningsPage /></ProtectedRoute>} />

      <Route path="/recipient" element={<ProtectedRoute roles={['recipient']}><Navigate to="/recipient/requests" replace /></ProtectedRoute>} />
      <Route path="/recipient/requests" element={<ProtectedRoute roles={['recipient']}><RequestsPage role="recipient" /></ProtectedRoute>} />
      <Route path="/recipient/requests/:id" element={<ProtectedRoute roles={['recipient']}><OperatorPickupPage role="recipient" /></ProtectedRoute>} />
      <Route path="/recipient/agenda" element={<ProtectedRoute roles={['recipient']}><AgendaPage role="recipient" /></ProtectedRoute>} />
      <Route path="/recipient/pickups/:id" element={<ProtectedRoute roles={['recipient']}><OperatorPickupPage role="recipient" /></ProtectedRoute>} />
      <Route path="/recipient/notifications" element={<ProtectedRoute roles={['recipient']}><Navigate to="/recipient/requests?status=action" replace /></ProtectedRoute>} />
      <Route path="/recipient/opportunities" element={<ProtectedRoute roles={['recipient']}><Navigate to="/recipient/requests?status=action" replace /></ProtectedRoute>} />
      <Route path="/recipient/calendar" element={<ProtectedRoute roles={['recipient']}><Navigate to="/recipient/agenda" replace /></ProtectedRoute>} />
      <Route path="/recipient/incoming" element={<ProtectedRoute roles={['recipient']}><Navigate to="/recipient/requests?status=agreement" replace /></ProtectedRoute>} />
      <Route path="/recipient/capacity" element={<ProtectedRoute roles={['recipient']}><Navigate to="/profile#technical" replace /></ProtectedRoute>} />
      <Route path="/recipient/facilities" element={<ProtectedRoute roles={['recipient']}><Navigate to="/profile#technical" replace /></ProtectedRoute>} />
      <Route path="/recipient/earnings" element={<ProtectedRoute roles={['recipient']}><RecipientEarningsPage /></ProtectedRoute>} />

      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/compliance" element={<ProtectedRoute roles={['admin']}><AdminCompliancePage /></ProtectedRoute>} />
    </Routes>
  );
}
