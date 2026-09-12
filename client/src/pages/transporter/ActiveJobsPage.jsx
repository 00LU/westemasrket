import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import CoverageZoneMap from '../../components/map/CoverageZoneMap';
import StatusBadge from '../../components/shared/StatusBadge';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTransporterJobs, updateTransporterJobStatus } from '../../services/transporterApi';

const links = [
  { to: '/transporter', label: 'Dashboard' },
  { to: '/transporter/opportunities', label: 'Opportunita e aste' },
  { to: '/transporter/planning', label: 'Pianificazione viaggi' },
  { to: '/transporter/jobs', label: 'Lavori assegnati' },
  { to: '/transporter/fleet', label: 'Mezzi e conducenti' },
  { to: '/transporter/authorizations', label: 'Autorizzazioni' },
  { to: '/transporter/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function ActiveJobsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'jobs'],
    queryFn: fetchTransporterJobs,
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateTransporterJobStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transporter', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['transporter', 'notifications'] });
    },
  });

  return (
    <RoleLayout title="Lavori assegnati" links={links}>
      <Card title="Activity History">
        {isLoading && <p className="text-sm text-slate-600">Loading jobs...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as transporter.' : 'Unable to load jobs.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="space-y-2 text-sm">
            {data.length === 0 && <p className="text-slate-600">No activities yet.</p>}
            {data.map((job) => (
              <div key={job.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{job.id} | CER {job.cerCode} | {job.quantityTon} ton</span>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-slate-600">Pickup: {job.pickupAddress}</p>
                {job.myBid && (
                  <p className="text-slate-600">Your offer: EUR {Number(job.myBid.transportPrice || 0).toLocaleString()} ({job.myBid.vehicleType || '-'})</p>
                )}
                {job.allowedNextStatuses?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {job.allowedNextStatuses.map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant="secondary"
                        onClick={() => updateStatusMutation.mutate({ wasteRequestId: job.id, status: nextStatus })}
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
      <CoverageZoneMap />
    </RoleLayout>
  );
}
