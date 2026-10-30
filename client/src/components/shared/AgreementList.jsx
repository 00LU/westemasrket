import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../ui/Card';
import StatusAlert from '../ui/StatusAlert';
import StatusBadge from './StatusBadge';
import PickupSummary from './PickupSummary';
import AgreementPanel from './AgreementPanel';
import { errorMessage } from '../../services/labels';

function AgreementItem({ scope, role, item, fetchOne }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [scope, 'pickup', item.id],
    queryFn: () => fetchOne(item.id),
  });

  return (
    <div className="space-y-3">
      <Card title={item.requestCode || '—'} action={<StatusBadge status={item.stage} kind="stage" />}>
        <PickupSummary pickup={item} showCode={false} />
      </Card>
      {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
      {isError && (
        <StatusAlert variant="error" action={<button type="button" className="text-sm font-semibold underline" onClick={() => refetch()}>Riprova</button>}>
          {errorMessage(error, 'Impossibile caricare l’accordo.')}
        </StatusAlert>
      )}
      {data && (
        <AgreementPanel
          pickupId={item.id}
          agreement={data.agreement}
          role={role}
          confirmed={['confirmed', 'completed'].includes(item.stage)}
          completed={item.stage === 'completed'}
          onChanged={() => queryClient.invalidateQueries({ queryKey: [scope] })}
        />
      )}
    </div>
  );
}

// Pickups where the user was chosen: negotiation, confirmed pickups and completion.
export default function AgreementList({ scope, role, fetchList, fetchOne }) {
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: [scope, 'pickups'], queryFn: fetchList });
  const items = data.filter((item) => ['in_agreement', 'confirmed', 'completed'].includes(item.stage));

  return (
    <>
      {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
      {isError && <StatusAlert variant="error">{errorMessage(error, 'Impossibile caricare i ritiri.')}</StatusAlert>}
      {!isLoading && !isError && items.length === 0 && (
        <Card><p className="text-sm text-slate-600">Nessun ritiro in corso, confermato o completato.</p></Card>
      )}
      {items.map((item) => (
        <AgreementItem key={item.id} scope={scope} role={role} item={item} fetchOne={fetchOne} />
      ))}
    </>
  );
}
