import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusAlert from '../../components/ui/StatusAlert';
import CERSelector from '../../components/forms/CERSelector';
import LazyPickupPhoto from '../../components/shared/LazyPickupPhoto';
import { formatQuantity } from '../../services/labels';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { approveDocument, fetchAdminCompliance, fetchCerRecognitionRequests, fetchPendingDocuments, proposeCerCode, rejectDocument } from '../../services/adminApi';

const links = [
  { to: '/admin/users', label: 'Verifica utenti' },
  { to: '/admin/analytics', label: 'Statistiche' },
  { to: '/admin/compliance', label: 'Conformità' },
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
    <RoleLayout title="Admin - Conformità e controversie" links={links}>
      {isLoading && <p className="text-sm text-slate-600">Caricamento stato di conformità...</p>}
      {isError && (
        <StatusAlert variant="error">
          {error?.response?.status === 401 ? 'Non autorizzato: accedi di nuovo come amministratore.' : 'Impossibile caricare lo stato di conformità.'}
        </StatusAlert>
      )}
      <Card title="RENTri Monitor">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">RENTRI abilitato: {data?.rentriEnabled ? 'Sì' : 'No'}</div>
          <div className="rounded-xl border border-slate-200 p-3">Sincronizzazione RENTRI: {data?.rentriSync || '-'}</div>
          <div className="rounded-xl border border-slate-200 p-3">Controversie aperte: {Number(data?.disputesOpen || 0)}</div>
        </div>
      </Card>

      <Card title="Documenti in attesa di revisione">
        {documentsLoading && <p className="text-sm text-slate-600">Caricamento documenti...</p>}
        {!documentsLoading && pendingDocuments.length === 0 && <p className="text-sm text-slate-600">Nessun documento in attesa di revisione.</p>}
        {!documentsLoading && pendingDocuments.length > 0 && (
          <div className="space-y-3 text-sm">
            {pendingDocuments.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{doc.documentType}</p>
                    <p className="text-slate-600">{doc.User?.companyName || 'Azienda'} · {doc.User?.role || 'ruolo'}</p>
                    <p className="text-slate-500">{doc.fileName}</p>
                    {doc.fileData && (doc.mimeType?.startsWith('image/') ? <img className="mt-2 max-h-40 rounded-lg object-contain" src={doc.fileData} alt={doc.fileName} /> : <a className="mt-2 inline-flex text-sm font-semibold text-brand-900" href={doc.fileData} target="_blank" rel="noreferrer">Apri documento</a>)}
                    {!doc.fileData && doc.fileUrl && <a className="mt-2 inline-flex text-sm font-semibold text-brand-900" href={doc.fileUrl} target="_blank" rel="noreferrer">Apri documento</a>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      onClick={() => rejectMutation.mutate({ id: doc.id, notes: 'Rifiutato dall’amministratore' })}
                    >
                      Rifiuta
                    </Button>
                    <Button
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ id: doc.id, notes: 'Approvato dall’amministratore' })}
                    >
                      Approva
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
                  <p className="font-semibold text-slate-800">{request.requestCode || '—'}</p>
                  <p>Produttore: {request.producer?.companyName || '-'}</p>
                  <p>Descrizione: {request.wasteDescription || '-'}</p>
                  <p>Quantità: {formatQuantity(request.quantity, request.quantityUnit)}</p>
                  <p>Documenti tecnici: {request.technicalDocuments || '-'}</p>
                  {(request.photos || []).length > 0
                    ? request.photos.map((photo) => (
                      <LazyPickupPhoto
                        key={photo.id}
                        photo={{ ...photo, url: `/pickups/${request.id}/photos/${photo.id}` }}
                        alt={photo.fileName || `Foto ordine ${request.id}`}
                      />
                    ))
                    : <p className="mt-3 text-slate-500">Nessuna foto disponibile.</p>}
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
