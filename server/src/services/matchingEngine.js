const { User, Certification, Document } = require('../models');
const { getRequiredDocumentsForRole } = require('./documentRequirements');

async function hasApprovedRequiredDocuments(user, { transaction } = {}) {
  const requiredTypes = getRequiredDocumentsForRole(user.role);
  if (requiredTypes.length === 0) return true;

  const approvedDocuments = await Document.findAll({
    where: { userId: user.id, status: 'approved', documentType: requiredTypes },
    attributes: ['documentType'],
    transaction,
  });
  return new Set(approvedDocuments.map((document) => document.documentType)).size === requiredTypes.length;
}

// Eligible = approved by the admin and with every required onboarding document approved.
// CER / zone / capacity filtering plugs in here without touching the workflow.
async function getEligibleUsers(role, { transaction } = {}) {
  const users = await User.findAll({ where: { role, verified: true }, transaction });
  const checks = await Promise.all(
    users.map(async (user) => ({ user, eligible: await hasApprovedRequiredDocuments(user, { transaction }) }))
  );
  return checks.filter((item) => item.eligible).map((item) => item.user);
}

const findEligibleRecipients = (_request, options) => getEligibleUsers('recipient', options);
const findEligibleTransporters = (_request, options) => getEligibleUsers('transporter', options);

async function hasValidCertification(userId, type) {
  const cert = await Certification.findOne({ where: { userId, type, verified: true } });
  return Boolean(cert);
}

module.exports = {
  findEligibleRecipients,
  findEligibleTransporters,
  hasValidCertification,
};
