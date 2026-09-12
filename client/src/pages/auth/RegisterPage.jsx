import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

const requiredDocumentsByRole = {
  producer: ['company_registration', 'operational_photo', 'cer_certificate'],
  transporter: ['vehicle_registration', 'driver_license', 'operational_authorization'],
  recipient: ['facility_registration', 'treatment_authorization', 'cer_capacity_certificate'],
};

const steps = ['Azienda', 'Ruolo', 'Documenti', 'Riepilogo'];

function resolveRouteByRole(role) {
  return role === 'admin' ? '/admin/users' : `/${role}`;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    piva: '',
    legalForm: '',
    registeredOffice: '',
    localSites: '',
    contactPerson: '',
    pecEmail: '',
    operationalEmail: '',
    phone: '',
    productionSites: '',
    intermediaryDocuments: '',
    transportAuthorizations: '',
    vehicleFleet: '',
    drivers: '',
    operatingRegions: '',
    facilities: '',
    siteAuthorizations: '',
    cerCodes: '',
    rdOperations: '',
    operationalLimitations: '',
    commercialPreferences: '',
    email: '',
    password: '',
    role: 'producer',
    documents: requiredDocumentsByRole.producer.map((documentType) => ({
      documentType,
      fileName: '',
      mimeType: 'application/pdf',
      fileSize: 1,
    })),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const formRef = useRef(null);

  const updateField = (field) => (event) => {
    setForm((curr) => ({ ...curr, [field]: event.target.value }));
  };

  const updateRole = (event) => {
    const role = event.target.value;
    setForm((curr) => ({
      ...curr,
      role,
      documents: requiredDocumentsByRole[role].map((documentType) => ({
        documentType,
        fileName: '',
        mimeType: 'application/pdf',
        fileSize: 1,
      })),
    }));
  };

  const updateDocumentFile = (documentType) => (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setForm((curr) => ({
      ...curr,
      documents: curr.documents.map((document) => (
        document.documentType === documentType
          ? { ...document, fileName: file.name, mimeType: file.type || 'application/octet-stream', fileSize: file.size }
          : document
      )),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register({
        role: form.role,
        companyName: form.companyName,
        piva: form.piva,
        legalForm: form.legalForm,
        registeredOffice: form.registeredOffice,
        localSites: form.localSites,
        contactPerson: form.contactPerson,
        pecEmail: form.pecEmail,
        operationalEmail: form.operationalEmail,
        phone: form.phone,
        productionSites: form.productionSites,
        intermediaryDocuments: form.intermediaryDocuments,
        transportAuthorizations: form.transportAuthorizations,
        vehicleFleet: form.vehicleFleet,
        drivers: form.drivers,
        operatingRegions: form.operatingRegions,
        facilities: form.facilities,
        siteAuthorizations: form.siteAuthorizations,
        cerCodes: form.cerCodes,
        rdOperations: form.rdOperations,
        operationalLimitations: form.operationalLimitations,
        commercialPreferences: form.commercialPreferences,
        email: form.email,
        password: form.password,
        documents: form.documents.filter((document) => document.fileName),
      });
      navigate(resolveRouteByRole(user.role));
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Check provided data.');
    } finally {
      setLoading(false);
    }
  };

  const goToNextStep = (event) => {
    event.preventDefault();
    if (!formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    setError('');
    setStep((currentStep) => Math.min(currentStep + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    setError('');
    setStep((currentStep) => Math.max(currentStep - 1, 0));
  };

  const deferDocuments = () => {
    setError('');
    setStep(3);
  };

  const documentLabel = (documentType) => documentType.replaceAll('_', ' ');

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form ref={formRef} className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Registrazione</p>
          <h1 className="font-display text-2xl font-bold text-brand-900">Crea il tuo profilo WasteMarket</h1>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Avanzamento registrazione">
          {steps.map((stepName, index) => (
            <div key={stepName} className="space-y-2">
              <div className={`h-1 rounded-full ${index <= step ? 'bg-brand-900' : 'bg-slate-200'}`} />
              <p className={`text-xs ${index === step ? 'font-semibold text-brand-900' : 'text-slate-500'}`}>{index + 1}. {stepName}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Dati aziendali</h2>
              <p className="text-sm text-slate-600">Inserisci le informazioni di base della tua organizzazione.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome azienda / ragione sociale" value={form.companyName} onChange={updateField('companyName')} required />
              <Input label="P.IVA / CF" value={form.piva} onChange={updateField('piva')} required />
              <Input label="Forma giuridica (opzionale)" value={form.legalForm} onChange={updateField('legalForm')} />
              <Input label="Sede legale" value={form.registeredOffice} onChange={updateField('registeredOffice')} />
              <Input label="Sedi / unita locali (opzionale)" value={form.localSites} onChange={updateField('localSites')} />
              <Input label="Persona di contatto" value={form.contactPerson} onChange={updateField('contactPerson')} />
              <Input label="PEC (opzionale)" type="email" value={form.pecEmail} onChange={updateField('pecEmail')} />
              <Input label="Email operativa (opzionale)" type="email" value={form.operationalEmail} onChange={updateField('operationalEmail')} />
              <Input label="Telefono (opzionale)" value={form.phone} onChange={updateField('phone')} />
              <Input label="Email" type="email" value={form.email} onChange={updateField('email')} required />
              <Input label="Password" type="password" value={form.password} onChange={updateField('password')} required />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Scegli il tuo ruolo</h2>
              <p className="text-sm text-slate-600">Il ruolo determina i documenti necessari per completare l'onboarding.</p>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Ruolo operativo
              <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={updateRole} required>
                <option value="producer">Produttore</option>
                <option value="transporter">Trasportatore</option>
                <option value="recipient">Destinatario</option>
              </select>
            </label>
            {form.role === 'producer' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Sedi di produzione / ritiro (opzionale)" value={form.productionSites} onChange={updateField('productionSites')} />
                <Input label="Documentazione da intermediario (opzionale)" value={form.intermediaryDocuments} onChange={updateField('intermediaryDocuments')} />
              </div>
            )}
            {form.role === 'transporter' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Iscrizioni / autorizzazioni (opzionale)" value={form.transportAuthorizations} onChange={updateField('transportAuthorizations')} />
                <Input label="Parco mezzi / rimorchi (opzionale)" value={form.vehicleFleet} onChange={updateField('vehicleFleet')} />
                <Input label="Conducenti (opzionale)" value={form.drivers} onChange={updateField('drivers')} />
                <Input label="Regioni / aree operative (opzionale)" value={form.operatingRegions} onChange={updateField('operatingRegions')} />
              </div>
            )}
            {form.role === 'recipient' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Impianti / sedi (opzionale)" value={form.facilities} onChange={updateField('facilities')} />
                <Input label="Autorizzazioni per sede (opzionale)" value={form.siteAuthorizations} onChange={updateField('siteAuthorizations')} />
                <Input label="CER / EER ammessi (opzionale)" value={form.cerCodes} onChange={updateField('cerCodes')} />
                <Input label="Operazioni R/D (opzionale)" value={form.rdOperations} onChange={updateField('rdOperations')} />
                <Input label="Limitazioni / prescrizioni (opzionale)" value={form.operationalLimitations} onChange={updateField('operationalLimitations')} />
                <Input label="Preferenze commerciali / operative (opzionale)" value={form.commercialPreferences} onChange={updateField('commercialPreferences')} />
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Documenti di onboarding</h2>
              <p className="text-sm text-slate-600">Carica i documenti richiesti per il ruolo selezionato. La verifica sara effettuata dall'amministratore.</p>
            </div>
            {form.documents.map((document) => (
              <Input
                key={document.documentType}
                label={documentLabel(document.documentType)}
                type="file"
                onChange={updateDocumentFile(document.documentType)}
              />
            ))}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Controlla e invia</h2>
              <p className="text-sm text-slate-600">Verifica i dati prima di creare il profilo.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><strong>Azienda:</strong> {form.companyName}</p>
              <p><strong>P.IVA:</strong> {form.piva}</p>
              <p><strong>Ruolo:</strong> {form.role}</p>
              <p><strong>Email:</strong> {form.email}</p>
              <p><strong>Documenti:</strong> {form.documents.filter((document) => document.fileName).map((document) => document.fileName).join(', ') || 'Da caricare dopo la registrazione'}</p>
            </div>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="secondary" onClick={goToPreviousStep} disabled={step === 0 || loading}>Indietro</Button>
          {step === 2 && (
            <Button type="button" variant="secondary" onClick={deferDocuments}>Carica dopo</Button>
          )}
          {step < steps.length - 1 ? (
            <Button type="button" onClick={goToNextStep}>{step === 2 ? 'Continua' : 'Continua'}</Button>
          ) : (
            <Button type="submit" disabled={loading}>{loading ? 'Invio in corso...' : 'Completa registrazione'}</Button>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Hai già un account? <Link className="font-semibold text-brand-900" to="/auth/login">Accedi</Link>
        </p>
      </form>
    </div>
  );
}
