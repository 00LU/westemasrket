require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const sequelize = require('./config/db');
const { initModels } = require('./models');
const { registerNotificationSocket } = require('./websocket/notificationSocket');
const { setSocketServer } = require('./services/notificationService');
const { expireStaleAgreements } = require('./services/pickupWorkflow');
const { settings } = require('./config/pickupFlow');

const port = Number(process.env.PORT || 5000);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

registerNotificationSocket(io);
setSocketServer(io);

(async function bootstrap() {
  try {
    initModels();
    await sequelize.authenticate();
    if (process.env.DB_SCHEMA) await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${process.env.DB_SCHEMA}"`);
    await sequelize.sync();
    server.listen(port, () => {
      console.log(`WasteMarket API running on port ${port}`);
    });

    // Parties that never answer a day/time proposal are treated as a refusal.
    setInterval(() => {
      expireStaleAgreements().catch((error) => console.error('Agreement sweep failed', error));
    }, settings.agreementSweepIntervalMs).unref();
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
})();
