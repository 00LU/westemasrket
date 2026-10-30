require('dotenv').config();
const sequelize = require('../src/config/db');
const { runMigrations } = require('../src/services/migrationRunner');

async function main() {
  const direction = process.argv[2] || 'up';
  if (!['up', 'down'].includes(direction)) throw new Error('Uso: node scripts/migrate.js [up|down]');
  if (direction === 'up') {
    require('../src/models').initModels();
    await sequelize.authenticate();
    if (process.env.DB_SCHEMA) await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${process.env.DB_SCHEMA}"`);
    await sequelize.sync();
  } else {
    await sequelize.authenticate();
  }
  await runMigrations(direction);
}

main()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error('Migration failed', error);
    await sequelize.close();
    process.exitCode = 1;
  });
