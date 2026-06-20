import api from './api';

export async function fetchProducerActiveOrders() {
  const { data } = await api.get('/producers/orders/active');
  return data;
}

export async function fetchProducerOrderHistory() {
  const { data } = await api.get('/producers/orders/history');
  return data;
}

export async function createProducerWasteRequest(payload) {
  const { data } = await api.post('/producers/waste-requests', payload);
  return data;
}

export async function fetchProducerRecipientOffers(wasteRequestId) {
  const { data } = await api.get(`/producers/waste-requests/${wasteRequestId}/recipient-offers`);
  return data;
}

export async function fetchProducerRecipientOffersBoard() {
  const { data } = await api.get('/producers/recipient-offers');
  return data;
}

export async function selectProducerRecipientOffer({ wasteRequestId, recipientOfferId, allowReplace = false }) {
  const { data } = await api.patch(`/producers/waste-requests/${wasteRequestId}/select-recipient`, {
    recipientOfferId,
    allowReplace,
  });
  return data;
}

export async function selectProducerTransportBid({ wasteRequestId, bidId, allowReplace = false }) {
  const { data } = await api.patch(`/producers/waste-requests/${wasteRequestId}/select-transport`, {
    bidId,
    allowReplace,
  });
  return data;
}

export async function updateProducerRequestStatus({ wasteRequestId, status }) {
  const { data } = await api.patch(`/producers/waste-requests/${wasteRequestId}/status`, { status });
  return data;
}
