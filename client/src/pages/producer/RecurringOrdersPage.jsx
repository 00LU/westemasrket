import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusAlert from '../../components/ui/StatusAlert';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/shared/StatusBadge';
import { producerLinks } from '../../components/shared/navLinks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProducerRecurringOrders, publishProducerPickup, repeatProducerOrder, uploadProducerPhoto } from '../../services/producerApi';
import { compressPhoto } from '../../services/photoUpload';
import { formatQuantity } from '../../services/labels';

const emptyRepeatForm = { quantity: '', deadline: '', confirmStableData: false };

export default function RecurringOrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState(emptyRepeatForm);
  const [photos, setPhotos] = useState([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState('');
  const [createdRequestId, setCreatedRequestId] = useState(null);
  const { data = [], isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['producer', 'recurring-orders'],
    queryFn: fetchProducerRecurringOrders,
  });

  const repeatMutation = useMutation({
    mutationFn: async () => {
      const request = await repeatProducerOrder({
        orderId: selectedOrder.id,
        quantity: Number(form.quantity),
        deadline: form.deadline,
        confirmStableData: form.confirmStableData,
        idempotencyKey,
      });
      if (request.status === 'draft') {
        for (const photo of photos) await uploadProducerPhoto({ id: request.id, photo });
        await publishProducerPickup(request.id);
      } else if (request.status === 'cancelled') {
        throw new Error('La richiesta generata è stata annullata; avvia una nuova ripetizione.');
      }
      return request;
    },
    onSuccess: (request) => {
      setError('');
      setCreatedRequestId(request.id);
      setSelectedOrder(null);
      setForm(emptyRepeatForm);
      setPhotos([]);
      setIdempotencyKey('');
      queryClient.invalidateQueries({ queryKey: ['producer'] });
    },
    onError: (requestError) => {
      setError(requestError?.response?.data?.message || requestError?.message || 'Impossibile ripetere l\'ordine.');
    },
  });

  const openRepeat = (order) => {
    setSelectedOrder(order);
    setForm({ ...emptyRepeatForm, quantity: String(order.quantity || '') });
    setPhotos([]);
    setIdempotencyKey(crypto.randomUUID());
    setError('');
    setCreatedRequestId(null);
  };

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitRepeat = (event) => {
    event.preventDefault();
    if (photos.length === 0) {
      setError('Carica almeno una nuova foto.');
      return;
    }
    repeatMutation.mutate();
  };

  const selectPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    try {
      setPhotos(await Promise.all(files.map(compressPhoto)));
      setError('');
    } catch (photoError) {
      setError(photoError.message || 'Impossibile elaborare le foto selezionate.');
    }
  };

  return (
    <RoleLayout title="Ordini ricorrenti" links={producerLinks}>
      {createdRequestId && (
        <StatusAlert
          variant="success"
          title="Richiesta creata e pubblicata"
          action={
            <Button type="button" variant="secondary" onClick={() => navigate(`/producer/pickups/${createdRequestId}`)}>
              Apri la richiesta
            </Button>
          }
        >
          Sono iniziati gli inviti ai destinatari. La richiesta precedente non è stata modificata.
        </StatusAlert>
      )}
      <Card title="Modelli riutilizzabili">
        <p className="mb-4 text-sm text-slate-600">I dati stabili vengono riutilizzati; quantità, tempistica e foto vengono aggiornate. Ogni ripetizione crea una nuova richiesta e avvia un nuovo matching, senza modificare quella precedente.</p>
        {isLoading && <p className="text-sm text-slate-600">Caricamento ordini ricorrenti...</p>}
        {isError && (
          <StatusAlert
            variant="error"
            title="Impossibile caricare i modelli ricorrenti"
            action={<Button type="button" variant="secondary" onClick={() => refetch()}>Riprova</Button>}
          >
            {loadError?.response?.data?.message || 'Controlla la connessione e riprova.'}
          </StatusAlert>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <EmptyState
            title="Non hai ancora modelli ricorrenti"
            action={
              <Button type="button" onClick={() => navigate('/producer/new-request')}>
                Crea una richiesta
              </Button>
            }
          >
            Crea una richiesta e seleziona “Usa come modello ricorrente” per poterla riutilizzare in seguito.
          </EmptyState>
        )}
        {!isLoading && !isError && data.length > 0 && (
          <div className="space-y-3">
            {data.map((order) => (
              <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">{order.requestCode || '—'} · CER {order.cerCode} | {formatQuantity(order.quantity, order.quantityUnit)}</p>
                  <p className="text-slate-600">{order.pickupAddress}</p>
                  <p className="text-slate-500">Frequenza: {order.recurrenceFrequency || 'non configurata'} · Ultima scadenza: {order.deadline || '-'}</p>
                  <StatusBadge status={order.status} />
                </div>
                <Button type="button" onClick={() => openRepeat(order)}>Ripeti ordine</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedOrder && (
        <Card title="Ripeti ordine">
          <form className="space-y-4" onSubmit={submitRepeat}>
            <p className="text-sm text-slate-600">Conferma che processo e caratteristiche del rifiuto non siano cambiati. Quantità, tempistiche e almeno una foto devono essere aggiornate.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuova quantità ({selectedOrder.quantityUnit === 'liter' ? 'litri' : 'kg'})<input className="rounded-xl border border-slate-300 px-3 py-2" type="number" min="0.001" step="any" value={form.quantity} onChange={update('quantity')} required /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuova tempistica<input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={form.deadline} onChange={update('deadline')} required /></label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuove foto (almeno una)<input type="file" accept="image/*" multiple onChange={selectPhotos} /></label>
            {photos.map((photo) => <p key={photo.idempotencyKey} className="text-sm text-slate-600">{photo.fileName} (compressa)</p>)}
            <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.confirmStableData} onChange={update('confirmStableData')} required /> Confermo che processo e caratteristiche del rifiuto sono invariati.</label>
            {error && <StatusAlert variant="error">{error}</StatusAlert>}
            <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
              <Button type="button" variant="secondary" disabled={repeatMutation.isPending} onClick={() => setSelectedOrder(null)}>Annulla</Button>
              <Button type="submit" disabled={repeatMutation.isPending}>
                {repeatMutation.isPending ? 'Creazione e pubblicazione...' : 'Conferma e crea nuova richiesta'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </RoleLayout>
  );
}
