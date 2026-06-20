function registerAuctionSocket(io) {
  const auctionNamespace = io.of('/auctions');
  const notificationNamespace = io.of('/notifications');

  auctionNamespace.on('connection', (socket) => {
    socket.on('auction:join', ({ roomId }) => {
      socket.join(`auction:${roomId}`);
    });

    socket.on('auction:bid', (bid) => {
      auctionNamespace.to(`auction:${bid.wasteRequestId}`).emit('auction:new-bid', bid);
    });
  });

  notificationNamespace.on('connection', () => {
    // Live notification channel for matched actors.
  });
}

module.exports = { registerAuctionSocket };
