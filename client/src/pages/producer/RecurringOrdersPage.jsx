import { useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProducerRecurringOrders, repeatProducerOrder } from '../../services/producerApi';

const links = [
  { to: '/profile', label: 'Profilo' },
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/recurring-orders', label: 'Ordini ricorrenti' },
];

const emptyRepeatForm = { quantityTon: '', deadline: '', photoFileName: '', confirmStableData: false };

export default function RecurringOrdersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState(emptyRepeatForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['producer', 'recurring-orders'],
    queryFn: fetchProducerRecurringOrders,
  });

  const repeatMutation = useMutation({
    mutationFn: repeatProducerOrder,
    onSuccess: () => {
      setError('');
      setMessage('Nuovo ordine creato. Sono stati generati un nuovo order_id e una nuova procedura di matching.');
      setSelectedOrder(null);
      setForm(emptyRepeatForm);
      queryClient.invalidateQueries({ queryKey: ['producer', 'active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['producer', 'recurring-orders'] });
    },
    onError: (requestError) => {
      setMessage('');
      setError(requestError?.response?.data?.message || 'Impossibile ripetere l\'ordine.');
    },
  });

  const openRepeat = (order) => {
    setSelectedOrder(order);
    setForm({ ...emptyRepeatForm, quantityTon: String(order.quantityTon || '') });
    setError('');
    setMessage('');
  };

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitRepeat = (event) => {
    event.preventDefault();
    repeatMutation.mutate({ orderId: selectedOrder.id, ...form });
  };

  return (
    <RoleLayout title="Ordini ricorrenti" links={links}>
      <Card title="Modelli riutilizzabili">
        <p className="mb-4 text-sm text-slate-600">I dati stabili vengono riutilizzati, ma ogni ripetizione crea un nuovo ordine, una nuova asta, un nuovo FIR e un nuovo settlement.</p>
        {isLoading && <p className="text-sm text-slate-600">Caricamento ordini ricorrenti...</p>}
        {isError && <p className="text-sm text-red-600">Impossibile caricare gli ordini ricorrenti.</p>}
        {!isLoading && !isError && data.length === 0 && <p className="text-sm text-slate-600">Non hai ancora ordini ricorrenti.</p>}
        {!isLoading && !isError && data.length > 0 && (
          <div className="space-y-3">
            {data.map((order) => (
              <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">CER {order.cerCode} | {order.quantityTon} ton</p>
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
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuova quantità (ton)<input className="rounded-xl border border-slate-300 px-3 py-2" type="number" min="0.1" step="0.1" value={form.quantityTon} onChange={update('quantityTon')} required /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuova tempistica<input className="rounded-xl border border-slate-300 px-3 py-2" type="date" value={form.deadline} onChange={update('deadline')} required /></label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Nuova foto<input type="file" onChange={(event) => setForm((current) => ({ ...current, photoFileName: event.target.files[0]?.name || '' }))} required /></label>
            <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.confirmStableData} onChange={update('confirmStableData')} required /> Confermo che processo e caratteristiche del rifiuto sono invariati.</label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}
            <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setSelectedOrder(null)}>Annulla</Button><Button type="submit" disabled={repeatMutation.isPending}>{repeatMutation.isPending ? 'Creazione...' : 'Conferma e crea nuovo ordine'}</Button></div>
          </form>
        </Card>
      )}
    </RoleLayout>
  );
}
