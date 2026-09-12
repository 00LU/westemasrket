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

export default function TransporterFleetPage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['transporter', 'profile'], queryFn: fetchCurrentUser });
  return <RoleLayout title="Mezzi e conducenti" links={links}>
    <Card title="Parco mezzi e rimorchi">
      {isLoading ? <p className="text-sm text-slate-600">Caricamento dati...</p> : <div className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Parco mezzi</p><p className="font-semibold">{user?.vehicleFleet || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">Conducenti</p><p className="font-semibold">{user?.drivers || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">Regioni operative</p><p className="font-semibold">{user?.operatingRegions || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">Stato documentazione</p><Badge tone="warning">Da verificare</Badge></div></div>}
    </Card>
    <Card title="Documenti collegati"><p className="text-sm text-slate-600">Le autorizzazioni e i documenti dei mezzi vengono gestiti nella checklist del profilo.</p><a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/profile">Apri checklist documenti</a></Card>
  </RoleLayout>;
}
