const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { PACKAGE_STATUS } = require('../config/pickupFlow');

// A package = available recipient + submitted transport proposal.
const PickupPackage = sequelize.define(
  'PickupPackage',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    recipientAvailabilityId: { type: DataTypes.UUID, allowNull: false },
    transportProposalId: { type: DataTypes.UUID, allowNull: false },
    recipientId: { type: DataTypes.UUID, allowNull: false },
    transporterId: { type: DataTypes.UUID, allowNull: false },
    treatmentPrice: { type: DataTypes.FLOAT, allowNull: false },
    transportPrice: { type: DataTypes.FLOAT, allowNull: false },
    totalPrice: { type: DataTypes.FLOAT, allowNull: false },
    score: { type: DataTypes.FLOAT, allowNull: false },
    rank: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: PACKAGE_STATUS.PROPOSED,
      validate: { isIn: [Object.values(PACKAGE_STATUS)] },
    },
    failureReason: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'pickup_packages',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = PickupPackage;
