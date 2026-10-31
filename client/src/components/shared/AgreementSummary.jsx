import { ROLE_LABELS, formatEuro } from '../../services/labels';

export default function AgreementSummary({ agreement, compact = false }) {
  const { parties, pricing } = agreement;
  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'} text-sm`}>
      <div className={compact ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-3'}>
        {Object.entries(parties).map(([key, party]) => (
          <div key={key} className={compact ? 'rounded-xl bg-slate-50 px-3 py-2' : 'rounded-2xl bg-slate-50 p-4'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ROLE_LABELS[key]}</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900">{party.companyName}</p>
            {party.destinationAddress && <p className="text-slate-600">{party.destinationAddress}</p>}
            {party.vehicleType && <p className="text-slate-600">{party.vehicleType}</p>}
          </div>
        ))}
      </div>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-3'}>
        {pricing.totalPrice !== undefined && (
          <div className={`${compact ? 'col-span-2 flex items-center justify-between rounded-xl px-3 py-2' : 'rounded-2xl px-5 py-3'} bg-brand-900 text-white`}>
            <p className="text-xs text-white/70">Totale</p>
            <p className="font-display text-2xl font-bold">{formatEuro(pricing.totalPrice)}</p>
          </div>
        )}
        {pricing.treatmentPrice !== undefined && (
          <div className={compact ? 'rounded-xl bg-slate-50 px-3 py-2' : 'rounded-2xl bg-slate-50 px-5 py-3'}>
            <p className="text-xs text-slate-500">Smaltimento</p>
            <p className="font-display text-lg font-semibold text-slate-900">{formatEuro(pricing.treatmentPrice)}</p>
          </div>
        )}
        {pricing.transportPrice !== undefined && (
          <div className={compact ? 'rounded-xl bg-slate-50 px-3 py-2' : 'rounded-2xl bg-slate-50 px-5 py-3'}>
            <p className="text-xs text-slate-500">Trasporto</p>
            <p className="font-display text-lg font-semibold text-slate-900">{formatEuro(pricing.transportPrice)}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-600">Importi delle proposte concordate. IVA ed eventuali extra non vengono calcolati separatamente dalla piattaforma.</p>
    </div>
  );
}
