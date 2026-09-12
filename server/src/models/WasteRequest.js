const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WasteRequest = sequelize.define(
  'WasteRequest',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    producerId: { type: DataTypes.UUID, allowNull: false, field: 'producer_id' },
    cerCode: { type: DataTypes.STRING, allowNull: false, field: 'cer_code' },
    cerKnown: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'cer_known' },
    wasteDescription: { type: DataTypes.TEXT, allowNull: true, field: 'waste_description' },
    photoFileName: { type: DataTypes.STRING, allowNull: true, field: 'photo_file_name' },
    photoData: { type: DataTypes.TEXT, allowNull: true, field: 'photo_data' },
    technicalDocuments: { type: DataTypes.TEXT, allowNull: true, field: 'technical_documents' },
    containment: { type: DataTypes.TEXT, allowNull: true },
    specialInfo: { type: DataTypes.TEXT, allowNull: true, field: 'special_info' },
    recurrenceFrequency: { type: DataTypes.STRING, allowNull: true, field: 'recurrence_frequency' },
    recurrenceStartDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'recurrence_start_date' },
    recurrenceEndDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'recurrence_end_date' },
    recurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    workflowStatus: { type: DataTypes.STRING, allowNull: true, field: 'workflow_status' },
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
    cerRequestNote: { type: DataTypes.TEXT, allowNull: true, field: 'cer_request_note' },
    selectedFinalPrice: { type: DataTypes.FLOAT, allowNull: true, field: 'selected_final_price' },
    selectedPlatformFee: { type: DataTypes.FLOAT, allowNull: true, field: 'selected_platform_fee' },
    transporterConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'transporter_confirmed' },
    recipientConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'recipient_confirmed' },
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
