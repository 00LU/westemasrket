import api from './api';

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchProfileRequirements() {
  const { data } = await api.get('/documents/requirements');
  return data;
}

export async function fetchProfileDocuments() {
  const { data } = await api.get('/documents');
  return data;
}

export async function uploadProfileDocument(payload) {
  const { data } = await api.post('/documents', payload);
  return data;
}

export async function createProfileProductionSite(payload) {
  const { data } = await api.post('/producers/sites', payload);
  return data;
}

export async function deleteProfileProductionSite(id) {
  await api.delete(`/producers/sites/${id}`);
}
