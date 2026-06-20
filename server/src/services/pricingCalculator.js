const BASE_RATE_BY_CATEGORY = {
  hazardous: 220,
  non_hazardous: 120,
};

function calculateSuggestedRange({ hazardous = false, quantityTon = 0, distanceKm = 0, urgency = 'normal' }) {
  const baseRate = hazardous ? BASE_RATE_BY_CATEGORY.hazardous : BASE_RATE_BY_CATEGORY.non_hazardous;
  const urgencyMultiplier = urgency === 'urgent' ? 1.35 : 1;
  const base = baseRate * quantityTon;
  const distance = distanceKm * 2.2;
  const estimate = (base + distance) * urgencyMultiplier;

  return {
    min: Math.round(estimate * 0.92),
    max: Math.round(estimate * 1.12),
    meta: { baseRate, urgencyMultiplier },
  };
}

module.exports = {
  calculateSuggestedRange,
};
