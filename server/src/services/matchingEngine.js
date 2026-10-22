const { User, Certification } = require('../models');

// Eligibility is currently "verified operators of the right role".
// CER / zone / capacity filtering plugs in here without touching the workflow.
async function findEligibleRecipients(_request, { transaction } = {}) {
  return User.findAll({ where: { role: 'recipient', verified: true }, transaction });
}

async function findEligibleTransporters(_request, { transaction } = {}) {
  return User.findAll({ where: { role: 'transporter', verified: true }, transaction });
}

async function hasValidCertification(userId, type) {
  const cert = await Certification.findOne({ where: { userId, type, verified: true } });
  return Boolean(cert);
}

module.exports = {
  findEligibleRecipients,
  findEligibleTransporters,
  hasValidCertification,
};
