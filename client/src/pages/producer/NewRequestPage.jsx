import RoleLayout from '../../components/shared/RoleLayout';
import WasteRequestForm from '../../components/forms/WasteRequestForm';
import { producerLinks } from '../../components/shared/navLinks';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProducerPickup } from '../../services/producerApi';
import { errorMessage } from '../../services/labels';

export default function NewRequestPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['producer', 'pickup', id], queryFn: () => fetchProducerPickup(id), enabled: Boolean(id) });
  return (
    <RoleLayout title={id ? 'Modifica richiesta' : 'Nuova richiesta di ritiro'} links={producerLinks}>
      {id && query.isLoading && <p role="status">Caricamento bozza...</p>}
      {id && query.isError && <p role="alert">{errorMessage(query.error, 'Impossibile caricare la bozza.')}</p>}
      {(!id || query.data) && (
        <WasteRequestForm
          key={id || 'new'}
          initialPickup={query.data?.request}
          initialPhotos={query.data?.photos || []}
        />
      )}
    </RoleLayout>
  );
}
