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
