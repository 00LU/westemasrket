import RoleLayout from '../../components/shared/RoleLayout';
import { Banknote, ClipboardList, Sparkles, Users } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="dark" icon={ClipboardList} label="Ordini totali" value={totalOrders.toLocaleString()} />
        <StatCard tone="accent" icon={Banknote} label="Ricavi piattaforma" value={`EUR ${platformRevenue.toLocaleString()}`} />
        <StatCard icon={Users} label="Utenti attivi" value={activeUsers.toLocaleString()} />
        <StatCard icon={Sparkles} label="Utenti funzioni premium" value={premiumFeatureUsers.toLocaleString()} />
      </div>
    </RoleLayout>
  );
}
