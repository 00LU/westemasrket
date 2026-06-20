import api from './api';

export async function fetchRecipientNotifications() {
  const { data } = await api.get('/recipients/notifications');
  return data;
}

export async function createRecipientOffer(payload) {
  const { data } = await api.post('/recipients/offers', payload);
  return data;
}

export async function acceptRecipientSelection(wasteRequestId) {
  const { data } = await api.patch(`/recipients/waste-requests/${wasteRequestId}/accept-selection`);
  return data;
}

export async function fetchIncomingShipments() {
  const { data } = await api.get('/recipients/incoming');
  return data;
}

export async function updateRecipientIncomingStatus({ wasteRequestId, status }) {
  const { data } = await api.patch(`/recipients/waste-requests/${wasteRequestId}/status`, { status });
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
