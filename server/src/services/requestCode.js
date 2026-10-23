const { randomInt } = require('crypto');

const REQUEST_CODE_INDEX = 'pickup_requests_request_code_uq';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRequestCode(date = new Date()) {
  let suffix = '';
  for (let index = 0; index < 6; index += 1) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `WM-${date.getUTCFullYear()}-${suffix}`;
}

module.exports = { generateRequestCode, REQUEST_CODE_INDEX };
