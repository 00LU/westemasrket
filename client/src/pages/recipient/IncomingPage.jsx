import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIncomingShipments, updateRecipientIncomingStatus } from '../../services/recipientApi';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/opportunities', label: 'Ordini compatibili' },
  { to: '/recipient/calendar', label: 'Calendario conferimenti' },
  { to: '/recipient/incoming', label: 'Arrivi e conferimenti' },
  { to: '/recipient/capacity', label: 'Disponibilita e capacita' },
  { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' },
  { to: '/recipient/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function IncomingPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['recipient', 'incoming'],
    queryFn: fetchIncomingShipments,
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateRecipientIncomingStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipient', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['recipient', 'notifications'] });
    },
  });

  return (
    <RoleLayout title="Arrivi e conferimenti" links={links}>
      <Card title="Activity History">
        {isLoading && <p className="text-sm text-slate-600">Loading incoming shipments...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as recipient.' : 'Unable to load incoming shipments.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="space-y-2 text-sm">
            {data.length === 0 && <p className="text-slate-600">No activities yet.</p>}
            {data.map((item) => (
              <div key={item.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{item.id} | CER {item.cerCode} | {item.quantityTon} ton</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-slate-600">Pickup: {item.pickupAddress}</p>
                <p className="text-slate-600">Destination: {item.destinationAddress}</p>
                <p className="text-slate-600">Recipient price: EUR {Number(item.recipientPricePerTon || 0).toLocaleString()}/ton</p>
                {item.allowedNextStatuses?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {item.allowedNextStatuses.map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant="secondary"
                        onClick={() => updateStatusMutation.mutate({ wasteRequestId: item.id, status: nextStatus })}
                        disabled={updateStatusMutation.isPending}
                      >
                        {updateStatusMutation.isPending ? 'Updating...' : `Set ${nextStatus}`}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
