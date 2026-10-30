const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { DataTypes, QueryTypes } = require("sequelize");
const sequelize = require("../config/db");
const PickupPhoto = require("../models/PickupPhoto");
const { getPhotoDirectory, getPhotoPath } = require("../services/photoStorage");
const {
  generateRequestCode,
  REQUEST_CODE_INDEX,
} = require("../services/requestCode");

const schema = process.env.DB_SCHEMA;
const qi = sequelize.getQueryInterface();
const tableRef = (name) => (schema ? { tableName: name, schema } : name);
const quoteTable = (name) => qi.queryGenerator.quoteTable(tableRef(name));
const quoteColumn = (name) => qi.quoteIdentifier(name);

async function columns(table, transaction) {
  return qi.describeTable(tableRef(table), { transaction });
}

async function addColumnIfMissing(table, column, definition, transaction) {
  const known = await columns(table, transaction);
  if (!known[column])
    await qi.addColumn(tableRef(table), column, definition, { transaction });
}

async function ensureFeatureTables(transaction) {
  if (!(await qi.tableExists(tableRef("production_sites")))) {
    await qi.createTable(
      tableRef("production_sites"),
      {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: tableRef("users"), key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        label: { type: DataTypes.STRING, allowNull: true },
        address_formatted: { type: DataTypes.STRING, allowNull: false },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lng: { type: DataTypes.FLOAT, allowNull: true },
        place_id: { type: DataTypes.STRING, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
  }
  if (!(await qi.tableExists(tableRef("pickup_photos")))) {
    await qi.createTable(
      tableRef("pickup_photos"),
      {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        pickup_request_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: tableRef("pickup_requests"), key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        storage_key: { type: DataTypes.STRING, allowNull: false },
        idempotency_key: { type: DataTypes.UUID, allowNull: true },
        file_name: { type: DataTypes.STRING, allowNull: false },
        mime_type: { type: DataTypes.STRING, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
  }
  await addColumnIfMissing(
    "pickup_photos",
    "idempotency_key",
    { type: DataTypes.UUID, allowNull: true },
    transaction,
  );

  const productionSiteIndexes = await qi.showIndex(
    tableRef("production_sites"),
    { transaction },
  );
  if (
    !productionSiteIndexes.some(
      (index) => index.name === "production_sites_user_id",
    )
  ) {
    await qi.addIndex(tableRef("production_sites"), ["user_id"], {
      name: "production_sites_user_id",
      transaction,
    });
  }
  const photoIndexes = await qi.showIndex(tableRef("pickup_photos"), {
    transaction,
  });
  if (
    !photoIndexes.some(
      (index) => index.name === "pickup_photos_pickup_request_id_created_at",
    )
  ) {
    await qi.addIndex(
      tableRef("pickup_photos"),
      ["pickup_request_id", "created_at"],
      {
        name: "pickup_photos_pickup_request_id_created_at",
        transaction,
      },
    );
  }
  if (
    !photoIndexes.some(
      (index) =>
        index.name === "pickup_photos_pickup_request_id_idempotency_key",
    )
  ) {
    await qi.addIndex(
      tableRef("pickup_photos"),
      ["pickup_request_id", "idempotency_key"],
      {
        name: "pickup_photos_pickup_request_id_idempotency_key",
        unique: true,
        transaction,
      },
    );
  }
}

async function snapshot(table, column, transaction) {
  const known = await columns(table, transaction);
  if (!known[column]) return false;
  await sequelize.query(
    `INSERT INTO ${quoteTable("area_a_legacy_values")} (entity, row_id, column_name, value)
     SELECT :table, id::text, :column, to_jsonb(${quoteColumn(column)})
     FROM ${quoteTable(table)} WHERE ${quoteColumn(column)} IS NOT NULL`,
    { replacements: { table, column }, transaction },
  );
  return true;
}

async function dropLegacyColumn(table, column, transaction) {
  if (table === "pickup_requests" && column === "photo_data") {
    const known = await columns(table, transaction);
    if (known[column])
      await qi.removeColumn(tableRef(table), column, { transaction });
    return;
  }
  if (await snapshot(table, column, transaction)) {
    await qi.removeColumn(tableRef(table), column, { transaction });
  }
}

function decodeImage(value) {
  const match = String(value).match(
    /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/,
  );
  if (!match)
    throw new Error(
      "Dati immagine legacy non validi: migrazione interrotta senza eliminare la colonna sorgente",
    );
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

async function migrateLegacyPhotos(transaction, createdStorageKeys) {
  const requestColumns = await columns("pickup_requests", transaction);
  if (!requestColumns.photo_data) return;
  const fileNameColumn = requestColumns.photo_file_name
    ? "photo_file_name"
    : null;
  const rows = await sequelize.query(
    `SELECT id, photo_data${fileNameColumn ? ", photo_file_name" : ""} FROM ${quoteTable("pickup_requests")} WHERE photo_data IS NOT NULL`,
    { type: QueryTypes.SELECT, transaction },
  );
  await fs.mkdir(getPhotoDirectory(), { recursive: true });
  for (const row of rows) {
    const { mimeType, bytes } = decodeImage(row.photo_data);
    if (bytes.length === 0)
      throw new Error(`Foto legacy vuota per la richiesta ${row.id}`);
    const extension =
      {
        "image/png": ".png",
        "image/webp": ".webp",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/heic": ".heic",
      }[mimeType] || ".img";
    const storageKey = `${randomUUID()}${extension}`;
    await fs.writeFile(path.join(getPhotoDirectory(), storageKey), bytes, {
      flag: "wx",
    });
    createdStorageKeys.push(storageKey);
    await PickupPhoto.create(
      {
        pickupRequestId: row.id,
        storageKey,
        fileName: path.basename(row.photo_file_name || `foto${extension}`),
        mimeType,
      },
      { transaction },
    );
  }
}

function siteAddress(item) {
  if (typeof item === "string") {
    return {
      addressFormatted: item.trim(),
      label: null,
      lat: null,
      lng: null,
      placeId: null,
    };
  }
  if (!item || typeof item !== "object") return null;
  const addressFormatted = String(
    item.addressFormatted || item.address || item.formattedAddress || "",
  ).trim();
  return addressFormatted
    ? {
        addressFormatted,
        label: item.label ? String(item.label) : null,
        lat: Number.isFinite(Number(item.lat ?? item.latitude))
          ? Number(item.lat ?? item.latitude)
          : null,
        lng: Number.isFinite(Number(item.lng ?? item.longitude))
          ? Number(item.lng ?? item.longitude)
          : null,
        placeId: item.placeId || item.place_id || null,
      }
    : null;
}

async function migrateProductionSites(transaction) {
  const userColumns = await columns("users", transaction);
  if (!userColumns.production_sites) return;
  const users = await sequelize.query(
    `SELECT id, production_sites FROM ${quoteTable("users")} WHERE production_sites IS NOT NULL AND production_sites <> ''`,
    { type: QueryTypes.SELECT, transaction },
  );
  for (const user of users) {
    let values;
    try {
      values = JSON.parse(user.production_sites);
    } catch {
      values = [user.production_sites];
    }
    if (!Array.isArray(values)) values = [values];
    for (const value of values) {
      const site = siteAddress(value);
      if (!site) continue;
      await sequelize.query(
        `INSERT INTO ${quoteTable("production_sites")}
         (id, user_id, label, address_formatted, lat, lng, place_id, created_at, updated_at)
         VALUES (:id, :userId, :label, :address, :lat, :lng, :placeId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        {
          replacements: {
            id: randomUUID(),
            userId: user.id,
            label: site.label,
            address: site.addressFormatted,
            lat: site.lat,
            lng: site.lng,
            placeId: site.placeId,
          },
          transaction,
        },
      );
    }
  }
}

async function up() {
  const createdStorageKeys = [];
  try {
    await sequelize.transaction(async (transaction) => {
      await ensureFeatureTables(transaction);

      if (!(await qi.tableExists(tableRef("area_a_legacy_values")))) {
        await qi.createTable(
          tableRef("area_a_legacy_values"),
          {
            entity: { type: DataTypes.STRING, allowNull: false },
            row_id: { type: DataTypes.STRING, allowNull: false },
            column_name: { type: DataTypes.STRING, allowNull: false },
            value: { type: DataTypes.JSONB, allowNull: false },
          },
          { transaction },
        );
        await qi.addConstraint(tableRef("area_a_legacy_values"), {
          fields: ["entity", "row_id", "column_name"],
          type: "primary key",
          name: "area_a_legacy_values_pkey",
          transaction,
        });
      }

      await migrateProductionSites(transaction);
      await migrateLegacyPhotos(transaction, createdStorageKeys);

      const userFields = {
        registered_office: DataTypes.STRING,
        registered_office_lat: DataTypes.FLOAT,
        registered_office_lng: DataTypes.FLOAT,
        registered_office_place_id: DataTypes.STRING,
        contact_person: DataTypes.STRING,
        phone: DataTypes.STRING,
        transport_authorizations: DataTypes.TEXT,
        vehicle_fleet: DataTypes.TEXT,
        drivers: DataTypes.TEXT,
        operating_regions: DataTypes.TEXT,
        facilities: DataTypes.TEXT,
        site_authorizations: DataTypes.TEXT,
        cer_codes: DataTypes.TEXT,
        rd_operations: DataTypes.TEXT,
        operational_limitations: DataTypes.TEXT,
        commercial_preferences: DataTypes.TEXT,
      };
      for (const [column, type] of Object.entries(userFields)) {
        await addColumnIfMissing(
          "users",
          column,
          { type, allowNull: true },
          transaction,
        );
      }

      const requestFields = {
        request_code: DataTypes.STRING(14),
        cer_known: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        cer_request_note: DataTypes.TEXT,
        waste_description: DataTypes.TEXT,
        technical_documents: DataTypes.TEXT,
        containment: DataTypes.TEXT,
        special_info: DataTypes.TEXT,
        recurring: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        recurrence_frequency: DataTypes.STRING,
        recurrence_start_date: DataTypes.DATEONLY,
        recurrence_end_date: DataTypes.DATEONLY,
        quantity: DataTypes.FLOAT,
        quantity_unit: DataTypes.STRING,
        pickup_lat: DataTypes.FLOAT,
        pickup_lng: DataTypes.FLOAT,
        pickup_place_id: DataTypes.STRING,
        production_site_id: DataTypes.UUID,
        idempotency_key: DataTypes.UUID,
        supersedes_id: DataTypes.UUID,
        superseded_by_id: DataTypes.UUID,
      };
      for (const [column, type] of Object.entries(requestFields)) {
        await addColumnIfMissing(
          "pickup_requests",
          column,
          { type, allowNull: true },
          transaction,
        );
      }

      const pickupColumns = await columns("pickup_requests", transaction);
      if (pickupColumns.quantity_ton) {
        await sequelize.query(
          `UPDATE ${quoteTable("pickup_requests")} SET quantity = quantity_ton * 1000, quantity_unit = 'kg' WHERE quantity IS NULL`,
          { transaction },
        );
      }
      await sequelize.query(
        `UPDATE ${quoteTable("pickup_requests")} SET quantity_unit = 'kg' WHERE quantity_unit IS NULL`,
        { transaction },
      );
      await qi.changeColumn(
        tableRef("pickup_requests"),
        "quantity",
        { type: DataTypes.FLOAT, allowNull: false },
        { transaction },
      );
      await qi.changeColumn(
        tableRef("pickup_requests"),
        "quantity_unit",
        { type: DataTypes.STRING, allowNull: false, defaultValue: "kg" },
        { transaction },
      );

      const requestCodes = await sequelize.query(
        `SELECT id FROM ${quoteTable("pickup_requests")} WHERE request_code IS NULL`,
        { type: QueryTypes.SELECT, transaction },
      );
      const codeRows = await sequelize.query(
        `SELECT request_code FROM ${quoteTable("pickup_requests")} WHERE request_code IS NOT NULL`,
        { type: QueryTypes.SELECT, transaction },
      );
      const usedCodes = new Set(codeRows.map((row) => row.request_code));
      for (const { id } of requestCodes) {
        let requestCode;
        do {
          requestCode = generateRequestCode();
        } while (usedCodes.has(requestCode));
        usedCodes.add(requestCode);
        await sequelize.query(
          `UPDATE ${quoteTable("pickup_requests")} SET request_code = :code WHERE id = :id`,
          { replacements: { code: requestCode, id }, transaction },
        );
      }
      await qi.changeColumn(
        tableRef("pickup_requests"),
        "request_code",
        { type: DataTypes.STRING(14), allowNull: false },
        { transaction },
      );

      const availabilityFields = {
        unit_price: DataTypes.FLOAT,
        quantity_tolerance_percent: DataTypes.FLOAT,
        availability_window: DataTypes.STRING,
        destination_lat: DataTypes.FLOAT,
        destination_lng: DataTypes.FLOAT,
        destination_place_id: DataTypes.STRING,
        notes: DataTypes.TEXT,
        responded_at: DataTypes.DATE,
      };
      for (const [column, type] of Object.entries(availabilityFields)) {
        await addColumnIfMissing(
          "recipient_availabilities",
          column,
          { type, allowNull: true },
          transaction,
        );
      }
      const availabilityColumns = await columns(
        "recipient_availabilities",
        transaction,
      );
      if (availabilityColumns.price_per_ton) {
        await sequelize.query(
          `UPDATE ${quoteTable("recipient_availabilities")} SET unit_price = price_per_ton / 1000 WHERE unit_price IS NULL`,
          { transaction },
        );
      }
      await addColumnIfMissing(
        "transport_proposals",
        "pricing_mode",
        { type: DataTypes.STRING, allowNull: true },
        transaction,
      );
      await addColumnIfMissing(
        "transport_proposals",
        "unit_price",
        { type: DataTypes.FLOAT, allowNull: true },
        transaction,
      );
      await addColumnIfMissing(
        "transport_proposals",
        "distance_km",
        { type: DataTypes.FLOAT, allowNull: true },
        transaction,
      );
      await addColumnIfMissing(
        "documents",
        "file_data",
        { type: DataTypes.TEXT, allowNull: true },
        transaction,
      );

      for (const column of ["production_sites", "intermediary_documents"]) {
        await dropLegacyColumn("users", column, transaction);
      }
      for (const column of [
        "quantity_ton",
        "max_price",
        "photo_data",
        "photo_file_name",
      ]) {
        await dropLegacyColumn("pickup_requests", column, transaction);
      }
      for (const column of [
        "price_per_ton",
        "pricing_unit",
        "available_capacity_ton",
      ]) {
        await dropLegacyColumn("recipient_availabilities", column, transaction);
      }

      const indexes = await qi.showIndex(tableRef("pickup_requests"), {
        transaction,
      });
      if (!indexes.some((index) => index.name === REQUEST_CODE_INDEX)) {
        await qi.addIndex(tableRef("pickup_requests"), ["request_code"], {
          name: REQUEST_CODE_INDEX,
          unique: true,
          transaction,
        });
      }
      if (
        !indexes.some(
          (index) =>
            index.name === "pickup_requests_producer_id_idempotency_key",
        )
      ) {
        await qi.addIndex(
          tableRef("pickup_requests"),
          ["producer_id", "idempotency_key"],
          {
            name: "pickup_requests_producer_id_idempotency_key",
            unique: true,
            transaction,
          },
        );
      }
    });
  } catch (error) {
    for (const storageKey of createdStorageKeys) {
      try {
        await fs.unlink(getPhotoPath(storageKey));
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error(
            "Unable to remove a photo from the rolled-back migration",
            cleanupError,
          );
        }
      }
    }
    throw error;
  }
}

async function down() {
  const requestColumns = await columns("pickup_requests");
  if (requestColumns.quantity_unit) {
    const [literRequests] = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM ${quoteTable("pickup_requests")} WHERE quantity_unit = 'liter'`,
    );
    if (literRequests[0].count > 0) {
      throw new Error(
        "Rollback impossibile: esistono richieste in litri, non convertibili in tonnellate senza densità verificata.",
      );
    }
  }
  const photoRows = await sequelize.query(
    `SELECT pickup_request_id, COUNT(*)::int AS count FROM ${quoteTable("pickup_photos")} GROUP BY pickup_request_id HAVING COUNT(*) > 1`,
  );
  if (photoRows[0].length > 0) {
    throw new Error(
      "Rollback impossibile: almeno una richiesta contiene più foto, non rappresentabili nel vecchio schema.",
    );
  }
  const photosToRestore = await sequelize.query(
    `SELECT pickup_request_id, storage_key, file_name, mime_type FROM ${quoteTable("pickup_photos")}`,
    { type: QueryTypes.SELECT },
  );

  await sequelize.transaction(async (transaction) => {
    const siteRows = await sequelize.query(
      `SELECT user_id, label, address_formatted, lat, lng, place_id
       FROM ${quoteTable("production_sites")} ORDER BY created_at`,
      { type: QueryTypes.SELECT, transaction },
    );
    const groupedSites = new Map();
    siteRows.forEach((site) => {
      const items = groupedSites.get(site.user_id) || [];
      items.push({
        label: site.label,
        addressFormatted: site.address_formatted,
        lat: site.lat,
        lng: site.lng,
        placeId: site.place_id,
      });
      groupedSites.set(site.user_id, items);
    });

    const userColumns = await columns("users", transaction);
    if (!userColumns.production_sites) {
      await qi.addColumn(
        tableRef("users"),
        "production_sites",
        { type: DataTypes.TEXT, allowNull: true },
        { transaction },
      );
      for (const [userId, sites] of groupedSites) {
        await sequelize.query(
          `UPDATE ${quoteTable("users")} SET production_sites = :sites WHERE id = :id`,
          {
            replacements: { sites: JSON.stringify(sites), id: userId },
            transaction,
          },
        );
      }
    }
    await qi.addColumn(
      tableRef("users"),
      "intermediary_documents",
      { type: DataTypes.TEXT, allowNull: true },
      { transaction },
    );

    const pickupNow = await columns("pickup_requests", transaction);
    if (!pickupNow.quantity_ton) {
      await qi.addColumn(
        tableRef("pickup_requests"),
        "quantity_ton",
        { type: DataTypes.FLOAT, allowNull: true },
        { transaction },
      );
      await sequelize.query(
        `UPDATE ${quoteTable("pickup_requests")} SET quantity_ton = quantity / 1000`,
        { transaction },
      );
    }
    await qi.addColumn(
      tableRef("pickup_requests"),
      "max_price",
      { type: DataTypes.FLOAT, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      tableRef("pickup_requests"),
      "photo_data",
      { type: DataTypes.TEXT, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      tableRef("pickup_requests"),
      "photo_file_name",
      { type: DataTypes.STRING, allowNull: true },
      { transaction },
    );
    for (const photo of photosToRestore) {
      const data = `data:${photo.mime_type};base64,${(await fs.readFile(getPhotoPath(photo.storage_key))).toString("base64")}`;
      await sequelize.query(
        `UPDATE ${quoteTable("pickup_requests")} SET photo_data = :data, photo_file_name = :fileName WHERE id = :id`,
        {
          replacements: {
            data,
            fileName: photo.file_name,
            id: photo.pickup_request_id,
          },
          transaction,
        },
      );
    }
    await qi.addColumn(
      tableRef("recipient_availabilities"),
      "price_per_ton",
      { type: DataTypes.FLOAT, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      tableRef("recipient_availabilities"),
      "pricing_unit",
      { type: DataTypes.STRING, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      tableRef("recipient_availabilities"),
      "available_capacity_ton",
      { type: DataTypes.FLOAT, allowNull: true },
      { transaction },
    );
    await sequelize.query(
      `UPDATE ${quoteTable("recipient_availabilities")} SET price_per_ton = unit_price * 1000, pricing_unit = 'per_ton'`,
      { transaction },
    );

    const snapshots = await sequelize.query(
      `SELECT entity, row_id, column_name, value #>> '{}' AS value
       FROM ${quoteTable("area_a_legacy_values")}`,
      { type: QueryTypes.SELECT, transaction },
    );
    for (const saved of snapshots) {
      const target =
        saved.entity === "users"
          ? "users"
          : saved.entity === "pickup_requests"
            ? "pickup_requests"
            : saved.entity === "recipient_availabilities"
              ? "recipient_availabilities"
              : null;
      if (!target) continue;
      const targetColumns = await columns(target, transaction);
      if (!targetColumns[saved.column_name]) {
        const type =
          saved.column_name === "quantity_ton" ||
          saved.column_name === "max_price" ||
          saved.column_name === "price_per_ton" ||
          saved.column_name === "available_capacity_ton"
            ? DataTypes.FLOAT
            : saved.column_name === "photo_file_name"
              ? DataTypes.STRING
              : DataTypes.TEXT;
        await qi.addColumn(
          tableRef(target),
          saved.column_name,
          { type, allowNull: true },
          { transaction },
        );
      }
      await sequelize.query(
        `UPDATE ${quoteTable(target)} SET ${quoteColumn(saved.column_name)} = :value WHERE id::text = :id`,
        { replacements: { value: saved.value, id: saved.row_id }, transaction },
      );
    }

    const indexes = await qi.showIndex(tableRef("pickup_requests"), {
      transaction,
    });
    for (const name of [
      "pickup_requests_producer_id_idempotency_key",
      REQUEST_CODE_INDEX,
    ]) {
      if (indexes.some((index) => index.name === name)) {
        await qi.removeIndex(tableRef("pickup_requests"), name, {
          transaction,
        });
      }
    }
    await qi.dropTable(tableRef("pickup_photos"), { transaction });
    const removeFields = {
      users: [
        "registered_office_lat",
        "registered_office_lng",
        "registered_office_place_id",
      ],
      pickup_requests: [
        "quantity",
        "quantity_unit",
        "pickup_lat",
        "pickup_lng",
        "pickup_place_id",
        "production_site_id",
        "idempotency_key",
        "supersedes_id",
        "superseded_by_id",
      ],
      recipient_availabilities: [
        "destination_lat",
        "destination_lng",
        "destination_place_id",
      ],
    };
    for (const [table, fields] of Object.entries(removeFields)) {
      const known = await columns(table, transaction);
      for (const field of fields)
        if (known[field])
          await qi.removeColumn(tableRef(table), field, { transaction });
    }
    await qi.dropTable(tableRef("production_sites"), { transaction });
    await qi.dropTable(tableRef("area_a_legacy_values"), { transaction });
  });
}

module.exports = { up, down };
