let ioServer = null;

function setSocketServer(io) {
  ioServer = io;
}

async function notifyUser(userId, type, payload) {
  if (!ioServer) return;
  ioServer.of('/notifications').emit('notification:new', {
    userId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  setSocketServer,
  notifyUser,
};
