import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProducerDashboard from './pages/producer/ProducerDashboard';
import NewRequestPage from './pages/producer/NewRequestPage';
import RecurringOrdersPage from './pages/producer/RecurringOrdersPage';
import TransporterDashboard from './pages/transporter/TransporterDashboard';
import TransporterNotificationsPage from './pages/transporter/TransporterNotificationsPage';
import ActiveJobsPage from './pages/transporter/ActiveJobsPage';
import EarningsPage from './pages/transporter/EarningsPage';
import TransporterPlanningPage from './pages/transporter/TransporterPlanningPage';
import TransporterFleetPage from './pages/transporter/TransporterFleetPage';
import TransporterAuthorizationsPage from './pages/transporter/TransporterAuthorizationsPage';
import RecipientDashboard from './pages/recipient/RecipientDashboard';
import RecipientNotificationsPage from './pages/recipient/RecipientNotificationsPage';
import CapacityPage from './pages/recipient/CapacityPage';
import IncomingPage from './pages/recipient/IncomingPage';
import RecipientCalendarPage from './pages/recipient/RecipientCalendarPage';
import RecipientFacilitiesPage from './pages/recipient/RecipientFacilitiesPage';
import RecipientEarningsPage from './pages/recipient/RecipientEarningsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCompliancePage from './pages/admin/AdminCompliancePage';
import UserProfilePage from './pages/shared/UserProfilePage';

function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/auth/login" replace />;
  return children;
}

export default function App() {
  const { restore } = useAuth();

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/profile" element={<ProtectedRoute roles={['producer', 'transporter', 'recipient', 'admin']}><UserProfilePage /></ProtectedRoute>} />

      <Route path="/producer" element={<ProtectedRoute roles={['producer']}><ProducerDashboard /></ProtectedRoute>} />
      <Route path="/producer/new-request" element={<ProtectedRoute roles={['producer']}><NewRequestPage /></ProtectedRoute>} />
      <Route path="/producer/recurring-orders" element={<ProtectedRoute roles={['producer']}><RecurringOrdersPage /></ProtectedRoute>} />

      <Route path="/transporter" element={<ProtectedRoute roles={['transporter']}><TransporterDashboard /></ProtectedRoute>} />
      <Route path="/transporter/notifications" element={<ProtectedRoute roles={['transporter']}><TransporterNotificationsPage /></ProtectedRoute>} />
      <Route path="/transporter/opportunities" element={<ProtectedRoute roles={['transporter']}><TransporterNotificationsPage /></ProtectedRoute>} />
      <Route path="/transporter/planning" element={<ProtectedRoute roles={['transporter']}><TransporterPlanningPage /></ProtectedRoute>} />
      <Route path="/transporter/jobs" element={<ProtectedRoute roles={['transporter']}><ActiveJobsPage /></ProtectedRoute>} />
      <Route path="/transporter/fleet" element={<ProtectedRoute roles={['transporter']}><TransporterFleetPage /></ProtectedRoute>} />
      <Route path="/transporter/authorizations" element={<ProtectedRoute roles={['transporter']}><TransporterAuthorizationsPage /></ProtectedRoute>} />
      <Route path="/transporter/earnings" element={<ProtectedRoute roles={['transporter']}><EarningsPage /></ProtectedRoute>} />

      <Route path="/recipient" element={<ProtectedRoute roles={['recipient']}><RecipientDashboard /></ProtectedRoute>} />
      <Route path="/recipient/notifications" element={<ProtectedRoute roles={['recipient']}><RecipientNotificationsPage /></ProtectedRoute>} />
      <Route path="/recipient/opportunities" element={<ProtectedRoute roles={['recipient']}><RecipientNotificationsPage /></ProtectedRoute>} />
      <Route path="/recipient/calendar" element={<ProtectedRoute roles={['recipient']}><RecipientCalendarPage /></ProtectedRoute>} />
      <Route path="/recipient/capacity" element={<ProtectedRoute roles={['recipient']}><CapacityPage /></ProtectedRoute>} />
      <Route path="/recipient/incoming" element={<ProtectedRoute roles={['recipient']}><IncomingPage /></ProtectedRoute>} />
      <Route path="/recipient/facilities" element={<ProtectedRoute roles={['recipient']}><RecipientFacilitiesPage /></ProtectedRoute>} />
      <Route path="/recipient/earnings" element={<ProtectedRoute roles={['recipient']}><RecipientEarningsPage /></ProtectedRoute>} />

      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/compliance" element={<ProtectedRoute roles={['admin']}><AdminCompliancePage /></ProtectedRoute>} />
    </Routes>
  );
}
