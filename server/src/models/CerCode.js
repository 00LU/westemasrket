const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CerCode = sequelize.define(
  'CerCode',
  {
    code: { type: DataTypes.STRING, primaryKey: true },
    description: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    hazardous: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'cer_codes',
    underscored: true,
    timestamps: false,
  }
);

module.exports = CerCode;
