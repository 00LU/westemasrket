import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import { producerLinks, recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchProducerPickup, fetchProducerPickups } from '../../services/producerApi';
import { fetchRecipientPickup, fetchRecipientPickups } from '../../services/recipientApi';
import { fetchTransporterPickup, fetchTransporterPickups } from '../../services/transporterApi';
import { errorMessage, formatDateTime, formatEuro, ROLE_LABELS } from '../../services/labels';

const configs = {
  producer: {
    title: 'Agenda · Ritiri confermati',
    links: producerLinks,
    fetchList: fetchProducerPickups,
    fetchOne: fetchProducerPickup,
    detailPath: (id) => `/producer/pickups/${id}`,
  },
  recipient: {
    title: 'Agenda · Conferimenti confermati',
    links: recipientLinks,
    fetchList: fetchRecipientPickups,
    fetchOne: fetchRecipientPickup,
    detailPath: (id) => `/recipient/pickups/${id}`,
  },
  transporter: {
    title: 'Agenda · Viaggi confermati',
    links: transporterLinks,
    fetchList: fetchTransporterPickups,
    fetchOne: fetchTransporterPickup,
    detailPath: (id) => `/transporter/pickups/${id}`,
  },
};

function makeDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : makeDateKey(date);
}

function normalizeEvent(role, item, detail) {
  if (role === 'producer') {
    const request = detail.request;
    const pkg = detail.currentPackage;
    const agreement = detail.agreement;
    const recipients = pkg?.recipient?.companyName || agreement?.parties?.recipient?.companyName;
    const transporters = pkg?.transporter?.companyName || agreement?.parties?.transporter?.companyName;
    return {
      id: item.id,
      scheduledAt: request.confirmedSlotAt,
      cerCode: request.cerCode,
      quantityTon: request.quantityTon,
      pickupAddress: request.pickupAddress,
      destinationAddress: pkg?.recipient?.destinationAddress || agreement?.parties?.recipient?.destinationAddress,
      partners: [
        recipients && `${ROLE_LABELS.recipient}: ${recipients}`,
        transporters && `${ROLE_LABELS.transporter}: ${transporters}`,
      ].filter(Boolean),
      packageLabel: pkg ? `Pacchetto #${pkg.rank} · ${formatEuro(pkg.totalPrice)}` : 'Pacchetto confermato',
    };
  }

  const agreement = detail.agreement;
  const parties = agreement?.parties || {};
  const partners = role === 'recipient'
    ? [
        parties.producer?.companyName && `${ROLE_LABELS.producer}: ${parties.producer.companyName}`,
        parties.transporter?.companyName && `${ROLE_LABELS.transporter}: ${parties.transporter.companyName}`,
      ]
    : [
        parties.producer?.companyName && `${ROLE_LABELS.producer}: ${parties.producer.companyName}`,
        parties.recipient?.companyName && `${ROLE_LABELS.recipient}: ${parties.recipient.companyName}`,
      ];

  return {
    id: item.id,
    scheduledAt: item.scheduledAt,
    cerCode: item.cerCode,
    quantityTon: item.quantityTon,
    pickupAddress: item.pickupAddress,
    destinationAddress: role === 'recipient'
      ? item.myResponse?.destinationAddress || agreement?.pricing?.destinationAddress
      : parties.recipient?.destinationAddress,
    partners: partners.filter(Boolean),
    packageLabel: agreement?.packageId
      ? `Pacchetto selezionato · ${formatEuro(role === 'recipient' ? agreement.pricing?.treatmentPrice : agreement.pricing?.transportPrice)}`
      : 'Pacchetto confermato',
  };
}

async function loadAgenda(config, role) {
  const items = await config.fetchList();
  const confirmed = items.filter((item) => role === 'producer' ? item.status === 'confirmed' : item.stage === 'confirmed');
  return Promise.all(confirmed.map(async (item) => {
    const detail = await config.fetchOne(item.id);
    return normalizeEvent(role, item, detail);
  }));
}

function getCalendarDays(anchor, mode) {
  if (mode === 'week') {
    const first = new Date(anchor);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(first);
      day.setDate(first.getDate() + index);
      return day;
    });
  }

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const total = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= total ? new Date(anchor.getFullYear(), anchor.getMonth(), day) : null;
  });
}

function AgendaEvent({ event, role, detailPath }) {
  return (
    <Link to={detailPath(event.id)} className="block rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{formatDateTime(event.scheduledAt)}</p>
          <p className="mt-1 text-sm text-slate-600">CER {event.cerCode} · {event.quantityTon} ton</p>
        </div>
        <StatusBadge status="confirmed" />
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {event.partners.map((partner) => <p key={partner} className="text-slate-700">{partner}</p>)}
        <p className="text-slate-600">Ritiro: {event.pickupAddress}</p>
        {event.destinationAddress && <p className="text-slate-600">{role === 'recipient' ? 'Impianto di conferimento' : 'Consegna'}: {event.destinationAddress}</p>}
        <p className="text-slate-600">{event.packageLabel}</p>
      </div>
      <span className="mt-3 inline-block text-sm font-semibold text-brand-900">Apri il dettaglio →</span>
    </Link>
  );
}

export default function AgendaPage({ role }) {
  const config = configs[role];
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: [role, 'agenda'],
    queryFn: () => loadAgenda(config, role),
  });

  const days = useMemo(() => getCalendarDays(anchor, mode), [anchor, mode]);
  const byDate = useMemo(() => data.reduce((map, item) => {
    const key = toDateKey(item.scheduledAt);
    if (key) map[key] = [...(map[key] || []), item];
    return map;
  }, {}), [data]);
  const visibleEvents = useMemo(() => data
    .filter((item) => !selectedDate || toDateKey(item.scheduledAt) === selectedDate)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)), [data, selectedDate]);

  const movePeriod = (amount) => {
    setAnchor((current) => {
      if (mode === 'month') return new Date(current.getFullYear(), current.getMonth() + amount, 1);
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
    setSelectedDate('');
  };

  const calendarTitle = mode === 'month'
    ? anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : `${days[0]?.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${days[6]?.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <RoleLayout title={config.title} links={config.links}>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr),minmax(360px,0.9fr)]">
        <Card title={selectedDate ? `Ritiri del ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString('it-IT')}` : 'To-do · Ritiri confermati'}>
          {selectedDate && (
            <button type="button" onClick={() => setSelectedDate('')} className="mb-3 text-sm font-semibold text-brand-900 underline">Mostra tutti i ritiri</button>
          )}
          {isLoading && <p role="status" className="text-sm text-slate-600">Caricamento agenda...</p>}
          {isError && <p role="alert" className="text-sm text-red-700">{errorMessage(error, 'Impossibile caricare l’agenda.')}</p>}
          {!isLoading && !isError && visibleEvents.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
              {selectedDate ? 'Nessun ritiro confermato in questa data.' : 'Non ci sono ritiri confermati.'}
            </p>
          )}
          {!isLoading && !isError && visibleEvents.length > 0 && (
            <div className="space-y-3">
              {visibleEvents.map((event) => <AgendaEvent key={event.id} event={event} role={role} detailPath={config.detailPath} />)}
            </div>
          )}
        </Card>

        <Card title="Calendario">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => movePeriod(-1)} aria-label="Periodo precedente">←</Button>
            <strong className="capitalize">{calendarTitle}</strong>
            <Button type="button" variant="secondary" onClick={() => movePeriod(1)} aria-label="Periodo successivo">→</Button>
          </div>
          <div className="mb-3 flex justify-end gap-1" role="group" aria-label="Vista calendario">
            {['month', 'week'].map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={mode === view}
                onClick={() => { setMode(view); setSelectedDate(''); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === view ? 'bg-brand-900 text-white' : 'border border-slate-300 text-slate-700'}`}
              >
                {view === 'month' ? 'Mese' : 'Settimana'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="min-h-16 rounded-lg bg-slate-50" />;
              const key = makeDateKey(day);
              const count = byDate[key]?.length || 0;
              const isSelected = selectedDate === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${day.toLocaleDateString('it-IT')}${count ? `, ${count} ritiri` : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDate(isSelected ? '' : key)}
                  className={`min-h-16 rounded-lg border p-1 text-left transition ${isSelected ? 'border-brand-900 bg-brand-900 text-white' : count ? 'border-brand-200 bg-brand-50 hover:border-brand-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="text-xs font-semibold">{day.getDate()}</span>
                  {count > 0 && <span className={`mt-1 block truncate text-[10px] ${isSelected ? 'text-white' : 'text-brand-900'}`}>{count} ritir{count === 1 ? 'o' : 'i'}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Seleziona una giornata per filtrare i ritiri nella lista.</p>
        </Card>
      </div>
    </RoleLayout>
  );
}
