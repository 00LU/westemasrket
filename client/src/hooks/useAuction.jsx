import { useEffect, useState } from 'react';
import { useAuctionContext } from '../context/AuctionContext';
import { useWebSocket } from './useWebSocket';

export function useAuction(roomId) {
  const { bids, pushBid } = useAuctionContext();
  const socketRef = useWebSocket('/auctions');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('auction:join', { roomId });
    });

    socket.on('auction:new-bid', (bid) => {
      pushBid(bid);
    });

    return () => {
      socket.off('connect');
      socket.off('auction:new-bid');
    };
  }, [roomId, pushBid, socketRef]);

  return { bids, connected };
}
