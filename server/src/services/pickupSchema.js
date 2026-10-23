const sequelize = require('../config/db');
const PickupRequest = require('../models/PickupRequest');
const RecipientAvailability = require('../models/RecipientAvailability');
const TransportProposal = require('../models/TransportProposal');

// sync() creates tables but does not add columns to installations of the earlier pickup flow.
async function ensurePickupColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const additions = [
    [PickupRequest, [
      'cerKnown', 'cerRequestNote', 'wasteDescription', 'photoFileName', 'photoData',
      'technicalDocuments', 'containment', 'specialInfo', 'recurring',
      'recurrenceFrequency', 'recurrenceStartDate', 'recurrenceEndDate',
    ]],
    [RecipientAvailability, [
      'pricingUnit', 'unitPrice', 'quantityTolerancePercent', 'availabilityWindow',
    ]],
    [TransportProposal, ['pricingMode', 'unitPrice', 'distanceKm']],
  ];

  await sequelize.transaction(async (transaction) => {
    for (const [model, attributes] of additions) {
      const table = model.getTableName();
      const columns = await queryInterface.describeTable(table, { transaction });
      for (const attribute of attributes) {
        const { field, type, allowNull, defaultValue } = model.rawAttributes[attribute];
        if (!columns[field]) {
          await queryInterface.addColumn(table, field, { type, allowNull, defaultValue }, { transaction });
        }
      }
    }
  });
}

module.exports = { ensurePickupColumns };
