import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { producerLinks } from '../../components/shared/navLinks';

export default function ProducerEarningsPage() {
  return (
    <RoleLayout title="Corrispettivi" links={producerLinks}>
      <Card title="Riepilogo corrispettivi">
        <p className="text-sm text-slate-600">
          Questa sezione non dispone ancora di dati o di un riepilogo per il produttore.
          Non vengono mostrati importi stimati come se fossero pagamenti o incassi.
        </p>
      </Card>
    </RoleLayout>
  );
}
