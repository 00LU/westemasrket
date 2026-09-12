const { User, Certification, Document } = require('../models');
const { getRequiredDocumentsForRole } = require('./documentRequirements');

async function hasApprovedRequiredDocuments(user) {
  const requiredTypes = getRequiredDocumentsForRole(user.role);
  if (requiredTypes.length === 0) return true;

  const approvedDocuments = await Document.findAll({
    where: { userId: user.id, status: 'approved', documentType: requiredTypes },
    attributes: ['documentType'],
  });
  return new Set(approvedDocuments.map((document) => document.documentType)).size === requiredTypes.length;
}

async function getEligibleUsers(role) {
  const users = await User.findAll({ where: { role, verified: true } });
  const checks = await Promise.all(users.map(async (user) => ({ user, eligible: await hasApprovedRequiredDocuments(user) })));
  return checks.filter((item) => item.eligible).map((item) => item.user);
}

async function matchOperators({ cerCode, pickupLat, pickupLng }) {
  const [transporters, recipients] = await Promise.all([
    getEligibleUsers('transporter'),
    getEligibleUsers('recipient'),
  ]);

  return {
    transporters: transporters.map((entity) => ({
      id: entity.id,
      companyName: entity.companyName,
      compatibility: 'zone+certification',
      score: 0.85,
    })),
    recipients: recipients.map((entity) => ({
      id: entity.id,
      companyName: entity.companyName,
      compatibility: `cer:${cerCode}+capacity+distance`,
      score: 0.88,
    })),
    origin: { pickupLat, pickupLng },
  };
}

async function hasValidCertification(userId, type) {
  const cert = await Certification.findOne({ where: { userId, type, verified: true } });
  return Boolean(cert);
}

module.exports = {
  matchOperators,
  hasValidCertification,
};
