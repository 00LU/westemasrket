const { calculateSuggestedRange } = require('../services/pricingCalculator');
const workflow = require('../services/pickupWorkflow');
const views = require('../services/pickupViews');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const createPickup = handle(async (req, res) => {
  const request = await workflow.createDraft(req.user, req.body);
  res.status(201).json(request);
});

const updatePickup = handle(async (req, res) => {
  res.json(await workflow.updateDraft(req.user, req.params.id, req.body));
});

const publishPickup = handle(async (req, res) => {
  res.json(await workflow.publish(req.user, req.params.id));
});

const listPickups = handle(async (req, res) => {
  res.json(await views.producerList(req.user.id));
});

const getPickup = handle(async (req, res) => {
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const closeRecipients = handle(async (req, res) => {
  await workflow.closeRecipientPhase(req.user, req.params.id);
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const closeTransporters = handle(async (req, res) => {
  await workflow.closeTransporterPhase(req.user, req.params.id);
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const selectPackage = handle(async (req, res) => {
  await workflow.selectPackage(req.user, req.params.id, req.params.packageId);
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const withdrawSelection = handle(async (req, res) => {
  await workflow.withdrawSelection(req.user, req.params.id);
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const cancelPickup = handle(async (req, res) => {
  await workflow.cancelByProducer(req.user, req.params.id, req.body?.reason);
  res.json(await views.producerDetail(req.user.id, req.params.id));
});

const estimatePrice = handle(async (req, res) => {
  const { hazardous, quantityTon, distanceKm, urgency } = req.body;
  res.json(calculateSuggestedRange({ hazardous, quantityTon, distanceKm, urgency }));
});

module.exports = {
  createPickup,
  updatePickup,
  publishPickup,
  listPickups,
  getPickup,
  closeRecipients,
  closeTransporters,
  selectPackage,
  withdrawSelection,
  cancelPickup,
  estimatePrice,
};
