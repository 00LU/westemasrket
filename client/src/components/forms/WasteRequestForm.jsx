import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Input from '../ui/Input';
import Button from '../ui/Button';
import CERSelector from './CERSelector';
import { createProducerPickup, publishProducerPickup, updateProducerPickup } from '../../services/producerApi';
import { errorMessage } from '../../services/labels';
import { PICKUP_FORM_DEFAULTS, pickupFormErrors, pickupToForm } from '../../services/pickupForm';

const steps = ['Rifiuto', 'Ritiro', 'Allegati e opzioni', 'Riepilogo'];
const stepFields = [
  ['cerCode', 'quantityTon'],
  ['pickupAddress', 'deadline'],
  ['recurrenceStartDate', 'recurrenceEndDate'],
  ['maxPrice'],
];

export default function WasteRequestForm({ initialPickup }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => initialPickup ? pickupToForm(initialPickup) : { ...PICKUP_FORM_DEFAULTS });
  const initial = useRef(JSON.stringify(form));
  const savedId = useRef(initialPickup?.id);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dirty = JSON.stringify(form) !== initial.current;

  useEffect(() => {
    const beforeUnload = (event) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const guardNavigation = (event) => {
      const link = event.target.closest('a[href]');
      if (dirty && link && !event.ctrlKey && !event.metaKey && !event.shiftKey && link.target !== '_blank'
        && !window.confirm('Hai modifiche non salvate. Vuoi uscire senza salvarle?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guardNavigation, true);
    return () => document.removeEventListener('click', guardNavigation, true);
  }, [dirty]);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const input = (field, props) => (
    <div>
      <Input {...props} value={form[field]} onChange={update(field)} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined} />
      {errors[field] && <p id={`${field}-error`} className="mt-1 text-sm text-red-700">{errors[field]}</p>}
    </div>
  );

  const saveMutation = useMutation({
    mutationFn: async (publish) => {
      const payload = {
        ...form,
        quantityTon: Number(form.quantityTon),
        deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
        maxPrice: Number(form.maxPrice || 0),
        recurrenceStartDate: form.recurring ? form.recurrenceStartDate : null,
        recurrenceEndDate: form.recurring ? form.recurrenceEndDate : null,
        cerRequestNote: form.cerKnown ? '' : 'Richiesta di assistenza per il codice CER',
      };
      const draft = savedId.current
        ? await updateProducerPickup({ id: savedId.current, ...payload })
        : await createProducerPickup(payload);
      savedId.current = draft.id;
      initial.current = JSON.stringify(form);
      await queryClient.invalidateQueries({ queryKey: ['producer'] });
      if (publish && form.cerKnown) {
        try {
          await publishProducerPickup(draft.id);
        } catch (publishError) {
          navigate(`/producer/pickups/${draft.id}`, { state: { notice: `Bozza salvata. Pubblicazione non riuscita: ${errorMessage(publishError)}` } });
          return;
        }
      }
      navigate(`/producer/pickups/${draft.id}`, {
        state: { notice: publish && form.cerKnown ? 'Richiesta pubblicata: i destinatari sono stati avvisati.' : 'Bozza salvata. Puoi modificarla e pubblicarla dal dettaglio.' },
      });
    },
    onError: (requestError) => setError(errorMessage(requestError, 'Impossibile salvare la richiesta. I dati inseriti sono ancora qui.')),
  });

  const advance = () => {
    const validation = pickupFormErrors(form);
    const currentErrors = Object.fromEntries(stepFields[step].filter((field) => validation[field]).map((field) => [field, validation[field]]));
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length === 0) setStep((current) => Math.min(current + 1, 3));
  };
  const save = (publish) => {
    const validation = pickupFormErrors(form);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      setStep(stepFields.findIndex((fields) => fields.some((field) => validation[field])));
      setError('Completa i campi evidenziati prima di salvare.');
      return;
    }
    saveMutation.mutate(publish);
  };
  return (
    <div>
      <form className="panel space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); if (step < 3) advance(); else save(true); }}>
        <fieldset disabled={saveMutation.isPending} className="space-y-5">
          <legend className="font-display text-xl font-semibold text-slate-900">{initialPickup ? 'Modifica bozza' : 'Nuova richiesta di ritiro'}</legend>
          <ol aria-label="Avanzamento richiesta" className="flex flex-wrap gap-2">
            {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`rounded-full px-3 py-1 text-sm ${step === index ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}. {label}</li>)}
          </ol>
          <p className="text-sm text-slate-600">Passaggio {step + 1} di 4. I campi indicati come obbligatori servono anche per salvare la bozza.</p>
          {step === 0 && (
            <section className="space-y-3" aria-label="Rifiuto">
              {input('wasteDescription', { label: 'Descrizione del rifiuto', placeholder: 'Materiale, origine e stato fisico' })}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!form.cerKnown} onChange={(event) => { setForm((current) => ({ ...current, cerKnown: !event.target.checked })); setErrors({}); }} />Non conosco il codice CER / EER</label>
              {form.cerKnown ? <><CERSelector value={form.cerCode} onChange={(value) => { setForm((current) => ({ ...current, cerCode: value })); setErrors((current) => ({ ...current, cerCode: undefined })); }} />{errors.cerCode && <p className="text-sm text-red-700">{errors.cerCode}</p>}</> : <p className="rounded-xl bg-amber-50 p-3 text-sm">La richiesta resterà in bozza finché l’amministratore non proporrà il CER. Non verranno ancora invitati destinatari.</p>}
              {input('quantityTon', { label: 'Quantità (ton) — obbligatoria', type: 'number', min: '0.001', step: 'any' })}
            </section>
          )}
          {step === 1 && (
            <section className="space-y-3" aria-label="Ritiro">
              {input('pickupAddress', { label: 'Indirizzo di ritiro — obbligatorio', placeholder: 'Via, numero civico, comune' })}
              {input('deadline', { label: 'Data limite del ritiro — obbligatoria', type: 'date' })}
              <p className="text-sm text-slate-600">È il termine entro cui richiedi il ritiro, non una prenotazione: giorno e orario saranno concordati dopo la scelta del pacchetto.</p>
              {input('containment', { label: 'Contenimento e modalità di carico', placeholder: 'Big bag, fusti, cassone, cisterna...' })}
              {input('specialInfo', { label: 'Esigenze particolari', placeholder: 'ADR, accesso mezzi, attrezzature...' })}
            </section>
          )}
          {step === 2 && (
            <section className="space-y-3" aria-label="Allegati e opzioni">
              <Input label="Foto del rifiuto (opzionale, massimo 1 MB)" type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files[0];
                if (!file) return;
                if (file.size > 1000000) { setError('La foto deve essere inferiore a 1 MB.'); return; }
                const reader = new FileReader();
                reader.onerror = () => setError('Impossibile leggere la foto. Seleziona nuovamente il file.');
                reader.onload = () => { setError(''); setForm((current) => ({ ...current, photoFileName: file.name, photoData: reader.result })); };
                reader.readAsDataURL(file);
              }} />
              {form.photoFileName && <p className="text-sm">Foto selezionata: {form.photoFileName}</p>}
              {input('technicalDocuments', { label: 'Riferimenti a documenti tecnici / analisi (opzionale)', placeholder: 'Nome o riferimento; questo campo non carica file' })}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.recurring} onChange={update('recurring')} />Usa come modello ricorrente</label>
              {form.recurring && <div className="space-y-3"><p className="text-sm text-slate-600">La ricorrenza crea un modello riutilizzabile: non pubblica automaticamente nuovi ritiri.</p><label className="flex flex-col gap-2 text-sm">Frequenza<select value={form.recurrenceFrequency} onChange={update('recurrenceFrequency')} className="rounded-xl border p-3"><option value="weekly">Settimanale</option><option value="monthly">Mensile</option><option value="quarterly">Trimestrale</option></select></label>{input('recurrenceStartDate', { label: 'Inizio ricorrenza', type: 'date' })}{input('recurrenceEndDate', { label: 'Fine ricorrenza', type: 'date' })}</div>}
            </section>
          )}
          {step === 3 && (
            <section className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm" aria-label="Riepilogo">
              <p><strong>Rifiuto:</strong> {form.wasteDescription || 'Non indicato'} · CER: {form.cerKnown ? form.cerCode : 'Da proporre'} · {form.quantityTon} ton</p>
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>Modifica rifiuto</Button>
              <p><strong>Ritiro:</strong> {form.pickupAddress} · entro il {form.deadline}</p>
              <p>{form.containment || 'Contenimento non indicato'} · {form.specialInfo || 'Nessuna esigenza particolare indicata'}</p>
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>Modifica ritiro</Button>
              <p><strong>Foto:</strong> {form.photoFileName || 'Nessuna'} · <strong>Documenti:</strong> {form.technicalDocuments || 'Nessun riferimento'}</p>
              <p><strong>Modello ricorrente:</strong> {form.recurring ? `${form.recurrenceFrequency}, dal ${form.recurrenceStartDate} al ${form.recurrenceEndDate}` : 'No'}</p>
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>Modifica allegati e opzioni</Button>
              {input('maxPrice', { label: 'Budget indicativo totale (EUR, opzionale)', type: 'number', min: '0', step: '0.01' })}
              <p>Vuoto o zero = nessun budget. Le offerte oltre budget saranno segnalate, non escluse. Il prezzo sarà determinato dalle proposte ricevute.</p>
              <p>{form.cerKnown ? 'Pubblicando inviterai i destinatari. I trasportatori saranno avvisati solo dopo le disponibilità.' : 'Salverai una bozza in attesa della proposta CER dell’amministratore.'}</p>
            </section>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {Object.values(errors).some(Boolean) && <p role="alert" className="text-sm text-red-700">Controlla i campi evidenziati.</p>}
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => { setErrors({}); setError(''); setStep((current) => Math.max(current - 1, 0)); }} disabled={step === 0}>Indietro</Button>
            <Button type="button" variant="secondary" onClick={() => save(false)}>Salva bozza</Button>
            <Button type="submit">{saveMutation.isPending ? 'Salvataggio...' : step < 3 ? 'Continua' : form.cerKnown ? 'Pubblica richiesta' : 'Salva e richiedi proposta CER'}</Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
