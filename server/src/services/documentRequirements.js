const REQUIRED_DOCUMENTS = {
  producer: [
    'company_registration',
    'operational_photo',
    'cer_certificate',
  ],
  transporter: [
    'vehicle_registration',
    'driver_license',
    'operational_authorization',
  ],
  recipient: [
    'facility_registration',
    'treatment_authorization',
    'cer_capacity_certificate',
  ],
  admin: [],
};

function getRequiredDocumentsForRole(role) {
  return REQUIRED_DOCUMENTS[role] || [];
}

function getMissingDocumentTypes(role, uploadedDocumentTypes = []) {
  const required = getRequiredDocumentsForRole(role);
  const uploadedSet = new Set(uploadedDocumentTypes);
  return required.filter((type) => !uploadedSet.has(type));
}

module.exports = {
  REQUIRED_DOCUMENTS,
  getRequiredDocumentsForRole,
  getMissingDocumentTypes,
};
