import { useEffect, useRef, useState } from 'react';
import loadGoogleMaps from '../../services/googleMaps';

function validCoordinates(point) {
  if (point?.lat == null || point.lat === '' || point?.lng == null || point.lng === '') return false;
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export default function GooglePickupMap({ origin, destinations = [] }) {
  const mapRef = useRef(null);
  const [message, setMessage] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let active = true;
    let markers = [];
    const points = [
      ...(validCoordinates(origin) ? [{ ...origin, label: 'P', isOrigin: true }] : []),
      ...destinations.filter(validCoordinates).map((destination, index) => ({
        ...destination,
        label: String(index + 1),
        isOrigin: false,
      })),
    ];

    if (!apiKey) {
      setMessage('Mappa non disponibile: configura VITE_GOOGLE_MAPS_API_KEY e abilita Maps JavaScript API.');
      return undefined;
    }
    if (!mapRef.current || points.length === 0) {
      setMessage('Coordinate salvate non sufficienti per visualizzare la mappa.');
      return undefined;
    }

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!active || !maps || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: { lat: Number(points[0].lat), lng: Number(points[0].lng) },
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new maps.LatLngBounds();
        markers = points.map((point) => {
          const position = { lat: Number(point.lat), lng: Number(point.lng) };
          bounds.extend(position);
          return new maps.Marker({
            map,
            position,
            label: { text: point.label, color: '#ffffff', fontWeight: 'bold' },
            // Producer pin stands out in green via a built-in vector icon (no external
            // image request, so it can't be blocked by ad blockers or network filters);
            // recipient pins keep the default red teardrop.
            icon: point.isOrigin ? {
              path: maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#16a34a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            } : undefined,
          });
        });
        if (points.length > 1) map.fitBounds(bounds);
        setMessage('');
      })
      .catch(() => {
        if (active) setMessage('Google Maps non è raggiungibile. Verifica la chiave e Maps JavaScript API.');
      });

    return () => {
      active = false;
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [apiKey, origin?.lat, origin?.lng, destinations]);

  const mapLink = validCoordinates(origin) && validCoordinates(destinations[0])
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destinations[0].lat},${destinations[0].lng}`
    : null;

  return (
    <section className="space-y-2" aria-label="Mappa delle sedi">
      <h3 className="font-semibold text-slate-900">Produttore e sedi di conferimento</h3>
      <div ref={mapRef} className="h-72 rounded-xl border border-slate-200 bg-slate-50" />
      {message && <p role="status" className="text-sm text-amber-700">{message}</p>}
      <ul className="space-y-1 text-sm text-slate-600">
        <li>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" aria-hidden="true" />{' '}
          <strong>P</strong> · Produttore: {origin?.address || 'indirizzo non disponibile'}
        </li>
        {destinations.map((destination, index) => (
          <li key={destination.id}>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />{' '}
            <strong>{index + 1}</strong> · Destinatario: {destination.address || 'indirizzo non disponibile'}
            {destination.roadDistanceMeters != null
              ? ` · ${Math.round(destination.roadDistanceMeters / 1000)} km stradali`
              : ' · Distanza stradale non disponibile'}
          </li>
        ))}
      </ul>
      {mapLink && (
        <a className="inline-block text-sm font-semibold text-brand-900 underline" href={mapLink} target="_blank" rel="noreferrer">
          Apri il percorso in Google Maps
        </a>
      )}
    </section>
  );
}
