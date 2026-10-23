import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
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
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(error, 'Impossibile caricare gli importi concordati.')}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">Totale concordato: {formatEuro(gross)}</div>
            <div className="rounded-xl border border-slate-200 p-3">Ritiri confermati: {jobs}</div>
            <div className="rounded-xl border border-slate-200 p-3">Media per ritiro: {formatEuro(jobs > 0 ? gross / jobs : 0)}</div>
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
