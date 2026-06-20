import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingShipments, fetchRecipientNotifications } from '../../services/recipientApi';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/notifications', label: 'Notifications' },
  { to: '/recipient/capacity', label: 'Capacity' },
  { to: '/recipient/incoming', label: 'Incoming' },
];

export default function RecipientDashboard() {
  const notificationsQuery = useQuery({
    queryKey: ['recipient', 'notifications'],
    queryFn: fetchRecipientNotifications,
  });
  const incomingQuery = useQuery({
    queryKey: ['recipient', 'incoming'],
    queryFn: fetchIncomingShipments,
  });

  const notifications = notificationsQuery.data || [];
  const incoming = incomingQuery.data || [];
  const incomingTon = incoming.reduce((sum, item) => sum + Number(item.quantityTon || 0), 0);
  const hasError = notificationsQuery.isError || incomingQuery.isError;

  return (
    <RoleLayout title="Recipient Dashboard" links={links}>
      {hasError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notificationsQuery.error?.response?.status === 401 || incomingQuery.error?.response?.status === 401
            ? 'Unauthorized: please login again as recipient.'
            : 'Unable to load recipient metrics.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Incoming Today"><p className="text-3xl font-bold">{incoming.length}</p></Card>
        <Card title="Incoming Volume"><p className="text-3xl font-bold">{incomingTon.toLocaleString()} ton</p></Card>
        <Card title="Matching Requests"><p className="text-3xl font-bold">{notifications.length}</p></Card>
      </div>
    </RoleLayout>
  );
}
