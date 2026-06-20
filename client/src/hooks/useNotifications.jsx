import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

export function useNotifications() {
  const socketRef = useWebSocket('/notifications');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('notification:new', (payload) => {
      setNotifications((curr) => [payload, ...curr].slice(0, 25));
    });

    return () => {
      socket.off('notification:new');
    };
  }, [socketRef]);

  return notifications;
}
