import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import CERSelector from '../../components/forms/CERSelector';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { approveDocument, fetchAdminCompliance, fetchCerRecognitionRequests, fetchPendingDocuments, proposeCerCode, rejectDocument } from '../../services/adminApi';

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
  const { data: cerRequests = [], isLoading: cerLoading } = useQuery({
    queryKey: ['admin', 'cer-recognition'],
    queryFn: fetchCerRecognitionRequests,
  });
  const [cerSelections, setCerSelections] = useState({});

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
  const cerMutation = useMutation({
    mutationFn: ({ id, cerCode }) => proposeCerCode(id, cerCode, 'CER riconosciuto e proposto da Admin'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cer-recognition'] }),
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
                    {doc.fileData && (doc.mimeType?.startsWith('image/') ? <img className="mt-2 max-h-40 rounded-lg object-contain" src={doc.fileData} alt={doc.fileName} /> : <a className="mt-2 inline-flex text-sm font-semibold text-brand-900" href={doc.fileData} target="_blank" rel="noreferrer">Apri documento</a>)}
                    {!doc.fileData && doc.fileUrl && <a className="mt-2 inline-flex text-sm font-semibold text-brand-900" href={doc.fileUrl} target="_blank" rel="noreferrer">Apri documento</a>}
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

      <Card title="Riconoscimento CER">
        <p className="mb-4 text-sm text-slate-600">Consulta descrizione, foto e documentazione prima di proporre il codice CER. L'ordine procedera al matching solo dopo la proposta Admin.</p>
        {cerLoading && <p className="text-sm text-slate-600">Caricamento richieste CER...</p>}
        {!cerLoading && cerRequests.length === 0 && <p className="text-sm text-slate-600">Nessuna richiesta CER da riconoscere.</p>}
        <div className="space-y-4">
          {cerRequests.map((request) => {
            const selectedCode = cerSelections[request.id] || '';
            return <div key={request.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-800">Ordine {request.id}</p>
                  <p>Produttore: {request.producer?.companyName || '-'}</p>
                  <p>Descrizione: {request.wasteDescription || '-'}</p>
                  <p>Quantita: {request.quantityTon} ton</p>
                  <p>Documenti tecnici: {request.technicalDocuments || '-'}</p>
                  {request.photoData ? <img className="mt-3 max-h-48 rounded-lg object-contain" src={request.photoData} alt={`Foto ordine ${request.id}`} /> : <p className="mt-3 text-slate-500">Nessuna foto disponibile.</p>}
                </div>
                <div className="space-y-3">
                  <CERSelector value={selectedCode} onChange={(code) => setCerSelections((current) => ({ ...current, [request.id]: code }))} />
                  <Button type="button" disabled={!selectedCode || cerMutation.isPending} onClick={() => cerMutation.mutate({ id: request.id, cerCode: selectedCode })}>{cerMutation.isPending ? 'Salvataggio...' : 'Proponi CER e pubblica ordine'}</Button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </Card>
    </RoleLayout>
  );
}
