import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import CoverageZoneMap from '../../components/map/CoverageZoneMap';
import { useQuery } from '@tanstack/react-query';
import { transporterLinks } from '../../components/shared/navLinks';
import { fetchTransporterEarnings, fetchTransporterPickups } from '../../services/transporterApi';
import { errorMessage } from '../../services/labels';

export default function TransporterDashboard() {
  const pickupsQuery = useQuery({ queryKey: ['transporter', 'pickups'], queryFn: fetchTransporterPickups });
  const earningsQuery = useQuery({ queryKey: ['transporter', 'earnings'], queryFn: fetchTransporterEarnings });

  const pickups = pickupsQuery.data || [];
  const earnings = earningsQuery.data || { gross: 0, currency: 'EUR' };
  const toBid = pickups.filter((item) => item.stage === 'to_respond').length;
  const inProgress = pickups.filter((item) => ['in_agreement', 'confirmed'].includes(item.stage)).length;
  const hasError = pickupsQuery.isError || earningsQuery.isError;

  return (
    <RoleLayout title="Dashboard trasportatore" links={transporterLinks}>
      {hasError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(pickupsQuery.error || earningsQuery.error, 'Impossibile caricare i dati.')}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Da quotare"><p className="text-3xl font-bold">{toBid}</p></Card>
        <Card title="Ritiri in corso"><p className="text-3xl font-bold">{inProgress}</p></Card>
        <Card title="Ricavi confermati"><p className="text-3xl font-bold">{earnings.currency} {Number(earnings.gross || 0).toLocaleString()}</p></Card>
      </div>
      <CoverageZoneMap />
    </RoleLayout>
  );
}
