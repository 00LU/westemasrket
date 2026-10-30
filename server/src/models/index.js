const User = require('./User');
const PickupRequest = require('./PickupRequest');
const RecipientAvailability = require('./RecipientAvailability');
const TransportProposal = require('./TransportProposal');
const TransportProposalOffer = require('./TransportProposalOffer');
const PickupPackage = require('./PickupPackage');
const SlotProposal = require('./SlotProposal');
const PickupStatusHistory = require('./PickupStatusHistory');
const Certification = require('./Certification');
const CerCode = require('./CerCode');
const Transaction = require('./Transaction');
const Notification = require('./Notification');
const Document = require('./Document');
const ProductionSite = require('./ProductionSite');
const PickupPhoto = require('./PickupPhoto');

function initModels() {
  User.hasMany(PickupRequest, { foreignKey: 'producerId', sourceKey: 'id' });
  PickupRequest.belongsTo(User, { as: 'producer', foreignKey: 'producerId', targetKey: 'id' });
  User.hasMany(ProductionSite, { as: 'productionSites', foreignKey: 'userId', sourceKey: 'id' });
  ProductionSite.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });
  PickupRequest.belongsTo(ProductionSite, { as: 'productionSite', foreignKey: 'productionSiteId' });
  PickupRequest.hasMany(PickupPhoto, { as: 'photos', foreignKey: 'pickupRequestId' });
  PickupPhoto.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });

  PickupRequest.hasMany(RecipientAvailability, { as: 'availabilities', foreignKey: 'pickupRequestId' });
  RecipientAvailability.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });
  RecipientAvailability.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId' });

  PickupRequest.hasMany(TransportProposal, { as: 'proposals', foreignKey: 'pickupRequestId' });
  TransportProposal.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });
  TransportProposal.belongsTo(User, { as: 'transporter', foreignKey: 'transporterId' });
  TransportProposal.hasMany(TransportProposalOffer, { as: 'offers', foreignKey: 'transportProposalId' });
  TransportProposalOffer.belongsTo(TransportProposal, { foreignKey: 'transportProposalId' });
  RecipientAvailability.hasMany(TransportProposalOffer, { as: 'transportOffers', foreignKey: 'recipientAvailabilityId' });
  TransportProposalOffer.belongsTo(RecipientAvailability, { foreignKey: 'recipientAvailabilityId' });

  PickupRequest.hasMany(PickupPackage, { as: 'packages', foreignKey: 'pickupRequestId' });
  PickupPackage.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });
  PickupPackage.belongsTo(RecipientAvailability, { as: 'availability', foreignKey: 'recipientAvailabilityId' });
  PickupPackage.belongsTo(TransportProposal, { as: 'proposal', foreignKey: 'transportProposalId' });
  PickupPackage.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId' });
  PickupPackage.belongsTo(User, { as: 'transporter', foreignKey: 'transporterId' });

  PickupRequest.hasMany(SlotProposal, { as: 'slots', foreignKey: 'pickupRequestId' });
  SlotProposal.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });

  PickupRequest.hasMany(PickupStatusHistory, { as: 'history', foreignKey: 'pickupRequestId' });
  PickupStatusHistory.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId' });

  User.hasMany(Certification, { foreignKey: 'userId', sourceKey: 'id' });
  Certification.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  User.hasMany(Notification, { foreignKey: 'userId', sourceKey: 'id' });
  Notification.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  User.hasMany(Document, { foreignKey: 'userId', sourceKey: 'id' });
  Document.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  PickupRequest.hasOne(Transaction, { foreignKey: 'pickupRequestId', sourceKey: 'id' });
  Transaction.belongsTo(PickupRequest, { foreignKey: 'pickupRequestId', targetKey: 'id' });
}

module.exports = {
  initModels,
  User,
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  TransportProposalOffer,
  PickupPackage,
  SlotProposal,
  PickupStatusHistory,
  Certification,
  CerCode,
  Transaction,
  Notification,
  Document,
  ProductionSite,
  PickupPhoto,
};
