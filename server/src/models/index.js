const User = require('./User');
const WasteRequest = require('./WasteRequest');
const Bid = require('./Bid');
const RecipientOffer = require('./RecipientOffer');
const Certification = require('./Certification');
const CerCode = require('./CerCode');
const Transaction = require('./Transaction');
const Notification = require('./Notification');
const Document = require('./Document');

function initModels() {
  User.hasMany(WasteRequest, { foreignKey: 'producerId', sourceKey: 'id' });
  WasteRequest.belongsTo(User, { as: 'producer', foreignKey: 'producerId', targetKey: 'id' });

  WasteRequest.hasMany(Bid, { foreignKey: 'wasteRequestId', sourceKey: 'id' });
  Bid.belongsTo(WasteRequest, { foreignKey: 'wasteRequestId', targetKey: 'id' });

  User.hasMany(Bid, { foreignKey: 'transporterId', sourceKey: 'id' });
  Bid.belongsTo(User, { as: 'transporter', foreignKey: 'transporterId', targetKey: 'id' });

  User.hasMany(Bid, { foreignKey: 'recipientId', sourceKey: 'id' });
  Bid.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId', targetKey: 'id' });

  WasteRequest.hasMany(RecipientOffer, { foreignKey: 'wasteRequestId', sourceKey: 'id' });
  RecipientOffer.belongsTo(WasteRequest, { foreignKey: 'wasteRequestId', targetKey: 'id' });

  User.hasMany(RecipientOffer, { foreignKey: 'recipientId', sourceKey: 'id' });
  RecipientOffer.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId', targetKey: 'id' });

  User.hasMany(Certification, { foreignKey: 'userId', sourceKey: 'id' });
  Certification.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  User.hasMany(Notification, { foreignKey: 'userId', sourceKey: 'id' });
  Notification.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  User.hasMany(Document, { foreignKey: 'userId', sourceKey: 'id' });
  Document.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });

  WasteRequest.hasOne(Transaction, { foreignKey: 'wasteRequestId', sourceKey: 'id' });
  Transaction.belongsTo(WasteRequest, { foreignKey: 'wasteRequestId', targetKey: 'id' });
}

module.exports = {
  initModels,
  User,
  WasteRequest,
  Bid,
  RecipientOffer,
  Certification,
  CerCode,
  Transaction,
  Notification,
  Document,
};
