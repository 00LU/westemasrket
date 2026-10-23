const sequelize = require('../config/db');
const { Op } = require('sequelize');
const PickupRequest = require('../models/PickupRequest');
const RecipientAvailability = require('../models/RecipientAvailability');
const TransportProposal = require('../models/TransportProposal');
const { generateRequestCode, REQUEST_CODE_INDEX } = require('./requestCode');

// sync() creates tables but does not add columns to installations of the earlier pickup flow.
async function ensurePickupColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const additions = [
    [PickupRequest, [
      'requestCode', 'cerKnown', 'cerRequestNote', 'wasteDescription', 'photoFileName', 'photoData',
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
          const definition = attribute === 'requestCode'
            ? { type, allowNull: true }
            : { type, allowNull, defaultValue };
          await queryInterface.addColumn(table, field, definition, { transaction });
        }
      }
    }

    const requestTable = PickupRequest.getTableName();
    const requestCodeField = PickupRequest.rawAttributes.requestCode.field;
    const existingCodes = await PickupRequest.findAll({
      where: { requestCode: { [Op.not]: null } },
      attributes: ['requestCode'],
      transaction,
    });
    const usedCodes = new Set(existingCodes.map((request) => request.requestCode));
    const missingCodes = await PickupRequest.findAll({
      where: { requestCode: null },
      attributes: ['id'],
      transaction,
    });
    for (const request of missingCodes) {
      let requestCode;
      do {
        requestCode = generateRequestCode();
      } while (usedCodes.has(requestCode));
      usedCodes.add(requestCode);
      await request.update({ requestCode }, { transaction });
    }

    const { type } = PickupRequest.rawAttributes.requestCode;
    await queryInterface.changeColumn(requestTable, requestCodeField, { type, allowNull: false }, { transaction });
    const indexes = await queryInterface.showIndex(requestTable, { transaction });
    if (!indexes.some((index) => index.name === REQUEST_CODE_INDEX)) {
      await queryInterface.addIndex(requestTable, ['request_code'], {
        name: REQUEST_CODE_INDEX,
        unique: true,
        transaction,
      });
    }
  });
}

module.exports = { ensurePickupColumns };
