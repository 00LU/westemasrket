import RoleLayout from '../../components/shared/RoleLayout';
import WasteRequestForm from '../../components/forms/WasteRequestForm';

const links = [
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/auction/123', label: 'Auction Room' },
  { to: '/producer/orders', label: 'Orders & Docs' },
];

export default function NewRequestPage() {
  return (
    <RoleLayout title="Create Waste Request" links={links}>
      <WasteRequestForm />
    </RoleLayout>
  );
}
