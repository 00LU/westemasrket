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

async function setCerPricing(_req, res) {
  return res.status(501).json({ message: 'Le tariffe CER generali non sono ancora disponibili. Indica il prezzo rispondendo alla singola richiesta di ritiro.' });
}

async function setCapacity(_req, res) {
  return res.status(501).json({ message: 'Il calendario generale di capacità non è ancora disponibile. Indica la capacità rispondendo alla singola richiesta di ritiro.' });
}

module.exports = {
  listPickups,
  getPickup,
  respondAvailability,
  setCerPricing,
  setCapacity,
};
