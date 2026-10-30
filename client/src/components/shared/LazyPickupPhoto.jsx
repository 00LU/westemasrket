import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export default function LazyPickupPhoto({ photo, alt }) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !photo.url) return undefined;
    let active = true;
    let objectUrl;
    api.get(photo.url, { responseType: 'blob' })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, photo.url]);

  return (
    <div ref={containerRef} className="mt-2">
      {src && <img src={src} alt={alt} loading="lazy" className="max-h-40 rounded-xl border border-slate-200 object-contain" />}
      {error && <p className="text-xs text-slate-500">Foto non disponibile.</p>}
    </div>
  );
}
