// End-to-end tests of the pickup flow. They run the real API in-process against PostgreSQL,
// inside a throw-away schema that is dropped at the end (the normal tables are never touched).
//
//   npm test            (uses the DB settings of server/.env, or DB_* environment variables)

process.env.DB_SCHEMA = `wm_test_${Date.now()}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.AUTO_APPROVE_OPERATORS = 'false';
require('dotenv').config();

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const sequelize = require('../src/config/db');
const app = require('../src/app');
const models = require('../src/models');
const { registerNotificationSocket } = require('../src/websocket/notificationSocket');
const { setSocketServer } = require('../src/services/notificationService');
const workflow = require('../src/services/pickupWorkflow');
const { rankPackages, STRATEGIES } = require('../src/services/packageOptimizer');
const { ensurePickupColumns } = require('../src/services/pickupSchema');

const { User, Document, CerCode, PickupRequest, PickupPackage, Transaction, TransportProposal, RecipientAvailability } = models;
const { REQUIRED_DOCUMENTS } = require('../src/services/documentRequirements');

let server;
let io;
let base;
const stamp = Date.now();
const people = {};

async function api(method, route, token, body) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function expectOk(promise, status = 200) {
  const res = await promise;
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function createUser(key, role, { verified = true, documents = verified } = {}) {
  const email = `${key}_${stamp}@test.local`;
  const { body } = await api('POST', '/api/auth/register', null, {
    role,
    companyName: `${key} srl`,
    piva: `PIVA-${key}-${stamp}`,
    email,
    password: 'secret1',
  });
  if (verified) await User.update({ verified: true }, { where: { id: body.user.id } });
  // Operators are only matched when every required onboarding document is approved.
  if (documents) {
    await Document.bulkCreate(
      (REQUIRED_DOCUMENTS[role] || []).map((documentType) => ({
        userId: body.user.id,
        documentType,
        fileName: `${documentType}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 1000,
        status: 'approved',
      }))
    );
  }
  people[key] = { id: body.user.id, token: body.token, role };
  return people[key];
}

const tok = (key) => people[key].token;
const future = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

async function notificationTypes(key, pickupRequestId) {
  const { body } = await api('GET', '/api/notifications', tok(key));
  return body.items
    .filter((n) => !pickupRequestId || n.payload.pickupRequestId === pickupRequestId)
    .map((n) => n.type);
}

async function newPublishedRequest(producerKey = 'prod', overrides = {}) {
  const draft = await expectOk(
    api('POST', '/api/producers/pickups', tok(producerKey), {
      cerCode: '15 01 10*',
      quantityTon: 10,
      pickupAddress: 'Via Industria 14, Milano',
      deadline: future(10),
      maxPrice: 1200,
      ...overrides,
    }),
    201
  );
  await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok(producerKey)));
  return draft.id;
}

const available = (key, id, pricePerTon, destination = `Impianto ${key}`) =>
  api('POST', `/api/recipients/pickups/${id}/availability`, tok(key), {
    available: true,
    pricePerTon,
    destinationAddress: destination,
    availableCapacityTon: 50,
  });
const unavailable = (key, id) =>
  api('POST', `/api/recipients/pickups/${id}/availability`, tok(key), { available: false });
const propose = (key, id, price) =>
  api('POST', `/api/transporters/pickups/${id}/proposal`, tok(key), { price, vehicleType: 'ADR Truck', availabilityNote: 'Domani' });
const decline = (key, id) => api('POST', `/api/transporters/pickups/${id}/proposal`, tok(key), { decline: true });
const producerDetail = (id, key = 'prod') => expectOk(api('GET', `/api/producers/pickups/${id}`, tok(key)));
const producerListItem = async (id) => (await expectOk(api('GET', '/api/producers/pickups', tok('prod')))).find((item) => item.id === id);

before(async () => {
  models.initModels();
  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${process.env.DB_SCHEMA}"`);
  await sequelize.sync();

  const httpServer = http.createServer(app);
  io = new Server(httpServer);
  registerNotificationSocket(io);
  setSocketServer(io);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  server = httpServer;
  base = `http://127.0.0.1:${server.address().port}`;

  await createUser('prod', 'producer');
  await createUser('prod2', 'producer');
  await createUser('rec1', 'recipient');
  await createUser('rec2', 'recipient');
  await createUser('rec3', 'recipient');
  await createUser('recUnverified', 'recipient', { verified: false });
  await createUser('recNoDocs', 'recipient', { documents: false });
  await createUser('traNoDocs', 'transporter', { documents: false });
  await createUser('admin', 'admin');
  await createUser('tra1', 'transporter');
  await createUser('tra2', 'transporter');
  await createUser('tra3', 'transporter');
});

after(async () => {
  io?.close();
  server?.close();
  await sequelize.query(`DROP SCHEMA IF EXISTS "${process.env.DB_SCHEMA}" CASCADE`);
  await sequelize.close();
});

describe('pickup schema upgrade', () => {
  test('upgrades populated earlier tables, preserves data and can run again', async () => {
    const existing = await PickupRequest.create({
      producerId: people.prod.id,
      cerCode: '15 01 10*',
      quantityTon: 10,
      pickupAddress: 'Via Migrazione 1',
      deadline: future(10),
      maxPrice: 1200,
    });
    const queryInterface = sequelize.getQueryInterface();
    const missingColumns = [
      [PickupRequest, [
        'cer_known', 'cer_request_note', 'waste_description', 'photo_file_name', 'photo_data',
        'technical_documents', 'containment', 'special_info', 'recurring',
        'recurrence_frequency', 'recurrence_start_date', 'recurrence_end_date',
      ]],
      [RecipientAvailability, [
        'pricing_unit', 'unit_price', 'quantity_tolerance_percent', 'availability_window',
      ]],
      [TransportProposal, ['pricing_mode', 'unit_price', 'distance_km']],
    ];
    await RecipientAvailability.create({
      pickupRequestId: existing.id, recipientId: people.rec1.id, pricePerTon: 25,
    });
    await TransportProposal.create({
      pickupRequestId: existing.id, transporterId: people.tra1.id, price: 100,
    });
    for (const [model, columns] of missingColumns) {
      for (const column of columns) await queryInterface.removeColumn(model.getTableName(), column);
    }

    await ensurePickupColumns();
    await ensurePickupColumns();

    for (const [model, columns] of missingColumns) {
      const actual = await queryInterface.describeTable(model.getTableName());
      for (const column of columns) assert.ok(actual[column], `missing ${column}`);
    }
    const restored = await PickupRequest.findByPk(existing.id);
    assert.equal(restored.pickupAddress, 'Via Migrazione 1');
    assert.equal(restored.cerKnown, true);
    assert.equal(restored.recurring, false);
    assert.equal(restored.wasteDescription, null);
    const recipient = await RecipientAvailability.findOne({ where: { pickupRequestId: existing.id } });
    assert.equal(recipient.pricingUnit, 'per_ton');
    assert.equal(recipient.pricePerTon, 25);
    const transporter = await TransportProposal.findOne({ where: { pickupRequestId: existing.id } });
    assert.equal(transporter.pricingMode, 'fixed_trip');
    assert.equal(transporter.price, 100);
    const draft = await expectOk(api('POST', '/api/producers/pickups', tok('prod'), {
      cerCode: '15 01 10*', quantityTon: 2, pickupAddress: 'Via Nuova 1',
      deadline: future(10), maxPrice: 500, wasteDescription: 'Migration check',
    }), 201);
    assert.equal(draft.status, 'draft');
    assert.equal((await producerListItem(draft.id)).actionRequired, true);
    assert.equal(draft.wasteDescription, 'Migration check');
    await RecipientAvailability.destroy({ where: { pickupRequestId: existing.id } });
    await TransportProposal.destroy({ where: { pickupRequestId: existing.id } });
    await PickupRequest.destroy({ where: { id: [existing.id, draft.id] } });
  });
});

describe('package optimizer', () => {
  const pkg = (id, treatment, transport) => ({ id, treatmentPrice: treatment, transportPrice: transport, totalPrice: treatment + transport });

  test('ranks by lowest total price with deterministic tie-breaks', () => {
    const ranked = rankPackages([pkg('a', 800, 300), pkg('b', 700, 400), pkg('c', 900, 100), pkg('d', 500, 600)], 'lowest_price');
    assert.deepEqual(ranked.map((p) => p.id), ['c', 'a', 'b', 'd']);
    assert.deepEqual(ranked.map((p) => p.rank), [1, 2, 3, 4]);
  });

  test('is pluggable and rejects unknown strategies', () => {
    STRATEGIES.test_strategy = (p) => -p.totalPrice;
    const ranked = rankPackages([pkg('a', 100, 100), pkg('b', 500, 500)], 'test_strategy');
    assert.equal(ranked[0].id, 'b');
    delete STRATEGIES.test_strategy;
    assert.throws(() => rankPackages([pkg('a', 1, 1)], 'nope'));
  });
});

describe('registration conflicts', () => {
  test('duplicate email returns an actionable conflict without creating an account', async () => {
    const existing = await User.findByPk(people.prod.id);
    const count = await User.count();
    const result = await api('POST', '/api/auth/register', null, {
      role: 'producer', companyName: 'Duplicate email', piva: `DUP-EMAIL-${stamp}`,
      email: existing.email, password: 'secret1',
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.field, 'email');
    assert.match(result.body.message, /email.*gia registrata/);
    assert.equal(await User.count(), count);
  });

  test('duplicate fiscal identifier returns an actionable conflict without creating an account', async () => {
    const existing = await User.findByPk(people.prod.id);
    const count = await User.count();
    const result = await api('POST', '/api/auth/register', null, {
      role: 'producer', companyName: 'Duplicate fiscal identifier', piva: existing.piva,
      email: `dup-fiscal-${stamp}@test.local`, password: 'secret1',
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.field, 'piva');
    assert.match(result.body.message, /partita IVA.*gia registrata/);
    assert.equal(await User.count(), count);
  });
});

describe('access control', () => {
  test('requires a token and the right role', async () => {
    assert.equal((await api('GET', '/api/producers/pickups')).status, 401);
    assert.equal((await api('GET', '/api/producers/pickups', tok('rec1'))).status, 403);
    assert.equal((await api('GET', '/api/recipients/pickups', tok('prod'))).status, 403);
    assert.equal((await api('GET', '/api/transporters/pickups', tok('rec1'))).status, 403);
    assert.equal((await api('POST', '/api/pickups/abc/reject', tok('rec1'))).status, 404);
    assert.equal((await api('POST', '/api/pickups/00000000-0000-4000-8000-000000000000/reject', tok('prod'))).status, 403);
  });

  test('validates the producer input', async () => {
    const res = await api('POST', '/api/producers/pickups', tok('prod'), {
      cerCode: '15 01 10*', quantityTon: -3, pickupAddress: 'x', deadline: future(2), maxPrice: 100,
    });
    assert.equal(res.status, 400);
  });
});

describe('full flow: steps 1-6', () => {
  let id;
  let bestPackage;

  test('1. producer creates a draft, nobody else sees it, then publishes', async () => {
    const draft = await expectOk(
      api('POST', '/api/producers/pickups', tok('prod'), {
        cerCode: '15 01 10*', quantityTon: 10, pickupAddress: 'Via Industria 14, Milano', deadline: future(10), maxPrice: 1200,
      }),
      201
    );
    id = draft.id;
    assert.equal(draft.status, 'draft');
    assert.deepEqual((await api('GET', '/api/recipients/pickups', tok('rec1'))).body, []);
    assert.equal((await api('GET', `/api/producers/pickups/${id}`, tok('prod2'))).status, 404);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/publish`, tok('prod2'))).status, 404);

    const published = await expectOk(api('POST', `/api/producers/pickups/${id}/publish`, tok('prod')));
    assert.equal(published.status, 'awaiting_recipients');
    assert.equal((await producerListItem(id)).actionRequired, false);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/publish`, tok('prod'))).status, 409);
  });

  test('2a. only verified recipients are notified; transporters are not notified yet', async () => {
    for (const key of ['rec1', 'rec2', 'rec3']) {
      assert.ok((await notificationTypes(key, id)).includes('recipient_invited'), `${key} notified`);
      assert.equal((await api('GET', '/api/recipients/pickups', tok(key))).body.length, 1);
    }
    assert.equal((await api('GET', '/api/recipients/pickups', tok('recUnverified'))).body.length, 0);
    for (const key of ['tra1', 'tra2', 'tra3']) {
      assert.deepEqual(await notificationTypes(key, id), []);
      assert.equal((await api('GET', '/api/transporters/pickups', tok(key))).body.length, 0);
      assert.equal((await propose(key, id, 100)).status, 404);
    }
  });

  test('2b. recipients see only what concerns them (no max price, no other offers)', async () => {
    const detail = await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec1')));
    assert.equal(detail.stage, 'to_respond');
    assert.equal(detail.maxPrice, undefined);
    assert.equal(detail.producerId, undefined);
    assert.equal(detail.recipients, undefined);
    assert.equal(detail.packages, undefined);
    assert.equal((await api('GET', `/api/recipients/pickups/${id}`, tok('recUnverified'))).status, 404);
  });

  test('2c. recipients confirm availability and the transporter phase opens only after all responded', async () => {
    assert.equal((await available('rec1', id, 100)).status, 200);
    assert.equal((await producerListItem(id)).actionRequired, true, 'can close recipient collection early');
    assert.equal((await available('rec1', id, 0, '')).status, 400);
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec1'), {})).status, 400);
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec2'), {
      available: true, pricePerTon: 80, destinationAddress: 'x', availableCapacityTon: 2,
    })).status, 400, 'capacity below requested quantity is refused');

    assert.equal((await available('rec2', id, 80)).status, 200);
    assert.equal((await producerDetail(id)).request.status, 'awaiting_recipients');
    assert.deepEqual(await notificationTypes('tra1', id), []);

    assert.equal((await unavailable('rec3', id)).status, 200);
    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'awaiting_transporters');
    assert.equal((await producerListItem(id)).actionRequired, false);
    assert.equal(detail.recipients.filter((r) => r.status === 'available').length, 2);

    assert.ok((await notificationTypes('prod', id)).includes('recipient_availability_received'));
    assert.ok((await notificationTypes('prod', id)).includes('transporters_notified'));
    assert.equal((await available('rec1', id, 90)).status, 409, 'recipient phase is closed');
  });

  test('3. transporters are notified and bid; proposals are private', async () => {
    for (const key of ['tra1', 'tra2', 'tra3']) {
      assert.ok((await notificationTypes(key, id)).includes('transporters_invited'));
    }
    assert.equal((await notificationTypes('rec3', id)).includes('transporters_invited'), false);

    const view = await expectOk(api('GET', `/api/transporters/pickups/${id}`, tok('tra1')));
    assert.equal(view.stage, 'to_respond');
    assert.equal(view.maxPrice, undefined);
    assert.equal(JSON.stringify(view).includes('pricePerTon'), false, 'no recipient price leaks to transporters');

    assert.equal((await propose('tra1', id, 0)).status, 400);
    assert.equal((await propose('tra1', id, 320)).status, 200);
    assert.equal((await producerListItem(id)).actionRequired, true, 'can close transport collection early');
    assert.equal((await propose('tra1', id, 300)).status, 200, 'proposal can be updated');
    assert.equal((await propose('tra2', id, 250)).status, 200);
    assert.equal((await producerDetail(id)).request.status, 'awaiting_transporters');
    assert.equal((await decline('tra3', id)).status, 200);
  });

  test('4. packages are generated, ranked by lowest price and shown to the producer', async () => {
    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'packages_ready');
    assert.equal((await producerListItem(id)).actionRequired, true);
    assert.deepEqual(detail.packages.map((p) => p.totalPrice), [1050, 1100, 1250, 1300]);
    assert.deepEqual(detail.packages.map((p) => p.rank), [1, 2, 3, 4]);
    assert.equal(detail.packages[0].recipient.companyName, undefined, 'available recipients stay anonymous before selection');
    assert.equal(detail.packages[0].transporter.companyName, undefined, 'available transporters stay anonymous before selection');
    assert.ok(detail.recipients.every((recipient) => recipient.companyName === undefined));
    assert.ok(detail.proposals.every((proposal) => proposal.companyName === undefined));
    assert.equal(detail.packages[0].overBudget, false);
    assert.equal(detail.packages[3].overBudget, true);
    assert.ok((await notificationTypes('prod', id)).includes('packages_ready'));
    bestPackage = detail.packages[0];

    const recipientView = await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec1')));
    assert.equal(recipientView.packages, undefined);
    assert.equal(JSON.stringify(recipientView).includes('transportPrice'), false);
  });

  test('5. producer selects a package: only the two involved parties are notified', async () => {
    assert.equal((await api('POST', `/api/producers/pickups/${id}/packages/${bestPackage.id}/select`, tok('prod2'))).status, 404);
    const detail = await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${bestPackage.id}/select`, tok('prod')));
    assert.equal(detail.request.status, 'in_agreement');
    assert.equal(detail.currentPackage.id, bestPackage.id);
    assert.equal(detail.currentPackage.recipient.companyName, 'rec2 srl');
    assert.equal(detail.currentPackage.transporter.companyName, 'tra2 srl');
    assert.deepEqual((await producerListItem(id)).pendingAgreementRoles, ['producer']);
    assert.equal((await producerListItem(id)).actionRequired, true);

    assert.ok((await notificationTypes('rec2', id)).includes('package_selected'));
    assert.ok((await notificationTypes('tra2', id)).includes('package_selected'));
    for (const key of ['rec1', 'tra1']) {
      assert.equal((await notificationTypes(key, id)).includes('package_selected'), false);
    }
    assert.equal((await api('POST', `/api/producers/pickups/${id}/packages/${bestPackage.id}/select`, tok('prod'))).status, 409);
  });

  test('6. day/time agreement: proposal, counter-proposal, confirmation only when all three agree', async () => {
    const first = future(5);
    const second = future(6);

    // recipient/transporter cannot open the negotiation; outsiders see nothing
    assert.equal((await api('POST', `/api/pickups/${id}/slots`, tok('rec2'), { scheduledAt: first })).status, 409);
    assert.equal((await api('POST', `/api/pickups/${id}/slots`, tok('rec1'), { scheduledAt: first })).status, 404);
    assert.equal((await api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: 'garbage' })).status, 400);
    assert.equal((await api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: new Date(Date.now() - 1000).toISOString() })).status, 400);

    const afterProposal = await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: first }), 201);
    const slotA = afterProposal.agreement.activeSlot;
    assert.deepEqual(slotA.accepted, { producer: true, recipient: false, transporter: false });
    assert.equal((await producerListItem(id)).actionRequired, false, 'producer already accepted own proposal');
    assert.deepEqual((await producerListItem(id)).pendingAgreementRoles, ['recipient', 'transporter']);
    for (const key of ['rec2', 'tra2']) assert.ok((await notificationTypes(key, id)).includes('slot_proposed'));
    assert.equal((await notificationTypes('rec1', id)).includes('slot_proposed'), false);

    // recipient accepts, still not confirmed
    const recAccepted = await expectOk(api('POST', `/api/pickups/${id}/slots/${slotA.id}/accept`, tok('rec2')));
    assert.equal(recAccepted.agreement.activeSlot.acceptedByMe, true);
    assert.equal((await producerDetail(id)).request.status, 'in_agreement');

    // the transporter proposes an alternative: it supersedes the first slot and resets acceptances
    const counter = await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('tra2'), { scheduledAt: second }), 201);
    const slotB = counter.agreement.activeSlot;
    assert.notEqual(slotB.id, slotA.id);
    assert.deepEqual(slotB.accepted, { producer: false, recipient: false, transporter: true });
    assert.equal((await producerListItem(id)).actionRequired, true, 'producer must accept the counterproposal');
    assert.equal((await api('POST', `/api/pickups/${id}/slots/${slotA.id}/accept`, tok('prod'))).status, 409, 'old slot is no longer valid');

    await expectOk(api('POST', `/api/pickups/${id}/slots/${slotB.id}/accept`, tok('prod')));
    assert.equal((await producerDetail(id)).request.status, 'in_agreement', 'two of three is not enough');
    assert.equal((await api('POST', `/api/pickups/${id}/slots/${slotB.id}/accept`, tok('rec1'))).status, 404);

    const confirmed = await expectOk(api('POST', `/api/pickups/${id}/slots/${slotB.id}/accept`, tok('rec2')));
    assert.equal(confirmed.stage, 'confirmed');
    assert.equal(new Date(confirmed.agreement.confirmedSlotAt).toISOString(), second);

    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'confirmed');
    assert.equal((await producerListItem(id)).actionRequired, false);
    assert.deepEqual((await producerListItem(id)).pendingAgreementRoles, []);
    assert.equal(new Date(detail.request.confirmedSlotAt).toISOString(), second);

    for (const key of ['prod', 'rec2', 'tra2']) assert.ok((await notificationTypes(key, id)).includes('pickup_confirmed'));
    for (const key of ['rec1', 'tra1']) assert.ok((await notificationTypes(key, id)).includes('pickup_closed'));
    for (const key of ['rec3', 'tra3']) assert.equal((await notificationTypes(key, id)).includes('pickup_closed'), false);

    assert.equal(await Transaction.count({ where: { pickupRequestId: id } }), 1);
    assert.equal(await PickupPackage.count({ where: { pickupRequestId: id, status: 'confirmed' } }), 1);

    const earnings = await expectOk(api('GET', '/api/transporters/earnings', tok('tra2')));
    assert.equal(earnings.jobs, 1);
    assert.equal(earnings.gross, 250);
  });

  test('status history records every transition', async () => {
    const detail = await producerDetail(id);
    assert.deepEqual(
      detail.history.map((h) => h.to),
      ['awaiting_recipients', 'awaiting_transporters', 'packages_ready', 'in_agreement', 'confirmed']
    );
  });
});

describe('step 7: refusal and no answer go back to the list', () => {
  async function toPackagesReady() {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    await available('rec2', id, 80);
    await unavailable('rec3', id);
    await propose('tra1', id, 300);
    await propose('tra2', id, 250);
    await decline('tra3', id);
    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'packages_ready');
    return { id, detail };
  }

  test('recipient refuses: request returns to packages_ready with the other packages', async () => {
    const { id, detail } = await toPackagesReady();
    const [first, second] = detail.packages;
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${first.id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: future(4) }), 201);

    assert.equal((await api('POST', `/api/pickups/${id}/reject`, tok('prod'))).status, 403, 'producer uses withdraw instead');
    assert.equal((await api('POST', `/api/pickups/${id}/reject`, tok('rec1'))).status, 404);

    const rejected = await expectOk(api('POST', `/api/pickups/${id}/reject`, tok('rec2')));
    assert.equal(rejected.stage, 'waiting');

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.request.selectedPackageId, null);
    assert.equal(after.agreement, null);
    assert.equal(after.failedPackages.length, 1);
    assert.equal(after.failedPackages[0].id, first.id);
    assert.equal(after.failedPackages[0].failureReason, 'recipient_rejected');
    assert.equal(after.packages.length, 3);
    assert.equal(after.packages.some((p) => p.id === first.id), false);
    assert.equal(after.packages[0].id, second.id);

    assert.ok((await notificationTypes('prod', id)).includes('package_failed'));
    assert.ok((await notificationTypes('tra2', id)).includes('package_released'));
    assert.equal((await notificationTypes('rec2', id)).includes('package_released'), false, 'the refusing party is not notified of its own refusal');

    // the producer picks another package and completes the flow
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${second.id}/select`, tok('prod')));
    assert.equal((await api('POST', `/api/producers/pickups/${id}/packages/${first.id}/select`, tok('prod'))).status, 409);
    const slotDate = future(7);
    const proposed = await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: slotDate }), 201);
    const slotId = proposed.agreement.activeSlot.id;
    const secondRecord = await PickupPackage.findByPk(second.id);
    const recKey = secondRecord.recipientId === people.rec1.id ? 'rec1' : 'rec2';
    const traKey = secondRecord.transporterId === people.tra1.id ? 'tra1' : 'tra2';
    await expectOk(api('POST', `/api/pickups/${id}/slots/${slotId}/accept`, tok(recKey)));
    await expectOk(api('POST', `/api/pickups/${id}/slots/${slotId}/accept`, tok(traKey)));
    assert.equal((await producerDetail(id)).request.status, 'confirmed');
  });

  test('transporter refuses', async () => {
    const { id, detail } = await toPackagesReady();
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${detail.packages[0].id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/reject`, tok('tra2')));
    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.failedPackages[0].failureReason, 'transporter_rejected');
    assert.ok((await notificationTypes('rec2', id)).includes('package_released'));
  });

  test('no answer within the deadline counts as a refusal', async () => {
    const { id, detail } = await toPackagesReady();
    const first = detail.packages[0];
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${first.id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: future(4) }), 201);

    await workflow.expireStaleAgreements();
    assert.equal((await producerDetail(id)).request.status, 'in_agreement', 'nothing is stale yet');

    await PickupRequest.update({ agreementDeadline: new Date(Date.now() - 1000) }, { where: { id } });
    await workflow.expireStaleAgreements();

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.failedPackages[0].failureReason, 'recipient_no_response');
    assert.ok((await notificationTypes('prod', id)).includes('package_failed'));
  });

  test('producer can withdraw its choice and the package becomes selectable again', async () => {
    const { id, detail } = await toPackagesReady();
    const first = detail.packages[0];
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${first.id}/select`, tok('prod')));
    const back = await expectOk(api('POST', `/api/producers/pickups/${id}/withdraw-selection`, tok('prod')));
    assert.equal(back.request.status, 'packages_ready');
    assert.equal(back.packages.length, 4);
    assert.equal(back.failedPackages.length, 0);
  });

  test('when every package has failed the request is cancelled', async () => {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    await unavailable('rec2', id);
    await unavailable('rec3', id);
    await propose('tra1', id, 300);
    await decline('tra2', id);
    await decline('tra3', id);
    const detail = await producerDetail(id);
    assert.equal(detail.packages.length, 1);
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${detail.packages[0].id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/reject`, tok('tra1')));
    const after = await producerDetail(id);
    assert.equal(after.request.status, 'cancelled');
    assert.equal(after.request.cancelReason, 'no_packages_left');
    assert.ok((await notificationTypes('prod', id)).includes('pickup_cancelled'));
  });
});

describe('phases and cancellation', () => {
  test('no available recipient: request is cancelled and transporters are never notified', async () => {
    const id = await newPublishedRequest();
    await unavailable('rec1', id);
    await unavailable('rec2', id);
    await unavailable('rec3', id);
    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'cancelled');
    assert.equal(detail.request.cancelReason, 'no_recipient_available');
    for (const key of ['tra1', 'tra2', 'tra3']) assert.deepEqual(await notificationTypes(key, id), []);
    assert.ok((await notificationTypes('prod', id)).includes('pickup_cancelled'));
    assert.equal(await TransportProposal.count({ where: { pickupRequestId: id } }), 0);
  });

  test('producer can close the recipient phase early; late recipients are refused', async () => {
    const id = await newPublishedRequest();
    assert.equal((await api('POST', `/api/producers/pickups/${id}/close-recipients`, tok('prod'))).status, 409, 'needs at least one available recipient');
    await available('rec1', id, 100);
    const closed = await expectOk(api('POST', `/api/producers/pickups/${id}/close-recipients`, tok('prod')));
    assert.equal(closed.request.status, 'awaiting_transporters');
    assert.equal((await available('rec2', id, 50)).status, 409);
    assert.equal(await RecipientAvailability.count({ where: { pickupRequestId: id, status: 'expired' } }), 2);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/close-recipients`, tok('prod'))).status, 409);
  });

  test('producer can close the transporter phase early; needs at least one proposal', async () => {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    await available('rec2', id, 100);
    await unavailable('rec3', id);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/close-transporters`, tok('prod'))).status, 409);
    await propose('tra1', id, 300);
    const closed = await expectOk(api('POST', `/api/producers/pickups/${id}/close-transporters`, tok('prod')));
    assert.equal(closed.request.status, 'packages_ready');
    assert.equal(closed.packages.length, 2);
    assert.equal((await propose('tra2', id, 100)).status, 409);
  });

  test('producer can cancel at any time; every interested party is notified; terminal state is final', async () => {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/cancel`, tok('prod2'))).status, 404);
    const cancelled = await expectOk(api('POST', `/api/producers/pickups/${id}/cancel`, tok('prod'), { reason: 'cambio piano' }));
    assert.equal(cancelled.request.status, 'cancelled');
    assert.ok((await notificationTypes('rec1', id)).includes('pickup_cancelled'));
    assert.ok((await notificationTypes('rec2', id)).includes('pickup_cancelled'));
    assert.equal((await api('POST', `/api/producers/pickups/${id}/cancel`, tok('prod'))).status, 409);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/publish`, tok('prod'))).status, 409);
    assert.equal((await available('rec2', id, 10)).status, 409);
  });

  test('a draft can be edited before publishing but not afterwards', async () => {
    const draft = await expectOk(
      api('POST', '/api/producers/pickups', tok('prod'), {
        cerCode: '20 01 01', quantityTon: 1, pickupAddress: 'Via A', deadline: future(3), maxPrice: 100,
      }),
      201
    );
    const edited = await expectOk(api('PATCH', `/api/producers/pickups/${draft.id}`, tok('prod'), { quantityTon: 2 }));
    assert.equal(edited.quantityTon, 2);
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok('prod')));
    assert.equal((await api('PATCH', `/api/producers/pickups/${draft.id}`, tok('prod'), { quantityTon: 3 })).status, 409);
  });

  test('concurrent last responses open the transporter phase exactly once', async () => {
    const id = await newPublishedRequest();
    await Promise.all([available('rec1', id, 100), available('rec2', id, 90), unavailable('rec3', id)]);
    assert.equal((await producerDetail(id)).request.status, 'awaiting_transporters');
    assert.equal(await TransportProposal.count({ where: { pickupRequestId: id } }), 3);
  });
});

describe('features of the onboarding branch inside the new flow', () => {
  test('only operators with approved documents are invited', async () => {
    const id = await newPublishedRequest();
    assert.equal((await api('GET', '/api/recipients/pickups', tok('recNoDocs'))).body.length, 0);
    assert.equal((await api('GET', '/api/recipients/pickups', tok('recUnverified'))).body.length, 0);
    assert.equal((await api('GET', `/api/recipients/pickups/${id}`, tok('recNoDocs'))).status, 404);
    await Promise.all([available('rec1', id, 100), unavailable('rec2', id), unavailable('rec3', id)]);
    assert.equal((await api('GET', '/api/transporters/pickups', tok('traNoDocs'))).body.length, 0);
    assert.equal((await propose('traNoDocs', id, 100)).status, 404);
  });

  test('unknown CER: stays a draft until the admin proposes a code, then the producer publishes', async () => {
    await CerCode.create({ code: '15 01 10*', description: 'Imballaggi', category: '15', hazardous: true }).catch(() => {});
    const draft = await expectOk(
      api('POST', '/api/producers/pickups', tok('prod'), {
        cerKnown: false, cerCode: '', quantityTon: 3, pickupAddress: 'Via CER 1', deadline: future(9), maxPrice: 0,
        wasteDescription: 'Residui da classificare', photoFileName: 'foto.jpg',
      }),
      201
    );
    assert.equal(draft.cerCode, 'UNKNOWN');
    assert.equal(draft.cerKnown, false);
    assert.equal((await api('POST', `/api/producers/pickups/${draft.id}/publish`, tok('prod'))).status, 409);

    const pending = await expectOk(api('GET', '/api/admin/cer-recognition', tok('admin')));
    assert.ok(pending.some((r) => r.id === draft.id));
    assert.equal((await api('PATCH', `/api/admin/cer-recognition/${draft.id}/propose`, tok('prod'), { cerCode: '15 01 10*' })).status, 403);
    assert.equal((await api('PATCH', `/api/admin/cer-recognition/${draft.id}/propose`, tok('admin'), { cerCode: 'NOPE' })).status, 400);
    await expectOk(api('PATCH', `/api/admin/cer-recognition/${draft.id}/propose`, tok('admin'), { cerCode: '15 01 10*' }));

    assert.ok((await notificationTypes('prod', draft.id)).includes('cer_proposed_by_admin'));
    const afterProposal = await producerDetail(draft.id);
    assert.equal(afterProposal.request.status, 'draft');
    assert.equal(afterProposal.request.cerCode, '15 01 10*');
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok('prod')));
    assert.equal((await producerDetail(draft.id)).request.status, 'awaiting_recipients');
  });

  test('pricing units and per-km transport are converted into comparable package prices', async () => {
    const id = await newPublishedRequest('prod', { maxPrice: 0 });
    const liters = await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec1'), {
      available: true, pricingUnit: 'per_liter', unitPrice: 0.1, destinationAddress: 'Impianto litri',
    });
    assert.equal(liters.status, 400);
    assert.match(liters.body.message, /densità/);
    assert.equal((await RecipientAvailability.findOne({ where: { pickupRequestId: id, recipientId: people.rec1.id } })).status, 'pending');
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec1'), {
      available: true, pricingUnit: 'per_kg', unitPrice: 0.09, destinationAddress: 'Impianto kg', quantityTolerancePercent: 2, availabilityWindow: 'Lun-Ven',
    })).status, 200);
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec2'), {
      available: true, pricingUnit: 'bogus', unitPrice: 1, destinationAddress: 'x',
    })).status, 400);
    await unavailable('rec2', id);
    await unavailable('rec3', id);

    assert.equal((await api('POST', `/api/transporters/pickups/${id}/proposal`, tok('tra1'), { pricingMode: 'per_km', unitPrice: 2.5 })).status, 400, 'distance is required');
    assert.equal((await api('POST', `/api/transporters/pickups/${id}/proposal`, tok('tra1'), { pricingMode: 'per_km', unitPrice: 2.5, distanceKm: 100 })).status, 200);
    await decline('tra2', id);
    await decline('tra3', id);

    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'packages_ready');
    assert.equal(detail.packages.length, 1);
    assert.equal(detail.packages[0].treatmentPrice, 900);
    assert.equal(detail.packages[0].transportPrice, 250);
    assert.equal(detail.packages[0].totalPrice, 1150);
    assert.equal(detail.packages[0].overBudget, false, 'max price 0 means no limit');
    assert.equal(detail.recipients.find((r) => r.status === 'available').availabilityWindow, 'Lun-Ven');
  });

  describe('unavailable general capacity settings', () => {
    test('never reports a successful save for unimplemented settings', async () => {
      for (const route of ['/api/recipients/pricing', '/api/recipients/capacity']) {
        const response = await api('POST', route, tok('rec1'), { cerCode: '15 01 10*', pricePerTon: 100, availableSlots: 10 });
        assert.equal(response.status, 501);
        assert.match(response.body.message, /non.*disponibil/);
        assert.equal((await api('POST', route, tok('tra1'), {})).status, 403);
      }
    });
  });

  test('recurring orders can be repeated as a new published request', async () => {
    const draft = await expectOk(
      api('POST', '/api/producers/pickups', tok('prod'), {
        cerCode: '15 01 10*', quantityTon: 4, pickupAddress: 'Via Ricorrente 5', deadline: future(8), maxPrice: 900,
        recurring: true, recurrenceFrequency: 'monthly', recurrenceStartDate: '2026-11-01', recurrenceEndDate: '2027-05-01',
        wasteDescription: 'Imballaggi', containment: 'Big bag',
      }),
      201
    );
    const list = await expectOk(api('GET', '/api/producers/pickups/recurring', tok('prod')));
    assert.ok(list.some((r) => r.id === draft.id));
    assert.equal((await api('GET', '/api/producers/pickups/recurring', tok('prod2'))).body.some((r) => r.id === draft.id), false);

    const path = `/api/producers/pickups/${draft.id}/repeat`;
    assert.equal((await api('POST', path, tok('prod'), { quantityTon: 5, deadline: future(20), photoFileName: 'n.jpg' })).status, 400, 'stable data must be confirmed');
    assert.equal((await api('POST', path, tok('prod'), { confirmStableData: true, quantityTon: 5 })).status, 400);
    assert.equal((await api('POST', path, tok('prod2'), { confirmStableData: true, quantityTon: 5, deadline: future(20), photoFileName: 'n.jpg' })).status, 404);

    const copy = await expectOk(
      api('POST', path, tok('prod'), { confirmStableData: true, quantityTon: 5, deadline: future(20), photoFileName: 'n.jpg' }),
      201
    );
    assert.notEqual(copy.id, draft.id);
    assert.equal(copy.recurring, false);
    assert.equal(copy.containment, 'Big bag');
    assert.equal((await producerDetail(copy.id)).request.status, 'awaiting_recipients');
  });

  test('recipients and transporters see the waste dossier but never the max price', async () => {
    const id = await newPublishedRequest('prod', { wasteDescription: 'Solventi esausti', containment: 'Fusti', specialInfo: 'ADR', photoFileName: 'f.jpg', photoData: 'data:image/png;base64,AAAA' });
    const view = await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec1')));
    assert.equal(view.wasteDescription, 'Solventi esausti');
    assert.equal(view.containment, 'Fusti');
    assert.equal(view.photoData, 'data:image/png;base64,AAAA');
    assert.equal(view.maxPrice, undefined);
    const list = await expectOk(api('GET', '/api/recipients/pickups', tok('rec1')));
    assert.equal(list.find((r) => r.id === id).photoData, undefined, 'photos are only sent with the detail');
  });
});

describe('notifications', () => {
  test('are private to each user and can be marked as read', async () => {
    const mine = await expectOk(api('GET', '/api/notifications', tok('rec1')));
    assert.ok(mine.unread > 0);
    const foreign = await expectOk(api('GET', '/api/notifications', tok('tra1')));
    assert.equal(foreign.items.some((n) => mine.items.some((m) => m.id === n.id)), false);

    assert.equal((await api('PATCH', `/api/notifications/${mine.items[0].id}/read`, tok('tra1'))).status, 200);
    assert.equal((await expectOk(api('GET', '/api/notifications', tok('rec1')))).unread, mine.unread, 'cannot mark others\' notifications');

    await expectOk(api('POST', '/api/notifications/read-all', tok('rec1')));
    assert.equal((await expectOk(api('GET', '/api/notifications', tok('rec1')))).unread, 0);
  });

  describe('temporary automatic operator approval', () => {
    test('approves existing and new operators, permits missing documents and restores manual checks', async () => {
      const { approveExistingOperators } = require('../src/services/automaticApproval');
      const { findEligibleRecipients, findEligibleTransporters } = require('../src/services/matchingEngine');
      const pendingDocument = await Document.create({
        userId: people.recUnverified.id, documentType: 'facility_registration',
        fileName: 'existing.pdf', mimeType: 'application/pdf', fileSize: 100,
        status: 'pending_review',
      });
      await approveExistingOperators();
      assert.equal((await User.findByPk(people.recUnverified.id)).verified, false);
      assert.equal((await pendingDocument.reload()).status, 'pending_review');

      process.env.AUTO_APPROVE_OPERATORS = 'true';
      try {
        await approveExistingOperators();
        await approveExistingOperators();
        assert.equal((await User.findByPk(people.recUnverified.id)).verified, true);
        assert.equal((await pendingDocument.reload()).status, 'approved');
        assert.equal(pendingDocument.reviewedBy, null);
        assert.ok((await findEligibleRecipients()).some((user) => user.id === people.recNoDocs.id));
        assert.ok((await findEligibleTransporters()).some((user) => user.id === people.traNoDocs.id));

        for (const role of ['recipient', 'transporter']) {
          const result = await expectOk(api('POST', '/api/auth/register', null, {
            role, companyName: `Auto ${role}`, piva: `AUTO-${role}-${stamp}`,
            email: `auto-${role}-${stamp}@test.local`, password: 'secret1',
          }), 201);
          assert.equal(result.user.verified, true);
          people[`auto${role}`] = { id: result.user.id, token: result.token, role };
        }
        const registration = await expectOk(api('POST', '/api/auth/register', null, {
          role: 'recipient', companyName: 'Auto documents', piva: `AUTODOC-${stamp}`,
          email: `auto-doc-${stamp}@test.local`, password: 'secret1',
          documents: [{ documentType: 'facility_registration', fileName: 'registration.pdf', mimeType: 'application/pdf', fileSize: 100 }],
        }), 201);
        assert.equal((await Document.findOne({ where: { userId: registration.user.id } })).status, 'approved');

        const requirements = await expectOk(api('GET', '/api/documents/requirements', tok('autorecipient')));
        assert.equal(requirements.automaticApprovalEnabled, true);
        assert.equal(requirements.missingDocuments.length, 3);
        const upload = { documentType: 'facility_registration', fileName: 'upload.pdf', mimeType: 'application/pdf', fileSize: 100 };
        const document = await expectOk(api('POST', '/api/documents', tok('autorecipient'), upload), 201);
        assert.equal(document.status, 'approved');
        const replaced = await expectOk(api('POST', '/api/documents', tok('autorecipient'), { ...upload, fileName: 'replacement.pdf' }), 201);
        assert.equal(replaced.id, document.id);
        assert.equal(replaced.status, 'approved');

        const id = await newPublishedRequest();
        assert.ok((await notificationTypes('autorecipient', id)).includes('recipient_invited'));
        await expectOk(available('autorecipient', id, 20));
        await expectOk(api('POST', `/api/producers/pickups/${id}/close-recipients`, tok('prod')));
        assert.ok((await notificationTypes('autotransporter', id)).includes('transporters_invited'));
        await expectOk(propose('autotransporter', id, 100));

        process.env.AUTO_APPROVE_OPERATORS = 'false';
        assert.equal((await findEligibleRecipients()).some((user) => user.id === people.autorecipient.id), false);
        assert.equal((await findEligibleTransporters()).some((user) => user.id === people.autotransporter.id), false);
        const manualUpload = await expectOk(api('POST', '/api/documents', tok('autorecipient'), upload), 201);
        assert.equal(manualUpload.status, 'pending_review');
        const manualUser = await expectOk(api('POST', '/api/auth/register', null, {
          role: 'recipient', companyName: 'Manual', piva: `MANUAL-${stamp}`,
          email: `manual-${stamp}@test.local`, password: 'secret1',
        }), 201);
        assert.equal(manualUser.user.verified, false);
      } finally {
        process.env.AUTO_APPROVE_OPERATORS = 'false';
      }
    });
  });

  test('socket delivery is limited to the addressed user', async () => {
    let ioClient;
    try {
      ioClient = require(path.join(__dirname, '..', '..', 'client', 'node_modules', 'socket.io-client')).io;
    } catch {
      return; // client dependencies not installed: skip the live-socket check
    }

    const connect = (key) =>
      new Promise((resolve, reject) => {
        const socket = ioClient(`${base}/notifications`, { auth: { token: tok(key) }, transports: ['websocket'] });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', reject);
      });

    const anonymous = ioClient(`${base}/notifications`, { transports: ['websocket'], reconnection: false });
    const rejected = await new Promise((resolve) => {
      anonymous.on('connect_error', () => resolve(true));
      anonymous.on('connect', () => resolve(false));
    });
    anonymous.close();
    assert.equal(rejected, true, 'sockets without a valid token are refused');

    const rec1 = await connect('rec1');
    const tra1 = await connect('tra1');
    const received = { rec1: [], tra1: [] };
    rec1.on('notification:new', (n) => received.rec1.push(n.type));
    tra1.on('notification:new', (n) => received.tra1.push(n.type));

    await newPublishedRequest();
    await new Promise((resolve) => setTimeout(resolve, 400));
    rec1.close();
    tra1.close();

    assert.deepEqual(received.rec1, ['recipient_invited']);
    assert.deepEqual(received.tra1, []);
  });
});
