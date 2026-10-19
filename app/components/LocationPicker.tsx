'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { PHARMACY_LOCATION, type LatLng } from '@/app/lib/delivery';
import { BRAND } from '@/app/lib/brand';

const pin = (colour: string) =>
  `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 40 15 40s15-14.1 15-25.2C30 6.6 23.3 0 15 0z" fill="${colour}"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`;

/** A map the customer taps or drags a pin on. Leaflet touches `window`, so it loads in the browser only. */
export default function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (location: LatLng) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const place = useRef<(at: LatLng, pan?: boolean) => void>(() => {});
  const changed = useRef(onChange);
  changed.current = onChange;
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !box.current || map.current) return;
      const icon = (colour: string) => L.divIcon({ html: pin(colour), className: '', iconSize: [30, 40], iconAnchor: [15, 40] });

      const m = L.map(box.current, { scrollWheelZoom: false }).setView([PHARMACY_LOCATION.lat, PHARMACY_LOCATION.lng], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      L.marker([PHARMACY_LOCATION.lat, PHARMACY_LOCATION.lng], { icon: icon('#1f2b28'), interactive: false, keyboard: false })
        .bindTooltip(BRAND.name, { direction: 'top', offset: [0, -38] })
        .addTo(m);

      place.current = (at, pan = true) => {
        if (!marker.current) {
          marker.current = L.marker([at.lat, at.lng], { icon: icon('#0e6b5c'), draggable: true, title: 'Delivery location' }).addTo(m);
          marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); changed.current({ lat: p.lat, lng: p.lng }); });
        } else marker.current.setLatLng([at.lat, at.lng]);
        if (pan) m.setView([at.lat, at.lng], Math.max(m.getZoom(), 16));
      };
      m.on('click', (e) => { place.current(e.latlng, false); changed.current({ lat: e.latlng.lat, lng: e.latlng.lng }); });
      map.current = m;
      if (value) place.current(value);
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; marker.current = null; };
    // The map is created once; later pin changes go through `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocateError('This browser cannot share your location. Tap the map instead.'); return; }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const at = { lat: coords.latitude, lng: coords.longitude };
        place.current(at);
        onChange(at);
      },
      () => { setLocating(false); setLocateError('We could not get your location. Tap the map where the rider should come.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">{value ? 'Drag the green pin to adjust it.' : 'Tap the map where the rider should come, or use your location.'}</p>
        <button type="button" onClick={useMyLocation} disabled={locating} className="shop-button secondary text-xs! min-h-9! px-3! py-1.5!">
          <LocateFixed size={14} /> {locating ? 'Finding you…' : 'Use my location'}
        </button>
      </div>
      <div ref={box} className="h-64 w-full rounded-lg border border-stone-200 overflow-hidden z-0" role="application" aria-label="Map: choose your delivery location" />
      {locateError && <p className="text-xs text-red-700" role="alert">{locateError}</p>}
    </div>
  );
}
