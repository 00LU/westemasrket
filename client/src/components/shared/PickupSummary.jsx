import { formatDateTime } from '../../services/labels';

// Request facts that every involved role is allowed to see.
export default function PickupSummary({ pickup, children }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold text-slate-800">CER {pickup.cerCode} | {pickup.quantityTon} ton</p>
      <p className="text-slate-600">Ritiro presso: {pickup.pickupAddress}</p>
      <p className="text-slate-600">Entro il: {formatDateTime(pickup.deadline)}</p>
      {pickup.notes && <p className="text-slate-600">Note: {pickup.notes}</p>}
      {children}
    </div>
  );
}
