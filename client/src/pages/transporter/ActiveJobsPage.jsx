import RoleLayout from '../../components/shared/RoleLayout';
import AgreementList from '../../components/shared/AgreementList';
import { transporterLinks } from '../../components/shared/navLinks';
import { fetchTransporterPickup, fetchTransporterPickups } from '../../services/transporterApi';

export default function ActiveJobsPage() {
  return (
    <RoleLayout title="Ritiri in corso" links={transporterLinks}>
      <AgreementList scope="transporter" role="transporter" fetchList={fetchTransporterPickups} fetchOne={fetchTransporterPickup} />
    </RoleLayout>
  );
}
