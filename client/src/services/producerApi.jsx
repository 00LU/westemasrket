import api from './api';

export async function fetchProducerPickups() {
  const { data } = await api.get('/producers/pickups');
  return data;
}

export async function fetchProducerPickup(id) {
  const { data } = await api.get(`/producers/pickups/${id}`);
  return data;
}

export async function createProducerPickup(payload) {
  const { data } = await api.post('/producers/pickups', payload);
  return data;
}

export async function publishProducerPickup(id) {
  const { data } = await api.post(`/producers/pickups/${id}/publish`);
  return data;
}

export async function closeRecipientPhase(id) {
  const { data } = await api.post(`/producers/pickups/${id}/close-recipients`);
  return data;
}

export async function closeTransporterPhase(id) {
  const { data } = await api.post(`/producers/pickups/${id}/close-transporters`);
  return data;
}

export async function selectProducerPackage({ id, packageId }) {
  const { data } = await api.post(`/producers/pickups/${id}/packages/${packageId}/select`);
  return data;
}

export async function withdrawProducerSelection(id) {
  const { data } = await api.post(`/producers/pickups/${id}/withdraw-selection`);
  return data;
}

export async function cancelProducerPickup({ id, reason }) {
  const { data } = await api.post(`/producers/pickups/${id}/cancel`, { reason });
  return data;
}
