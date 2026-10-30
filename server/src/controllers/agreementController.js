const workflow = require('../services/pickupWorkflow');
const views = require('../services/pickupViews');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// Re-reads the request through the caller's own role view, so each role only gets its own data.
async function detailFor(user, id) {
  if (user.role === 'producer') return views.producerDetail(user.id, id);
  if (user.role === 'recipient') return views.recipientDetail(user.id, id);
  return views.transporterDetail(user.id, id);
}

const proposeSlot = handle(async (req, res) => {
  await workflow.proposeSlot(req.user, req.params.id, req.body.scheduledAt);
  res.status(201).json(await detailFor(req.user, req.params.id));
});

const acceptSlot = handle(async (req, res) => {
  await workflow.acceptSlot(req.user, req.params.id, req.params.slotId);
  res.json(await detailFor(req.user, req.params.id));
});

const cancelOffer = handle(async (req, res) => {
  await workflow.cancelOffer(req.user, req.params.id);
  res.json(await detailFor(req.user, req.params.id));
});

const confirmCompletion = handle(async (req, res) => {
  await workflow.confirmWorkCompletion(req.user, req.params.id);
  res.json(await detailFor(req.user, req.params.id));
});

module.exports = { proposeSlot, acceptSlot, cancelOffer, confirmCompletion };
