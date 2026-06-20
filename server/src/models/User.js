const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    role: {
      type: DataTypes.ENUM('producer', 'transporter', 'recipient', 'admin'),
      allowNull: false,
    },
    companyName: { type: DataTypes.STRING, allowNull: false, field: 'company_name' },
    piva: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    subscriptionPlan: {
      type: DataTypes.ENUM('free', 'basic', 'pro', 'enterprise'),
      defaultValue: 'basic',
      field: 'subscription_plan',
    },
    premiumFeaturesEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'premium_features_enabled',
    },
  },
  {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = User;
