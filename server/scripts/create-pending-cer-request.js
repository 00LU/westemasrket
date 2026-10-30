require('dotenv').config();
const sequelize = require('../src/config/db');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { initModels, User, PickupRequest, PickupPhoto } = require('../src/models');
const { runMigrations } = require('../src/services/migrationRunner');
const { getPhotoDirectory } = require('../src/services/photoStorage');

async function main() {
  initModels();
  await sequelize.authenticate();
  await sequelize.sync();
  await runMigrations();
  const producer = await User.findOne({ where: { email: 'demo.producer@wastemarket.local' } });
  if (!producer) throw new Error('Demo producer not found');

  const existing = await PickupRequest.findOne({ where: { producerId: producer.id, cerKnown: false } });
  const request = existing || await PickupRequest.create({
    producerId: producer.id,
    cerCode: 'UNKNOWN',
    cerKnown: false,
    wasteDescription: 'Miscela di residui da processo produttivo da classificare',
    technicalDocuments: 'analisi-chimica-demo.pdf',
    containment: 'Fusti omologati',
    specialInfo: 'Richiesta analisi Admin prima della pubblicazione',
    quantity: 3000,
    quantityUnit: 'kg',
    pickupAddress: 'Via Demo CER 20, Milano',
    pickupLat: 45.4642,
    pickupLng: 9.19,
    deadline: new Date(Date.now() + 7 * 86400000),
    status: 'draft',
    cerRequestNote: 'Richiesta proposta CER all\'intermediario',
  });

  if (!existing) {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const storageKey = `${randomUUID()}.png`;
    await fs.mkdir(getPhotoDirectory(), { recursive: true });
    await fs.writeFile(path.join(getPhotoDirectory(), storageKey), bytes, { flag: 'wx' });
    await PickupPhoto.create({
      pickupRequestId: request.id,
      storageKey,
      fileName: 'cer-recognition-demo.png',
      mimeType: 'image/png',
    });
  }

  console.log(JSON.stringify({ message: 'Pending CER request ready', requestCode: request.requestCode, orderId: request.id, status: request.status, cerKnown: request.cerKnown }, null, 2));
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
