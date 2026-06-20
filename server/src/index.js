require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { DataTypes } = require('sequelize');
const app = require('./app');
const sequelize = require('./config/db');
const { initModels } = require('./models');
const { registerAuctionSocket } = require('./websocket/auctionRoom');
const { setSocketServer } = require('./services/notificationService');

const port = Number(process.env.PORT || 5000);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

registerAuctionSocket(io);
setSocketServer(io);

async function ensureWasteRequestWorkflowColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('waste_requests');

  if (!table.selected_recipient_id) {
    await queryInterface.addColumn('waste_requests', 'selected_recipient_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }

  if (!table.selected_recipient_offer_id) {
    await queryInterface.addColumn('waste_requests', 'selected_recipient_offer_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }

  if (!table.selected_transporter_id) {
    await queryInterface.addColumn('waste_requests', 'selected_transporter_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }

  if (!table.selected_bid_id) {
    await queryInterface.addColumn('waste_requests', 'selected_bid_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }
}

(async function bootstrap() {
  try {
    initModels();
    await sequelize.authenticate();
    await ensureWasteRequestWorkflowColumns();
    await sequelize.sync();
    server.listen(port, () => {
      console.log(`WasteMarket API running on port ${port}`);
    });
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
})();
