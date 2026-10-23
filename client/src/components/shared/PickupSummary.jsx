import { formatDateTime } from '../../services/labels';

// Request facts that every involved role is allowed to see.
export default function PickupSummary({ pickup, children }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold text-slate-800">CER {pickup.cerCode === 'UNKNOWN' ? 'da proporre' : pickup.cerCode} | {pickup.quantityTon} ton</p>
      <p className="text-slate-600">Ritiro presso: {pickup.pickupAddress}</p>
      <p className="text-slate-600">Entro il: {formatDateTime(pickup.deadline)}</p>
      {pickup.notes && <p className="text-slate-600">Note: {pickup.notes}</p>}
      {pickup.wasteDescription && <p className="text-slate-600">Rifiuto: {pickup.wasteDescription}</p>}
      {pickup.containment && <p className="text-slate-600">Contenimento: {pickup.containment}</p>}
      {pickup.specialInfo && <p className="text-slate-600">Informazioni speciali: {pickup.specialInfo}</p>}
      {pickup.technicalDocuments && <p className="text-slate-600">Documenti tecnici: {pickup.technicalDocuments}</p>}
      {pickup.photoData && <img src={pickup.photoData} alt={pickup.photoFileName || 'Foto del rifiuto'} className="mt-2 max-h-40 rounded-xl border border-slate-200" />}
      {children}
    </div>
  );
}
