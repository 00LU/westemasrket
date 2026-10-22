import api from './api';

export async function fetchRecipientPickups() {
  const { data } = await api.get('/recipients/pickups');
  return data;
}

export async function fetchRecipientPickup(id) {
  const { data } = await api.get(`/recipients/pickups/${id}`);
  return data;
}

export async function respondRecipientAvailability({ id, ...payload }) {
  const { data } = await api.post(`/recipients/pickups/${id}/availability`, payload);
  return data;
}

export async function updateRecipientPricing(payload) {
  const { data } = await api.post('/recipients/pricing', payload);
  return data;
}

export async function updateRecipientCapacity(payload) {
  const { data } = await api.post('/recipients/capacity', payload);
  return data;
}
