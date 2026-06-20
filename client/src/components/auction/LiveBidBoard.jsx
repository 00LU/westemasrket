import BidCard from './BidCard';

export default function LiveBidBoard({ bids }) {
  return (
    <section className="panel overflow-hidden">
      <header className="mb-3 grid grid-cols-4 gap-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100">
        <span>Transporter</span>
        <span>Recipient</span>
        <span>Total Price</span>
        <span className="text-right">Trend</span>
      </header>
      <div className="space-y-2">
        {bids.map((bid) => (
          <BidCard key={bid.id} bid={bid} />
        ))}
      </div>
    </section>
  );
}
