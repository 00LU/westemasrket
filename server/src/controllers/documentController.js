const { Document, User } = require('../models');
const { getRequiredDocumentsForRole, getMissingDocumentTypes } = require('../services/documentRequirements');

async function listUserDocuments(req, res, next) {
  try {
    const documents = await Document.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
    });

    return res.json(documents);
  } catch (error) {
    return next(error);
  }
}

async function getUserDocumentRequirements(req, res, next) {
  try {
    const role = req.user.role;
    const documents = await Document.findAll({
      where: { userId: req.user.id },
      attributes: ['documentType', 'status'],
    });

    const uploadedTypes = documents.map((doc) => doc.documentType);
    return res.json({
      role,
      requiredDocuments: getRequiredDocumentsForRole(role),
      uploadedDocuments: uploadedTypes,
      missingDocuments: getMissingDocumentTypes(role, uploadedTypes),
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const { documentType, fileName, mimeType, fileSize, fileUrl, notes } = req.body;

    if (!documentType || !fileName || !mimeType || !fileSize) {
      return res.status(400).json({ message: 'documentType, fileName, mimeType and fileSize are required' });
    }

    const requiredDocs = getRequiredDocumentsForRole(req.user.role);
    if (!requiredDocs.includes(documentType)) {
      return res.status(400).json({ message: 'This document type is not required for the current role' });
    }

    const existing = await Document.findOne({ where: { userId: req.user.id, documentType } });
    const document = existing
      ? await existing.update({
          fileName,
          mimeType,
          fileSize,
          fileUrl,
          status: 'pending_review',
          notes,
        })
      : await Document.create({
          userId: req.user.id,
          documentType,
          fileName,
          mimeType,
          fileSize,
          fileUrl,
          status: 'pending_review',
          notes,
        });

    return res.status(201).json(document);
  } catch (error) {
    return next(error);
  }
}

async function listPendingDocuments(_req, res, next) {
  try {
    const documents = await Document.findAll({
      where: { status: 'pending_review' },
      include: [{ model: User, attributes: ['id', 'companyName', 'email', 'role'] }],
      order: [['created_at', 'DESC']],
    });

    return res.json(documents);
  } catch (error) {
    return next(error);
  }
}

async function approveDocument(req, res, next) {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await document.update({
      status: 'approved',
      reviewedBy: req.user.id,
      notes: req.body.notes || document.notes,
    });

    return res.json(document);
  } catch (error) {
    return next(error);
  }
}

async function rejectDocument(req, res, next) {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await document.update({
      status: 'rejected',
      reviewedBy: req.user.id,
      notes: req.body.notes || 'Rejected by admin',
    });

    return res.json(document);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUserDocuments,
  getUserDocumentRequirements,
  uploadDocument,
  listPendingDocuments,
  approveDocument,
  rejectDocument,
};
