require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/db');
const { initModels, User, WasteRequest, Bid, RecipientOffer, Document, Notification, Transaction } = require('../src/models');

const DEMO_EMAILS = [
  'demo.producer@wastemarket.local',
  'demo.transporter@wastemarket.local',
  'demo.recipient@wastemarket.local',
  'demo.admin@wastemarket.local',
];

const password = 'Demo1234!';
const requiredDocuments = {
  producer: ['company_registration', 'operational_photo', 'cer_certificate'],
  transporter: ['vehicle_registration', 'driver_license', 'operational_authorization'],
  recipient: ['facility_registration', 'treatment_authorization', 'cer_capacity_certificate'],
};

const orderStatuses = [
  'draft',
  'recipient_matching',
  'recipient_options_ready',
  'recipient_selected',
  'transporter_matching',
  'package_options_ready',
  'package_selected',
  'assigned',
  'in_execution',
  'delivered',
  'completed',
  'cancelled',
  'expired',
  'active',
  'awarded',
];

async function deleteDemoData(transaction) {
  const users = await User.findAll({ where: { email: DEMO_EMAILS }, attributes: ['id'], transaction });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const producerOrders = await WasteRequest.findAll({ where: { producerId: userIds }, attributes: ['id'], transaction });
  const orderIds = producerOrders.map((order) => order.id);

  await Notification.destroy({ where: { userId: userIds }, transaction });
  await Document.destroy({ where: { userId: userIds }, transaction });
  await Bid.destroy({ where: { transporterId: userIds }, transaction });
  await RecipientOffer.destroy({ where: { recipientId: userIds }, transaction });
  if (orderIds.length > 0) {
    await Transaction.destroy({ where: { wasteRequestId: orderIds }, transaction });
    await Bid.destroy({ where: { wasteRequestId: orderIds }, transaction });
    await RecipientOffer.destroy({ where: { wasteRequestId: orderIds }, transaction });
  }
  await WasteRequest.destroy({ where: { producerId: userIds }, transaction });
  await User.destroy({ where: { id: userIds }, transaction });
}

async function createUser({ role, companyName, piva, email, registeredOffice, contactPerson }, transaction) {
  return User.create({
    role,
    companyName,
    piva,
    email,
    registeredOffice,
    contactPerson,
    pecEmail: `${email.replace('@', '.pec@')}`,
    operationalEmail: email,
    phone: '+39 02 0000000',
    passwordHash: await bcrypt.hash(password, 10),
    verified: true,
    premiumFeaturesEnabled: true,
  }, { transaction });
}

async function createApprovedDocuments(user, transaction) {
  const types = requiredDocuments[user.role] || [];
  await Document.bulkCreate(types.map((documentType) => ({
    userId: user.id,
    documentType,
    fileName: `${documentType}-approved.pdf`,
    mimeType: 'application/pdf',
    fileSize: 120000,
    status: 'approved',
    notes: 'Demo document approved for flow testing',
  })), { transaction });
}

async function main() {
  initModels();
  await sequelize.authenticate();
  await sequelize.sync();
  const transaction = await sequelize.transaction();

  try {
    await deleteDemoData(transaction);

    const producer = await createUser({
      role: 'producer',
      companyName: 'Demo Producer Srl',
      piva: 'DEMO-PRODUCER-001',
      email: DEMO_EMAILS[0],
      registeredOffice: 'Via Demo 1, Milano',
      contactPerson: 'Laura Producer',
    }, transaction);
    const transporter = await createUser({
      role: 'transporter',
      companyName: 'Demo Transporter Srl',
      piva: 'DEMO-TRANSPORTER-001',
      email: DEMO_EMAILS[1],
      registeredOffice: 'Via Demo 2, Milano',
      contactPerson: 'Marco Driver',
    }, transaction);
    const recipient = await createUser({
      role: 'recipient',
      companyName: 'Demo Recipient Impianto',
      piva: 'DEMO-RECIPIENT-001',
      email: DEMO_EMAILS[2],
      registeredOffice: 'Via Demo 3, Monza',
      contactPerson: 'Giulia Plant',
    }, transaction);
    const admin = await createUser({
      role: 'admin',
      companyName: 'Demo WasteMarket Admin',
      piva: 'DEMO-ADMIN-001',
      email: DEMO_EMAILS[3],
      registeredOffice: 'WasteMarket HQ',
      contactPerson: 'Admin Demo',
    }, transaction);

    await Promise.all([
      createApprovedDocuments(producer, transaction),
      createApprovedDocuments(transporter, transaction),
      createApprovedDocuments(recipient, transaction),
    ]);

    const createdOrders = [];
    for (let index = 0; index < orderStatuses.length; index += 1) {
      const status = orderStatuses[index];
      const order = await WasteRequest.create({
        producerId: producer.id,
        cerCode: index % 2 === 0 ? '15 01 10*' : '16 01 03',
        cerKnown: true,
        wasteDescription: `Ordine demo stato ${status}`,
        photoFileName: 'demo-waste.jpg',
        containment: 'Big bag',
        specialInfo: 'Dati demo per verifica workflow',
        quantityTon: 2 + index,
        pickupAddress: `Via Demo ${index + 10}, Milano`,
        pickupLat: 45.4642,
        pickupLng: 9.19,
        deadline: new Date(Date.now() + (index + 1) * 86400000),
        maxPrice: 500 + index * 25,
        status,
        recurring: index === 1,
        recurrenceFrequency: index === 1 ? 'monthly' : null,
        workflowStatus: status === 'completed' ? 'confirmed' : null,
      }, { transaction });

      const recipientOffer = await RecipientOffer.create({
        wasteRequestId: order.id,
        recipientId: recipient.id,
        pricePerTon: 120 + index,
        pricingUnit: 'per_ton',
        availableCapacityTon: 20,
        quantityTolerancePercent: 1,
        availabilityWindow: 'Lun-Ven 08:00-17:00',
        availabilityStatus: 'available',
        destinationAddress: 'Demo Recipient Impianto, Via Demo 3, Monza',
        notes: 'Offerta demo per test',
      }, { transaction });
      const bid = await Bid.create({
        wasteRequestId: order.id,
        transporterId: transporter.id,
        recipientId: recipient.id,
        transportPrice: 180 + index * 10,
        pricingMode: index % 2 === 0 ? 'per_km' : 'fixed_trip',
        distanceKm: 42,
        treatmentPrice: (120 + index) * (2 + index),
        totalPrice: 180 + index * 10 + (120 + index) * (2 + index),
        vehicleType: 'ADR Truck',
        availability: 'Lun-Ven 08:00-17:00',
        status: ['cancelled', 'expired'].includes(status) ? 'rejected' : 'active',
      }, { transaction });

      const selected = ['recipient_selected', 'transporter_matching', 'package_options_ready', 'package_selected', 'assigned', 'in_execution', 'delivered', 'completed'].includes(status);
      if (selected) {
        await order.update({
          selectedRecipientId: recipient.id,
          selectedRecipientOfferId: recipientOffer.id,
          selectedTransporterId: transporter.id,
          selectedBidId: bid.id,
          selectedFinalPrice: bid.totalPrice,
          selectedPlatformFee: Math.round(bid.totalPrice * 0.02 * 100) / 100,
          workflowStatus: status === 'completed' ? 'confirmed' : 'awaiting_operator_confirmation',
          transporterConfirmed: status === 'completed',
          recipientConfirmed: status === 'completed',
        }, { transaction });
      }
      createdOrders.push({ id: order.id, status });
    }

    await Notification.bulkCreate([
      { userId: transporter.id, type: 'demo_orders_available', payloadJson: { count: createdOrders.length }, read: false },
      { userId: recipient.id, type: 'demo_orders_available', payloadJson: { count: createdOrders.length }, read: false },
      { userId: admin.id, type: 'demo_seed_completed', payloadJson: { count: createdOrders.length }, read: false },
    ], { transaction });

    await transaction.commit();
    console.log(JSON.stringify({
      message: 'Demo data seeded',
      credentials: {
        password,
        producer: DEMO_EMAILS[0],
        transporter: DEMO_EMAILS[1],
        recipient: DEMO_EMAILS[2],
        admin: DEMO_EMAILS[3],
      },
      orders: createdOrders,
    }, null, 2));
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
