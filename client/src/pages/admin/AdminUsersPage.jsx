import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveUser, fetchAllUsers, fetchPendingUsers } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'User Verification' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/compliance', label: 'Compliance' },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: pendingUsers = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'pending-users'],
    queryFn: fetchPendingUsers,
  });
  const {
    data: allUsers = [],
    isLoading: isAllUsersLoading,
    isError: isAllUsersError,
  } = useQuery({
    queryKey: ['admin', 'all-users'],
    queryFn: fetchAllUsers,
  });

  const approveMutation = useMutation({
    mutationFn: approveUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-users'] });
    },
  });

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  }

  return (
    <RoleLayout title="Admin - User Approval" links={links}>
      <Card title="Pending Verifications">
        {isLoading && <p className="text-sm text-slate-600">Loading pending users...</p>}
        {isError && <p className="text-sm text-red-600">Unable to load pending users.</p>}
        {!isLoading && !isError && (
          <div className="space-y-2 text-sm">
            {pendingUsers.length === 0 && <p className="text-slate-600">No pending users to verify.</p>}
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <span>
                  {user.companyName} - {user.role} - {user.email}
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Registered Users">
        {isAllUsersLoading && <p className="text-sm text-slate-600">Loading users table...</p>}
        {isAllUsersError && <p className="text-sm text-red-600">Unable to load users table.</p>}
        {!isAllUsersLoading && !isAllUsersError && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Company</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Verified</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Plan</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {allUsers.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={6}>
                      No users found.
                    </td>
                  </tr>
                )}
                {allUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2 text-slate-800">{user.companyName}</td>
                    <td className="px-3 py-2 text-slate-700">{user.email}</td>
                    <td className="px-3 py-2 uppercase text-slate-700">{user.role}</td>
                    <td className="px-3 py-2 text-slate-700">{user.verified ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-slate-700">{user.subscriptionPlan || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
