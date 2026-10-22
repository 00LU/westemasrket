const { REQUEST_TRANSITIONS } = require('../config/pickupFlow');
const { PickupStatusHistory } = require('../models');

class WorkflowError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

function canTransition(from, to) {
  return (REQUEST_TRANSITIONS[from] || []).includes(to);
}

// Single entry point for every status change: validates the transition and records history.
async function transition(request, to, { actorId = null, note = null, transaction, patch = {} } = {}) {
  const from = request.status;
  if (!canTransition(from, to)) {
    throw new WorkflowError(`Transizione non consentita: ${from} -> ${to}`);
  }

  await request.update({ ...patch, status: to }, { transaction });
  await PickupStatusHistory.create(
    { pickupRequestId: request.id, fromStatus: from, toStatus: to, actorId, note },
    { transaction }
  );
  return request;
}

module.exports = { WorkflowError, canTransition, transition };
