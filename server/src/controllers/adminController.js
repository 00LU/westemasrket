const { User, WasteRequest, Transaction, CerCode } = require('../models');
const { matchOperators } = require('../services/matchingEngine');
const { notifyUser } = require('../services/notificationService');

async function listPendingUsers(_req, res, next) {
  try {
    const users = await User.findAll({
      where: { verified: false },
      attributes: ['id', 'companyName', 'email', 'role', 'verified', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

async function listUsers(_req, res, next) {
  try {
    const users = await User.findAll({
      attributes: ['id', 'companyName', 'email', 'role', 'verified', 'subscriptionPlan', 'created_at'],
      order: [['created_at', 'DESC']],
    });
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

async function verifyUser(req, res, next) {
  try {
    const { userId } = req.params;
    await User.update({ verified: true }, { where: { id: userId } });
    return res.json({ message: 'User verified' });
  } catch (error) {
    return next(error);
  }
}

async function analytics(_req, res, next) {
  try {
    const [activeUsers, totalOrders, transactions] = await Promise.all([
      User.count({ where: { verified: true } }),
      WasteRequest.count(),
      Transaction.findAll(),
    ]);

    const revenue = transactions.reduce((sum, tx) => sum + Number(tx.platformFee || 0), 0);

    return res.json({
      activeUsers,
      totalOrders,
      platformRevenue: revenue,
      premiumFeatureUsers: await User.count({ where: { premiumFeaturesEnabled: true } }),
    });
  } catch (error) {
    return next(error);
  }
}

async function complianceStatus(_req, res) {
  return res.json({
    rentriEnabled: process.env.RENTRI_ENABLED === 'true',
    rentriSync: 'placeholder',
    disputesOpen: 0,
  });
}

async function listCerRecognitionRequests(_req, res, next) {
  try {
    const requests = await WasteRequest.findAll({
      where: { cerKnown: false },
      include: [{ model: User, as: 'producer', attributes: ['id', 'companyName', 'email'] }],
      order: [['created_at', 'DESC']],
    });
    return res.json(requests);
  } catch (error) {
    return next(error);
  }
}

async function proposeCerCode(req, res, next) {
  try {
    const { cerCode, notes } = req.body;
    const request = await WasteRequest.findByPk(req.params.id);
    if (!request || request.cerKnown) return res.status(404).json({ message: 'CER recognition request not found' });

    const catalogEntry = await CerCode.findByPk(cerCode);
    if (!catalogEntry) return res.status(400).json({ message: 'CER code not found in catalog' });

    await request.update({
      cerCode,
      cerKnown: true,
      status: 'recipient_matching',
      workflowStatus: null,
      cerRequestNote: notes || `CER proposed by Admin: ${cerCode}`,
    });

    const matches = await matchOperators({ cerCode, pickupLat: request.pickupLat, pickupLng: request.pickupLng });
    await Promise.all([
      ...matches.transporters.map((item) => notifyUser(item.id, 'new_request_match', { wasteRequestId: request.id })),
      ...matches.recipients.map((item) => notifyUser(item.id, 'new_request_match', { wasteRequestId: request.id })),
      notifyUser(request.producerId, 'cer_proposed_by_admin', { wasteRequestId: request.id, cerCode }),
    ]);

    return res.json({ request, matches });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPendingUsers,
  listUsers,
  verifyUser,
  analytics,
  complianceStatus,
  listCerRecognitionRequests,
  proposeCerCode,
};
