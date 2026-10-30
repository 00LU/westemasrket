const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductionSite = sequelize.define(
  'ProductionSite',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: true },
    addressFormatted: { type: DataTypes.STRING, allowNull: false },
    lat: { type: DataTypes.FLOAT, allowNull: true },
    lng: { type: DataTypes.FLOAT, allowNull: true },
    placeId: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'production_sites',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id'] }],
  }
);

module.exports = ProductionSite;
