const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PickupPhoto = sequelize.define(
  'PickupPhoto',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    storageKey: { type: DataTypes.STRING, allowNull: false },
    idempotencyKey: { type: DataTypes.UUID, allowNull: true },
    fileName: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: 'pickup_photos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['pickup_request_id', 'created_at'] },
      { unique: true, fields: ['pickup_request_id', 'idempotency_key'] },
    ],
  }
);

module.exports = PickupPhoto;
