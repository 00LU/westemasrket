import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminCompliance } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'User Verification' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/compliance', label: 'Compliance' },
];

export default function AdminCompliancePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'compliance'],
    queryFn: fetchAdminCompliance,
  });

  return (
    <RoleLayout title="Admin - Compliance & Disputes" links={links}>
      {isLoading && <p className="text-sm text-slate-600">Loading compliance status...</p>}
      {isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error?.response?.status === 401 ? 'Unauthorized: please login again as admin.' : 'Unable to load compliance status.'}
        </p>
      )}
      <Card title="RENTri Monitor">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">RENTRI Enabled: {data?.rentriEnabled ? 'Yes' : 'No'}</div>
          <div className="rounded-xl border border-slate-200 p-3">RENTRI Sync: {data?.rentriSync || '-'}</div>
          <div className="rounded-xl border border-slate-200 p-3">Open Disputes: {Number(data?.disputesOpen || 0)}</div>
        </div>
      </Card>
    </RoleLayout>
  );
}
