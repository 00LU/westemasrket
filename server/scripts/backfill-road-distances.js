require('dotenv').config();
const sequelize = require('../src/config/db');
const { initModels, PickupRequest, RecipientAvailability } = require('../src/models');
const { RECIPIENT_RESPONSE } = require('../src/config/pickupFlow');
const { cacheRoadDistances } = require('../src/services/roadDistanceService');

// One-off backfill for recipient availabilities whose road distance was never cached
// (e.g. because GOOGLE_MAPS_API_KEY was missing/misconfigured when the transporter
// phase opened). Safe to re-run: cacheRoadDistances skips availabilities that already
// have a roadDistanceMeters value.
async function main() {
  initModels();
  await sequelize.authenticate();

  const availabilities = await RecipientAvailability.findAll({
    where: { status: RECIPIENT_RESPONSE.AVAILABLE, roadDistanceMeters: null },
  });

  const byRequestId = new Map();
  for (const availability of availabilities) {
    const list = byRequestId.get(availability.pickupRequestId) || [];
    list.push(availability);
    byRequestId.set(availability.pickupRequestId, list);
  }

  console.log(`Trovate ${availabilities.length} disponibilità senza distanza, su ${byRequestId.size} richieste.`);

  for (const [pickupRequestId, group] of byRequestId) {
    const request = await PickupRequest.findByPk(pickupRequestId);
    if (!request) continue;
    const before = group.filter((a) => a.roadDistanceMeters == null).length;
    await cacheRoadDistances(request, group);
    await Promise.all(group.map((a) => a.reload()));
    const after = group.filter((a) => a.roadDistanceMeters == null).length;
    console.log(`Richiesta ${request.requestCode}: ${before - after}/${before} distanze calcolate.`);
  }
}

main()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error('Backfill fallito', error);
    await sequelize.close();
    process.exitCode = 1;
  });
