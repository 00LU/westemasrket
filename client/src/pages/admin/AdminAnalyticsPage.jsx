import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminAnalytics } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'User Verification' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/compliance', label: 'Compliance' },
];

export default function AdminAnalyticsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: fetchAdminAnalytics,
  });

  const activeUsers = Number(data?.activeUsers || 0);
  const totalOrders = Number(data?.totalOrders || 0);
  const platformRevenue = Number(data?.platformRevenue || 0);
  const premiumFeatureUsers = Number(data?.premiumFeatureUsers || 0);

  return (
    <RoleLayout title="Admin - Platform Analytics" links={links}>
      {isLoading && <p className="text-sm text-slate-600">Loading analytics...</p>}
      {isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error?.response?.status === 401 ? 'Unauthorized: please login again as admin.' : 'Unable to load analytics.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Total Orders"><p className="text-3xl font-bold">{totalOrders.toLocaleString()}</p></Card>
        <Card title="Platform Revenue"><p className="text-3xl font-bold">EUR {platformRevenue.toLocaleString()}</p></Card>
        <Card title="Active Users"><p className="text-3xl font-bold">{activeUsers.toLocaleString()}</p></Card>
      </div>
      <Card title="Premium Feature Users">
        <p className="text-3xl font-bold">{premiumFeatureUsers.toLocaleString()}</p>
      </Card>
    </RoleLayout>
  );
}
