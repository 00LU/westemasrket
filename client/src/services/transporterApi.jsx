import api from './api';

export async function fetchTransporterNotifications() {
  const { data } = await api.get('/transporters/notifications');
  return data;
}

export async function fetchTransporterJobs() {
  const { data } = await api.get('/transporters/jobs');
  return data;
}

export async function updateTransporterJobStatus({ wasteRequestId, status }) {
  const { data } = await api.patch(`/transporters/waste-requests/${wasteRequestId}/status`, { status });
  return data;
}

export async function fetchTransporterEarnings() {
  const { data } = await api.get('/transporters/earnings');
  return data;
}

export async function createTransportOffer(payload) {
  const { data } = await api.post('/bids', payload);
  return data;
}

export async function acceptTransportSelection(wasteRequestId) {
  const { data } = await api.patch(`/transporters/waste-requests/${wasteRequestId}/accept-selection`);
  return data;
}

export async function confirmTransporterCombination(wasteRequestId) {
  const { data } = await api.patch(`/transporters/waste-requests/${wasteRequestId}/confirm-combination`);
  return data;
}
