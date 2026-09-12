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
  const tableExists = await queryInterface.tableExists('waste_requests');

  if (!tableExists) {
    return;
  }

  const table = await queryInterface.describeTable('waste_requests');

  const optionalOrderColumns = {
    cer_known: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    waste_description: { type: DataTypes.TEXT, allowNull: true },
    photo_file_name: { type: DataTypes.STRING, allowNull: true },
    photo_data: { type: DataTypes.TEXT, allowNull: true },
    technical_documents: { type: DataTypes.TEXT, allowNull: true },
    containment: { type: DataTypes.TEXT, allowNull: true },
    special_info: { type: DataTypes.TEXT, allowNull: true },
    recurrence_frequency: { type: DataTypes.STRING, allowNull: true },
    recurrence_start_date: { type: DataTypes.DATEONLY, allowNull: true },
    recurrence_end_date: { type: DataTypes.DATEONLY, allowNull: true },
    recurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    cer_request_note: { type: DataTypes.TEXT, allowNull: true },
    workflow_status: { type: DataTypes.STRING, allowNull: true },
    selected_final_price: { type: DataTypes.FLOAT, allowNull: true },
    selected_platform_fee: { type: DataTypes.FLOAT, allowNull: true },
    transporter_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    recipient_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  };

  for (const [column, definition] of Object.entries(optionalOrderColumns)) {
    if (!table[column]) {
      await queryInterface.addColumn('waste_requests', column, definition);
    }
  }

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

async function ensureAuctionColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const bidExists = await queryInterface.tableExists('bids');
  if (bidExists) {
    const bidTable = await queryInterface.describeTable('bids');
    if (!bidTable.pricing_mode) await queryInterface.addColumn('bids', 'pricing_mode', { type: DataTypes.STRING, allowNull: false, defaultValue: 'fixed_trip' });
    if (!bidTable.distance_km) await queryInterface.addColumn('bids', 'distance_km', { type: DataTypes.FLOAT, allowNull: true });
    if (bidTable.recipient_id && bidTable.recipient_id.allowNull === false) {
      await queryInterface.changeColumn('bids', 'recipient_id', { type: DataTypes.UUID, allowNull: true });
    }
  }

  const offerExists = await queryInterface.tableExists('recipient_offers');
  if (offerExists) {
    const offerTable = await queryInterface.describeTable('recipient_offers');
    if (!offerTable.pricing_unit) await queryInterface.addColumn('recipient_offers', 'pricing_unit', { type: DataTypes.STRING, allowNull: false, defaultValue: 'per_ton' });
    if (!offerTable.quantity_tolerance_percent) await queryInterface.addColumn('recipient_offers', 'quantity_tolerance_percent', { type: DataTypes.FLOAT, allowNull: true, defaultValue: 1 });
    if (!offerTable.availability_window) await queryInterface.addColumn('recipient_offers', 'availability_window', { type: DataTypes.STRING, allowNull: true });
  }
}

async function ensureUserProfileColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const tableExists = await queryInterface.tableExists('users');

  if (!tableExists) {
    return;
  }

  const table = await queryInterface.describeTable('users');

  const optionalColumns = {
    legal_form: DataTypes.STRING,
    registered_office: DataTypes.STRING,
    local_sites: DataTypes.TEXT,
    contact_person: DataTypes.STRING,
    pec_email: DataTypes.STRING,
    operational_email: DataTypes.STRING,
    phone: DataTypes.STRING,
    production_sites: DataTypes.TEXT,
    intermediary_documents: DataTypes.TEXT,
    transport_authorizations: DataTypes.TEXT,
    vehicle_fleet: DataTypes.TEXT,
    drivers: DataTypes.TEXT,
    operating_regions: DataTypes.TEXT,
    facilities: DataTypes.TEXT,
    site_authorizations: DataTypes.TEXT,
    cer_codes: DataTypes.TEXT,
    rd_operations: DataTypes.TEXT,
    operational_limitations: DataTypes.TEXT,
    commercial_preferences: DataTypes.TEXT,
  };

  for (const [column, type] of Object.entries(optionalColumns)) {
    if (!table[column]) {
      await queryInterface.addColumn('users', column, { type, allowNull: true });
    }
  }

}

(async function bootstrap() {
  try {
    initModels();
    await sequelize.authenticate();
    await sequelize.sync();
    await ensureUserProfileColumns();
    await ensureWasteRequestWorkflowColumns();
    await ensureAuctionColumns();
    await sequelize.sync();
    server.listen(port, () => {
      console.log(`WasteMarket API running on port ${port}`);
    });
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
})();
