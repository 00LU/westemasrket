const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Document = sequelize.define(
  'Document',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    documentType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'document_type',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'file_name',
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'mime_type',
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size',
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'file_url',
    },
    status: {
      type: DataTypes.ENUM('pending', 'uploaded', 'pending_review', 'approved', 'rejected', 'required_missing'),
      defaultValue: 'pending_review',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
    },
  },
  {
    tableName: 'documents',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: true,
  }
);

module.exports = Document;
