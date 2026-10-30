const { DataTypes, QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

const schema = process.env.DB_SCHEMA;
const qi = sequelize.getQueryInterface();
const tableRef = (name) => (schema ? { tableName: name, schema } : name);
const quoteTable = (name) => qi.queryGenerator.quoteTable(
  schema ? { tableName: name, schema } : name
);
const quoteIndex = (name) => qi.quoteIdentifier(name);
const quoteIndexTable = (name) => schema
  ? qi.queryGenerator.quoteTable({ tableName: name, schema })
  : quoteIndex(name);

const indexNames = ['pickup_requests_list_order_idx', 'pickup_requests_producer_list_order_idx'];

function orderIndexSql(name, producer = false, terminalStatuses = ['cancelled', 'completed']) {
  const statuses = terminalStatuses.map((status) => `'${status}'`).join(', ');
  const columns = producer ? 'producer_id, ' : '';
  return `CREATE INDEX ${quoteIndex(name)} ON ${quoteTable('pickup_requests')}
    (${columns}(CASE WHEN status IN (${statuses}) THEN 1 ELSE 0 END), created_at DESC, id DESC)`;
}

async function replaceOrderIndexes(transaction, terminalStatuses) {
  for (const name of indexNames) {
    await sequelize.query(`DROP INDEX IF EXISTS ${quoteIndexTable(name)}`, { transaction });
    await sequelize.query(orderIndexSql(name, name.includes('producer'), terminalStatuses), { transaction });
  }
}

async function up() {
  await sequelize.transaction(async (transaction) => {
    for (const [name, field] of [
      ['producer_completion_confirmed_at', 'producerCompletionConfirmedAt'],
      ['recipient_completion_confirmed_at', 'recipientCompletionConfirmedAt'],
      ['transporter_completion_confirmed_at', 'transporterCompletionConfirmedAt'],
      ['completed_at', 'completedAt'],
    ]) {
      const columns = await qi.describeTable(tableRef('pickup_requests'), { transaction });
      if (columns[name]) continue;
      await qi.addColumn(tableRef('pickup_requests'), name, {
        type: DataTypes.DATE,
        allowNull: true,
        field,
      }, { transaction });
    }
    await replaceOrderIndexes(transaction, ['cancelled', 'completed']);
  });
}

async function down() {
  const table = quoteTable('pickup_requests');
  await sequelize.transaction(async (transaction) => {
    const [row] = await sequelize.query(
      `SELECT COUNT(*)::integer AS count FROM ${table}
       WHERE status = 'completed'
          OR producer_completion_confirmed_at IS NOT NULL
          OR recipient_completion_confirmed_at IS NOT NULL
          OR transporter_completion_confirmed_at IS NOT NULL
          OR completed_at IS NOT NULL`,
      { type: QueryTypes.SELECT, transaction }
    );
    if (row.count > 0) {
      throw new Error('Cannot roll back completion confirmations while completed pickups or confirmations exist.');
    }

    await replaceOrderIndexes(transaction, ['cancelled', 'confirmed']);
    for (const name of [
      'completed_at',
      'transporter_completion_confirmed_at',
      'recipient_completion_confirmed_at',
      'producer_completion_confirmed_at',
    ]) {
      const columns = await qi.describeTable(tableRef('pickup_requests'), { transaction });
      if (columns[name]) await qi.removeColumn(tableRef('pickup_requests'), name, { transaction });
    }
  });
}

module.exports = { up, down };
