const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateSuggestedRange } = require('../src/services/pricingCalculator');

test('pricing estimates accept kilograms and reject liters without a verified density', () => {
  const estimate = calculateSuggestedRange({
    quantity: 1000,
    quantityUnit: 'kg',
    distanceKm: 0,
  });
  assert.deepEqual({ min: estimate.min, max: estimate.max }, { min: 110, max: 134 });
  assert.throws(
    () => calculateSuggestedRange({ quantity: 1000, quantityUnit: 'liter', distanceKm: 0 }),
    /richiede una quantità espressa in kg/
  );
});
