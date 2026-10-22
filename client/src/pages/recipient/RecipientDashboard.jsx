import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { recipientLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickups } from '../../services/recipientApi';
import { errorMessage } from '../../services/labels';

export default function RecipientDashboard() {
  const { data = [], isError, error } = useQuery({
    queryKey: ['recipient', 'pickups'],
    queryFn: fetchRecipientPickups,
  });

  const toRespond = data.filter((item) => item.stage === 'to_respond').length;
  const inProgress = data.filter((item) => item.stage === 'in_agreement').length;
  const confirmed = data.filter((item) => item.stage === 'confirmed');
  const confirmedTon = confirmed.reduce((sum, item) => sum + Number(item.quantityTon || 0), 0);

  return (
    <RoleLayout title="Dashboard destinatario" links={recipientLinks}>
      {isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(error, 'Impossibile caricare i dati.')}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card title="Da confermare"><p className="text-3xl font-bold">{toRespond}</p></Card>
        <Card title="In accordo"><p className="text-3xl font-bold">{inProgress}</p></Card>
        <Card title="Ritiri confermati"><p className="text-3xl font-bold">{confirmed.length}</p></Card>
        <Card title="Volume confermato"><p className="text-3xl font-bold">{confirmedTon.toLocaleString()} ton</p></Card>
      </div>
    </RoleLayout>
  );
}
