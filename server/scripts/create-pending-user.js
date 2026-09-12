require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/db');
const { initModels, User, Document } = require('../src/models');

const email = 'demo.pending@wastemarket.local';
const password = 'Pending1234!';
const role = 'transporter';
const documentTypes = ['vehicle_registration', 'driver_license', 'operational_authorization'];
const demoFileData = 'data:application/pdf;base64,JVBERi0xLjQKJURFTU8gRE9DVU1FTlQK';

async function main() {
  initModels();
  await sequelize.authenticate();
  await sequelize.sync();

  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      role,
      companyName: 'Demo Transporter Pending Srl',
      piva: 'DEMO-PENDING-001',
      registeredOffice: 'Via Verifica 10, Milano',
      contactPerson: 'Utente Da Verificare',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      verified: false,
    },
  });
  await user.update({ verified: false });

  for (const documentType of documentTypes) {
    const [document] = await Document.findOrCreate({
      where: { userId: user.id, documentType },
      defaults: {
        fileName: `${documentType}-pending.pdf`,
        mimeType: 'application/pdf',
        fileSize: 100000,
        fileData: demoFileData,
        status: 'pending_review',
        notes: 'Documento demo in attesa di revisione Admin',
      },
    });
    await document.update({ fileData: demoFileData, status: 'pending_review' });
  }

  console.log(JSON.stringify({
    message: 'Pending demo user ready',
    email,
    password,
    role,
    verified: user.verified,
    documents: documentTypes,
  }, null, 2));
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
