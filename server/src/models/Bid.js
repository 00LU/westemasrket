const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Bid = sequelize.define(
  'Bid',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    wasteRequestId: { type: DataTypes.UUID, allowNull: false, field: 'waste_request_id' },
    transporterId: { type: DataTypes.UUID, allowNull: false, field: 'transporter_id' },
    recipientId: { type: DataTypes.UUID, allowNull: false, field: 'recipient_id' },
    transportPrice: { type: DataTypes.FLOAT, allowNull: false, field: 'transport_price' },
    treatmentPrice: { type: DataTypes.FLOAT, allowNull: false, field: 'treatment_price' },
    totalPrice: { type: DataTypes.FLOAT, allowNull: false, field: 'total_price' },
    vehicleType: { type: DataTypes.STRING, allowNull: true, field: 'vehicle_type' },
    availability: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'accepted', 'rejected'),
      defaultValue: 'active',
    },
  },
  {
    tableName: 'bids',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = Bid;
