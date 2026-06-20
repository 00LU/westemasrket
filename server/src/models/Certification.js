const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Certification = sequelize.define(
  'Certification',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    type: { type: DataTypes.STRING, allowNull: false },
    fileUrl: { type: DataTypes.STRING, allowNull: false, field: 'file_url' },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'expiry_date' },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'certifications',
    underscored: true,
    timestamps: false,
  }
);

module.exports = Certification;
