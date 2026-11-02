import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';

const colombiaCenter = [4.5709, -74.2973];
const markerIcon = L.divIcon({
  className: 'delivery-location-marker',
  html: '<span></span>',
  iconSize: [26, 30],
  iconAnchor: [13, 28],
});

const normalizedPoint = (point) => ({
  latitude: Number(Number(point.latitude).toFixed(7)),
  longitude: Number(Number(point.longitude).toFixed(7)),
});

export default function DeliveryLocationPicker({ value, onChange }) {
  const mapContainerRef = useRef(null);
  const mapApiRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapContainerRef.current) return undefined;

    const hasInitialPoint = Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
    const initialCenter = hasInitialPoint ? [Number(value.latitude), Number(value.longitude)] : colombiaCenter;
    const map = L.map(mapContainerRef.current, { scrollWheelZoom: false }).setView(initialCenter, hasInitialPoint ? 16 : 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);

    let marker = null;
    const placeMarker = (point, { notify = true, zoom = false } = {}) => {
      const latLng = [Number(point.latitude), Number(point.longitude)];
      if (marker) marker.setLatLng(latLng);
      else {
        marker = L.marker(latLng, { icon: markerIcon, draggable: true, keyboard: true }).addTo(map);
        marker.on('dragend', () => {
          const current = marker.getLatLng();
          onChangeRef.current(normalizedPoint({ latitude: current.lat, longitude: current.lng }));
        });
      }
      if (zoom) map.setView(latLng, 17);
      if (notify) onChangeRef.current(normalizedPoint(point));
    };

    map.on('click', (event) => placeMarker({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
    mapApiRef.current = { map, placeMarker };
    if (hasInitialPoint) placeMarker({ latitude: initialCenter[0], longitude: initialCenter[1] }, { notify: false });
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      mapApiRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && mapApiRef.current) {
      mapApiRef.current.placeMarker({ latitude, longitude }, { notify: false });
    }
  }, [value?.latitude, value?.longitude]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Este navegador no permite obtener la ubicación actual. Puedes marcar el punto directamente en el mapa.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapApiRef.current?.placeMarker({ latitude: coords.latitude, longitude: coords.longitude }, { zoom: true });
        setLocating(false);
      },
      () => {
        setLocationError('No se pudo obtener la ubicación. Revisa el permiso del navegador o marca el punto en el mapa.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="delivery-location-picker">
      <div className="delivery-location-map" ref={mapContainerRef} aria-label="Mapa para marcar la ubicación de entrega" />
      <div className="delivery-location-controls">
        <button type="button" className="btn btn-secondary delivery-location-current" onClick={useCurrentLocation} disabled={locating}>
          <LocateFixed size={16} /> {locating ? 'Buscando ubicación…' : 'Usar mi ubicación'}
        </button>
        <span className={value ? 'delivery-location-status is-selected' : 'delivery-location-status'} role="status">
          <MapPin size={15} /> {value ? 'Punto marcado en el mapa' : 'Haz clic en el mapa para marcar el punto'}
        </span>
      </div>
      {locationError ? <p className="delivery-location-error" role="alert">{locationError}</p> : null}
      <small className="delivery-location-attribution">Mapa © OpenStreetMap contributors</small>
    </div>
  );
}
