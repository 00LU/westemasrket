import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementNextStep, filterPickups, notificationPickupPath, operatorNextStep, producerNextStep } from '../src/services/pickupGuidance.js';

test('notifications target the exact pickup using only supported role routes', () => {
  for (const role of ['producer', 'recipient', 'transporter']) {
    assert.equal(notificationPickupPath(role, 'pickup-123'), `/${role}/pickups/pickup-123`);
  }
  assert.equal(notificationPickupPath('admin', 'pickup-123'), null);
  assert.equal(notificationPickupPath('producer', null), null);
  assert.equal(notificationPickupPath('recipient', 'a/b'), '/recipient/pickups/a%2Fb');
});

test('agreement guidance distinguishes initial proposal, own response and waiting', () => {
  const initial = { activeSlot: null };
  assert.match(agreementNextStep(initial, 'producer'), /tocca a te.*proponi/);
  for (const role of ['recipient', 'transporter']) {
    assert.match(agreementNextStep(initial, role), /Produttore.*proporre/);
  }
  const agreement = { activeSlot: { accepted: { producer: true, recipient: false, transporter: true } } };
  assert.match(agreementNextStep(agreement, 'recipient'), /tocca a te.*accetta/);
  assert.match(agreementNextStep(agreement, 'producer'), /Hai accettato.*Destinatario/);
  assert.match(agreementNextStep(agreement, 'transporter'), /Hai accettato.*Destinatario/);
  const counterproposal = { activeSlot: { accepted: { producer: false, recipient: true, transporter: false } } };
  assert.match(agreementNextStep(counterproposal, 'producer'), /tocca a te/);
  assert.match(agreementNextStep(counterproposal, 'recipient'), /Produttore, Trasportatore/);
});

test('producer guidance covers every state, including unknown CER and optional early closure', () => {
  assert.match(producerNextStep({ status: 'draft', cerKnown: false }), /amministratore/);
  assert.match(producerNextStep({ status: 'draft', cerKnown: true }), /pubblica/);
  const counts = { recipientsAvailable: 0, recipientsPending: 3, proposalsSubmitted: 0, transportersInvited: 2 };
  assert.match(producerNextStep({ status: 'awaiting_recipients', counts }), /solo dopo almeno una/);
  assert.match(producerNextStep({ status: 'awaiting_recipients', counts: { ...counts, recipientsAvailable: 1 } }), /chiudere/);
  assert.match(producerNextStep({ status: 'awaiting_transporters', counts }), /attesa delle proposte/);
  assert.match(producerNextStep({ status: 'awaiting_transporters', counts: { ...counts, proposalsSubmitted: 1 } }), /confrontare/);
  assert.match(producerNextStep({ status: 'packages_ready' }), /scegli/);
  assert.match(producerNextStep({ status: 'in_agreement', pendingAgreementRoles: ['producer'] }), /tocca a te/);
  assert.match(producerNextStep({ status: 'in_agreement', pendingAgreementRoles: ['recipient'] }), /attesa di: Destinatario/);
  assert.match(producerNextStep({ status: 'confirmed', confirmedSlotAt: '2026-12-01T10:00:00Z' }), /Tutti hanno accettato/);
  assert.match(producerNextStep({ status: 'cancelled' }), /Non sono richieste/);
});

test('operator guidance explains the next step for every request stage', () => {
  assert.match(operatorNextStep('to_respond', 'recipient'), /disponibilità/);
  assert.match(operatorNextStep('to_respond', 'transporter'), /tariffe/);
  assert.match(operatorNextStep('responded', 'recipient'), /Disponibilità inviata.*produttore/);
  assert.match(operatorNextStep('responded', 'transporter'), /Proposta inviata.*produttore/);
  assert.match(operatorNextStep('in_agreement', 'recipient'), /giorno e orario/);
  assert.match(operatorNextStep('confirmed', 'transporter'), /terminato il tuo lavoro/);
  assert.match(operatorNextStep('completed', 'recipient'), /tutte le parti/);
  assert.match(operatorNextStep('closed', 'transporter'), /Non sono richieste/);
  assert.match(operatorNextStep('cancelled', 'recipient'), /annullata/);
  assert.match(operatorNextStep('waiting', 'recipient'), /Nessuna azione richiesta/);
});

test('opportunity filters preserve all states and combine search with status', () => {
  const items = ['to_respond', 'responded', 'waiting', 'in_agreement', 'confirmed', 'closed', 'cancelled']
    .map((stage, index) => ({ id: index, stage, requestCode: `WM-2026-A7K2P${index}`, cerCode: index ? '16 01 03' : '15 01 10*', pickupAddress: 'Milano', wasteDescription: 'Solventi' }));
  assert.equal(filterPickups(items, 'all', '').length, 7);
  assert.equal(filterPickups(items, 'action', '').length, 1);
  for (const filter of ['waiting', 'agreement', 'closed']) assert.equal(filterPickups(items, filter, '').length, 2);
  assert.equal(filterPickups(items, 'action', '  MILANO ').length, 1);
  assert.equal(filterPickups(items, 'action', '16 01').length, 0);
  assert.equal(filterPickups(items, 'all', 'solventi').length, 7);
  assert.equal(filterPickups(items, 'action', 'WM-2026-A7K2P0').length, 1);
});
