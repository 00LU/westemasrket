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
  res.json(await views.recipientList(req.user.id));
});

const getPickup = handle(async (req, res) => {
  res.json(await views.recipientDetail(req.user.id, req.params.id));
});

const respondAvailability = handle(async (req, res) => {
  await workflow.recipientRespond(req.user, req.params.id, req.body);
  res.json(await views.recipientDetail(req.user.id, req.params.id));
});

async function setCerPricing(req, res) {
  return res.json({ message: 'CER pricing updated (placeholder)', payload: req.body });
}

async function setCapacity(req, res) {
  return res.json({ message: 'Capacity calendar updated (placeholder)', payload: req.body });
}

module.exports = {
  listPickups,
  getPickup,
  respondAvailability,
  setCerPricing,
  setCapacity,
};
