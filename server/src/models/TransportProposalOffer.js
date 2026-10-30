const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TransportProposalOffer = sequelize.define(
  'TransportProposalOffer',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    transportProposalId: { type: DataTypes.UUID, allowNull: false },
    recipientAvailabilityId: { type: DataTypes.UUID, allowNull: false },
    pricingMode: { type: DataTypes.STRING, allowNull: false },
    unitPrice: { type: DataTypes.FLOAT, allowNull: false },
    distanceKm: { type: DataTypes.FLOAT, allowNull: true },
    price: { type: DataTypes.FLOAT, allowNull: false },
  },
  {
    tableName: 'transport_proposal_offers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = TransportProposalOffer;
