import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { fetchCurrentUser } from '../../services/profileApi';

const links = [{ to: '/recipient', label: 'Dashboard' }, { to: '/recipient/opportunities', label: 'Ordini compatibili' }, { to: '/recipient/calendar', label: 'Calendario conferimenti' }, { to: '/recipient/incoming', label: 'Arrivi e conferimenti' }, { to: '/recipient/capacity', label: 'Disponibilita e capacita' }, { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' }, { to: '/recipient/earnings', label: 'Corrispettivi' }, { to: '/profile', label: 'Profilo' }];

export default function RecipientFacilitiesPage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['recipient', 'profile'], queryFn: fetchCurrentUser });
  return <RoleLayout title="Impianti e autorizzazioni" links={links}><Card title="Dati impiantistici"><div className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Impianti / sedi</p><p className="font-semibold">{isLoading ? 'Caricamento...' : user?.facilities || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">CER/EER ammessi</p><p className="font-semibold">{user?.cerCodes || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">Operazioni R/D</p><p className="font-semibold">{user?.rdOperations || 'Nessun dato inserito'}</p></div><div><p className="text-slate-500">Stato autorizzazioni</p><Badge tone="warning">Da verificare</Badge></div></div></Card><Card title="Scadenze documentali"><p className="text-sm text-slate-600">Autorizzazioni, prescrizioni e scadenze vengono gestite nella checklist del profilo.</p><a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/profile">Apri checklist documenti</a></Card></RoleLayout>;
}
