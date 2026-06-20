import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchTransporterEarnings } from '../../services/transporterApi';

const links = [
  { to: '/transporter', label: 'Dashboard' },
  { to: '/transporter/notifications', label: 'Notifications' },
  { to: '/transporter/jobs', label: 'Active Jobs' },
  { to: '/transporter/earnings', label: 'Earnings' },
];

export default function EarningsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'earnings'],
    queryFn: fetchTransporterEarnings,
  });

  const gross = Number(data?.gross || 0);
  const jobs = Number(data?.jobs || 0);
  const currency = data?.currency || 'EUR';

  return (
    <RoleLayout title="Earnings History" links={links}>
      <Card title="Revenue Summary">
        {isLoading && <p className="text-sm text-slate-600">Loading earnings...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as transporter.' : 'Unable to load earnings.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">Gross: {currency} {gross.toLocaleString()}</div>
            <div className="rounded-xl border border-slate-200 p-3">Accepted Jobs: {jobs}</div>
            <div className="rounded-xl border border-slate-200 p-3">Average per Job: {currency} {jobs > 0 ? Math.round(gross / jobs).toLocaleString() : '0'}</div>
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
