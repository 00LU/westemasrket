import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import AgreementPanel from '../../components/shared/AgreementPanel';
import { recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickup } from '../../services/recipientApi';
import { fetchTransporterPickup } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';
import { AvailabilityForm } from '../recipient/RecipientNotificationsPage';
import { ProposalForm } from '../transporter/TransporterNotificationsPage';

export default function OperatorPickupPage({ role }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const recipient = role === 'recipient';
  const query = useQuery({
    queryKey: [role, 'pickup', id],
    queryFn: () => recipient ? fetchRecipientPickup(id) : fetchTransporterPickup(id),
  });
  const item = query.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: [role] });
  const response = item && (recipient ? item.myResponse : item.myProposal);

  return (
    <RoleLayout title="Dettaglio richiesta di ritiro" links={recipient ? recipientLinks : transporterLinks}>
      <Link to={`/${role}/requests`} className="text-sm font-semibold text-brand-900 underline">Torna alle richieste</Link>
      {query.isLoading && <p role="status">Caricamento richiesta...</p>}
      {query.isError && (
        <div role="alert" className="text-red-700">
          <p>{errorMessage(query.error, 'Impossibile caricare la richiesta.')}</p>
          <button type="button" className="underline" onClick={() => query.refetch()}>Riprova</button>
        </div>
      )}
      {item && (
        <>
          <Card title="Richiesta" action={<StatusBadge status={item.stage} kind="stage" />}>
            <div className="space-y-3 text-sm">
              <PickupSummary pickup={item} />
              {!item.agreement && (
                <p role="status" className="rounded-xl bg-brand-50 p-3">
                  {item.stage === 'cancelled'
                    ? 'La richiesta è stata annullata. Non sono richieste altre risposte.'
                    : item.stage === 'closed'
                      ? 'La tua partecipazione è conclusa. Non sono richieste altre risposte.'
                      : item.stage === 'to_respond'
                        ? recipient ? 'Ora tocca a te: conferma la disponibilità o comunica che non sei disponibile.' : 'Ora tocca a te: invia una proposta o comunica che non partecipi.'
                        : 'La tua risposta è stata registrata. Attendi l’esito della raccolta e la scelta del Produttore.'}
                </p>
              )}
              <p>La tua risposta: {RESPONSE_LABELS[response.status]}</p>
              {recipient && response.status === 'available' && (
                <p>Trattamento: {formatEuro(response.pricePerTon)}/ton · {response.destinationAddress}</p>
              )}
              {!recipient && response.status === 'submitted' && <p>Proposta trasporto: {formatEuro(response.price)}</p>}
              {item.canRespond && (recipient
                ? <AvailabilityForm key={item.id} item={item} onDone={refresh} />
                : <ProposalForm key={item.id} item={item} onDone={refresh} />)}
            </div>
          </Card>
          <AgreementPanel key={item.agreement?.activeSlot?.id || item.id} pickupId={id} agreement={item.agreement} role={role} confirmed={item.stage === 'confirmed'} onChanged={refresh} />
        </>
      )}
    </RoleLayout>
  );
}
