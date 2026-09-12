const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/db');
const { User, Document } = require('../models');
const { getRequiredDocumentsForRole } = require('../services/documentRequirements');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET || 'change-this-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

async function register(req, res, next) {
  const transaction = await sequelize.transaction();

  try {
    const {
      role,
      companyName,
      piva,
      legalForm,
      registeredOffice,
      localSites,
      contactPerson,
      pecEmail,
      operationalEmail,
      phone,
      productionSites,
      intermediaryDocuments,
      transportAuthorizations,
      vehicleFleet,
      drivers,
      operatingRegions,
      facilities,
      siteAuthorizations,
      cerCodes,
      rdOperations,
      operationalLimitations,
      commercialPreferences,
      email,
      password,
      documents = [],
    } = req.body;
    const requiredDocumentTypes = getRequiredDocumentsForRole(role);

    if (!Array.isArray(documents)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'The onboarding documents must be provided as a list' });
    }

    const documentTypes = documents.map((document) => document.documentType);
    const hasOnlyRequiredDocumentTypes = documentTypes.every((type) => requiredDocumentTypes.includes(type));
    if (!hasOnlyRequiredDocumentTypes || new Set(documentTypes).size !== documentTypes.length) {
      await transaction.rollback();
      return res.status(400).json({ message: 'The onboarding documents do not match the selected role' });
    }

    const invalidDocument = documents.find((document) => !document.fileName || !document.mimeType || !document.fileSize);
    if (invalidDocument) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Each onboarding document requires a file name, MIME type and file size' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      role,
      companyName,
      piva,
      legalForm,
      registeredOffice,
      localSites,
      contactPerson,
      pecEmail,
      operationalEmail,
      phone,
      productionSites,
      intermediaryDocuments,
      transportAuthorizations,
      vehicleFleet,
      drivers,
      operatingRegions,
      facilities,
      siteAuthorizations,
      cerCodes,
      rdOperations,
      operationalLimitations,
      commercialPreferences,
      email,
      passwordHash,
      verified: role === 'producer' ? true : false,
    }, { transaction });

    if (documents.length > 0) {
      await Document.bulkCreate(
        documents.map((document) => ({
          userId: user.id,
          documentType: document.documentType,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: Number(document.fileSize),
          fileUrl: document.fileUrl || null,
          status: 'pending_review',
          notes: 'Submitted during registration',
        })),
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(201).json({
      user: {
        id: user.id,
        role: user.role,
        companyName: user.companyName,
        piva: user.piva,
        legalForm: user.legalForm,
        registeredOffice: user.registeredOffice,
        localSites: user.localSites,
        contactPerson: user.contactPerson,
        pecEmail: user.pecEmail,
        operationalEmail: user.operationalEmail,
        phone: user.phone,
        productionSites: user.productionSites,
        intermediaryDocuments: user.intermediaryDocuments,
        transportAuthorizations: user.transportAuthorizations,
        vehicleFleet: user.vehicleFleet,
        drivers: user.drivers,
        operatingRegions: user.operatingRegions,
        facilities: user.facilities,
        siteAuthorizations: user.siteAuthorizations,
        cerCodes: user.cerCodes,
        rdOperations: user.rdOperations,
        operationalLimitations: user.operationalLimitations,
        commercialPreferences: user.commercialPreferences,
        email: user.email,
        verified: user.verified,
      },
      token: signToken(user),
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        role: user.role,
        companyName: user.companyName,
        piva: user.piva,
        legalForm: user.legalForm,
        registeredOffice: user.registeredOffice,
        localSites: user.localSites,
        contactPerson: user.contactPerson,
        pecEmail: user.pecEmail,
        operationalEmail: user.operationalEmail,
        phone: user.phone,
        productionSites: user.productionSites,
        intermediaryDocuments: user.intermediaryDocuments,
        transportAuthorizations: user.transportAuthorizations,
        vehicleFleet: user.vehicleFleet,
        drivers: user.drivers,
        operatingRegions: user.operatingRegions,
        facilities: user.facilities,
        siteAuthorizations: user.siteAuthorizations,
        cerCodes: user.cerCodes,
        rdOperations: user.rdOperations,
        operationalLimitations: user.operationalLimitations,
        commercialPreferences: user.commercialPreferences,
        email: user.email,
        verified: user.verified,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  getCurrentUser,
};
