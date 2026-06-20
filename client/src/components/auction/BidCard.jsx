export default function BidCard({ bid }) {
  const trendClass = bid.trend === 'down' ? 'text-emerald-600' : 'text-red-600';
  const trendSign = bid.trend === 'down' ? '▼' : '▲';

  return (
    <article className="grid grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800">{bid.transporter}</p>
      <p className="text-slate-600">{bid.recipient}</p>
      <p className="font-semibold text-slate-900">EUR {bid.totalPrice.toLocaleString()}</p>
      <p className={`text-right font-bold ${trendClass}`}>{trendSign}</p>
    </article>
  );
}
