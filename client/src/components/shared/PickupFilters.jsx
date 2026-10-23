export default function PickupFilters({ status, onStatus, search, onSearch }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">Stato delle richieste
        <select value={status} onChange={(event) => onStatus(event.target.value)} className="rounded-xl border border-slate-300 p-2">
          <option value="action">Da rispondere</option>
          <option value="waiting">Risposta inviata / in attesa</option>
          <option value="agreement">In accordo / confermate</option>
          <option value="closed">Concluse / annullate</option>
          <option value="all">Tutte</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Cerca per CER, indirizzo o rifiuto
        <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} className="rounded-xl border border-slate-300 p-2" />
      </label>
    </div>
  );
}
