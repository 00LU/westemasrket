import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/shared/Navbar';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { fetchCurrentUser, fetchProfileDocuments, fetchProfileRequirements, uploadProfileDocument } from '../../services/profileApi';

const dashboardByRole = {
  producer: '/producer',
  transporter: '/transporter',
  recipient: '/recipient',
  admin: '/admin/users',
};

const statusLabels = {
  missing: { label: 'Da caricare', tone: 'warning' },
  pending: { label: 'In revisione', tone: 'warning' },
  pending_review: { label: 'In revisione', tone: 'warning' },
  uploaded: { label: 'In revisione', tone: 'warning' },
  approved: { label: 'Approvato', tone: 'success' },
  rejected: { label: 'Rifiutato', tone: 'danger' },
};

function formatDocumentType(documentType) {
  return documentType.replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('it-IT');
}

const optionalProfileFields = {
  common: [
    ['legalForm', 'Forma giuridica'],
    ['localSites', 'Sedi / unita locali'],
    ['pecEmail', 'PEC'],
    ['operationalEmail', 'Email operativa'],
    ['phone', 'Telefono'],
  ],
  producer: [
    ['productionSites', 'Sedi di produzione / ritiro'],
    ['intermediaryDocuments', 'Documentazione da intermediario'],
  ],
  transporter: [
    ['transportAuthorizations', 'Iscrizioni / autorizzazioni'],
    ['vehicleFleet', 'Parco mezzi / rimorchi'],
    ['drivers', 'Conducenti'],
    ['operatingRegions', 'Regioni / aree operative'],
  ],
  recipient: [
    ['facilities', 'Impianti / sedi'],
    ['siteAuthorizations', 'Autorizzazioni per sede'],
    ['cerCodes', 'CER / EER ammessi'],
    ['rdOperations', 'Operazioni R/D'],
    ['operationalLimitations', 'Limitazioni / prescrizioni'],
    ['commercialPreferences', 'Preferenze commerciali / operative'],
  ],
};

export default function UserProfilePage() {
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ['profile', 'user'], queryFn: fetchCurrentUser });
  const requirementsQuery = useQuery({ queryKey: ['profile', 'requirements'], queryFn: fetchProfileRequirements });
  const documentsQuery = useQuery({ queryKey: ['profile', 'documents'], queryFn: fetchProfileDocuments });

  const uploadMutation = useMutation({
    mutationFn: uploadProfileDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'requirements'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'documents'] });
    },
  });

  const user = userQuery.data;
  const dashboardPath = dashboardByRole[user?.role] || '/';
  const documentsByType = new Map((documentsQuery.data || []).map((document) => [document.documentType, document]));
  const requiredDocuments = requirementsQuery.data?.requiredDocuments || [];

  const handleUpload = (documentType) => (event) => {
    const file = event.target.files[0];
    if (!file) return;

    uploadMutation.mutate({
      documentType,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      notes: 'Caricato dal profilo utente',
    });
    event.target.value = '';
  };

  const isLoading = userQuery.isLoading || requirementsQuery.isLoading || documentsQuery.isLoading;
  const hasError = userQuery.isError || requirementsQuery.isError || documentsQuery.isError;

  return (
    <div className="min-h-screen">
      <Navbar title="Profilo utente" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <Link
          className="inline-flex items-center rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
          to={dashboardPath}
        >
          Torna alla Dashboard
        </Link>
        {isLoading && <p className="text-sm text-slate-600">Caricamento profilo...</p>}
        {hasError && <p className="text-sm text-red-600">Impossibile caricare il profilo. Prova ad aggiornare la pagina.</p>}
        {!isLoading && !hasError && (
          <>
            <Card title="Dati aziendali">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="text-slate-500">Azienda</p><p className="font-semibold text-slate-800">{user.companyName}</p></div>
              <div><p className="text-slate-500">P.IVA</p><p className="font-semibold text-slate-800">{user.piva}</p></div>
              <div><p className="text-slate-500">Ruolo</p><p className="font-semibold capitalize text-slate-800">{user.role}</p></div>
              <div><p className="text-slate-500">Email</p><p className="font-semibold text-slate-800">{user.email}</p></div>
              <div><p className="text-slate-500">Sede legale</p><p className="font-semibold text-slate-800">{user.registeredOffice || '-'}</p></div>
              <div><p className="text-slate-500">Referente</p><p className="font-semibold text-slate-800">{user.contactPerson || '-'}</p></div>
              <div><p className="text-slate-500">Registrato il</p><p className="font-semibold text-slate-800">{formatDate(user.createdAt)}</p></div>
              <div><p className="text-slate-500">Stato account</p><Badge tone={user.verified ? 'success' : 'warning'}>{user.verified ? 'Verificato' : 'In verifica'}</Badge></div>
              {[...optionalProfileFields.common, ...(optionalProfileFields[user.role] || [])].map(([field, label]) => (
                <div key={field}><p className="text-slate-500">{label}</p><p className="font-semibold text-slate-800">{user[field] || '-'}</p></div>
              ))}
            </div>
            </Card>

            <Card title="Checklist documenti">
            <div className="space-y-3">
              {requiredDocuments.length === 0 && <p className="text-sm text-slate-600">Nessun documento richiesto per questo ruolo.</p>}
              {requiredDocuments.map((documentType) => {
                const document = documentsByType.get(documentType);
                const status = statusLabels[document?.status || 'missing'];
                return (
                  <div key={documentType} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold capitalize text-slate-800">{formatDocumentType(documentType)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {document?.fileName && <span>{document.fileName}</span>}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                        {document ? 'Sostituisci' : 'Carica documento'}
                      </span>
                      <input className="hidden" type="file" onChange={handleUpload(documentType)} disabled={uploadMutation.isPending} />
                    </label>
                  </div>
                );
              })}
            </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
