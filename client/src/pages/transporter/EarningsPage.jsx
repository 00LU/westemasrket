import RoleLayout from '../../components/shared/RoleLayout';
import { Banknote, Receipt, TrendingUp } from 'lucide-react';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import StatusAlert from '../../components/ui/StatusAlert';
import { useQuery } from '@tanstack/react-query';
import { fetchTransporterEarnings } from '../../services/transporterApi';
import { errorMessage, formatEuro } from '../../services/labels';
import { transporterLinks } from '../../components/shared/navLinks';

export default function EarningsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'earnings'],
    queryFn: fetchTransporterEarnings,
  });

  const gross = Number(data?.gross || 0);
  const jobs = Number(data?.jobs || 0);
  return (
    <RoleLayout title="Importi concordati" links={transporterLinks}>
      <Card title="Riepilogo dei ritiri confermati">
        <p className="mb-3 text-sm text-slate-600">Importi delle proposte di trasporto per i ritiri confermati. Non rappresentano fatture emesse o pagamenti incassati; IVA ed extra non vengono calcolati separatamente.</p>
        {isLoading && <p role="status" className="text-sm text-slate-600">Caricamento importi...</p>}
        {isError && (
          <StatusAlert variant="error">
            {errorMessage(error, 'Impossibile caricare gli importi concordati.')}
          </StatusAlert>
        )}
        {!isLoading && !isError && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard tone="dark" icon={Banknote} label="Totale concordato" value={formatEuro(gross)} />
            <StatCard tone="accent" icon={Receipt} label="Ritiri confermati" value={jobs} />
            <StatCard icon={TrendingUp} label="Media per ritiro" value={formatEuro(jobs > 0 ? gross / jobs : 0)} />
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
