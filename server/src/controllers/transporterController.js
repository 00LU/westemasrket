const workflow = require('../services/pickupWorkflow');
const views = require('../services/pickupViews');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const listPickups = handle(async (req, res) => {
  res.json(await views.transporterList(req.user.id));
});

const getPickup = handle(async (req, res) => {
  res.json(await views.transporterDetail(req.user.id, req.params.id));
});

const submitProposal = handle(async (req, res) => {
  await workflow.transporterRespond(req.user, req.params.id, req.body);
  res.json(await views.transporterDetail(req.user.id, req.params.id));
});

const getEarnings = handle(async (req, res) => {
  res.json(await views.transporterEarnings(req.user.id));
});

module.exports = {
  listPickups,
  getPickup,
  submitProposal,
  getEarnings,
};
