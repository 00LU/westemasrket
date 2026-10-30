const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'production';
const app = require('../server/src/app');
let server;
let origin;
let index;

before(async () => {
  index = await readFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'), 'utf8');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('production serves the frontend and React Router deep links', async () => {
  for (const route of ['/', '/login', '/producer/pickups/request-1']) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(await response.text(), index);
  }
});

test('production serves the compiled JavaScript', async () => {
  const asset = index.match(/src="([^"]+\.js)"/);
  assert.ok(asset, 'The frontend build must reference a JavaScript asset');
  const response = await fetch(`${origin}${asset[1]}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
});

test('the API still responds as JSON, independently of the frontend', async () => {
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'WasteMarket API' });
});

test('unknown APIs, missing assets and socket paths never fall back to the frontend', async () => {
  for (const route of ['/api/does-not-exist', '/assets/missing.js', '/assets/missing', '/socket.io/missing']) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 404);
    assert.notEqual(await response.text(), index);
  }
});
