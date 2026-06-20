import { useParams } from 'react-router-dom';
import RoleLayout from '../../components/shared/RoleLayout';
import LiveBidBoard from '../../components/auction/LiveBidBoard';
import CountdownTimer from '../../components/auction/CountdownTimer';
import Button from '../../components/ui/Button';
import { useAuction } from '../../hooks/useAuction';

const links = [
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/auction/123', label: 'Auction Room' },
  { to: '/producer/orders', label: 'Orders & Docs' },
];

export default function AuctionRoomPage() {
  const { id } = useParams();
  const { bids, connected } = useAuction(id);

  return (
    <RoleLayout title="Reverse Auction Room" links={links}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CountdownTimer deadline={new Date(Date.now() + 3600 * 1000).toISOString()} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
          {connected ? 'Live connected' : 'Connecting...'}
        </p>
      </div>
      <LiveBidBoard bids={bids} />
      <div className="flex gap-3">
        <Button>Accept Best Bid</Button>
        <Button variant="secondary">Counter Offer</Button>
      </div>
    </RoleLayout>
  );
}
