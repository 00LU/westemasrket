const { WorkflowError } = require('./pickupStateMachine');

const ROUTES_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const DESTINATIONS_PER_REQUEST = 100;

function hasCoordinates(value) {
  if (value?.lat == null || value?.lat === '' || value?.lng == null || value?.lng === '') return false;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function distanceUnavailableReason(request, availability) {
  if (availability.roadDistanceMeters != null) return null;
  if (!hasCoordinates({ lat: request.pickupLat, lng: request.pickupLng })
    || !hasCoordinates({ lat: availability.destinationLat, lng: availability.destinationLng })) {
    return 'missing_coordinates';
  }
  if (!process.env.GOOGLE_MAPS_API_KEY) return 'maps_not_configured';
  return 'route_unavailable';
}

async function fetchDistanceMatrix(origin, destinations, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(ROUTES_MATRIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: [{
          waypoint: { location: { latLng: { latitude: Number(origin.lat), longitude: Number(origin.lng) } } },
        }],
        destinations: destinations.map((destination) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: Number(destination.destinationLat),
                longitude: Number(destination.destinationLng),
              },
            },
          },
        })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'Il calcolo delle distanze stradali ha superato il tempo massimo.'
      : 'Impossibile raggiungere il servizio Google Routes API.';
    throw new WorkflowError(message, 503);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new WorkflowError(`Calcolo delle distanze stradali non riuscito (Routes API: ${response.status}).`, 503);
  }
  let matrix;
  try {
    matrix = await response.json();
  } catch {
    throw new WorkflowError('La risposta del servizio Routes API non è leggibile.', 503);
  }
  if (!Array.isArray(matrix)) {
    throw new WorkflowError('La risposta del servizio Routes API non è valida.', 503);
  }
  return matrix;
}

async function cacheRoadDistances(request, availabilities, { transaction } = {}) {
  const uncached = availabilities.filter((availability) =>
    availability.roadDistanceMeters == null
    && hasCoordinates({ lat: request.pickupLat, lng: request.pickupLng })
    && hasCoordinates({ lat: availability.destinationLat, lng: availability.destinationLng }));
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || uncached.length === 0) return;

  const distances = new Map();
  for (let offset = 0; offset < uncached.length; offset += DESTINATIONS_PER_REQUEST) {
    const batch = uncached.slice(offset, offset + DESTINATIONS_PER_REQUEST);
    const matrix = await fetchDistanceMatrix(
      { lat: request.pickupLat, lng: request.pickupLng },
      batch,
      apiKey
    );
    matrix.forEach((element) => {
      const availability = batch[element.destinationIndex];
      if (element.originIndex === 0 && availability && element.condition === 'ROUTE_EXISTS'
        && Number.isFinite(Number(element.distanceMeters)) && Number(element.distanceMeters) >= 0) {
        distances.set(availability.id, Math.round(Number(element.distanceMeters)));
      }
    });
  }

  for (const availability of uncached) {
    const distanceMeters = distances.get(availability.id);
    if (distanceMeters == null) continue;
    await availability.update({ roadDistanceMeters: distanceMeters }, { transaction });
  }
}

module.exports = { cacheRoadDistances, distanceUnavailableReason };
