const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { REQUEST_STATUS } = require('../config/pickupFlow');
const { generateRequestCode } = require('../services/requestCode');

const PickupRequest = sequelize.define(
  'PickupRequest',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    requestCode: { type: DataTypes.STRING(14), allowNull: false, defaultValue: generateRequestCode },
    producerId: { type: DataTypes.UUID, allowNull: false },
    cerCode: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    quantityUnit: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['kg', 'liter']] },
    },
    pickupAddress: { type: DataTypes.STRING, allowNull: false },
    pickupLat: { type: DataTypes.FLOAT, allowNull: true },
    pickupLng: { type: DataTypes.FLOAT, allowNull: true },
    pickupPlaceId: { type: DataTypes.STRING, allowNull: true },
    productionSiteId: { type: DataTypes.UUID, allowNull: true },
    deadline: { type: DataTypes.DATE, allowNull: false },
    idempotencyKey: { type: DataTypes.UUID, allowNull: true },
    supersedesId: { type: DataTypes.UUID, allowNull: true },
    supersededById: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    cerKnown: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    cerRequestNote: { type: DataTypes.TEXT, allowNull: true },
    wasteDescription: { type: DataTypes.TEXT, allowNull: true },
    technicalDocuments: { type: DataTypes.TEXT, allowNull: true },
    containment: { type: DataTypes.TEXT, allowNull: true },
    specialInfo: { type: DataTypes.TEXT, allowNull: true },
    recurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    recurrenceFrequency: { type: DataTypes.STRING, allowNull: true },
    recurrenceStartDate: { type: DataTypes.DATEONLY, allowNull: true },
    recurrenceEndDate: { type: DataTypes.DATEONLY, allowNull: true },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: REQUEST_STATUS.DRAFT,
      validate: { isIn: [Object.values(REQUEST_STATUS)] },
    },
    selectedPackageId: { type: DataTypes.UUID, allowNull: true },
    agreementDeadline: { type: DataTypes.DATE, allowNull: true },
    confirmedSlotAt: { type: DataTypes.DATE, allowNull: true },
    producerCompletionConfirmedAt: { type: DataTypes.DATE, allowNull: true },
    recipientCompletionConfirmedAt: { type: DataTypes.DATE, allowNull: true },
    transporterCompletionConfirmedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    cancelReason: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'pickup_requests',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = PickupRequest;
