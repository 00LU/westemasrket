import { useEffect, useId, useRef, useState } from 'react';
import loadGoogleMaps from '../../services/googleMaps';

export default function AddressAutocomplete({ label, value, onChange, required = false, disabled = false }) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const sessionTokenRef = useRef(null);
  onChangeRef.current = onChange;
  const inputId = useId();
  const [placesLibrary, setPlacesLibrary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY));

  useEffect(() => {
    let active = true;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return undefined;

    loadGoogleMaps(apiKey)
      .then((maps) => maps?.importLibrary('places'))
      .then((places) => {
        if (!active || !places?.AutocompleteSuggestion || !places?.AutocompleteSessionToken) return;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setPlacesLibrary(places);
        setConfigured(true);
      })
      .catch(() => {
        if (!active) return;
        setConfigured(false);
        setError('Google Maps non è raggiungibile. Verifica la chiave e il servizio Places.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = value?.trim() || '';
    if (!placesLibrary || query.length < 3 || disabled) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const { suggestions: results } = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['it'],
          includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
          sessionToken: sessionTokenRef.current,
        });
        if (!active) return;
        setSuggestions(results.map((result) => result.placePrediction).filter(Boolean));
        setActiveSuggestion(-1);
        setError('');
      } catch {
        if (!active) return;
        setSuggestions([]);
        setError('Impossibile cercare indirizzi. Verifica che Places API (New) sia abilitata.');
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [value, placesLibrary, disabled]);

  const updateText = (event) => {
    setError('');
    onChangeRef.current({ addressFormatted: event.target.value, lat: null, lng: null, placeId: '' });
  };

  const selectSuggestion = async (prediction) => {
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] });
      if (!place.formattedAddress || !place.location || !place.id) {
        setError('Seleziona un indirizzo completo dai suggerimenti Google Maps.');
        return;
      }
      setError('');
      setSuggestions([]);
      sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
      onChangeRef.current({
        addressFormatted: place.formattedAddress,
        lat: place.location.lat(),
        lng: place.location.lng(),
        placeId: place.id,
      });
    } catch {
      setError('Impossibile caricare i dettagli dell’indirizzo selezionato.');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  return (
    <div className="relative flex flex-col gap-2 text-sm font-medium text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        value={value || ''}
        onChange={updateText}
        onKeyDown={handleKeyDown}
        autoComplete="street-address"
        required={required}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${inputId}-suggestions`}
        aria-activedescendant={activeSuggestion >= 0 ? `${inputId}-suggestion-${activeSuggestion}` : undefined}
      />
      {suggestions.length > 0 && (
        <ul
          id={`${inputId}-suggestions`}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((prediction, index) => (
            <li
              id={`${inputId}-suggestion-${index}`}
              key={`${prediction.placeId}-${index}`}
              className={`cursor-pointer px-3 py-2 text-sm font-normal ${index === activeSuggestion ? 'bg-slate-100' : ''}`}
              role="option"
              aria-selected={index === activeSuggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(prediction)}
            >
              {prediction.text.toString()}
            </li>
          ))}
        </ul>
      )}
      {!configured && (
        <span className="text-xs font-normal text-amber-700">
          Autocomplete non attivo: configura VITE_GOOGLE_MAPS_API_KEY e abilita Maps JavaScript API e Places API (New).
        </span>
      )}
      {error && <span role="alert" className="text-xs font-normal text-red-700">{error}</span>}
    </div>
  );
}
