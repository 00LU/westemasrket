import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/ui/StatusAlert';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminAnalytics } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'Verifica utenti' },
  { to: '/admin/analytics', label: 'Statistiche' },
  { to: '/admin/compliance', label: 'Conformità' },
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
    <RoleLayout title="Admin - Statistiche piattaforma" links={links}>
      {isLoading && <p className="text-sm text-slate-600">Caricamento statistiche...</p>}
      {isError && (
        <StatusAlert variant="error">
          {error?.response?.status === 401 ? 'Non autorizzato: accedi di nuovo come amministratore.' : 'Impossibile caricare le statistiche.'}
        </StatusAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Ordini totali"><p className="text-3xl font-bold">{totalOrders.toLocaleString()}</p></Card>
        <Card title="Ricavi piattaforma"><p className="text-3xl font-bold">EUR {platformRevenue.toLocaleString()}</p></Card>
        <Card title="Utenti attivi"><p className="text-3xl font-bold">{activeUsers.toLocaleString()}</p></Card>
      </div>
      <Card title="Utenti funzioni premium">
        <p className="text-3xl font-bold">{premiumFeatureUsers.toLocaleString()}</p>
      </Card>
    </RoleLayout>
  );
}
