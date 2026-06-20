const { User, WasteRequest, Transaction } = require('../models');

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

module.exports = {
  listPendingUsers,
  listUsers,
  verifyUser,
  analytics,
  complianceStatus,
};
