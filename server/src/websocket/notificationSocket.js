const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Each user joins a private room, so a notification is delivered only to its recipient.
function registerNotificationSocket(io) {
  const namespace = io.of('/notifications');

  namespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret');
      const user = await User.findByPk(decoded.sub, { attributes: ['id'] });
      if (!user) return next(new Error('Invalid token subject'));
      socket.data.userId = user.id;
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  namespace.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });
}

module.exports = { registerNotificationSocket };
