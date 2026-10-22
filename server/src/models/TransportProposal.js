const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { PROPOSAL_STATUS } = require('../config/pickupFlow');

// One row per transporter invited to a pickup request; `price` is filled when they bid.
const TransportProposal = sequelize.define(
  'TransportProposal',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pickupRequestId: { type: DataTypes.UUID, allowNull: false },
    transporterId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: PROPOSAL_STATUS.INVITED,
      validate: { isIn: [Object.values(PROPOSAL_STATUS)] },
    },
    price: { type: DataTypes.FLOAT, allowNull: true },
    vehicleType: { type: DataTypes.STRING, allowNull: true },
    availabilityNote: { type: DataTypes.STRING, allowNull: true },
    respondedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'transport_proposals',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['pickup_request_id', 'transporter_id'] }],
  }
);

module.exports = TransportProposal;
