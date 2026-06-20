const { Bid, Transaction, WasteRequest } = require('../models');

async function closeAuction(wasteRequestId) {
  const winningBid = await Bid.findOne({
    where: { wasteRequestId },
    order: [['totalPrice', 'ASC']],
  });

  if (!winningBid) {
    await WasteRequest.update({ status: 'expired' }, { where: { id: wasteRequestId } });
    return null;
  }

  const feeRatio = Number(process.env.PLATFORM_TRANSACTION_FEE_MIN || 0.02);
  const platformFee = Number(winningBid.totalPrice) * feeRatio;

  const tx = await Transaction.create({
    wasteRequestId,
    winningBidId: winningBid.id,
    platformFee,
    status: 'open',
  });

  await WasteRequest.update({ status: 'awarded' }, { where: { id: wasteRequestId } });
  await Bid.update({ status: 'rejected' }, { where: { wasteRequestId } });
  await winningBid.update({ status: 'accepted' });

  return tx;
}

module.exports = { closeAuction };
