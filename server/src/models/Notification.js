const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define(
  'Notification',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    type: { type: DataTypes.STRING, allowNull: false },
    payloadJson: { type: DataTypes.JSONB, allowNull: false, field: 'payload_json' },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = Notification;
