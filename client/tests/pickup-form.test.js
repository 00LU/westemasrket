import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PICKUP_FORM_DEFAULTS, pickupFormErrors, pickupToForm } from '../src/services/pickupForm.js';

const valid = () => ({
  ...PICKUP_FORM_DEFAULTS, cerCode: '15 01 10*', quantity: '2500',
  pickupAddress: 'Via Test 1', deadline: '2099-12-01',
});

test('new requests have no preselected operational data or fake estimate', () => {
  for (const field of ['cerCode', 'quantity', 'pickupAddress', 'deadline']) assert.equal(PICKUP_FORM_DEFAULTS[field], '');
  assert.equal(PICKUP_FORM_DEFAULTS.quantityUnit, 'kg');
  assert.equal('distanceKm' in PICKUP_FORM_DEFAULTS, false);
  assert.equal('urgency' in PICKUP_FORM_DEFAULTS, false);
  assert.deepEqual(Object.keys(pickupFormErrors(PICKUP_FORM_DEFAULTS)).sort(), ['cerCode', 'deadline', 'pickupAddress', 'quantity']);
});

test('request validation supports unknown CER, rejects invalid numbers, dates and recurrence', () => {
  assert.deepEqual(pickupFormErrors(valid()), {});
  assert.deepEqual(pickupFormErrors({ ...valid(), cerKnown: false, cerCode: '' }), {});
  for (const value of ['0', '-1', 'Infinity', 'x']) assert.ok(pickupFormErrors({ ...valid(), quantity: value }).quantity);
  assert.ok(pickupFormErrors({ ...valid(), quantityUnit: 'ton' }).quantityUnit);
  for (const value of ['', '2000-01-01', 'not-date']) assert.ok(pickupFormErrors({ ...valid(), deadline: value }).deadline);
  assert.ok(pickupFormErrors({ ...valid(), recurring: true }).recurrenceStartDate);
  assert.ok(pickupFormErrors({ ...valid(), recurring: true, recurrenceStartDate: '2099-12-02', recurrenceEndDate: '2099-12-01' }).recurrenceEndDate);
});

test('editing preserves dossier, unknown CER and local date from the existing request', () => {
  const request = { ...valid(), deadline: new Date(2099, 11, 1, 23, 59).toISOString(), cerKnown: false, cerCode: 'UNKNOWN', photos: [{ id: 'photo-id', fileName: 'photo.jpg' }] };
  const form = pickupToForm(request);
  assert.equal(form.deadline, '2099-12-01');
  assert.equal(form.cerCode, '');
  assert.equal(form.quantity, '2500');
  assert.equal(form.quantityUnit, 'kg');
  assert.equal('photos' in form, false);
});
