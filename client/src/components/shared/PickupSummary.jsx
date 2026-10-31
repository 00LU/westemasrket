import { CalendarDays, MapPin, Package, Scale, Tag } from 'lucide-react';
import { formatDateTime, formatQuantity } from '../../services/labels';
import LazyPickupPhoto from './LazyPickupPhoto';

// Request facts that every involved role is allowed to see.
// `part` lets detail pages show only the headline (description + key figures) at the top and
// the full facts ("details") below the section where the user has to act.
export default function PickupSummary({ pickup, children, extra, showCode = true, part = 'all' }) {
  const scheduledAt = pickup.scheduledAt || pickup.confirmedSlotAt;
  const cer = !pickup.cerCode || pickup.cerCode === 'UNKNOWN' ? 'Da proporre' : pickup.cerCode;
  const details = [
    ['Contenimento e carico', pickup.containment],
    ['Esigenze particolari', pickup.specialInfo],
    ['Documenti tecnici', pickup.technicalDocuments],
    ['Note', pickup.notes],
  ].filter(([, value]) => value);

  const description = (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-900"><Package size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rifiuto da ritirare</p>
        <p className="mt-1 whitespace-pre-wrap break-words font-display text-xl font-semibold leading-snug text-slate-900">
          {pickup.wasteDescription || 'Descrizione non indicata'}
        </p>
      </div>
    </div>
  );

  const keyFigures = (
    <ul className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Dati principali">
      <li className="rounded-full bg-brand-900 px-3 py-1.5 text-white">{formatQuantity(pickup.quantity, pickup.quantityUnit)}</li>
      <li className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">CER {cer}</li>
      <li className={`rounded-full px-3 py-1.5 ${scheduledAt ? 'bg-accent-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
        {scheduledAt ? 'Ritiro concordato: ' : 'Ritiro entro il '}{formatDateTime(scheduledAt || pickup.deadline)}
      </li>
    </ul>
  );

  const facts = (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-brand-900 p-4 text-white">
        <dt className="flex items-center gap-2 text-xs font-medium text-white/70"><Scale size={15} aria-hidden="true" />Quantità</dt>
        <dd className="mt-2 font-display text-3xl font-bold tabular-nums">{formatQuantity(pickup.quantity, pickup.quantityUnit)}</dd>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><Tag size={15} aria-hidden="true" />Codice CER / EER</dt>
        <dd className="mt-2 font-display text-3xl font-bold text-slate-900">{cer}</dd>
      </div>
      <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
        <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><MapPin size={15} aria-hidden="true" />Luogo di ritiro</dt>
        <dd className="mt-2 break-words font-semibold leading-relaxed text-slate-900">{pickup.pickupAddress || 'Indirizzo non indicato'}</dd>
      </div>
      <div className={`rounded-2xl p-4 ${scheduledAt ? 'bg-accent-500 text-white' : 'bg-slate-50'}`}>
        <dt className={`flex items-center gap-2 text-xs font-medium ${scheduledAt ? 'text-white/85' : 'text-slate-500'}`}><CalendarDays size={15} aria-hidden="true" />{scheduledAt ? 'Ritiro concordato' : 'Ritiro entro il'}</dt>
        <dd className={`mt-2 font-semibold ${scheduledAt ? 'text-lg' : 'text-slate-900'}`}>{formatDateTime(scheduledAt || pickup.deadline)}</dd>
        {scheduledAt && <p className="mt-2 text-xs text-white/85">Scadenza richiesta: {formatDateTime(pickup.deadline)}</p>}
      </div>
    </dl>
  );

  const rest = (
    <>
      {extra}
      {details.length > 0 && (
        <section className="rounded-2xl bg-slate-50 p-5" aria-label="Dettagli operativi">
          <p className="mb-3 font-display text-base font-semibold text-slate-900">Dettagli operativi</p>
          <dl className="grid gap-4 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {(pickup.photos || []).length > 0 && (
        <section aria-label="Foto del rifiuto">
          <p className="mb-3 font-display text-base font-semibold text-slate-900">Foto del rifiuto <span className="font-sans text-sm font-normal text-slate-500">({pickup.photos.length})</span></p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pickup.photos.map((photo) => <LazyPickupPhoto key={photo.id} photo={photo} alt={photo.fileName || 'Foto del rifiuto'} />)}
          </div>
        </section>
      )}
      {children}
    </>
  );

  return (
    <div className="min-w-0 space-y-5 text-sm">
      {part !== 'details' && showCode && pickup.requestCode && <p className="font-semibold tracking-wide text-brand-900">{pickup.requestCode}</p>}
      {part !== 'details' && description}
      {part === 'headline' && keyFigures}
      {part !== 'headline' && facts}
      {part !== 'headline' && rest}
    </div>
  );
}
