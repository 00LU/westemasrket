import Input from '../ui/Input';
import Button from '../ui/Button';

export default function BidForm() {
  return (
    <form className="panel space-y-3">
      <h3 className="font-display text-lg font-semibold">Submit Bid</h3>
      <Input label="Price per km (EUR)" type="number" defaultValue="1.6" />
      <Input label="Treatment price per ton (EUR)" type="number" defaultValue="125" />
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Vehicle Type
        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option>ADR Truck</option>
          <option>Container Truck</option>
          <option>Tank Trailer</option>
        </select>
      </label>
      <Button type="button">Send Bid</Button>
    </form>
  );
}
