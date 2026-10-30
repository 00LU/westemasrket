import { CalendarDays, MapPin, Package, Scale } from 'lucide-react';
import { formatDateTime, formatQuantity } from '../../services/labels';
import LazyPickupPhoto from './LazyPickupPhoto';

// Request facts that every involved role is allowed to see.
export default function PickupSummary({ pickup, children, showCode = true }) {
  const scheduledAt = pickup.scheduledAt || pickup.confirmedSlotAt;
  const details = [
    ['Contenimento e carico', pickup.containment],
    ['Esigenze particolari', pickup.specialInfo],
    ['Documenti tecnici', pickup.technicalDocuments],
    ['Note', pickup.notes],
  ].filter(([, value]) => value);

  return (
    <div className="min-w-0 space-y-4 text-sm">
      {showCode && pickup.requestCode && <p className="font-semibold tracking-wide text-brand-900">{pickup.requestCode}</p>}
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Package size={20} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rifiuto da ritirare</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-base font-semibold leading-snug text-slate-900">
            {pickup.wasteDescription || 'Descrizione non indicata'}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><Scale size={15} aria-hidden="true" />Quantità</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatQuantity(pickup.quantity, pickup.quantityUnit)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-500">Codice CER / EER</dt>
          <dd className="mt-1 text-lg font-bold text-slate-900">{!pickup.cerCode || pickup.cerCode === 'UNKNOWN' ? 'Da proporre' : pickup.cerCode}</dd>
        </div>
        <div className="col-span-2 min-w-0 rounded-xl border border-slate-200 p-3 sm:col-span-1">
          <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><MapPin size={15} aria-hidden="true" />Luogo di ritiro</dt>
          <dd className="mt-1 break-words font-medium leading-relaxed text-slate-800">{pickup.pickupAddress || 'Indirizzo non indicato'}</dd>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 p-3 sm:col-span-1">
          <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays size={15} aria-hidden="true" />{scheduledAt ? 'Ritiro concordato' : 'Ritiro entro il'}</dt>
          <dd className="mt-1 font-semibold text-slate-800">{formatDateTime(scheduledAt || pickup.deadline)}</dd>
          {scheduledAt && <p className="mt-2 text-xs text-slate-500">Scadenza richiesta: {formatDateTime(pickup.deadline)}</p>}
        </div>
      </dl>
      {details.length > 0 && (
        <section className="border-t border-slate-200 pt-4" aria-label="Dettagli operativi">
          <p className="mb-3 font-semibold text-slate-900">Dettagli operativi</p>
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
        <section className="border-t border-slate-200 pt-4" aria-label="Foto del rifiuto">
          <p className="font-semibold text-slate-900">Foto del rifiuto <span className="font-normal text-slate-500">({pickup.photos.length})</span></p>
          <div className="grid grid-cols-2 gap-3">
            {pickup.photos.map((photo) => <LazyPickupPhoto key={photo.id} photo={photo} alt={photo.fileName || 'Foto del rifiuto'} />)}
          </div>
        </section>
      )}
      {children}
    </div>
  );
}
