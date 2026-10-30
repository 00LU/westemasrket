const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { RECIPIENT_RESPONSE } = require('../config/pickupFlow');

// One row per recipient invited to a pickup request.
const RecipientAvailability = sequelize.define(
  'RecipientAvailability',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    recipientId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: RECIPIENT_RESPONSE.PENDING,
      validate: { isIn: [Object.values(RECIPIENT_RESPONSE)] },
    },
    unitPrice: { type: DataTypes.FLOAT, allowNull: true },
    quantityTolerancePercent: { type: DataTypes.FLOAT, allowNull: true },
    availabilityWindow: { type: DataTypes.STRING, allowNull: true },
    destinationAddress: { type: DataTypes.STRING, allowNull: true },
    destinationLat: { type: DataTypes.FLOAT, allowNull: true },
    destinationLng: { type: DataTypes.FLOAT, allowNull: true },
    destinationPlaceId: { type: DataTypes.STRING, allowNull: true },
    roadDistanceMeters: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    respondedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'recipient_availabilities',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['pickup_request_id', 'recipient_id'] }],
  }
);

module.exports = RecipientAvailability;
