import { Link } from 'react-router-dom';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { recipientLinks } from '../../components/shared/navLinks';

export default function CapacityPage() {
  return (
    <RoleLayout title="Disponibilità e capacità" links={recipientLinks}>
      <Card title="Configurazione generale non ancora disponibile">
        <div className="space-y-3 text-sm text-slate-700">
          <p>Il calendario generale di capacità e le tariffe CER predefinite non sono ancora operativi. Qui non vengono salvate impostazioni e non vengono modificate le condizioni dei ritiri.</p>
          <p>Puoi indicare prezzo, capacità e finestra di disponibilità rispondendo a ogni richiesta ricevuta.</p>
          <Link to="/recipient/opportunities" className="inline-block font-semibold text-brand-900 underline">Vai alle richieste ricevute</Link>
        </div>
      </Card>
    </RoleLayout>
  );
}
