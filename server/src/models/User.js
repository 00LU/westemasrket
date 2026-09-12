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
    legalForm: { type: DataTypes.STRING, allowNull: true, field: 'legal_form' },
    registeredOffice: { type: DataTypes.STRING, allowNull: true, field: 'registered_office' },
    localSites: { type: DataTypes.TEXT, allowNull: true, field: 'local_sites' },
    contactPerson: { type: DataTypes.STRING, allowNull: true, field: 'contact_person' },
    pecEmail: { type: DataTypes.STRING, allowNull: true, field: 'pec_email' },
    operationalEmail: { type: DataTypes.STRING, allowNull: true, field: 'operational_email' },
    phone: { type: DataTypes.STRING, allowNull: true },
    productionSites: { type: DataTypes.TEXT, allowNull: true, field: 'production_sites' },
    intermediaryDocuments: { type: DataTypes.TEXT, allowNull: true, field: 'intermediary_documents' },
    transportAuthorizations: { type: DataTypes.TEXT, allowNull: true, field: 'transport_authorizations' },
    vehicleFleet: { type: DataTypes.TEXT, allowNull: true, field: 'vehicle_fleet' },
    drivers: { type: DataTypes.TEXT, allowNull: true },
    operatingRegions: { type: DataTypes.TEXT, allowNull: true, field: 'operating_regions' },
    facilities: { type: DataTypes.TEXT, allowNull: true },
    siteAuthorizations: { type: DataTypes.TEXT, allowNull: true, field: 'site_authorizations' },
    cerCodes: { type: DataTypes.TEXT, allowNull: true, field: 'cer_codes' },
    rdOperations: { type: DataTypes.TEXT, allowNull: true, field: 'rd_operations' },
    operationalLimitations: { type: DataTypes.TEXT, allowNull: true, field: 'operational_limitations' },
    commercialPreferences: { type: DataTypes.TEXT, allowNull: true, field: 'commercial_preferences' },
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
