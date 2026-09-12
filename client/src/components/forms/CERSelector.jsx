import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export default function CERSelector({ value, onChange }) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cer-codes', query],
    queryFn: async () => {
      const response = await api.get('/cer-codes', { params: { q: query } });
      return response.data.items;
    },
    staleTime: 300000,
  });
  const filtered = data || [];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Codice CER / EER</label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca codice o descrizione"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white">
        {isLoading && <p className="px-3 py-2 text-sm text-slate-500">Caricamento catalogo...</p>}
        {isError && <p className="px-3 py-2 text-sm text-red-600">Impossibile caricare il catalogo CER.</p>}
        {!isLoading && !isError && filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Nessun codice trovato.</p>}
        {filtered.map((item) => (
          <button
            key={item.code}
            className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-brand-50 ${value === item.code ? 'bg-brand-50' : ''}`}
            onClick={() => {
              onChange(item.code);
              setQuery(item.code);
            }}
            type="button"
          >
            <p className="font-semibold text-slate-800">{item.code}</p>
            <p className="text-xs text-slate-500">{item.description}{item.hazardous ? ' - pericoloso' : ''}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
