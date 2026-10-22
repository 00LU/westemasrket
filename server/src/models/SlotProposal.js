const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { SLOT_STATUS } = require('../config/pickupFlow');

// Day/time proposal for the selected package. Only one is active at a time;
// a counter-proposal supersedes the previous one and resets the other acceptances.
const SlotProposal = sequelize.define(
  'SlotProposal',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    packageId: { type: DataTypes.UUID, allowNull: false },
    proposedById: { type: DataTypes.UUID, allowNull: false },
    proposedByRole: { type: DataTypes.STRING, allowNull: false },
    scheduledAt: { type: DataTypes.DATE, allowNull: false },
    producerAccepted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    recipientAccepted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    transporterAccepted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: SLOT_STATUS.ACTIVE,
      validate: { isIn: [Object.values(SLOT_STATUS)] },
    },
  },
  {
    tableName: 'slot_proposals',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = SlotProposal;
