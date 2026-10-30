const { DataTypes, QueryTypes } = require('sequelize');
const sequelize = require('../config/db');
const areaA = require('../migrations/20261028-area-a');
const areaB = require('../migrations/20261028-area-b');
const completionConfirmations = require('../migrations/20261029-completion-confirmations');
const rejectedRequestOrder = require('../migrations/20261029-rejected-request-order');
const transporterOffers = require('../migrations/20261030-transporter-per-destination-offers');

const schema = process.env.DB_SCHEMA;
const migrationsTable = schema
  ? { tableName: 'schema_migrations', schema }
  : 'schema_migrations';
const knownMigrations = [
  { name: '20261028-area-a', migration: areaA },
  { name: '20261028-area-b', migration: areaB },
  { name: '20261029-completion-confirmations', migration: completionConfirmations },
  { name: '20261029-rejected-request-order', migration: rejectedRequestOrder },
  { name: '20261030-transporter-per-destination-offers', migration: transporterOffers },
];

async function ensureMigrationsTable() {
  const qi = sequelize.getQueryInterface();
  if (await qi.tableExists(migrationsTable)) return;
  await qi.createTable(migrationsTable, {
    name: { type: DataTypes.STRING, primaryKey: true },
    applied_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
}

async function runMigrations(direction = 'up') {
  await ensureMigrationsTable();
  const qi = sequelize.getQueryInterface();
  const quoteTable = qi.queryGenerator.quoteTable(migrationsTable);
  const applied = await sequelize.query(`SELECT name FROM ${quoteTable}`, { type: QueryTypes.SELECT });
  const appliedNames = new Set(applied.map((row) => row.name));

  if (direction === 'down') {
    const latest = [...knownMigrations].reverse().find(({ name }) => appliedNames.has(name));
    if (latest) {
      await latest.migration.down();
      await qi.bulkDelete(migrationsTable, { name: latest.name });
    }
    return;
  }

  for (const item of knownMigrations) {
    if (appliedNames.has(item.name)) continue;
    await item.migration.up();
    await qi.bulkInsert(migrationsTable, [{ name: item.name, applied_at: new Date() }]);
  }
}

module.exports = { runMigrations };
