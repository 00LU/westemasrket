const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'wastemarket',
  process.env.DB_USER || 'wastemarket',
  process.env.DB_PASSWORD || 'wastemarket',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  }
);

module.exports = sequelize;
