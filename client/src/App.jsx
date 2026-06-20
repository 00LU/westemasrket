import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProducerDashboard from './pages/producer/ProducerDashboard';
import NewRequestPage from './pages/producer/NewRequestPage';
import AuctionRoomPage from './pages/producer/AuctionRoomPage';
import ProducerOrdersPage from './pages/producer/ProducerOrdersPage';
import TransporterDashboard from './pages/transporter/TransporterDashboard';
import TransporterNotificationsPage from './pages/transporter/TransporterNotificationsPage';
import ActiveJobsPage from './pages/transporter/ActiveJobsPage';
import EarningsPage from './pages/transporter/EarningsPage';
import RecipientDashboard from './pages/recipient/RecipientDashboard';
import RecipientNotificationsPage from './pages/recipient/RecipientNotificationsPage';
import CapacityPage from './pages/recipient/CapacityPage';
import IncomingPage from './pages/recipient/IncomingPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCompliancePage from './pages/admin/AdminCompliancePage';

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

      <Route path="/producer" element={<ProtectedRoute roles={['producer']}><ProducerDashboard /></ProtectedRoute>} />
      <Route path="/producer/new-request" element={<ProtectedRoute roles={['producer']}><NewRequestPage /></ProtectedRoute>} />
      <Route path="/producer/auction/:id" element={<ProtectedRoute roles={['producer']}><AuctionRoomPage /></ProtectedRoute>} />
      <Route path="/producer/orders" element={<ProtectedRoute roles={['producer']}><ProducerOrdersPage /></ProtectedRoute>} />

      <Route path="/transporter" element={<ProtectedRoute roles={['transporter']}><TransporterDashboard /></ProtectedRoute>} />
      <Route path="/transporter/notifications" element={<ProtectedRoute roles={['transporter']}><TransporterNotificationsPage /></ProtectedRoute>} />
      <Route path="/transporter/jobs" element={<ProtectedRoute roles={['transporter']}><ActiveJobsPage /></ProtectedRoute>} />
      <Route path="/transporter/earnings" element={<ProtectedRoute roles={['transporter']}><EarningsPage /></ProtectedRoute>} />

      <Route path="/recipient" element={<ProtectedRoute roles={['recipient']}><RecipientDashboard /></ProtectedRoute>} />
      <Route path="/recipient/notifications" element={<ProtectedRoute roles={['recipient']}><RecipientNotificationsPage /></ProtectedRoute>} />
      <Route path="/recipient/capacity" element={<ProtectedRoute roles={['recipient']}><CapacityPage /></ProtectedRoute>} />
      <Route path="/recipient/incoming" element={<ProtectedRoute roles={['recipient']}><IncomingPage /></ProtectedRoute>} />

      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/compliance" element={<ProtectedRoute roles={['admin']}><AdminCompliancePage /></ProtectedRoute>} />
    </Routes>
  );
}
