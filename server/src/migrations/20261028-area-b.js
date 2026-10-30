const sequelize = require('../config/db');

const schema = process.env.DB_SCHEMA;
const quoteTable = (name) => sequelize.getQueryInterface().queryGenerator.quoteTable(
  schema ? { tableName: name, schema } : name
);
const quoteIndex = (name) => sequelize.getQueryInterface().quoteIdentifier(name);
const quoteIndexTable = (name) => schema
  ? sequelize.getQueryInterface().queryGenerator.quoteTable({ tableName: name, schema })
  : quoteIndex(name);

const indexes = [
  {
    name: 'pickup_requests_list_order_idx',
    table: 'pickup_requests',
    sql: `CREATE INDEX ${quoteIndex('pickup_requests_list_order_idx')} ON ${quoteTable('pickup_requests')}
      ((CASE WHEN status IN ('cancelled', 'confirmed') THEN 1 ELSE 0 END), created_at DESC, id DESC)`,
  },
  {
    name: 'pickup_requests_producer_list_order_idx',
    table: 'pickup_requests',
    sql: `CREATE INDEX ${quoteIndex('pickup_requests_producer_list_order_idx')} ON ${quoteTable('pickup_requests')}
      (producer_id, (CASE WHEN status IN ('cancelled', 'confirmed') THEN 1 ELSE 0 END), created_at DESC, id DESC)`,
  },
  {
    name: 'recipient_availabilities_recipient_request_idx',
    table: 'recipient_availabilities',
    sql: `CREATE INDEX ${quoteIndex('recipient_availabilities_recipient_request_idx')} ON ${quoteTable('recipient_availabilities')}
      (recipient_id, pickup_request_id)`,
  },
  {
    name: 'transport_proposals_transporter_request_idx',
    table: 'transport_proposals',
    sql: `CREATE INDEX ${quoteIndex('transport_proposals_transporter_request_idx')} ON ${quoteTable('transport_proposals')}
      (transporter_id, pickup_request_id)`,
  },
];

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  await sequelize.transaction(async (transaction) => {
    for (const index of indexes) {
      const existing = await queryInterface.showIndex(
        schema ? { tableName: index.table, schema } : index.table,
        { transaction }
      );
      if (!existing.some((item) => item.name === index.name)) {
        await sequelize.query(index.sql, { transaction });
      }
    }
  });
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  await sequelize.transaction(async (transaction) => {
    for (const index of [...indexes].reverse()) {
      const existing = await queryInterface.showIndex(
        schema ? { tableName: index.table, schema } : index.table,
        { transaction }
      );
      if (existing.some((item) => item.name === index.name)) {
        await sequelize.query(`DROP INDEX ${quoteIndexTable(index.name)}`, { transaction });
      }
    }
  });
}

module.exports = { up, down };
