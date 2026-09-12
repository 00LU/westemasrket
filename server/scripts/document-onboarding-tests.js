const assert = require('node:assert/strict');

function expectRequiredDocuments() {
  const { REQUIRED_DOCUMENTS } = require('../src/services/documentRequirements');
  assert.ok(REQUIRED_DOCUMENTS && Array.isArray(REQUIRED_DOCUMENTS));
  assert.ok(REQUIRED_DOCUMENTS.length > 0);
}

function expectDocumentModel() {
  const { Document } = require('../src/models');
  assert.ok(Document && typeof Document.findAll === 'function');
}

try {
  expectRequiredDocuments();
  expectDocumentModel();
  console.log('document-onboarding-tests: PASS');
} catch (error) {
  console.error('document-onboarding-tests: FAIL');
  console.error(error.message);
  process.exit(1);
}
