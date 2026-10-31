import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import { Banknote, Receipt } from 'lucide-react';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import StatusAlert from '../../components/ui/StatusAlert';
import { recipientLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickups } from '../../services/recipientApi';
import { errorMessage, formatEuro } from '../../services/labels';

export default function RecipientEarningsPage() {
  const query = useQuery({ queryKey: ['recipient', 'pickups'], queryFn: fetchRecipientPickups });
  const pickups = (query.data || []).filter((item) => item.stage === 'confirmed');
  const total = pickups.reduce((sum, item) => sum + Number(item.confirmedValue || 0), 0);
  return (
    <RoleLayout title="Importi concordati" links={recipientLinks}>
      <Card title="Riepilogo dei ritiri confermati">
        <p className="mb-3 text-sm text-slate-600">Importi delle proposte di trattamento per tutti i ritiri confermati. Non rappresentano fatture emesse o pagamenti incassati; IVA ed extra non vengono calcolati separatamente.</p>
        {query.isLoading && <p role="status">Caricamento importi...</p>}
        {query.isError && <StatusAlert variant="error">{errorMessage(query.error, 'Impossibile caricare gli importi concordati.')}</StatusAlert>}
        {!query.isLoading && !query.isError && (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard tone="dark" icon={Banknote} label="Totale concordato" value={formatEuro(total)} />
            <StatCard tone="accent" icon={Receipt} label="Ritiri confermati" value={pickups.length} />
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
