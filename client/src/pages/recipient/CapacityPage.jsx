import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateRecipientCapacity, updateRecipientPricing } from '../../services/recipientApi';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/notifications', label: 'Notifications' },
  { to: '/recipient/capacity', label: 'Capacity' },
  { to: '/recipient/incoming', label: 'Incoming' },
];

export default function CapacityPage() {
  const [cerCode, setCerCode] = useState('15 01 10*');
  const [pricePerTon, setPricePerTon] = useState('135');
  const [availableSlots, setAvailableSlots] = useState('12');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pricingMutation = useMutation({
    mutationFn: updateRecipientPricing,
  });

  const capacityMutation = useMutation({
    mutationFn: updateRecipientCapacity,
  });

  const handleUpdate = async () => {
    setMessage('');
    setError('');
    try {
      await pricingMutation.mutateAsync({
        cerCode,
        pricePerTon: Number(pricePerTon || 0),
      });
      await capacityMutation.mutateAsync({
        cerCode,
        availableSlots: Number(availableSlots || 0),
      });
      setMessage('Pricing and capacity updated successfully.');
    } catch (err) {
      setError(
        err?.response?.status === 401
          ? 'Unauthorized: please login again as recipient.'
          : err?.response?.data?.message || 'Unable to update capacity.'
      );
    }
  };

  return (
    <RoleLayout title="Capacity Calendar" links={links}>
      <Card title="CER Pricing & Slots">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="CER Code" value={cerCode} onChange={(event) => setCerCode(event.target.value)} />
          <Input label="Price per ton (EUR)" value={pricePerTon} onChange={(event) => setPricePerTon(event.target.value)} />
          <Input label="Available slots" value={availableSlots} onChange={(event) => setAvailableSlots(event.target.value)} />
        </div>
        <Button
          className="mt-4"
          type="button"
          onClick={handleUpdate}
          disabled={pricingMutation.isPending || capacityMutation.isPending}
        >
          {pricingMutation.isPending || capacityMutation.isPending ? 'Updating...' : 'Update Capacity'}
        </Button>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>
    </RoleLayout>
  );
}
