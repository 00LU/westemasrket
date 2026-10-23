const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateRequestCode } = require('../src/services/requestCode');

test('generates a short request code with its creation year', () => {
  const code = generateRequestCode(new Date('2026-10-22T12:00:00Z'));
  assert.match(code, /^WM-2026-[A-Z0-9]{6}$/);
});
