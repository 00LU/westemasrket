const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { REQUEST_STATUS } = require('../config/pickupFlow');

const PickupRequest = sequelize.define(
  'PickupRequest',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    producerId: { type: DataTypes.UUID, allowNull: false },
    cerCode: { type: DataTypes.STRING, allowNull: false },
    quantityTon: { type: DataTypes.FLOAT, allowNull: false },
    pickupAddress: { type: DataTypes.STRING, allowNull: false },
    pickupLat: { type: DataTypes.FLOAT, allowNull: true },
    pickupLng: { type: DataTypes.FLOAT, allowNull: true },
    deadline: { type: DataTypes.DATE, allowNull: false },
    maxPrice: { type: DataTypes.FLOAT, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: REQUEST_STATUS.DRAFT,
      validate: { isIn: [Object.values(REQUEST_STATUS)] },
    },
    selectedPackageId: { type: DataTypes.UUID, allowNull: true },
    agreementDeadline: { type: DataTypes.DATE, allowNull: true },
    confirmedSlotAt: { type: DataTypes.DATE, allowNull: true },
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
