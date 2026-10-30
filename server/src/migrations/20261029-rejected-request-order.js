const sequelize = require('../config/db');

const schema = process.env.DB_SCHEMA;
const qi = sequelize.getQueryInterface();
const quoteTable = (name) => qi.queryGenerator.quoteTable(
  schema ? { tableName: name, schema } : name
);
const quoteIndex = (name) => qi.quoteIdentifier(name);
const quoteIndexTable = (name) => schema
  ? qi.queryGenerator.quoteTable({ tableName: name, schema })
  : quoteIndex(name);

const indexes = [
  {
    name: 'pickup_packages_recipient_rejected_list_idx',
    sql: `CREATE INDEX ${quoteIndex('pickup_packages_recipient_rejected_list_idx')}
      ON ${quoteTable('pickup_packages')} (recipient_id, pickup_request_id)
      WHERE status = 'rejected' AND failure_reason = 'recipient_rejected'`,
  },
  {
    name: 'pickup_packages_transporter_rejected_list_idx',
    sql: `CREATE INDEX ${quoteIndex('pickup_packages_transporter_rejected_list_idx')}
      ON ${quoteTable('pickup_packages')} (transporter_id, pickup_request_id)
      WHERE status = 'rejected' AND failure_reason = 'transporter_rejected'`,
  },
];

async function up() {
  await sequelize.transaction(async (transaction) => {
    for (const index of indexes) {
      const existing = await qi.showIndex(
        schema ? { tableName: 'pickup_packages', schema } : 'pickup_packages',
        { transaction }
      );
      if (!existing.some((item) => item.name === index.name)) {
        await sequelize.query(index.sql, { transaction });
      }
    }
  });
}

async function down() {
  await sequelize.transaction(async (transaction) => {
    for (const index of [...indexes].reverse()) {
      const existing = await qi.showIndex(
        schema ? { tableName: 'pickup_packages', schema } : 'pickup_packages',
        { transaction }
      );
      if (existing.some((item) => item.name === index.name)) {
        await sequelize.query(`DROP INDEX ${quoteIndexTable(index.name)}`, { transaction });
      }
    }
  });
}

module.exports = { up, down };
