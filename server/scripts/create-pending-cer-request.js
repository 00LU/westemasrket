require('dotenv').config();
const sequelize = require('../src/config/db');
const { initModels, User, WasteRequest } = require('../src/models');

async function main() {
  initModels();
  await sequelize.authenticate();
  await sequelize.sync();
  const producer = await User.findOne({ where: { email: 'demo.producer@wastemarket.local' } });
  if (!producer) throw new Error('Demo producer not found');

  const existing = await WasteRequest.findOne({ where: { producerId: producer.id, cerKnown: false } });
  const request = existing || await WasteRequest.create({
    producerId: producer.id,
    cerCode: 'UNKNOWN',
    cerKnown: false,
    wasteDescription: 'Miscela di residui da processo produttivo da classificare',
    photoFileName: 'cer-recognition-demo.jpg',
    photoData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    technicalDocuments: 'analisi-chimica-demo.pdf',
    containment: 'Fusti omologati',
    specialInfo: 'Richiesta analisi Admin prima della pubblicazione',
    quantityTon: 3,
    pickupAddress: 'Via Demo CER 20, Milano',
    pickupLat: 45.4642,
    pickupLng: 9.19,
    deadline: new Date(Date.now() + 7 * 86400000),
    maxPrice: 750,
    status: 'draft',
    cerRequestNote: 'Richiesta proposta CER all\'intermediario',
  });

  console.log(JSON.stringify({ message: 'Pending CER request ready', orderId: request.id, status: request.status, cerKnown: request.cerKnown }, null, 2));
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
