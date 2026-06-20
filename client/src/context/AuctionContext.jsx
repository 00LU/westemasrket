import { createContext, useContext, useMemo, useState } from 'react';

const AuctionContext = createContext(null);

const seedBids = [
  { id: 1, transporter: 'FastTrans SRL', recipient: 'EcoPlant Nord', totalPrice: 1450, trend: 'down' },
  { id: 2, transporter: 'ADR Logistics', recipient: 'GreenCycle Plant', totalPrice: 1520, trend: 'up' },
];

export function AuctionProvider({ children }) {
  const [bids, setBids] = useState(seedBids);

  const pushBid = (bid) => {
    setBids((current) => [{ id: Date.now(), ...bid }, ...current]);
  };

  const value = useMemo(() => ({ bids, pushBid }), [bids]);

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuctionContext() {
  const ctx = useContext(AuctionContext);
  if (!ctx) {
    throw new Error('useAuctionContext must be used inside AuctionProvider');
  }
  return ctx;
}
