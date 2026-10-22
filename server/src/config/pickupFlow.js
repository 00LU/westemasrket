const REQUEST_STATUS = {
  DRAFT: 'draft',
  AWAITING_RECIPIENTS: 'awaiting_recipients',
  AWAITING_TRANSPORTERS: 'awaiting_transporters',
  PACKAGES_READY: 'packages_ready',
  IN_AGREEMENT: 'in_agreement',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

// Allowed request transitions. Anything not listed here is rejected by the state machine.
const REQUEST_TRANSITIONS = {
  [REQUEST_STATUS.DRAFT]: [REQUEST_STATUS.AWAITING_RECIPIENTS, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.AWAITING_RECIPIENTS]: [REQUEST_STATUS.AWAITING_TRANSPORTERS, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.AWAITING_TRANSPORTERS]: [REQUEST_STATUS.PACKAGES_READY, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.PACKAGES_READY]: [REQUEST_STATUS.IN_AGREEMENT, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.IN_AGREEMENT]: [
    REQUEST_STATUS.CONFIRMED,
    REQUEST_STATUS.PACKAGES_READY,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.CONFIRMED]: [REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.CANCELLED]: [],
};

const RECIPIENT_RESPONSE = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  EXPIRED: 'expired',
};

const PROPOSAL_STATUS = {
  INVITED: 'invited',
  SUBMITTED: 'submitted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
};

const PACKAGE_STATUS = {
  PROPOSED: 'proposed',
  SELECTED: 'selected',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  DISCARDED: 'discarded',
};

const SLOT_STATUS = {
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  AGREED: 'agreed',
  CLOSED: 'closed',
};

const settings = {
  // How many best packages the producer sees at a time.
  packagesTopN: Number(process.env.PACKAGES_TOP_N || 5),
  // Hours each party has to answer a slot proposal before the package is considered abandoned.
  agreementResponseHours: Number(process.env.AGREEMENT_RESPONSE_HOURS || 48),
  agreementSweepIntervalMs: Number(process.env.AGREEMENT_SWEEP_INTERVAL_MS || 60 * 1000),
  platformFeeRatio: Number(process.env.PLATFORM_TRANSACTION_FEE_MIN || 0.02),
  optimizationStrategy: process.env.PACKAGE_OPTIMIZATION_STRATEGY || 'lowest_price',
};

module.exports = {
  REQUEST_STATUS,
  REQUEST_TRANSITIONS,
  RECIPIENT_RESPONSE,
  PROPOSAL_STATUS,
  PACKAGE_STATUS,
  SLOT_STATUS,
  settings,
};
