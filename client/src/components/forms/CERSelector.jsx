import { useMemo, useState } from 'react';

const cerOptions = [
  { code: '15 01 10*', description: 'Packaging containing dangerous substances' },
  { code: '16 01 03', description: 'End-of-life tires' },
  { code: '20 01 21*', description: 'Fluorescent tubes and mercury waste' },
  { code: '12 01 01', description: 'Ferrous metal filings and turnings' },
];

export default function CERSelector({ value, onChange }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return cerOptions.filter((item) => item.code.includes(query) || item.description.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">CER Code</label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search CER by code or description"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white">
        {filtered.map((item) => (
          <button
            key={item.code}
            className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-brand-50 ${value === item.code ? 'bg-brand-50' : ''}`}
            onClick={() => onChange(item.code)}
            type="button"
          >
            <p className="font-semibold text-slate-800">{item.code}</p>
            <p className="text-xs text-slate-500">{item.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
