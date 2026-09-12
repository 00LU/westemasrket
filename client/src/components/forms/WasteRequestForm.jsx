import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Input from '../ui/Input';
import Button from '../ui/Button';
import CERSelector from './CERSelector';
import { createProducerWasteRequest } from '../../services/producerApi';

const steps = [
  'Sede / luogo',
  'Descrizione rifiuto',
  'Foto',
  'CER / EER',
  'Documenti tecnici',
  'Quantita',
  'Contenimento / carico',
  'Informazioni speciali',
  'Tempistiche',
  'Ricorrenza',
  'Riepilogo',
];

const initialForm = {
  pickupAddress: '',
  wasteDescription: '',
  photoFileName: '',
  photoData: '',
  cerKnown: true,
  cerCode: '15 01 10*',
  technicalDocuments: '',
  quantityTon: '2.5',
  containment: '',
  specialInfo: '',
  deadline: '',
  urgency: 'normal',
  recurring: false,
  recurrenceFrequency: 'monthly',
  recurrenceStartDate: '',
  recurrenceEndDate: '',
  maxPrice: '',
  distanceKm: '85',
};

export default function WasteRequestForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const createMutation = useMutation({
    mutationFn: createProducerWasteRequest,
    onSuccess: (data) => {
      setError('');
      setMessage(data.request.cerKnown === false
        ? 'Richiesta inviata all\'intermediario per la proposta CER.'
        : 'Ordine pubblicato e inviato al matching.');
      setForm(initialForm);
      setStep(0);
    },
    onError: (requestError) => {
      setMessage('');
      setError(requestError?.response?.data?.message || 'Impossibile creare l\'ordine.');
    },
  });

  const next = (event) => {
    event.preventDefault();
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const previous = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = (event) => {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      quantityTon: Number(form.quantityTon),
      pickupLat: 45.4642,
      pickupLng: 9.19,
      deadline: form.deadline || form.recurrenceEndDate,
      maxPrice: Number(form.maxPrice || 0),
      cerRequestNote: form.cerKnown ? '' : 'Richiesta proposta CER da parte dell\'intermediario',
    });
  };

  const estimatedPrice = Math.round(120 * Number(form.quantityTon || 0) + 2.2 * Number(form.distanceKm || 0));

  return (
    <form className="panel space-y-5" onSubmit={submit}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Creazione nuovo ordine</p>
        <h3 className="font-display text-xl font-semibold text-slate-900">Procedura guidata</h3>
      </div>
      <div className="grid gap-1 sm:grid-cols-11" aria-label="Avanzamento ordine">
        {steps.map((label, index) => (
          <div key={label} title={label} className={`h-2 rounded-full ${index <= step ? 'bg-brand-900' : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="text-sm font-semibold text-slate-700">Step {step + 1} di {steps.length}: {steps[step]}</p>

      {step === 0 && <Input label="Sede registrata o luogo diverso" placeholder="Via Industria 14, Milano" value={form.pickupAddress} onChange={update('pickupAddress')} />}
      {step === 1 && <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Descrizione del rifiuto<textarea className="min-h-32 rounded-xl border border-slate-300 px-3 py-2" value={form.wasteDescription} onChange={update('wasteDescription')} placeholder="Processo di origine, materiale, stato fisico..." /></label>}
      {step === 2 && <Input label="Foto del rifiuto (opzionale)" type="file" accept="image/*" onChange={(event) => { const file = event.target.files[0]; if (!file) return; if (file.size > 1000000) { setError('La foto deve essere inferiore a 1 MB.'); return; } const reader = new FileReader(); reader.onload = () => setForm((current) => ({ ...current, photoFileName: file.name, photoData: reader.result })); reader.readAsDataURL(file); }} />}
      {step === 3 && <section className="space-y-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!form.cerKnown} onChange={(event) => setForm((current) => ({ ...current, cerKnown: !event.target.checked }))} /> Non conosco il codice CER / EER</label>{form.cerKnown ? <CERSelector value={form.cerCode} onChange={(value) => setForm((current) => ({ ...current, cerCode: value }))} /> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">L'ordine andra in stato di attesa proposta CER e sara analizzato dall'amministratore.</p>}</section>}
      {step === 4 && <Input label="Documenti tecnici / analisi (opzionale)" placeholder="Nome file o riferimento documento" value={form.technicalDocuments} onChange={update('technicalDocuments')} />}
      {step === 5 && <div className="grid gap-3 sm:grid-cols-2"><Input label="Quantita (ton)" type="number" min="0" step="0.1" value={form.quantityTon} onChange={update('quantityTon')} /><Input label="Distanza stimata (km)" type="number" min="0" value={form.distanceKm} onChange={update('distanceKm')} /></div>}
      {step === 6 && <Input label="Contenimento / carico" placeholder="Big bag, fusti, cassone, cisterna..." value={form.containment} onChange={update('containment')} />}
      {step === 7 && <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Informazioni speciali<textarea className="min-h-32 rounded-xl border border-slate-300 px-3 py-2" value={form.specialInfo} onChange={update('specialInfo')} placeholder="ADR, requisiti specifici, tempi di attesa..." /></label>}
      {step === 8 && <div className="grid gap-3 sm:grid-cols-2"><Input label="Data limite" type="date" value={form.deadline} onChange={update('deadline')} /><label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Urgenza<select className="rounded-xl border border-slate-300 px-3 py-2" value={form.urgency} onChange={update('urgency')}><option value="normal">Normale</option><option value="urgent">Urgente</option></select></label></div>}
      {step === 9 && <section className="space-y-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.recurring} onChange={update('recurring')} /> Ordine ricorrente</label>{form.recurring && <div className="grid gap-3 sm:grid-cols-3"><label className="flex flex-col gap-2 text-sm font-medium">Frequenza<select className="rounded-xl border border-slate-300 px-3 py-2" value={form.recurrenceFrequency} onChange={update('recurrenceFrequency')}><option value="weekly">Settimanale</option><option value="monthly">Mensile</option><option value="quarterly">Trimestrale</option></select></label><Input label="Inizio" type="date" value={form.recurrenceStartDate} onChange={update('recurrenceStartDate')} /><Input label="Fine" type="date" value={form.recurrenceEndDate} onChange={update('recurrenceEndDate')} /></div>}</section>}
      {step === 10 && <section className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Sede:</strong> {form.pickupAddress || '-'}</p><p><strong>Rifiuto:</strong> {form.wasteDescription || '-'}</p><p><strong>CER:</strong> {form.cerKnown ? form.cerCode : 'Da proporre tramite intermediario'}</p><p><strong>Quantita:</strong> {form.quantityTon} ton</p><p><strong>Tempistiche:</strong> {form.deadline || 'Da definire'}</p><p><strong>Stima base:</strong> EUR {estimatedPrice.toLocaleString()}</p><Input label="Prezzo massimo (opzionale)" type="number" min="0" value={form.maxPrice} onChange={update('maxPrice')} /></section>}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between gap-3"><Button type="button" variant="secondary" onClick={previous} disabled={step === 0 || createMutation.isPending}>Indietro</Button>{step < steps.length - 1 ? <Button type="button" onClick={next}>Continua</Button> : <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creazione...' : (form.cerKnown ? 'Pubblica ordine' : 'Richiedi proposta CER')}</Button>}</div>
    </form>
  );
}
