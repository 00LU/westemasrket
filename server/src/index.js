require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { DataTypes } = require('sequelize');
const app = require('./app');
const sequelize = require('./config/db');
const { initModels } = require('./models');
const { registerNotificationSocket } = require('./websocket/notificationSocket');
const { setSocketServer } = require('./services/notificationService');
const { expireStaleAgreements } = require('./services/pickupWorkflow');
const { settings } = require('./config/pickupFlow');

// Columns added to existing tables after their first creation (sync() never alters tables).
async function ensureProfileColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const schema = process.env.DB_SCHEMA;
  const describe = (table) => queryInterface.describeTable(schema ? { tableName: table, schema } : table);

  if (await queryInterface.tableExists(schema ? { tableName: 'users', schema } : 'users')) {
    const table = await describe('users');
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
        await queryInterface.addColumn(schema ? { tableName: 'users', schema } : 'users', column, { type, allowNull: true });
      }
    }
  }

  if (await queryInterface.tableExists(schema ? { tableName: 'documents', schema } : 'documents')) {
    const documentTable = await describe('documents');
    if (!documentTable.file_data) {
      await queryInterface.addColumn(schema ? { tableName: 'documents', schema } : 'documents', 'file_data', { type: DataTypes.TEXT, allowNull: true });
    }
  }
}

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
    await ensureProfileColumns();
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
