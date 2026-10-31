import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

test('the compact description is separate from operational details and photos', () => {
  const headline = render({ part: 'headline' });
  const details = render({ part: 'details' });
  assert.ok(headline.includes(pickup.wasteDescription));
  assert.ok(!headline.includes(pickup.specialInfo));
  assert.ok(!headline.includes(pickup.pickupAddress));
  assert.ok(details.includes(pickup.specialInfo));
  assert.ok(details.includes(pickup.pickupAddress));
  assert.ok(!details.includes(pickup.wasteDescription));
});

test('every role keeps the current phase first and the selected package in a responsive compact box', async () => {
  const { default: ProducerPickupPage } = await server.ssrLoadModule('/src/pages/producer/ProducerPickupPage.jsx');
  const { default: OperatorPickupPage } = await server.ssrLoadModule('/src/pages/shared/OperatorPickupPage.jsx');
  const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const scenarios = [
    { stage: 'in_agreement', activeSlot: null, section: 'accordo', actionable: false },
    { stage: 'in_agreement', accepted: false, section: 'accordo', actionable: true },
    { stage: 'in_agreement', accepted: true, section: 'accordo', actionable: false },
    { stage: 'confirmed', section: 'accordo', actionable: true },
    { stage: 'confirmed', finished: true, section: 'accordo', actionable: false },
    { stage: 'completed', finished: true, section: 'accordo', actionable: false },
  ];
  for (const role of ['producer', 'recipient', 'transporter']) {
    const roleScenarios = role === 'producer'
      ? [
          { stage: 'awaiting_recipients', section: 'destinatari' },
          { stage: 'awaiting_transporters', section: 'proposte' },
          { stage: 'packages_ready', section: 'pacchetti' },
          ...scenarios,
        ]
      : [{ stage: 'to_respond', canRespond: true, section: 'risposta' }, ...scenarios];
    for (const scenario of roleScenarios) {
      const { stage, section } = scenario;
      const inAgreement = ['in_agreement', 'confirmed', 'completed'].includes(stage);
      const agreement = inAgreement ? {
        activeSlot: scenario.activeSlot === null ? null : {
          id: 'slot-1',
          scheduledAt: '2026-11-10T09:00:00Z',
          accepted: { producer: false, recipient: false, transporter: false, [role]: !!scenario.accepted },
        },
        actions: {
          canProposeSlot: stage === 'in_agreement' && (role === 'producer' || scenario.activeSlot !== null),
          canAccept: stage === 'in_agreement' && !scenario.accepted && scenario.activeSlot !== null,
          canConfirmCompletion: stage === 'confirmed' && !scenario.finished,
        },
        parties: { producer: { companyName: 'Produttore test' }, recipient: { companyName: 'Destinatario test' }, transporter: { companyName: 'Trasportatore test' } },
        pricing: { totalPrice: 100 },
        completion: { producer: false, recipient: false, transporter: false, [role]: !!scenario.finished },
        confirmedSlotAt: '2026-11-10T09:00:00Z',
      } : null;
      const item = {
        ...pickup, id: 'request-1', status: stage, stage, agreement,
        canRespond: !!scenario.canRespond, cerKnown: true,
        myResponse: { status: 'pending' }, myProposal: { status: 'invited', offers: [] },
        destinations: [{ id: 'destination-1', address: 'Sede test', roadDistanceMeters: 10000 }],
      };
      const client = new QueryClient();
      client.setQueryData([role, 'pickup', item.id], role === 'producer' ? {
        request: item, agreement,
        currentPackage: inAgreement ? {
          id: 'package-1', rank: 1, totalPrice: 100, treatmentPrice: 60, transportPrice: 40,
          recipient: { companyName: 'Destinatario test', destinationAddress: 'Sede scelta', unitPrice: 0.05, quantityUnit: 'kg' },
          transporter: { companyName: 'Trasportatore test', vehicleType: 'ADR Truck', availabilityNote: 'Entro 48 ore' },
        } : null,
        recipients: [{ id: 'recipient-1', status: 'pending' }],
        proposals: [{ id: 'proposal-1', status: 'invited' }],
        packages: [], failedPackages: [], history: [],
      } : item);
      const originalWindow = globalThis.window;
      try {
        for (const wide of [false, true]) {
          globalThis.window = { matchMedia: () => ({ matches: wide }) };
          const page = role === 'producer'
            ? createElement(ProducerPickupPage)
            : createElement(OperatorPickupPage, { role });
          const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
            createElement(MemoryRouter, { initialEntries: [`/${role}/pickups/${item.id}`] },
              createElement(AuthProvider, null,
                createElement(Routes, null,
                  createElement(Route, { path: '/:role/pickups/:id', element: page }))))));
          const ids = [...html.matchAll(/\bid="(riepilogo|dettagli|accordo|risposta|destinatari|proposte|pacchetti|pacchetto-scelto)"/g)].map((match) => match[1]);
          const expected = inAgreement && !wide
            ? ['riepilogo', section, 'pacchetto-scelto', 'dettagli']
            : ['riepilogo', section, 'dettagli'];
          assert.deepEqual(ids.slice(0, expected.length), expected, `${role}: ${stage}, accepted=${scenario.accepted}, finished=${scenario.finished}`);
          assert.equal(ids.filter((id) => id === section).length, 1);
          assert.equal(ids.filter((id) => id === 'pacchetto-scelto').length, inAgreement ? 1 : 0);
          assert.ok(html.includes(pickup.specialInfo));
          if (inAgreement) {
            const selectedPackage = html.slice(html.indexOf('id="pacchetto-scelto"'));
            assert.ok(selectedPackage.includes('Destinatario test'));
            assert.ok(selectedPackage.includes('Trasportatore test'));
            const sidebar = html.slice(html.indexOf('<aside aria-label="Riepilogo e avanzamento"'));
            assert.equal(sidebar.includes('id="pacchetto-scelto"'), wide);
            assert.ok(selectedPackage.includes('!p-4'));
            if (wide) {
              assert.ok(sidebar.indexOf('id="pacchetto-scelto"') < sidebar.indexOf('Avanzamento'));
            }
            if (role === 'producer') {
              assert.ok(selectedPackage.includes('Sede scelta'));
              assert.ok(selectedPackage.includes('Entro 48 ore'));
            }
            assert.equal(html.split('Destinatario test').length - 1, 1);
            const actionable = scenario.activeSlot === null ? role === 'producer' : scenario.actionable;
            assert.equal(html.includes('>Conferma fine del tuo lavoro</button>'), stage === 'confirmed' && !scenario.finished);
            assert.equal(html.includes('Vai all’accordo<svg'), stage === 'in_agreement' && actionable);
          }
        }
      } finally {
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
        client.clear();
      }
    }
  }
});
