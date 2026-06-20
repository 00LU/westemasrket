import RoleLayout from '../../components/shared/RoleLayout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import { fetchProducerOrderHistory, updateProducerRequestStatus } from '../../services/producerApi';

const links = [
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/auction/123', label: 'Auction Room' },
  { to: '/producer/orders', label: 'Orders & Docs' },
];

export default function ProducerOrdersPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'order-history'],
    queryFn: fetchProducerOrderHistory,
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateProducerRequestStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer', 'order-history'] });
      queryClient.invalidateQueries({ queryKey: ['producer', 'active-orders'] });
    },
  });

  const allowedNextStatuses = {
    recipient_matching: ['cancelled'],
    recipient_options_ready: ['cancelled'],
    recipient_selected: ['cancelled'],
    transporter_matching: ['cancelled'],
    package_options_ready: ['cancelled'],
    package_selected: ['cancelled'],
    assigned: ['in_execution', 'cancelled'],
    in_execution: ['delivered', 'cancelled'],
    delivered: ['completed'],
  };

  const history = data;

  return (
    <RoleLayout title="Orders & Compliance Documents" links={links}>
      <Card title="Activity History">
        {isLoading && <p className="text-sm text-slate-600">Loading orders...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as producer.' : 'Unable to load orders.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {history.length === 0 && <p className="text-slate-600">No activities yet.</p>}
            {history.map((item) => (
              <div key={item.id} className="space-y-2 rounded-xl border border-slate-200 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{item.id} | CER {item.cerCode} | {item.quantityTon} ton</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-slate-600">Pickup: {item.pickupAddress}</p>
                {allowedNextStatuses[item.status]?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {allowedNextStatuses[item.status].map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant="secondary"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ wasteRequestId: item.id, status: nextStatus })}
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
