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
const { randomUUID } = require('crypto');
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
const { runMigrations } = require('../src/services/migrationRunner');
const completionMigration = require('../src/migrations/20261029-completion-confirmations');
const transporterOffersMigration = require('../src/migrations/20261030-transporter-per-destination-offers');

const {
  User,
  Document,
  CerCode,
  PickupRequest,
  PickupPhoto,
  PickupPackage,
  Transaction,
  TransportProposal,
  TransportProposalOffer,
  RecipientAvailability,
} = models;
const { REQUIRED_DOCUMENTS } = require('../src/services/documentRequirements');

let server;
let io;
let base;
const stamp = Date.now();
const people = {};

async function api(method, route, token, body, options = {}) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(options.contentType ? { 'Content-Type': options.contentType } : body !== undefined && !options.raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body && body.idempotencyKey ? { 'Idempotency-Key': body.idempotencyKey } : {}),
      ...options.headers,
    },
    body: body !== undefined ? options.raw ? body : JSON.stringify(body) : undefined,
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
      quantity: 10000,
      quantityUnit: 'kg',
      pickupAddress: 'Via Industria 14, Milano',
      deadline: future(10),
      ...overrides,
    }),
    201
  );
  await expectOk(api('POST', `/api/producers/pickups/${draft.id}/photos`, tok(producerKey), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {
    raw: true,
    contentType: 'image/png',
    headers: { 'Idempotency-Key': randomUUID(), 'X-File-Name': 'test.png' },
  }), 201);
  await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok(producerKey)));
  return draft.id;
}

const available = (key, id, rate, destination = `Impianto ${key}`) =>
  api('POST', `/api/recipients/pickups/${id}/availability`, tok(key), {
    available: true,
    unitPrice: rate / 1000,
    quantityUnit: 'kg',
    destinationAddress: destination,
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
  await runMigrations();

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

describe('versioned schema migration', () => {
  test('is idempotent and uses the new quantity, address, photo and idempotency columns', async () => {
    await runMigrations();
    const queryInterface = sequelize.getQueryInterface();
    const offersTable = process.env.DB_SCHEMA
      ? { tableName: 'transport_proposal_offers', schema: process.env.DB_SCHEMA }
      : 'transport_proposal_offers';
    const requestColumns = await queryInterface.describeTable(PickupRequest.getTableName());
    const availabilityColumns = await queryInterface.describeTable(RecipientAvailability.getTableName());
    assert.ok(availabilityColumns.road_distance_meters);
    assert.ok(await queryInterface.tableExists(offersTable));
    const offerIndexes = await queryInterface.showIndex(offersTable);
    assert.ok(offerIndexes.some((index) => index.unique
      && index.fields.length === 2
      && index.fields.some((field) => ['recipient_availability_id', 'recipientAvailabilityId'].includes(field.attribute || field.field || field.name))));
    assert.ok(requestColumns.quantity);
    assert.ok(requestColumns.quantity_unit);
    assert.ok(requestColumns.idempotency_key);
    assert.equal(requestColumns.quantity_ton, undefined);
    assert.equal(requestColumns.max_price, undefined);
    assert.ok(availabilityColumns.unit_price);
    assert.equal(availabilityColumns.price_per_ton, undefined);
    const indexes = await queryInterface.showIndex(PickupRequest.getTableName());
    const packageIndexes = await queryInterface.showIndex(PickupPackage.getTableName());
    const recipientIndexes = await queryInterface.showIndex(RecipientAvailability.getTableName());
    const transporterIndexes = await queryInterface.showIndex(TransportProposal.getTableName());
    assert.ok(indexes.some((index) => index.name === 'pickup_requests_producer_id_idempotency_key' && index.unique));
    for (const name of ['pickup_requests_list_order_idx', 'pickup_requests_producer_list_order_idx']) {
      assert.ok(indexes.some((index) => index.name === name), `Area B index ${name} exists`);
    }
    const [indexDefinitions] = await sequelize.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = :schema
       AND indexname IN ('pickup_requests_list_order_idx', 'pickup_requests_producer_list_order_idx')`,
      { replacements: { schema: process.env.DB_SCHEMA } }
    );
    assert.equal(indexDefinitions.length, 2);
    for (const { indexdef } of indexDefinitions) {
      assert.ok(indexdef.includes("'completed'"));
      assert.equal(indexdef.includes("'confirmed'"), false);
    }
    assert.ok(recipientIndexes.some((index) => index.name === 'recipient_availabilities_recipient_request_idx'));
    assert.ok(transporterIndexes.some((index) => index.name === 'transport_proposals_transporter_request_idx'));
    assert.ok(packageIndexes.some((index) => index.name === 'pickup_packages_recipient_rejected_list_idx'));
    assert.ok(packageIndexes.some((index) => index.name === 'pickup_packages_transporter_rejected_list_idx'));

    await runMigrations('down');
    const revertedAvailabilityColumns = await queryInterface.describeTable(RecipientAvailability.getTableName());
    assert.equal(revertedAvailabilityColumns.road_distance_meters, undefined);
    assert.equal(await queryInterface.tableExists(offersTable), false);

    await runMigrations('down');
    let remainingPackageIndexes = await queryInterface.showIndex(PickupPackage.getTableName());
    assert.equal(remainingPackageIndexes.some((index) => index.name === 'pickup_packages_recipient_rejected_list_idx'), false);
    assert.equal(remainingPackageIndexes.some((index) => index.name === 'pickup_packages_transporter_rejected_list_idx'), false);
    let remainingIndexes = await queryInterface.showIndex(PickupRequest.getTableName());
    assert.ok(remainingIndexes.some((index) => index.name === 'pickup_requests_list_order_idx'), 'Area B ordering index is restored');
    let revertedCompletionColumns = await queryInterface.describeTable(PickupRequest.getTableName());
    assert.ok(revertedCompletionColumns.producer_completion_confirmed_at);
    assert.ok(revertedCompletionColumns.completed_at);

    await runMigrations('down');
    remainingIndexes = await queryInterface.showIndex(PickupRequest.getTableName());
    assert.ok(remainingIndexes.some((index) => index.name === 'pickup_requests_list_order_idx'), 'Area B index remains after completion rollback');
    revertedCompletionColumns = await queryInterface.describeTable(PickupRequest.getTableName());
    assert.equal(revertedCompletionColumns.producer_completion_confirmed_at, undefined);
    assert.equal(revertedCompletionColumns.completed_at, undefined);
    await runMigrations('down');
    remainingIndexes = await queryInterface.showIndex(PickupRequest.getTableName());
    assert.equal(remainingIndexes.some((index) => index.name === 'pickup_requests_list_order_idx'), false);
    await runMigrations('down');
    await runMigrations('down');
    const revertedColumns = await queryInterface.describeTable(PickupRequest.getTableName());
    assert.ok(revertedColumns.quantity_ton);
    assert.ok(revertedColumns.max_price);
    assert.equal(await queryInterface.tableExists(PickupPhoto.getTableName()), false);

    await runMigrations();
    const reappliedColumns = await queryInterface.describeTable(PickupRequest.getTableName());
    assert.ok(reappliedColumns.quantity_unit);
    assert.ok(reappliedColumns.idempotency_key);
    assert.ok(await queryInterface.tableExists(PickupPhoto.getTableName()));
  });
});

describe('transporter offer rollback safeguards', () => {
  test('refuses rollback when per-recipient prices cannot be represented by the old schema', async () => {
    const request = await PickupRequest.create({
      producerId: people.prod.id,
      cerCode: '15 01 10*',
      quantity: 100,
      quantityUnit: 'kg',
      pickupAddress: 'Via test 1',
      deadline: future(10),
      status: 'awaiting_transporters',
    });
    const availabilities = await RecipientAvailability.bulkCreate([
      { pickupRequestId: request.id, recipientId: people.rec1.id, status: 'available', destinationAddress: 'Sede uno' },
      { pickupRequestId: request.id, recipientId: people.rec2.id, status: 'available', destinationAddress: 'Sede due' },
    ]);
    const proposal = await TransportProposal.create({
      pickupRequestId: request.id,
      transporterId: people.tra1.id,
      status: 'submitted',
      price: 100,
      pricingMode: 'per_destination',
    });
    await TransportProposalOffer.bulkCreate([
      {
        transportProposalId: proposal.id,
        recipientAvailabilityId: availabilities[0].id,
        pricingMode: 'fixed_trip',
        unitPrice: 100,
        price: 100,
      },
      {
        transportProposalId: proposal.id,
        recipientAvailabilityId: availabilities[1].id,
        pricingMode: 'fixed_trip',
        unitPrice: 200,
        price: 200,
      },
    ]);

    await assert.rejects(
      transporterOffersMigration.down(),
      /different offers per recipient/
    );
    assert.equal(await TransportProposalOffer.count({ where: { transportProposalId: proposal.id } }), 2);
    assert.ok((await sequelize.getQueryInterface().describeTable(RecipientAvailability.getTableName())).road_distance_meters);

    await TransportProposalOffer.destroy({ where: { transportProposalId: proposal.id } });
    await TransportProposal.destroy({ where: { id: proposal.id } });
    await RecipientAvailability.destroy({ where: { pickupRequestId: request.id } });
    await PickupRequest.destroy({ where: { id: request.id } });
  });

  test('backfills historical request-level bids as one offer for each available recipient', async () => {
    await transporterOffersMigration.down();

    const request = await PickupRequest.create({
      producerId: people.prod.id,
      cerCode: '15 01 10*',
      quantity: 100,
      quantityUnit: 'kg',
      pickupAddress: 'Via legacy 1',
      deadline: future(10),
      status: 'awaiting_transporters',
    });
    const availabilityRows = [
      { id: randomUUID(), pickup_request_id: request.id, recipient_id: people.rec1.id, status: 'available', destination_address: 'Impianto legacy 1' },
      { id: randomUUID(), pickup_request_id: request.id, recipient_id: people.rec2.id, status: 'available', destination_address: 'Impianto legacy 2' },
    ];
    await sequelize.getQueryInterface().bulkInsert(
      RecipientAvailability.getTableName(),
      availabilityRows.map((row) => ({ ...row, created_at: new Date(), updated_at: new Date() }))
    );
    const proposal = await TransportProposal.create({
      pickupRequestId: request.id,
      transporterId: people.tra1.id,
      status: 'submitted',
      price: 250,
      pricingMode: 'fixed_trip',
      unitPrice: 250,
    });

    await transporterOffersMigration.up();
    const migratedOffers = await TransportProposalOffer.findAll({
      where: { transportProposalId: proposal.id },
      order: [['recipientAvailabilityId', 'ASC']],
    });
    assert.equal(migratedOffers.length, 2);
    assert.deepEqual(migratedOffers.map((offer) => offer.price), [250, 250]);
    assert.deepEqual(
      migratedOffers.map((offer) => offer.recipientAvailabilityId).sort(),
      availabilityRows.map((availability) => availability.id).sort()
    );

    await TransportProposalOffer.destroy({ where: { transportProposalId: proposal.id } });
    await TransportProposal.destroy({ where: { id: proposal.id } });
    await RecipientAvailability.destroy({ where: { pickupRequestId: request.id } });
    await PickupRequest.destroy({ where: { id: request.id } });
  });
});

describe('request list ordering and rejection ownership', () => {
  test('all role lists place terminal requests last and expose only the current user rejection', async () => {
    const requestIds = [];
    const makeRequest = (status, createdAt) => PickupRequest.create({
      producerId: people.prod.id,
      cerCode: '15 01 10*',
      quantity: 100,
      quantityUnit: 'kg',
      pickupAddress: 'Via Lista 1',
      deadline: future(10),
      status,
      created_at: createdAt,
      updated_at: createdAt,
    }).then((request) => {
      requestIds.push(request.id);
      return request;
    });
    try {
      const openAt = new Date('2026-01-01T00:00:00.000Z');
      const confirmedAt = new Date('2026-01-03T00:00:00.000Z');
      const completedAt = new Date('2026-01-05T00:00:00.000Z');
      const cancelledAt = new Date('2026-01-04T00:00:00.000Z');
      const rejectedAt = new Date('2025-12-31T00:00:00.000Z');
      const open = await makeRequest('awaiting_recipients', openAt);
      const confirmed = await makeRequest('confirmed', confirmedAt);
      const completed = await makeRequest('completed', completedAt);
      const cancelled = await makeRequest('cancelled', cancelledAt);
      const rejected = await makeRequest('awaiting_recipients', rejectedAt);

      await RecipientAvailability.bulkCreate([
        { pickupRequestId: open.id, recipientId: people.rec1.id, status: 'pending' },
        { pickupRequestId: open.id, recipientId: people.rec2.id, status: 'unavailable' },
        { pickupRequestId: confirmed.id, recipientId: people.rec1.id, status: 'pending' },
        { pickupRequestId: completed.id, recipientId: people.rec1.id, status: 'pending' },
        { pickupRequestId: cancelled.id, recipientId: people.rec1.id, status: 'pending' },
        { pickupRequestId: rejected.id, recipientId: people.rec1.id, status: 'unavailable' },
      ]);
      await TransportProposal.bulkCreate([
        { pickupRequestId: open.id, transporterId: people.tra1.id, status: 'invited' },
        { pickupRequestId: open.id, transporterId: people.tra2.id, status: 'declined' },
        { pickupRequestId: confirmed.id, transporterId: people.tra1.id, status: 'invited' },
        { pickupRequestId: completed.id, transporterId: people.tra1.id, status: 'invited' },
        { pickupRequestId: cancelled.id, transporterId: people.tra1.id, status: 'invited' },
        { pickupRequestId: rejected.id, transporterId: people.tra1.id, status: 'declined' },
      ]);

      const producerItems = await expectOk(api('GET', '/api/producers/pickups', tok('prod')));
      const recipientItems = await expectOk(api('GET', '/api/recipients/pickups', tok('rec1')));
      const transporterItems = await expectOk(api('GET', '/api/transporters/pickups', tok('tra1')));
      for (const items of [producerItems, recipientItems, transporterItems]) {
        const positions = [open.id, confirmed.id, completed.id, cancelled.id, rejected.id]
          .map((id) => items.findIndex((item) => item.id === id));
        assert.ok(positions.every((position) => position >= 0));
        assert.ok(positions[0] < positions[2], 'active request stays before completed request');
        assert.ok(positions[0] < positions[3], 'active request stays before cancelled request');
        assert.ok(positions[1] < positions[2], 'confirmed request stays before completed request');
        assert.ok(positions[1] < positions[3], 'confirmed request stays before cancelled request');
        assert.ok(positions[2] < positions[3], 'terminal requests retain newest-first order');
        if (items === recipientItems || items === transporterItems) {
          assert.ok(positions[0] < positions[4], 'active request stays before personally rejected request');
          assert.ok(positions[1] < positions[4], 'confirmed request stays before personally rejected request');
          assert.ok(positions[3] < positions[4], 'personally rejected request is at the end of the terminal group');
        }
      }
      assert.equal(recipientItems.find((item) => item.id === open.id).rejectedByMe, false, 'another recipient rejection does not affect this user');
      assert.equal(transporterItems.find((item) => item.id === open.id).rejectedByMe, false, 'another transporter rejection does not affect this user');
      assert.equal(recipientItems.find((item) => item.id === rejected.id).rejectedByMe, true);
      assert.equal(transporterItems.find((item) => item.id === rejected.id).rejectedByMe, true);
      assert.equal(recipientItems.find((item) => item.id === confirmed.id).rejectedByMe, false);
      assert.equal(transporterItems.find((item) => item.id === confirmed.id).rejectedByMe, false);
    } finally {
      if (requestIds.length > 0) {
        await RecipientAvailability.destroy({ where: { pickupRequestId: requestIds } });
        await TransportProposal.destroy({ where: { pickupRequestId: requestIds } });
        await PickupPackage.destroy({ where: { pickupRequestId: requestIds } });
        await PickupRequest.destroy({ where: { id: requestIds } });
      }
    }
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
    assert.equal((await api('POST', '/api/pickups/abc/cancel-offer', tok('rec1'))).status, 404);
    assert.equal((await api('POST', '/api/pickups/00000000-0000-4000-8000-000000000000/cancel-offer', tok('prod'))).status, 403);
  });

  test('private producer lists are never served from conditional HTTP cache', async () => {
    const response = await fetch(`${base}/api/producers/pickups`, {
      headers: {
        Authorization: `Bearer ${tok('prod')}`,
        'If-None-Match': 'W/"cached-empty-producer-list"',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('etag'), null);
    assert.match(response.headers.get('cache-control') || '', /private/);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    assert.ok(Array.isArray(await response.json()));
  });

  test('validates the producer input', async () => {
    const res = await api('POST', '/api/producers/pickups', tok('prod'), {
      cerCode: '15 01 10*', quantity: -3, quantityUnit: 'kg', pickupAddress: 'x', deadline: future(2),
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
        cerCode: '15 01 10*', quantity: 10000, quantityUnit: 'kg', pickupAddress: 'Via Industria 14, Milano', deadline: future(10),
      }),
      201
    );
    id = draft.id;
    assert.equal(draft.status, 'draft');
    assert.deepEqual((await api('GET', '/api/recipients/pickups', tok('rec1'))).body, []);
    assert.equal((await api('GET', `/api/producers/pickups/${id}`, tok('prod2'))).status, 404);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/publish`, tok('prod2'))).status, 404);

    await expectOk(api('POST', `/api/producers/pickups/${id}/photos`, tok('prod'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {
      raw: true, contentType: 'image/png', headers: { 'Idempotency-Key': randomUUID(), 'X-File-Name': 'test.png' },
    }), 201);
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

  test('2b. recipients see only what concerns them', async () => {
    const detail = await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec1')));
    assert.equal(detail.stage, 'to_respond');
    assert.match(detail.requestCode, /^WM-\d{4}-[A-Z0-9]{6}$/);
    assert.equal(detail.quantityUnit, 'kg');
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
    assert.match(view.requestCode, /^WM-\d{4}-[A-Z0-9]{6}$/);
    assert.equal(view.maxPrice, undefined);
    assert.equal(view.recipients, undefined, 'recipient offers are not exposed to transporters');
    assert.equal(view.myProposal.unitPrice, null, 'the transporter sees only its own quote');

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
    assert.equal((await producerListItem(id)).actionRequired, true, 'producer must confirm the work is finished');
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

  test('all three selected parties must confirm work completion; retries are idempotent', async () => {
    const path = `/api/pickups/${id}/completion-confirmations`;
    assert.equal((await api('POST', path, tok('prod2'))).status, 404);
    assert.equal((await api('POST', path, tok('rec1'))).status, 404);

    const producerConfirmation = await expectOk(api('POST', path, tok('prod')));
    assert.equal(producerConfirmation.request.status, 'confirmed');
    assert.deepEqual(producerConfirmation.agreement.completion, {
      producer: true, recipient: false, transporter: false,
    });
    assert.equal(producerConfirmation.agreement.actions.canConfirmCompletion, false);

    const recipientConfirmation = await expectOk(api('POST', path, tok('rec2')));
    assert.equal(recipientConfirmation.stage, 'confirmed');
    assert.equal(recipientConfirmation.agreement.completion.recipient, true);
    assert.equal((await producerDetail(id)).request.status, 'confirmed', 'two confirmations do not complete the pickup');

    const completed = await expectOk(api('POST', path, tok('tra2')));
    assert.equal(completed.stage, 'completed');
    assert.deepEqual(completed.agreement.completion, {
      producer: true, recipient: true, transporter: true,
    });
    assert.ok(completed.agreement.completedAt);
    assert.equal((await expectOk(api('POST', path, tok('tra2')))).stage, 'completed');
    assert.equal((await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec2')))).stage, 'completed');
    assert.equal((await expectOk(api('GET', `/api/transporters/pickups/${id}`, tok('tra2')))).stage, 'completed');
    assert.equal((await producerDetail(id)).history.filter((entry) => entry.to === 'completed').length, 1);
    assert.equal((await producerListItem(id)).actionRequired, false);
    assert.equal((await api('POST', `/api/producers/pickups/${id}/cancel`, tok('prod'), { reason: 'not allowed after completion' })).status, 409);
    await assert.rejects(completionMigration.down(), /Cannot roll back completion confirmations/);

    for (const key of ['prod', 'rec2', 'tra2']) {
      assert.ok((await notificationTypes(key, id)).includes('pickup_completed'));
    }
  });
});

describe('step 7: offer withdrawal and timeout continue with remaining packages', () => {
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

  test('recipient cancels its offer: all its packages are removed and the remaining auction continues', async () => {
    const { id, detail } = await toPackagesReady();
    const recipientPackages = detail.packages.filter((pkg) => pkg.recipient.destinationAddress === 'Impianto rec2');
    const selected = recipientPackages[0];
    const otherCancelledPackage = recipientPackages[1];
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${selected.id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: future(4) }), 201);

    assert.equal((await api('POST', `/api/pickups/${id}/cancel-offer`, tok('prod'))).status, 403, 'producer uses withdraw instead');
    assert.equal((await api('POST', `/api/pickups/${id}/cancel-offer`, tok('rec3'))).status, 409);

    const cancelled = await expectOk(api('POST', `/api/pickups/${id}/cancel-offer`, tok('rec2')));
    assert.equal(cancelled.stage, 'closed');
    assert.equal(
      (await expectOk(api('GET', '/api/recipients/pickups', tok('rec2'))))
        .find((item) => item.id === id).rejectedByMe,
      true,
      'the refusing recipient sees the private rejection marker'
    );
    assert.equal(
      (await expectOk(api('GET', '/api/transporters/pickups', tok('tra2'))))
        .find((item) => item.id === id).rejectedByMe,
      false,
      'the other party does not see a rejection marker for the recipient'
    );

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.request.selectedPackageId, null);
    assert.equal(after.agreement, null);
    assert.equal(after.failedPackages.length, 2);
    assert.ok(after.failedPackages.every((pkg) => pkg.failureReason === 'recipient_cancelled'));
    assert.equal(after.packages.length, 2);
    assert.ok(after.packages.every((pkg) => pkg.recipient.destinationAddress === 'Impianto rec1'));
    assert.equal((await api('POST', `/api/producers/pickups/${id}/packages/${otherCancelledPackage.id}/select`, tok('prod'))).status, 404);

    assert.ok((await notificationTypes('prod', id)).includes('package_failed'));
    assert.ok((await notificationTypes('tra2', id)).includes('package_released'));
    assert.ok((await notificationTypes('rec1', id)).includes('package_not_selected'));
    assert.ok((await notificationTypes('tra1', id)).includes('package_not_selected'));
    assert.equal((await notificationTypes('rec2', id)).includes('package_released'), false, 'the cancelling party is not notified of its own cancellation');

    // the producer picks another package and completes the flow
    const replacement = after.packages[0];
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${replacement.id}/select`, tok('prod')));
    const slotDate = future(7);
    const proposed = await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: slotDate }), 201);
    const slotId = proposed.agreement.activeSlot.id;
    const replacementRecord = await PickupPackage.findByPk(replacement.id);
    const recKey = replacementRecord.recipientId === people.rec1.id ? 'rec1' : 'rec2';
    const traKey = replacementRecord.transporterId === people.tra1.id ? 'tra1' : 'tra2';
    await expectOk(api('POST', `/api/pickups/${id}/slots/${slotId}/accept`, tok(recKey)));
    await expectOk(api('POST', `/api/pickups/${id}/slots/${slotId}/accept`, tok(traKey)));
    assert.equal((await producerDetail(id)).request.status, 'confirmed');
  });

  test('transporter refuses', async () => {
    const { id, detail } = await toPackagesReady();
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${detail.packages[0].id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/cancel-offer`, tok('tra2')));
    assert.equal(
      (await expectOk(api('GET', '/api/transporters/pickups', tok('tra2'))))
        .find((item) => item.id === id).rejectedByMe,
      true
    );
    assert.equal(
      (await expectOk(api('GET', '/api/recipients/pickups', tok('rec2'))))
        .find((item) => item.id === id).rejectedByMe,
      false
    );
    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.failedPackages[0].failureReason, 'transporter_cancelled');
    assert.ok((await notificationTypes('rec2', id)).includes('package_released'));
  });

  test('a non-selected offer can be cancelled during agreement and the selected package returns to the auction', async () => {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    await available('rec2', id, 80);
    await unavailable('rec3', id);
    await propose('tra1', id, 300);
    await propose('tra2', id, 250);
    await propose('tra3', id, 350);
    const detail = await producerDetail(id);
    const selected = detail.packages.find((pkg) =>
      pkg.recipient.destinationAddress === 'Impianto rec1'
      && pkg.transportPrice === 250
    );
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${selected.id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: future(4) }), 201);

    await expectOk(api('POST', `/api/pickups/${id}/cancel-offer`, tok('tra1')));

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.request.selectedPackageId, null);
    assert.ok(after.packages.some((pkg) => pkg.id === selected.id), 'the active agreement package is selectable again');
    assert.ok(after.failedPackages.every((pkg) => pkg.transportPrice === 300));
    assert.ok((await notificationTypes('tra3', id)).includes('auction_reopened'));
  });

  test('two simultaneous transporter withdrawals both remove their offers and preserve the third bidder', async () => {
    const id = await newPublishedRequest();
    await available('rec1', id, 100);
    await available('rec2', id, 80);
    await unavailable('rec3', id);
    await propose('tra1', id, 300);
    await propose('tra2', id, 250);
    await propose('tra3', id, 350);
    const ready = await producerDetail(id);
    assert.equal(ready.request.status, 'packages_ready');

    const results = await Promise.all([
      api('POST', `/api/pickups/${id}/cancel-offer`, tok('tra1')),
      api('POST', `/api/pickups/${id}/cancel-offer`, tok('tra2')),
    ]);
    assert.deepEqual(results.map((result) => result.status), [200, 200]);

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.packages.length, 2);
    const remaining = await PickupPackage.findAll({
      where: { pickupRequestId: id, status: 'proposed' },
    });
    assert.ok(remaining.every((pkg) => pkg.transporterId === people.tra3.id));
    assert.equal(after.packages[0].rank, 1);
    assert.equal(after.packages[1].rank, 2);
  });

  test('an offer cancellation racing the agreement deadline is serialized and leaves the other offers available', async () => {
    const { id, detail } = await toPackagesReady();
    const selected = detail.packages.find((pkg) => pkg.recipient.destinationAddress === 'Impianto rec2');
    const selectedRecord = await PickupPackage.findByPk(selected.id);
    await expectOk(api('POST', `/api/producers/pickups/${id}/packages/${selected.id}/select`, tok('prod')));
    await expectOk(api('POST', `/api/pickups/${id}/slots`, tok('prod'), { scheduledAt: future(4) }), 201);
    await PickupRequest.update({ agreementDeadline: new Date(Date.now() - 1000) }, { where: { id } });

    const recipientKey = selectedRecord.recipientId === people.rec1.id ? 'rec1' : 'rec2';
    const [cancelResult] = await Promise.all([
      api('POST', `/api/pickups/${id}/cancel-offer`, tok(recipientKey)),
      workflow.expireStaleAgreements(),
    ]);
    assert.ok([200, 409].includes(cancelResult.status));

    const after = await producerDetail(id);
    assert.equal(after.request.status, 'packages_ready');
    assert.equal(after.request.selectedPackageId, null);
    assert.ok(after.packages.length > 0);
    const cancelledAvailability = await RecipientAvailability.findOne({
      where: { pickupRequestId: id, recipientId: selectedRecord.recipientId },
    });
    assert.equal(cancelledAvailability.status, 'unavailable');
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
    await expectOk(api('POST', `/api/pickups/${id}/cancel-offer`, tok('tra1')));
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
        cerCode: '20 01 01', quantity: 1000, quantityUnit: 'kg', pickupAddress: 'Via A', deadline: future(3),
      }),
      201
    );
    const edited = await expectOk(api('PATCH', `/api/producers/pickups/${draft.id}`, tok('prod'), { quantity: 2000 }));
    assert.equal(edited.quantity, 2000);
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/photos`, tok('prod'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {
      raw: true, contentType: 'image/png', headers: { 'Idempotency-Key': randomUUID(), 'X-File-Name': 'test.png' },
    }), 201);
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok('prod')));
    const revisionKey = randomUUID();
    const revision = await expectOk(api('PATCH', `/api/producers/pickups/${draft.id}`, tok('prod'), { quantity: 3000, idempotencyKey: revisionKey }));
    assert.equal(revision.status, 'draft');
    assert.equal(revision.quantity, 3000);
    assert.equal(revision.supersedesId, draft.id);
    assert.equal((await PickupRequest.findByPk(draft.id)).supersededById, revision.id);
    assert.equal((await producerDetail(draft.id)).request.status, 'cancelled');
    const retried = await expectOk(api('PATCH', `/api/producers/pickups/${draft.id}`, tok('prod'), { quantity: 3000, idempotencyKey: revisionKey }));
    assert.equal(retried.id, revision.id, 'retry returns the same revision');
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
        cerKnown: false, cerCode: '', quantity: 3000, quantityUnit: 'kg', pickupAddress: 'Via CER 1', deadline: future(9),
        wasteDescription: 'Residui da classificare',
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
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/photos`, tok('prod'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {
      raw: true, contentType: 'image/png', headers: { 'Idempotency-Key': randomUUID(), 'X-File-Name': 'test.png' },
    }), 201);
    await expectOk(api('POST', `/api/producers/pickups/${draft.id}/publish`, tok('prod')));
    assert.equal((await producerDetail(draft.id)).request.status, 'awaiting_recipients');
  });

  test('pricing units and per-km transport are converted into comparable package prices', async () => {
    const id = await newPublishedRequest('prod', { pickupLat: 45, pickupLng: 9, pickupPlaceId: 'producer-place' });
    const liters = await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec1'), {
      available: true, quantityUnit: 'liter', unitPrice: 0.1, destinationAddress: 'Impianto litri',
    });
    assert.equal(liters.status, 400);
    assert.match(liters.body.message, /richiede una tariffa in kg/);
    assert.equal((await RecipientAvailability.findOne({ where: { pickupRequestId: id, recipientId: people.rec1.id } })).status, 'pending');
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec1'), {
      available: true, quantityUnit: 'kg', unitPrice: 0.09, destinationAddress: 'Impianto kg',
      destinationLat: 45.5, destinationLng: 9.5, destinationPlaceId: 'recipient-one-place',
      quantityTolerancePercent: 2, availabilityWindow: 'Lun-Ven',
    })).status, 200);
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec2'), {
      available: true, quantityUnit: 'bogus', unitPrice: 1, destinationAddress: 'x',
    })).status, 400);
    assert.equal((await api('POST', `/api/recipients/pickups/${id}/availability`, tok('rec2'), {
      available: true, quantityUnit: 'kg', unitPrice: 0.08, destinationAddress: 'Impianto kg due',
      destinationLat: 46, destinationLng: 10, destinationPlaceId: 'recipient-two-place',
    })).status, 200);

    const originalFetch = global.fetch;
    const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    let matrixCalls = 0;
    process.env.GOOGLE_MAPS_API_KEY = 'test-routes-key';
    global.fetch = async (url, options) => {
      if (String(url).startsWith('https://routes.googleapis.com/')) {
        matrixCalls += 1;
        const request = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => request.destinations.map((destination, destinationIndex) => ({
            originIndex: 0,
            destinationIndex,
            distanceMeters: destination.waypoint.location.latLng.latitude === 45.5 ? 100000 : 200000,
            condition: 'ROUTE_EXISTS',
          })),
        };
      }
      return originalFetch(url, options);
    };
    try {
      await unavailable('rec3', id);
    } finally {
      global.fetch = originalFetch;
      if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
      else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    }

    assert.equal(matrixCalls, 1, 'one route matrix is requested when the transporter phase opens');
    const availabilities = await RecipientAvailability.findAll({ where: { pickupRequestId: id, status: 'available' } });
    const firstDestination = availabilities.find((availability) => availability.recipientId === people.rec1.id);
    const secondDestination = availabilities.find((availability) => availability.recipientId === people.rec2.id);
    assert.equal(firstDestination.roadDistanceMeters, 100000);
    assert.equal(secondDestination.roadDistanceMeters, 200000);

    const transporterOffers = [
      { recipientAvailabilityId: firstDestination.id, pricingMode: 'per_km', unitPrice: 2.5, distanceKm: 1 },
      { recipientAvailabilityId: secondDestination.id, pricingMode: 'fixed_trip', unitPrice: 100 },
    ];
    assert.equal((await api('POST', `/api/transporters/pickups/${id}/proposal`, tok('tra1'), {
      offers: transporterOffers.slice(0, 1),
    })).status, 400, 'every available destination requires one offer');
    assert.equal((await api('POST', `/api/transporters/pickups/${id}/proposal`, tok('tra1'), {
      offers: transporterOffers, vehicleType: 'ADR Truck', availabilityNote: 'Domani',
    })).status, 200);
    await decline('tra2', id);
    await decline('tra3', id);

    const detail = await producerDetail(id);
    assert.equal(detail.request.status, 'packages_ready');
    assert.equal(detail.packages.length, 2);
    const perKmPackage = detail.packages.find((pkg) => pkg.recipient.destinationAddress === 'Impianto kg');
    const fixedPackage = detail.packages.find((pkg) => pkg.recipient.destinationAddress === 'Impianto kg due');
    assert.equal(perKmPackage.treatmentPrice, 900);
    assert.equal(perKmPackage.transportPrice, 250);
    assert.equal(perKmPackage.totalPrice, 1150);
    assert.equal(perKmPackage.transporter.distanceKm, 100);
    assert.equal(fixedPackage.treatmentPrice, 800);
    assert.equal(fixedPackage.transportPrice, 100);
    assert.equal(fixedPackage.totalPrice, 900);
    assert.equal(detail.recipients.find((recipient) => recipient.id === firstDestination.id).availabilityWindow, 'Lun-Ven');

    const transporterDetail = await expectOk(api('GET', `/api/transporters/pickups/${id}`, tok('tra1')));
    assert.equal(transporterDetail.destinations.length, 2);
    assert.equal(transporterDetail.destinations.find((destination) => destination.id === firstDestination.id).roadDistanceMeters, 100000);
    assert.equal(transporterDetail.myProposal.offers.length, 2);
  });

  describe('unavailable general capacity settings', () => {
    test('never reports a successful save for unimplemented settings', async () => {
      for (const route of ['/api/recipients/pricing', '/api/recipients/capacity']) {
        const response = await api('POST', route, tok('rec1'), { cerCode: '15 01 10*', quantityUnit: 'kg', unitPrice: 0.1, availableSlots: 10 });
        assert.equal(response.status, 501);
        assert.match(response.body.message, /non.*disponibil/);
        assert.equal((await api('POST', route, tok('tra1'), {})).status, 403);
      }
    });
  });

  test('recurring orders can be repeated as a new published request', async () => {
    const draft = await expectOk(
      api('POST', '/api/producers/pickups', tok('prod'), {
        cerCode: '15 01 10*', quantity: 4000, quantityUnit: 'kg', pickupAddress: 'Via Ricorrente 5', deadline: future(8),
        recurring: true, recurrenceFrequency: 'monthly', recurrenceStartDate: '2026-11-01', recurrenceEndDate: '2027-05-01',
        wasteDescription: 'Imballaggi', containment: 'Big bag',
      }),
      201
    );
    await PickupRequest.update({ status: 'confirmed' }, { where: { id: draft.id } });
    const list = await expectOk(api('GET', '/api/producers/pickups/recurring', tok('prod')));
    assert.ok(list.some((r) => r.id === draft.id));
    assert.equal((await api('GET', '/api/producers/pickups/recurring', tok('prod2'))).body.some((r) => r.id === draft.id), false);

    const path = `/api/producers/pickups/${draft.id}/repeat`;
    assert.equal((await api('POST', path, tok('prod'), { quantity: 5000, deadline: future(20), idempotencyKey: randomUUID() })).status, 400, 'stable data must be confirmed');
    assert.equal((await api('POST', path, tok('prod'), { confirmStableData: true, quantity: 5000, idempotencyKey: randomUUID() })).status, 400);
    assert.equal((await api('POST', path, tok('prod2'), { confirmStableData: true, quantity: 5000, deadline: future(20), idempotencyKey: randomUUID() })).status, 404);

    const idempotencyKey = randomUUID();
    const copy = await expectOk(
      api('POST', path, tok('prod'), { confirmStableData: true, quantity: 5000, deadline: future(20), idempotencyKey }),
      201
    );
    const retry = await expectOk(api('POST', path, tok('prod'), {
      confirmStableData: true, quantity: 5000, deadline: future(20), idempotencyKey,
    }), 201);
    assert.equal(retry.id, copy.id, 'repeating the request with the same key is idempotent');
    assert.notEqual(copy.id, draft.id);
    assert.notEqual(copy.requestCode, draft.requestCode);
    assert.match(copy.requestCode, /^WM-\d{4}-[A-Z0-9]{6}$/);
    assert.equal(copy.recurring, false);
    assert.equal(copy.containment, 'Big bag');
    assert.equal(copy.status, 'draft');
    await expectOk(api('POST', `/api/producers/pickups/${copy.id}/photos`, tok('prod'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {
      raw: true, contentType: 'image/png', headers: { 'Idempotency-Key': randomUUID(), 'X-File-Name': 'repeat.png' },
    }), 201);
    await expectOk(api('POST', `/api/producers/pickups/${copy.id}/publish`, tok('prod')));
    assert.equal((await producerDetail(copy.id)).request.status, 'awaiting_recipients');
  });

  test('recipients and transporters see the waste dossier and photo references, not photo bytes', async () => {
    const id = await newPublishedRequest('prod', { wasteDescription: 'Solventi esausti', containment: 'Fusti', specialInfo: 'ADR' });
    const view = await expectOk(api('GET', `/api/recipients/pickups/${id}`, tok('rec1')));
    assert.equal(view.wasteDescription, 'Solventi esausti');
    assert.equal(view.containment, 'Fusti');
    assert.equal(view.photos.length, 1);
    assert.equal(view.photoData, undefined);
    assert.equal(view.maxPrice, undefined);
    const list = await expectOk(api('GET', '/api/recipients/pickups', tok('rec1')));
    assert.equal(list.find((r) => r.id === id).photos.length, 1);
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
