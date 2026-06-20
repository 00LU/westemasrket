const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    wasteRequestId: { type: DataTypes.UUID, allowNull: false, field: 'waste_request_id' },
    winningBidId: { type: DataTypes.UUID, allowNull: false, field: 'winning_bid_id' },
    platformFee: { type: DataTypes.FLOAT, allowNull: false, field: 'platform_fee' },
    status: {
      type: DataTypes.ENUM('open', 'paid', 'failed'),
      defaultValue: 'open',
    },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  },
  {
    tableName: 'transactions',
    underscored: true,
    timestamps: false,
  }
);

module.exports = Transaction;
