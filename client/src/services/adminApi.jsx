import api from './api';

export async function fetchPendingUsers() {
  const { data } = await api.get('/admin/users/pending');
  return data;
}

export async function fetchAllUsers() {
  const { data } = await api.get('/admin/users');
  return data;
}

export async function approveUser(userId) {
  const { data } = await api.patch(`/admin/users/${userId}/verify`);
  return data;
}

export async function fetchAdminAnalytics() {
  const { data } = await api.get('/admin/analytics');
  return data;
}

export async function fetchAdminCompliance() {
  const { data } = await api.get('/admin/compliance');
  return data;
}

export async function fetchPendingDocuments() {
  const { data } = await api.get('/admin/documents/pending');
  return data;
}

export async function approveDocument(documentId, notes) {
  const { data } = await api.patch(`/admin/documents/${documentId}/approve`, { notes });
  return data;
}

export async function rejectDocument(documentId, notes) {
  const { data } = await api.patch(`/admin/documents/${documentId}/reject`, { notes });
  return data;
}

export async function fetchCerRecognitionRequests() {
  const { data } = await api.get('/admin/cer-recognition');
  return data;
}

export async function proposeCerCode(requestId, cerCode, notes) {
  const { data } = await api.patch(`/admin/cer-recognition/${requestId}/propose`, { cerCode, notes });
  return data;
}
