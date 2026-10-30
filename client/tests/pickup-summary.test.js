import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cacheDir = await mkdtemp(join(tmpdir(), 'wastemarket-summary-test-'));
const server = await createServer({
  configFile: false,
  cacheDir,
  optimizeDeps: { noDiscovery: true, include: [] },
  esbuild: { jsx: 'automatic' },
  server: { middlewareMode: true, hmr: false },
});
after(async () => {
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
});
const { default: PickupSummary } = await server.ssrLoadModule('/src/components/shared/PickupSummary.jsx');

const pickup = {
  requestCode: 'WM-2026-TEST01',
  cerCode: '150101',
  quantity: 1200,
  quantityUnit: 'kg',
  pickupAddress: 'Via Roma 10, Milano',
  deadline: '2026-11-12T12:00:00Z',
  wasteDescription: 'Imballaggi in cartone',
  containment: 'Big bag',
  specialInfo: 'Accesso dal cancello B',
  technicalDocuments: 'Analisi materiale.pdf',
  notes: 'Contattare il referente',
};
const render = (props = {}) => renderToStaticMarkup(createElement(PickupSummary, { pickup, ...props }));

test('request details keep every supplied field in clearly labelled groups', () => {
  const html = render();
  for (const field of ['requestCode', 'cerCode', 'pickupAddress', 'wasteDescription', 'containment', 'specialInfo', 'technicalDocuments', 'notes']) {
    assert.ok(html.includes(pickup[field]), `Missing ${field}`);
  }
  for (const label of ['Quantità', 'Codice CER / EER', 'Luogo di ritiro', 'Ritiro entro il', 'Dettagli operativi']) {
    assert.ok(html.includes(label), `Missing label ${label}`);
  }
  assert.match(html, /<dl/);
  assert.match(html, /kg/);
  assert.match(html, /<strong|font-bold/);
});

test('detail summaries can omit the request code already displayed in the heading', () => {
  const html = render({ showCode: false });
  assert.ok(html.includes(pickup.pickupAddress));
  assert.ok(html.includes(pickup.wasteDescription));
  assert.ok(html.includes(pickup.cerCode));
  assert.ok(!html.includes(pickup.requestCode));
  assert.ok(html.includes('Dettagli operativi'));
});

test('a scheduled pickup is distinguished from the original deadline', () => {
  const html = render({ pickup: { ...pickup, confirmedSlotAt: '2026-11-10T09:00:00Z' } });
  assert.ok(html.includes('Ritiro concordato'));
  assert.ok(html.includes('Scadenza richiesta:'));
});

test('missing optional data is explicit and does not create empty sections', () => {
  const html = render({ pickup: { quantity: 10, quantityUnit: 'liter', cerCode: 'UNKNOWN' } });
  assert.ok(html.includes('Da proporre'));
  assert.ok(html.includes('Descrizione non indicata'));
  assert.ok(html.includes('Indirizzo non indicato'));
  assert.ok(!html.includes('Dettagli operativi'));
  assert.ok(!html.includes('Foto del rifiuto'));
});

test('photos and child content remain available in the full summary', () => {
  const html = render({
    pickup: { ...pickup, photos: [{ id: 'photo-1', fileName: 'rifiuto.jpg' }] },
    children: createElement('p', null, 'Informazioni aggiuntive'),
  });
  assert.ok(html.includes('Foto del rifiuto'));
  assert.ok(html.includes('(1)'));
  assert.ok(html.includes('Informazioni aggiuntive'));
});

test('all role lists retain the table, next step and a real detail link', async () => {
  const { default: RequestsPage } = await server.ssrLoadModule('/src/pages/shared/RequestsPage.jsx');
  const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
  for (const role of ['producer', 'recipient', 'transporter']) {
    const client = new QueryClient();
    client.setQueryData([role, 'pickups'], [{
      ...pickup,
      id: 'request-1',
      status: 'draft',
      stage: 'to_respond',
      actionRequired: true,
    }]);
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, null,
          createElement(AuthProvider, null, createElement(RequestsPage, { role })))));
      assert.match(html, /<table/);
      assert.ok(html.includes(`href="/${role}/pickups/request-1"`));
      for (const heading of ['Richiesta', 'Data', 'Indirizzo di ritiro', 'Stato', 'Prossimo passo']) {
        assert.ok(html.includes(`<th class="px-3 py-3">${heading}</th>`));
      }
      assert.ok(html.includes(pickup.requestCode));
      assert.ok(html.includes(pickup.wasteDescription));
      assert.ok(html.includes(pickup.pickupAddress));
      assert.ok(!html.includes('<article'));
      assert.ok(!html.includes('Dettagli operativi'));
    } finally {
      client.clear();
    }
  }
});
