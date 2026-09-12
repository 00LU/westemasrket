import api from './api';

export async function fetchProducerActiveOrders() {
  const { data } = await api.get('/producers/orders/active');
  return data;
}

export async function fetchProducerOrderHistory() {
  const { data } = await api.get('/producers/orders/history');
  return data;
}

export async function fetchProducerRecurringOrders() {
  const { data } = await api.get('/producers/orders/recurring');
  return data;
}

export async function repeatProducerOrder({ orderId, quantityTon, deadline, photoFileName, confirmStableData }) {
  const { data } = await api.post(`/producers/orders/recurring/${orderId}/repeat`, {
    quantityTon,
    deadline,
    photoFileName,
    confirmStableData,
  });
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

export async function fetchProducerCombinations() {
  const { data } = await api.get('/producers/combinations');
  return data;
}

export async function selectProducerCombination({ orderId, bidId, recipientOfferId, finalPrice, platformFee }) {
  const { data } = await api.post(`/producers/waste-requests/${orderId}/select-combination`, {
    bidId,
    recipientOfferId,
    finalPrice,
    platformFee,
  });
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

export async function fetchDocumentRequirements() {
  const { data } = await api.get('/documents/requirements');
  return data;
}

export async function uploadDocument(payload) {
  const { data } = await api.post('/documents', payload);
  return data;
}

export async function fetchUserDocuments() {
  const { data } = await api.get('/documents');
  return data;
}
