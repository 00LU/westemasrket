import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/pickupApi';

export function useNotifications() {
  const socketRef = useWebSocket('/notifications');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
  const items = query.data?.items || [];
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['notifications'], (current) => current && ({
        ...current, items: current.items.map((item) => item.id === id ? { ...item, read: true } : item),
      }));
    },
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData(['notifications'], (current) => current && ({
        ...current, items: current.items.map((item) => ({ ...item, read: true })),
      }));
    },
  });

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    const onNew = (notification) => {
      queryClient.setQueryData(['notifications'], (current) => ({
        ...current,
        items: [notification, ...(current?.items || []).filter((item) => item.id !== notification.id)].slice(0, 50),
      }));
      // A notification means some pickup changed: refresh whatever the current page shows.
      ['producer', 'recipient', 'transporter'].forEach((scope) => queryClient.invalidateQueries({ queryKey: [scope] }));
    };

    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [socketRef, queryClient]);

  return {
    items, unread: items.filter((item) => !item.read).length,
    markRead: readMutation.mutate, markAllRead: readAllMutation.mutate,
    isLoading: query.isLoading, error: query.error || readMutation.error || readAllMutation.error,
    retry: () => { readMutation.reset(); readAllMutation.reset(); query.refetch(); },
    isMarking: readMutation.isPending || readAllMutation.isPending,
  };
}
