function buildCombinations({ request, offers = [], bids = [] }) {
  const combinations = [];

  for (const offer of offers) {
    for (const bid of bids) {
      const transportCost = Number(bid.transportPrice || 0);
      const treatmentCost = Number(offer.pricePerTon || 0) * Number(request.quantityTon || 0);
      const platformFee = Math.round((transportCost + treatmentCost) * 0.02 * 100) / 100;
      const finalPrice = Math.round((transportCost + treatmentCost + platformFee) * 100) / 100;
      const operationalFit = calculateOperationalFit({ offer, bid });

      combinations.push({
        id: `${bid.id}:${offer.id}`,
        wasteRequestId: request.id,
        bidId: bid.id,
        recipientOfferId: offer.id,
        transporterId: bid.transporterId,
        recipientId: offer.recipientId,
        transportCost,
        treatmentCost,
        platformFee,
        finalPrice,
        operationalFit,
        bestPrice: false,
        bestOperationalFit: false,
        warnings: getWarnings({ request, offer, bid }),
      });
    }
  }

  const cheapest = combinations.reduce((best, item) => (!best || item.finalPrice < best.finalPrice ? item : best), null);
  const bestFit = combinations.reduce((best, item) => (!best || item.operationalFit > best.operationalFit ? item : best), null);
  if (cheapest) cheapest.bestPrice = true;
  if (bestFit) bestFit.bestOperationalFit = true;

  return combinations.sort((first, second) => first.finalPrice - second.finalPrice);
}

function calculateOperationalFit({ offer, bid }) {
  let score = 0.5;
  if (offer.availabilityWindow) score += 0.2;
  if (bid.availability) score += 0.2;
  if (offer.availabilityStatus === 'available') score += 0.1;
  return Math.min(score, 1);
}

function getWarnings({ request, offer, bid }) {
  const warnings = [];
  if (!offer.availabilityWindow) warnings.push('Disponibilita destinatario non indicata');
  if (!bid.availability) warnings.push('Disponibilita trasportatore non indicata');
  if (Number(offer.availableCapacityTon || 0) < Number(request.quantityTon || 0)) warnings.push('Capacita destinatario potenzialmente insufficiente');
  if (Number(bid.transportPrice || 0) <= 0) warnings.push('Prezzo trasporto da verificare');
  return warnings;
}

module.exports = { buildCombinations };
