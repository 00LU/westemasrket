import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import CoverageZoneMap from '../../components/map/CoverageZoneMap';
import { useQuery } from '@tanstack/react-query';
import { fetchTransporterEarnings, fetchTransporterJobs, fetchTransporterNotifications } from '../../services/transporterApi';

const links = [
  { to: '/transporter', label: 'Dashboard' },
  { to: '/transporter/notifications', label: 'Notifications' },
  { to: '/transporter/jobs', label: 'Active Jobs' },
  { to: '/transporter/earnings', label: 'Earnings' },
];

export default function TransporterDashboard() {
  const notificationsQuery = useQuery({
    queryKey: ['transporter', 'notifications'],
    queryFn: fetchTransporterNotifications,
  });
  const jobsQuery = useQuery({
    queryKey: ['transporter', 'jobs'],
    queryFn: fetchTransporterJobs,
  });
  const earningsQuery = useQuery({
    queryKey: ['transporter', 'earnings'],
    queryFn: fetchTransporterEarnings,
  });

  const notifications = notificationsQuery.data || [];
  const jobs = jobsQuery.data || [];
  const earnings = earningsQuery.data || { gross: 0, currency: 'EUR' };
  const hasError = notificationsQuery.isError || jobsQuery.isError || earningsQuery.isError;

  return (
    <RoleLayout title="Transporter Dashboard" links={links}>
      {hasError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notificationsQuery.error?.response?.status === 401 || jobsQuery.error?.response?.status === 401 || earningsQuery.error?.response?.status === 401
            ? 'Unauthorized: please login again as transporter.'
            : 'Unable to load transporter metrics.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Compatible Requests"><p className="text-3xl font-bold">{notifications.length}</p></Card>
        <Card title="Active Jobs"><p className="text-3xl font-bold">{jobs.length}</p></Card>
        <Card title="Revenue"><p className="text-3xl font-bold">{earnings.currency} {Number(earnings.gross || 0).toLocaleString()}</p></Card>
      </div>
      <CoverageZoneMap />
    </RoleLayout>
  );
}
