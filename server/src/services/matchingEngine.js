const { User, Certification } = require('../models');

async function matchOperators({ cerCode, pickupLat, pickupLng }) {
  const [transporters, recipients] = await Promise.all([
    User.findAll({ where: { role: 'transporter', verified: true } }),
    User.findAll({ where: { role: 'recipient', verified: true } }),
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
