import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import { producerLinks } from '../../components/shared/navLinks';
import { fetchProducerPickups } from '../../services/producerApi';
import { CANCEL_LABELS, errorMessage, formatDateTime } from '../../services/labels';

export default function ProducerOrdersPage() {
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'pickups'],
    queryFn: fetchProducerPickups,
  });

  return (
    <RoleLayout title="Storico ritiri" links={producerLinks}>
      <Card title="Tutti i ritiri">
        {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
        {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare lo storico.')}</p>}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {data.length === 0 && <p className="text-slate-600">Nessun ritiro.</p>}
            {data.map((item) => (
              <Link key={item.id} to={`/producer/pickups/${item.id}`} className="block space-y-1 rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>CER {item.cerCode} | {item.quantityTon} ton</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-slate-600">Ritiro presso: {item.pickupAddress}</p>
                <p className="text-xs text-slate-500">
                  Creata il {formatDateTime(item.created_at)}
                  {item.confirmedSlotAt && ` | Ritiro il ${formatDateTime(item.confirmedSlotAt)}`}
                  {item.cancelReason && ` | ${CANCEL_LABELS[item.cancelReason] || item.cancelReason}`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
