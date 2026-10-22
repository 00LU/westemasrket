import api from './api';

export async function fetchTransporterPickups() {
  const { data } = await api.get('/transporters/pickups');
  return data;
}

export async function fetchTransporterPickup(id) {
  const { data } = await api.get(`/transporters/pickups/${id}`);
  return data;
}

export async function submitTransportProposal({ id, ...payload }) {
  const { data } = await api.post(`/transporters/pickups/${id}/proposal`, payload);
  return data;
}

export async function fetchTransporterEarnings() {
  const { data } = await api.get('/transporters/earnings');
  return data;
}
