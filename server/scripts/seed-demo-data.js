require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/db');
const {
  initModels,
  User,
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  PickupPackage,
  SlotProposal,
  PickupStatusHistory,
  Document,
  Notification,
  Transaction,
} = require('../src/models');

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
  'awaiting_recipients',
  'awaiting_transporters',
  'packages_ready',
  'in_agreement',
  'confirmed',
  'cancelled',
];

async function deleteDemoData(transaction) {
  const users = await User.findAll({ where: { email: DEMO_EMAILS }, attributes: ['id'], transaction });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const producerOrders = await PickupRequest.findAll({ where: { producerId: userIds }, attributes: ['id'], transaction });
  const orderIds = producerOrders.map((order) => order.id);

  await Notification.destroy({ where: { userId: userIds }, transaction });
  await Document.destroy({ where: { userId: userIds }, transaction });
  if (orderIds.length > 0) {
    const where = { pickupRequestId: orderIds };
    await Transaction.destroy({ where, transaction });
    await SlotProposal.destroy({ where, transaction });
    await PickupPackage.destroy({ where, transaction });
    await TransportProposal.destroy({ where, transaction });
    await RecipientAvailability.destroy({ where, transaction });
    await PickupStatusHistory.destroy({ where, transaction });
  }
  await PickupRequest.destroy({ where: { producerId: userIds }, transaction });
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
    const at = (days) => new Date(Date.now() + days * 86400000);
    for (let index = 0; index < orderStatuses.length; index += 1) {
      const status = orderStatuses[index];
      const quantityTon = 2 + index;
      const order = await PickupRequest.create({
        producerId: producer.id,
        cerCode: index % 2 === 0 ? '15 01 10*' : '16 01 03',
        cerKnown: true,
        wasteDescription: `Ordine demo stato ${status}`,
        photoFileName: 'demo-waste.jpg',
        containment: 'Big bag',
        specialInfo: 'Dati demo per verifica workflow',
        quantityTon,
        pickupAddress: `Via Demo ${index + 10}, Milano`,
        pickupLat: 45.4642,
        pickupLng: 9.19,
        deadline: at(index + 10),
        maxPrice: 1500 + index * 25,
        status,
        recurring: index === 1,
        recurrenceFrequency: index === 1 ? 'monthly' : null,
        cancelReason: status === 'cancelled' ? 'producer_cancelled' : null,
      }, { transaction });
      await PickupStatusHistory.create({ pickupRequestId: order.id, toStatus: status, actorId: producer.id, note: 'demo seed' }, { transaction });

      // Related records are created only for the phases that have them.
      if (status === 'draft') {
        createdOrders.push({ id: order.id, status });
        continue;
      }

      const pricePerTon = 120 + index;
      const availability = await RecipientAvailability.create({
        pickupRequestId: order.id,
        recipientId: recipient.id,
        status: status === 'awaiting_recipients' ? 'pending' : 'available',
        pricingUnit: 'per_ton',
        unitPrice: pricePerTon,
        pricePerTon,
        availableCapacityTon: 20,
        quantityTolerancePercent: 1,
        availabilityWindow: 'Lun-Ven 08:00-17:00',
        destinationAddress: 'Demo Recipient Impianto, Via Demo 3, Monza',
        notes: 'Disponibilità demo',
        respondedAt: status === 'awaiting_recipients' ? null : new Date(),
      }, { transaction });

      if (['awaiting_recipients', 'cancelled'].includes(status)) {
        createdOrders.push({ id: order.id, status });
        continue;
      }

      const transportPrice = 180 + index * 10;
      const proposal = await TransportProposal.create({
        pickupRequestId: order.id,
        transporterId: transporter.id,
        status: status === 'awaiting_transporters' ? 'invited' : 'submitted',
        pricingMode: 'per_km',
        unitPrice: transportPrice / 42,
        distanceKm: 42,
        price: status === 'awaiting_transporters' ? null : transportPrice,
        vehicleType: 'ADR Truck',
        availabilityNote: 'Lun-Ven 08:00-17:00',
        respondedAt: status === 'awaiting_transporters' ? null : new Date(),
      }, { transaction });

      if (status !== 'awaiting_transporters') {
        const treatmentPrice = pricePerTon * quantityTon;
        const pkg = await PickupPackage.create({
          pickupRequestId: order.id,
          recipientAvailabilityId: availability.id,
          transportProposalId: proposal.id,
          recipientId: recipient.id,
          transporterId: transporter.id,
          treatmentPrice,
          transportPrice,
          totalPrice: treatmentPrice + transportPrice,
          score: treatmentPrice + transportPrice,
          rank: 1,
          status: { packages_ready: 'proposed', in_agreement: 'selected', confirmed: 'confirmed' }[status],
        }, { transaction });

        if (['in_agreement', 'confirmed'].includes(status)) {
          const scheduledAt = at(5);
          await SlotProposal.create({
            pickupRequestId: order.id,
            packageId: pkg.id,
            proposedById: producer.id,
            proposedByRole: 'producer',
            scheduledAt,
            producerAccepted: true,
            recipientAccepted: status === 'confirmed',
            transporterAccepted: status === 'confirmed',
            status: status === 'confirmed' ? 'agreed' : 'active',
          }, { transaction });
          await order.update({
            selectedPackageId: pkg.id,
            agreementDeadline: status === 'in_agreement' ? at(2) : null,
            confirmedSlotAt: status === 'confirmed' ? scheduledAt : null,
          }, { transaction });
          if (status === 'confirmed') {
            await Transaction.create({
              pickupRequestId: order.id,
              packageId: pkg.id,
              platformFee: Math.round(pkg.totalPrice * 0.02 * 100) / 100,
              status: 'open',
            }, { transaction });
          }
        }
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
