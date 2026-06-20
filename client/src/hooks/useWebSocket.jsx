import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useWebSocket(namespace = '/') {
  const socketRef = useRef(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [namespace]);

  return socketRef;
}
