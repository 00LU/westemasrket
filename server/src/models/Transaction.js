const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    packageId: { type: DataTypes.UUID, allowNull: false },
    platformFee: { type: DataTypes.FLOAT, allowNull: false },
    status: {
      type: DataTypes.ENUM('open', 'paid', 'failed'),
      defaultValue: 'open',
    },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'pickup_transactions',
    underscored: true,
    timestamps: false,
  }
);

module.exports = Transaction;
