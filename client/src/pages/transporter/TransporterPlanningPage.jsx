import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { fetchTransporterJobs } from '../../services/transporterApi';

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

function dateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TransporterPlanningPage() {
  const [month, setMonth] = useState(() => new Date());
  const jobsQuery = useQuery({ queryKey: ['transporter', 'planning'], queryFn: fetchTransporterJobs });
  const jobs = jobsQuery.data || [];
  const jobsByDate = useMemo(() => jobs.reduce((map, job) => ({ ...map, [dateKey(job.deadline)]: [...(map[dateKey(job.deadline)] || []), job] }), {}), [jobs]);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });

  return (
    <RoleLayout title="Pianificazione viaggi" links={links}>
      <Card title="Calendario viaggi">
        <div className="mb-4 flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Precedente</Button>
          <strong className="capitalize">{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong>
          <Button type="button" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Successivo</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day, index) => <div key={day?.toISOString() || `empty-${index}`} className={`min-h-20 rounded-lg border p-2 ${day ? 'border-slate-200 bg-white' : 'border-transparent bg-slate-50'}`}>{day && <><p className="text-xs font-semibold">{day.getDate()}</p>{(jobsByDate[dateKey(day)] || []).map((job) => <div key={job.id} className="mt-1 truncate rounded bg-brand-900 px-1 text-[10px] text-white">CER {job.cerCode}</div>)}</>}</div>)}
        </div>
      </Card>
    </RoleLayout>
  );
}
