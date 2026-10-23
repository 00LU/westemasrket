const sequelize = require('../config/db');
const { User, Document } = require('../models');

function isAutomaticApprovalEnabled() {
  return process.env.AUTO_APPROVE_OPERATORS === 'true';
}

async function approveExistingOperators() {
  if (!isAutomaticApprovalEnabled()) return;

  await sequelize.transaction(async (transaction) => {
    const operators = await User.findAll({
      where: { role: ['producer', 'recipient', 'transporter'] },
      attributes: ['id'],
      transaction,
    });
    const ids = operators.map((user) => user.id);
    if (ids.length === 0) return;
    await User.update({ verified: true }, { where: { id: ids }, transaction });
    await Document.update(
      { status: 'approved', reviewedBy: null },
      { where: { userId: ids, status: ['pending', 'uploaded', 'pending_review', 'rejected'] }, transaction }
    );
  });
  console.warn('Automatic operator approval enabled: manual verification and required-document eligibility checks are bypassed.');
}

module.exports = { isAutomaticApprovalEnabled, approveExistingOperators };
