const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PickupStatusHistory = sequelize.define(
  'PickupStatusHistory',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    fromStatus: { type: DataTypes.STRING, allowNull: true },
    toStatus: { type: DataTypes.STRING, allowNull: false },
    actorId: { type: DataTypes.UUID, allowNull: true },
    note: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'pickup_status_history',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = PickupStatusHistory;
