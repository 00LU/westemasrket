const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WasteRequest = sequelize.define(
  'WasteRequest',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    producerId: { type: DataTypes.UUID, allowNull: false, field: 'producer_id' },
    cerCode: { type: DataTypes.STRING, allowNull: false, field: 'cer_code' },
    quantityTon: { type: DataTypes.FLOAT, allowNull: false, field: 'quantity_ton' },
    pickupAddress: { type: DataTypes.STRING, allowNull: false, field: 'pickup_address' },
    pickupLat: { type: DataTypes.FLOAT, allowNull: true, field: 'pickup_lat' },
    pickupLng: { type: DataTypes.FLOAT, allowNull: true, field: 'pickup_lng' },
    deadline: { type: DataTypes.DATE, allowNull: false },
    selectedRecipientId: { type: DataTypes.UUID, allowNull: true, field: 'selected_recipient_id' },
    selectedRecipientOfferId: { type: DataTypes.UUID, allowNull: true, field: 'selected_recipient_offer_id' },
    selectedTransporterId: { type: DataTypes.UUID, allowNull: true, field: 'selected_transporter_id' },
    selectedBidId: { type: DataTypes.UUID, allowNull: true, field: 'selected_bid_id' },
    status: {
      type: DataTypes.ENUM(
        'draft',
        'recipient_matching',
        'recipient_options_ready',
        'recipient_selected',
        'transporter_matching',
        'package_options_ready',
        'package_selected',
        'assigned',
        'in_execution',
        'delivered',
        'completed',
        'cancelled',
        'expired',
        'active',
        'awarded'
      ),
      defaultValue: 'recipient_matching',
    },
    maxPrice: { type: DataTypes.FLOAT, allowNull: false, field: 'max_price' },
  },
  {
    tableName: 'waste_requests',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = WasteRequest;
