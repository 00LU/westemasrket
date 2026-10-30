const path = require('path');

function getPhotoDirectory() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
}

function getPhotoPath(storageKey) {
  if (path.basename(storageKey) !== storageKey) throw new Error('Percorso foto non valido');
  return path.join(getPhotoDirectory(), storageKey);
}

module.exports = { getPhotoDirectory, getPhotoPath };
