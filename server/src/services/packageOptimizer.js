// Package ranking. This is the ONLY place that decides what "best" means.
//
// A package is { treatmentPrice, transportPrice, totalPrice, recipient, proposal, request }.
// A strategy returns a numeric score: LOWER IS BETTER.
//
// To move to a mixed criterion (price + distance + time), add a strategy to STRATEGIES
// (e.g. `weighted`) and select it with PACKAGE_OPTIMIZATION_STRATEGY; nothing else changes.

const STRATEGIES = {
  lowest_price: (pkg) => pkg.totalPrice,
};

function resolveStrategy(name) {
  const strategy = STRATEGIES[name];
  if (!strategy) {
    throw new Error(`Unknown package optimization strategy: ${name}`);
  }
  return strategy;
}

function computeScore(pkg, strategyName) {
  return resolveStrategy(strategyName)(pkg);
}

// Returns the packages sorted best-first with `score` and a 1-based `rank`.
// Ties are broken by transport price, then by treatment price, so ordering is deterministic.
function rankPackages(packages, strategyName) {
  return packages
    .map((pkg) => ({ ...pkg, score: computeScore(pkg, strategyName) }))
    .sort(
      (a, b) =>
        a.score - b.score
        || a.transportPrice - b.transportPrice
        || a.treatmentPrice - b.treatmentPrice
    )
    .map((pkg, index) => ({ ...pkg, rank: index + 1 }));
}

module.exports = {
  STRATEGIES,
  computeScore,
  rankPackages,
};
