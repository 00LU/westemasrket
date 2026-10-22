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
    pricePerTon: { type: DataTypes.FLOAT, allowNull: true },
    destinationAddress: { type: DataTypes.STRING, allowNull: true },
    availableCapacityTon: { type: DataTypes.FLOAT, allowNull: true },
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
