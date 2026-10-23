import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { producerLinks, recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchCurrentUser, fetchProfileDocuments, fetchProfileRequirements, uploadProfileDocument } from '../../services/profileApi';

const profileLinksByRole = {
  producer: producerLinks,
  recipient: recipientLinks,
  transporter: transporterLinks,
  admin: [
    { to: '/admin/users', label: 'User Verification' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/compliance', label: 'Compliance' },
    { to: '/profile', label: 'Profilo utente' },
  ],
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
  const { user: sessionUser } = useAuth();
  const role = user?.role || sessionUser?.role;
  const links = profileLinksByRole[role] || profileLinksByRole.admin;
  const documentsByType = new Map((documentsQuery.data || []).map((document) => [document.documentType, document]));
  const requiredDocuments = requirementsQuery.data?.requiredDocuments || [];

  const handleUpload = (documentType) => (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => uploadMutation.mutate({
      documentType,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileData: reader.result,
      notes: 'Caricato dal profilo utente',
    });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const isLoading = userQuery.isLoading || requirementsQuery.isLoading || documentsQuery.isLoading;
  const hasError = userQuery.isError || requirementsQuery.isError || documentsQuery.isError;

  return (
    <RoleLayout title="Profilo utente" links={links}>
      <div className="space-y-6">
        <nav aria-label="Sezioni del profilo" className="flex flex-wrap gap-2">
          {[
            ['company', 'Società e contatti'],
            ['technical', 'Dati tecnici'],
            ['members', 'Utenti associati'],
            ['documents', 'Documenti'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-700 hover:text-brand-900">
              {label}
            </a>
          ))}
        </nav>
        {isLoading && <p className="text-sm text-slate-600">Caricamento profilo...</p>}
        {hasError && <p role="alert" className="text-sm text-red-600">Impossibile caricare il profilo. Prova ad aggiornare la pagina.</p>}
        {!isLoading && !hasError && (
          <>
            <section id="company" className="scroll-mt-24">
              <Card title="Società e contatti">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><p className="text-slate-500">Azienda</p><p className="font-semibold text-slate-800">{user.companyName}</p></div>
                  <div><p className="text-slate-500">P.IVA / CF</p><p className="font-semibold text-slate-800">{user.piva}</p></div>
                  <div><p className="text-slate-500">Ruolo</p><p className="font-semibold capitalize text-slate-800">{user.role}</p></div>
                  <div><p className="text-slate-500">Email</p><p className="font-semibold text-slate-800">{user.email}</p></div>
                  <div><p className="text-slate-500">Telefono</p><p className="font-semibold text-slate-800">{user.phone || '-'}</p></div>
                  <div><p className="text-slate-500">Sede legale</p><p className="font-semibold text-slate-800">{user.registeredOffice || '-'}</p></div>
                  <div><p className="text-slate-500">Referente</p><p className="font-semibold text-slate-800">{user.contactPerson || '-'}</p></div>
                  <div><p className="text-slate-500">Registrato il</p><p className="font-semibold text-slate-800">{formatDate(user.createdAt)}</p></div>
                  <div><p className="text-slate-500">Stato account</p><Badge tone={user.verified ? 'success' : 'warning'}>{user.verified ? 'Verificato' : 'In verifica'}</Badge></div>
                </div>
              </Card>
            </section>

            <section id="technical" className="scroll-mt-24">
              <Card title="Dati tecnici">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  {(optionalProfileFields[user.role] || []).map(([field, label]) => (
                    <div key={field} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-slate-500">{label}</p>
                      <p className="mt-1 whitespace-pre-wrap font-semibold text-slate-800">{user[field] || 'Non indicato'}</p>
                    </div>
                  ))}
                </div>
                {user.role === 'recipient' && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    La capacità e la disponibilità generali non sono configurate nel profilo: vengono indicate rispondendo alle singole richieste.
                  </p>
                )}
                {user.role === 'producer' && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Orari, prescrizioni e volumi di produzione non sono attualmente registrati come dati separati nel profilo.
                  </p>
                )}
                {user.role === 'transporter' && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Mezzi, conducenti e autorizzazioni sono mostrati con i dati disponibili nell’account; la gestione di schede separate per targa e attrezzatura non è presente.
                  </p>
                )}
              </Card>
            </section>

            <section id="members" className="scroll-mt-24">
              <Card title="Utenti associati">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-800">{user.email}</p>
                  <p className="mt-1 text-sm text-slate-600">Account attualmente in uso</p>
                  <p className="mt-3 text-sm text-slate-500">La gestione di altri account aziendali non è disponibile.</p>
                </div>
              </Card>
            </section>

            <section id="documents" className="scroll-mt-24">
              <Card title="Documenti e autorizzazioni">
                <div className="space-y-3">
                  {requirementsQuery.data?.automaticApprovalEnabled && (
                    <p className="text-sm text-amber-700">Modalità temporanea: approvazione automatica attiva. I documenti mancanti non bloccano la partecipazione ai ritiri.</p>
                  )}
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
            </section>
          </>
        )}
      </div>
    </RoleLayout>
  );
}
