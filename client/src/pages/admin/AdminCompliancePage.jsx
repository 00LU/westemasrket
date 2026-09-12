import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveDocument, fetchAdminCompliance, fetchPendingDocuments, rejectDocument } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'User Verification' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/compliance', label: 'Compliance' },
];

export default function AdminCompliancePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'compliance'],
    queryFn: fetchAdminCompliance,
  });

  const { data: pendingDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['admin', 'pending-documents'],
    queryFn: fetchPendingDocuments,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => approveDocument(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-documents'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => rejectDocument(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-documents'] });
    },
  });

  return (
    <RoleLayout title="Admin - Compliance & Disputes" links={links}>
      {isLoading && <p className="text-sm text-slate-600">Loading compliance status...</p>}
      {isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error?.response?.status === 401 ? 'Unauthorized: please login again as admin.' : 'Unable to load compliance status.'}
        </p>
      )}
      <Card title="RENTri Monitor">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">RENTRI Enabled: {data?.rentriEnabled ? 'Yes' : 'No'}</div>
          <div className="rounded-xl border border-slate-200 p-3">RENTRI Sync: {data?.rentriSync || '-'}</div>
          <div className="rounded-xl border border-slate-200 p-3">Open Disputes: {Number(data?.disputesOpen || 0)}</div>
        </div>
      </Card>

      <Card title="Pending Documents Review">
        {documentsLoading && <p className="text-sm text-slate-600">Loading documents...</p>}
        {!documentsLoading && pendingDocuments.length === 0 && <p className="text-sm text-slate-600">No documents pending review.</p>}
        {!documentsLoading && pendingDocuments.length > 0 && (
          <div className="space-y-3 text-sm">
            {pendingDocuments.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{doc.documentType}</p>
                    <p className="text-slate-600">{doc.User?.companyName || 'Company'} · {doc.User?.role || 'role'}</p>
                    <p className="text-slate-500">{doc.fileName}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      onClick={() => rejectMutation.mutate({ id: doc.id, notes: 'Rejected by admin' })}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ id: doc.id, notes: 'Approved by admin' })}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
