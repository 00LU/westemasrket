import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// The server only delivers notifications to authenticated sockets, one private room per user.
export function useWebSocket(namespace = '/') {
  const socketRef = useRef(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('wm_token') },
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [namespace]);

  return socketRef;
}
