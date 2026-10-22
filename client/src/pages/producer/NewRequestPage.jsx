import RoleLayout from '../../components/shared/RoleLayout';
import WasteRequestForm from '../../components/forms/WasteRequestForm';
import { producerLinks } from '../../components/shared/navLinks';

export default function NewRequestPage() {
  return (
    <RoleLayout title="Nuova richiesta di ritiro" links={producerLinks}>
      <WasteRequestForm />
    </RoleLayout>
  );
}
