import api from './api';

// Agreement on day/time, shared by producer, recipient and transporter.
export async function proposeSlot({ id, scheduledAt }) {
  const { data } = await api.post(`/pickups/${id}/slots`, { scheduledAt });
  return data;
}

export async function acceptSlot({ id, slotId }) {
  const { data } = await api.post(`/pickups/${id}/slots/${slotId}/accept`);
  return data;
}

export async function rejectPackage(id) {
  const { data } = await api.post(`/pickups/${id}/reject`);
  return data;
}

export async function fetchNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data;
}
