import RoleLayout from '../../components/shared/RoleLayout';
import AgreementList from '../../components/shared/AgreementList';
import { recipientLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickup, fetchRecipientPickups } from '../../services/recipientApi';

export default function IncomingPage() {
  return (
    <RoleLayout title="Arrivi e conferimenti" links={recipientLinks}>
      <AgreementList scope="recipient" role="recipient" fetchList={fetchRecipientPickups} fetchOne={fetchRecipientPickup} />
    </RoleLayout>
  );
}
