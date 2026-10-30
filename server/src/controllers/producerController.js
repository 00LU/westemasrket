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

const listRecurring = handle(async (req, res) => {
  res.json(await views.producerRecurring(req.user.id));
});

const repeatRecurring = handle(async (req, res) => {
  const request = await workflow.repeatRecurring(req.user, req.params.id, {
    ...req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  });
  res.status(201).json(request);
});

const createPickup = handle(async (req, res) => {
  const request = await workflow.createDraft(req.user, {
    ...req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  });
  res.status(201).json(request);
});

const updatePickup = handle(async (req, res) => {
  res.json(await workflow.updateDraft(req.user, req.params.id, {
    ...req.body,
    idempotencyKey: req.get('Idempotency-Key'),
  }));
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
  const { hazardous, quantity, quantityUnit, distanceKm, urgency } = req.body;
  if (!['kg', 'liter'].includes(quantityUnit) || !(Number(quantity) > 0) || !(Number(distanceKm) >= 0)) {
    return res.status(400).json({ message: 'Quantità, unità di misura o distanza non validi.' });
  }
  if (quantityUnit === 'liter') {
    return res.status(422).json({ message: 'La stima per litri non è disponibile senza una densità del rifiuto verificata.' });
  }
  res.json(calculateSuggestedRange({ hazardous, quantity, quantityUnit, distanceKm, urgency }));
});

module.exports = {
  listRecurring,
  repeatRecurring,
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
