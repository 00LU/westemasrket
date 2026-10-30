const { DataTypes, QueryTypes } = require('sequelize');
const { randomUUID } = require('crypto');
const sequelize = require('../config/db');

const schema = process.env.DB_SCHEMA;
const qi = sequelize.getQueryInterface();
const tableRef = (name) => (schema ? { tableName: name, schema } : name);
const quoteTable = (name) => qi.queryGenerator.quoteTable(tableRef(name));
const quoteIndexTable = (name) => schema
  ? qi.queryGenerator.quoteTable({ tableName: name, schema })
  : qi.quoteIdentifier(name);

function isOfferPairIndex(index) {
  if (!index.unique) return false;
  const fields = index.fields.map((field) => field.attribute || field.field || field.name);
  return fields.length === 2
    && ['transport_proposal_id', 'transportProposalId'].includes(fields[0])
    && ['recipient_availability_id', 'recipientAvailabilityId'].includes(fields[1]);
}

async function up() {
  await sequelize.transaction(async (transaction) => {
    const availabilityColumns = await qi.describeTable(tableRef('recipient_availabilities'), { transaction });
    if (!availabilityColumns.road_distance_meters) {
      await qi.addColumn(tableRef('recipient_availabilities'), 'road_distance_meters', {
        type: DataTypes.INTEGER,
        allowNull: true,
      }, { transaction });
    }

    if (!(await qi.tableExists(tableRef('transport_proposal_offers')))) {
      await qi.createTable(tableRef('transport_proposal_offers'), {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        transport_proposal_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: tableRef('transport_proposals'), key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        recipient_availability_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: tableRef('recipient_availabilities'), key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        pricing_mode: { type: DataTypes.STRING, allowNull: false },
        unit_price: { type: DataTypes.FLOAT, allowNull: false },
        distance_km: { type: DataTypes.FLOAT, allowNull: true },
        price: { type: DataTypes.FLOAT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });
    }

    const existingIndexes = await qi.showIndex(tableRef('transport_proposal_offers'), { transaction });
    const hasOfferUniqueness = existingIndexes.some(isOfferPairIndex);
    if (!hasOfferUniqueness) {
      await qi.addIndex(tableRef('transport_proposal_offers'), ['transport_proposal_id', 'recipient_availability_id'], {
        name: 'transport_proposal_offers_proposal_availability_unique',
        unique: true,
        transaction,
      });
    }

    const duplicateIndexes = existingIndexes.filter((index) =>
      isOfferPairIndex(index) && index.name !== 'transport_proposal_offers_proposal_availability_unique');
    for (const index of duplicateIndexes) {
      const [constraints] = await sequelize.query(
        `SELECT conname FROM pg_constraint WHERE conindid = (
          SELECT relation.oid
          FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE relation.relname = :indexName
            AND namespace.nspname = :schemaName
        )`,
        {
          replacements: {
            indexName: index.name,
            schemaName: schema || 'public',
          },
          transaction,
        }
      );
      if (constraints.length > 0) {
        throw new Error(`Refusing to remove unique index ${index.name} because it backs a database constraint.`);
      }
      await sequelize.query(`DROP INDEX ${quoteIndexTable(index.name)}`, { transaction });
    }

    const legacyOffers = await sequelize.query(
      `SELECT tp.id AS transport_proposal_id,
              ra.id AS recipient_availability_id,
              COALESCE(tp.pricing_mode, 'fixed_trip') AS pricing_mode,
              COALESCE(tp.unit_price, tp.price) AS unit_price,
              tp.distance_km AS distance_km,
              tp.price AS price
       FROM ${quoteTable('transport_proposals')} tp
       JOIN ${quoteTable('recipient_availabilities')} ra
         ON ra.pickup_request_id = tp.pickup_request_id
        AND ra.status = 'available'
       WHERE tp.status = 'submitted'
         AND tp.price IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ${quoteTable('transport_proposal_offers')} existing
           WHERE existing.transport_proposal_id = tp.id
             AND existing.recipient_availability_id = ra.id
         )`,
      { type: QueryTypes.SELECT, transaction }
    );

    const now = new Date();
    for (let offset = 0; offset < legacyOffers.length; offset += 500) {
      await qi.bulkInsert(
        tableRef('transport_proposal_offers'),
        legacyOffers.slice(offset, offset + 500).map((offer) => ({
          id: randomUUID(),
          ...offer,
          created_at: now,
          updated_at: now,
        })),
        { transaction }
      );
    }
  });
}

async function down() {
  await sequelize.transaction(async (transaction) => {
    const cachedDistances = await sequelize.query(
      `SELECT COUNT(*)::integer AS count
       FROM ${quoteTable('recipient_availabilities')}
       WHERE road_distance_meters IS NOT NULL`,
      { type: QueryTypes.SELECT, transaction }
    );
    if (cachedDistances[0].count > 0) {
      throw new Error('Cannot roll back road distances while cached road distance data exists.');
    }

    const unrepresentableOffers = await sequelize.query(
      `SELECT tp.id
       FROM ${quoteTable('transport_proposals')} tp
       LEFT JOIN ${quoteTable('transport_proposal_offers')} offer
         ON offer.transport_proposal_id = tp.id
       WHERE tp.status = 'submitted'
       GROUP BY tp.id, tp.pickup_request_id
       HAVING COUNT(offer.id) <> (
                SELECT COUNT(*)
                FROM ${quoteTable('recipient_availabilities')} ra
                WHERE ra.pickup_request_id = tp.pickup_request_id
                  AND ra.status = 'available'
              )
           OR COUNT(DISTINCT (
                offer.pricing_mode,
                offer.unit_price,
                offer.distance_km,
                offer.price
              )) > 1`,
      { type: QueryTypes.SELECT, transaction }
    );
    if (unrepresentableOffers.length > 0) {
      throw new Error('Cannot roll back: some transporters have different offers per recipient and the old schema cannot represent them.');
    }

    await sequelize.query(
      `UPDATE ${quoteTable('transport_proposals')} tp
       SET pricing_mode = offer.pricing_mode,
           unit_price = offer.unit_price,
           distance_km = offer.distance_km,
           price = offer.price
       FROM ${quoteTable('transport_proposal_offers')} offer
       WHERE offer.transport_proposal_id = tp.id`,
      { transaction }
    );
    if (await qi.tableExists(tableRef('transport_proposal_offers'))) {
      await qi.dropTable(tableRef('transport_proposal_offers'), { transaction });
    }
    const availabilityColumns = await qi.describeTable(tableRef('recipient_availabilities'), { transaction });
    if (availabilityColumns.road_distance_meters) {
      await qi.removeColumn(tableRef('recipient_availabilities'), 'road_distance_meters', { transaction });
    }
  });
}

module.exports = { up, down };
