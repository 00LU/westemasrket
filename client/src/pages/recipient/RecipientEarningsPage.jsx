import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
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
        {query.isError && <p role="alert" className="text-red-700">{errorMessage(query.error, 'Impossibile caricare gli importi concordati.')}</p>}
        {!query.isLoading && !query.isError && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">Ritiri confermati: {pickups.length}</div>
            <div className="rounded-xl border border-slate-200 p-3">Totale concordato: {formatEuro(total)}</div>
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
