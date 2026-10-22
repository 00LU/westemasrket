import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/pickupApi';

export function useNotifications() {
  const socketRef = useWebSocket('/notifications');
  const queryClient = useQueryClient();
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setItems(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    const onNew = (notification) => {
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 50));
      // A notification means some pickup changed: refresh whatever the current page shows.
      ['producer', 'recipient', 'transporter'].forEach((scope) => queryClient.invalidateQueries({ queryKey: [scope] }));
    };

    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [socketRef, queryClient]);

  const markRead = useCallback((id) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    markAllNotificationsRead().catch(() => {});
  }, []);

  return { items, unread: items.filter((item) => !item.read).length, markRead, markAllRead };
}
