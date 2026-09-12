import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { fetchCurrentUser } from '../../services/profileApi';

const links = [
  { to: '/transporter', label: 'Dashboard' },
  { to: '/transporter/opportunities', label: 'Opportunita e aste' },
  { to: '/transporter/planning', label: 'Pianificazione viaggi' },
  { to: '/transporter/jobs', label: 'Lavori assegnati' },
  { to: '/transporter/fleet', label: 'Mezzi e conducenti' },
  { to: '/transporter/authorizations', label: 'Autorizzazioni' },
  { to: '/transporter/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function TransporterAuthorizationsPage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['transporter', 'profile'], queryFn: fetchCurrentUser });
  return <RoleLayout title="Autorizzazioni e scadenze" links={links}>
    <Card title="Autorizzazioni trasporto">
      {isLoading ? <p className="text-sm text-slate-600">Caricamento autorizzazioni...</p> : <div className="space-y-3 text-sm"><div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span>{user?.transportAuthorizations || 'Nessuna autorizzazione inserita'}</span><Badge tone="warning">Da verificare</Badge></div><p className="text-slate-600">Le scadenze saranno controllate per ogni nuova movimentazione, senza riutilizzare automaticamente l’esito precedente.</p></div>}
    </Card>
    <Card title="Checklist documenti"><p className="text-sm text-slate-600">Carica o aggiorna licenze, iscrizioni e allegati nella pagina Profilo.</p><a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/profile">Vai al profilo</a></Card>
  </RoleLayout>;
}
