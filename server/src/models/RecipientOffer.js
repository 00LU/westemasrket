const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RecipientOffer = sequelize.define(
  'RecipientOffer',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    wasteRequestId: { type: DataTypes.UUID, allowNull: false, field: 'waste_request_id' },
    recipientId: { type: DataTypes.UUID, allowNull: false, field: 'recipient_id' },
    pricePerTon: { type: DataTypes.FLOAT, allowNull: false, field: 'price_per_ton' },
    pricingUnit: { type: DataTypes.ENUM('per_kg', 'per_liter', 'per_ton'), allowNull: false, defaultValue: 'per_ton', field: 'pricing_unit' },
    availableCapacityTon: { type: DataTypes.FLOAT, allowNull: true, field: 'available_capacity_ton' },
    quantityTolerancePercent: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 1, field: 'quantity_tolerance_percent' },
    availabilityWindow: { type: DataTypes.STRING, allowNull: true, field: 'availability_window' },
    availabilityStatus: {
      type: DataTypes.ENUM('available', 'unavailable'),
      allowNull: false,
      defaultValue: 'available',
      field: 'availability_status',
    },
    destinationAddress: { type: DataTypes.STRING, allowNull: false, field: 'destination_address' },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'recipient_offers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = RecipientOffer;