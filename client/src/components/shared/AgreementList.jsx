import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card';
import StatusBadge from './StatusBadge';
import PickupSummary from './PickupSummary';
import AgreementPanel from './AgreementPanel';
import { errorMessage } from '../../services/labels';

function AgreementItem({ scope, role, item, fetchOne }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [scope, 'pickup', item.id],
    queryFn: () => fetchOne(item.id),
  });

  return (
    <div className="space-y-3">
      <Card title="Richiesta" action={<StatusBadge status={item.stage} kind="stage" />}>
        <PickupSummary pickup={item} />
      </Card>
      {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
      {data && (
        <AgreementPanel
          pickupId={item.id}
          agreement={data.agreement}
          role={role}
          confirmed={item.stage === 'confirmed'}
          onChanged={() => queryClient.invalidateQueries({ queryKey: [scope] })}
        />
      )}
    </div>
  );
}

// Pickups where the user was chosen: negotiation of day/time and confirmed pickups.
export default function AgreementList({ scope, role, fetchList, fetchOne }) {
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: [scope, 'pickups'], queryFn: fetchList });
  const items = data.filter((item) => ['in_agreement', 'confirmed'].includes(item.stage));

  return (
    <>
      {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
      {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare i ritiri.')}</p>}
      {!isLoading && !isError && items.length === 0 && (
        <Card><p className="text-sm text-slate-600">Nessun ritiro in corso o confermato.</p></Card>
      )}
      {items.map((item) => (
        <AgreementItem key={item.id} scope={scope} role={role} item={item} fetchOne={fetchOne} />
      ))}
    </>
  );
}
