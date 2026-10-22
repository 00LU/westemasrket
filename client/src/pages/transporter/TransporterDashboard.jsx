import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchTransporterEarnings, fetchTransporterPickups } from '../../services/transporterApi';

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

export default function TransporterDashboard() {
  const pickupsQuery = useQuery({
    queryKey: ['transporter', 'pickups'],
    queryFn: fetchTransporterPickups,
  });
  const earningsQuery = useQuery({
    queryKey: ['transporter', 'earnings'],
    queryFn: fetchTransporterEarnings,
  });

  const pickups = pickupsQuery.data || [];
  const notifications = pickups.filter((item) => item.stage === 'to_respond');
  const jobs = pickups
    .filter((item) => ['in_agreement', 'confirmed'].includes(item.stage))
    .map((item) => ({ ...item, deadline: item.scheduledAt || item.deadline }));
  const earnings = earningsQuery.data || { gross: 0, currency: 'EUR' };
  const hasError = pickupsQuery.isError || earningsQuery.isError;

  const workingJobs = jobs.filter((job) => job.stage === 'in_agreement');
  const confirmedJobs = jobs.filter((job) => job.stage === 'confirmed');

  return (
    <RoleLayout title="Dashboard Trasportatore" links={links}>
      {hasError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pickupsQuery.error?.response?.status === 401 || earningsQuery.error?.response?.status === 401
            ? 'Unauthorized: please login again as transporter.'
            : 'Unable to load transporter metrics.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Nuovi ordini compatibili"><p className="text-3xl font-bold">{notifications.length}</p><p className="mt-1 text-sm text-slate-500">Richieste su cui fare una proposta</p></Card>
        <Card title="Lavori in corso"><p className="text-3xl font-bold">{workingJobs.length}</p><p className="mt-1 text-sm text-slate-500">Data e ora da concordare</p></Card>
        <Card title="Corrispettivi"><p className="text-3xl font-bold">{earnings.currency} {Number(earnings.gross || 0).toLocaleString()}</p><p className="mt-1 text-sm text-slate-500">{earnings.jobs || 0} lavori confermati</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Nuovi ordini e aste attive" action={<a className="text-sm font-semibold text-brand-900" href="/transporter/opportunities">Vedi tutti</a>}>
          {notifications.length === 0 && <p className="text-sm text-slate-600">Nessun ordine compatibile al momento.</p>}
          <div className="space-y-2 text-sm">
            {notifications.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"><span>CER {item.cerCode} · {item.quantityTon} ton</span><span className="text-slate-500">{item.deadline ? new Date(item.deadline).toLocaleDateString('it-IT') : '-'}</span></div>)}
          </div>
        </Card>
        <Card title="Pianificazione e calendario viaggi" action={<a className="text-sm font-semibold text-brand-900" href="/transporter/planning">Apri calendario</a>}>
          {jobs.length === 0 && <p className="text-sm text-slate-600">Nessun viaggio pianificato.</p>}
          <div className="space-y-2 text-sm">
            {jobs.slice(0, 4).map((job) => <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"><span>{job.pickupAddress}</span><strong>{job.deadline ? new Date(job.deadline).toLocaleDateString('it-IT') : '-'}</strong></div>)}
          </div>
        </Card>
        <Card title="Tracking e assistenza">
          <p className="text-sm text-slate-600">In accordo: {workingJobs.length} · Confermati: {confirmedJobs.length}</p>
          <p className="mt-2 text-sm text-slate-600">Anomalie / assistenza aperte: 0</p>
          <a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/transporter/jobs">Gestisci i lavori</a>
        </Card>
        <Card title="Mezzi, conducenti e documenti">
          <p className="text-sm text-slate-600">Gestisci il parco mezzi, i conducenti e le scadenze autorizzative.</p>
          <a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/transporter/fleet">Apri gestione mezzi</a>
        </Card>
      </div>
    </RoleLayout>
  );
}
