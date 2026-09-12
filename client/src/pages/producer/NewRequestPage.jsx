import RoleLayout from '../../components/shared/RoleLayout';
import WasteRequestForm from '../../components/forms/WasteRequestForm';

const links = [
  { to: '/profile', label: 'Profilo' },
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/recurring-orders', label: 'Ordini ricorrenti' },
];

export default function NewRequestPage() {
  return (
    <RoleLayout title="Create Waste Request" links={links}>
      <WasteRequestForm />
    </RoleLayout>
  );
}
