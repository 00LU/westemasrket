let googleMapsPromise;

export default function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => window.google?.maps
      ? resolve(window.google.maps)
      : reject(new Error('Google Maps non disponibile'));
    script.onerror = () => reject(new Error('Impossibile caricare Google Maps'));
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}
