import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, MapPin } from 'lucide-react';

setWorkerUrl(mapLibreWorkerUrl);

const colombiaCenter = [-74.2973, 4.5709];
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty';

const normalizedPoint = (latitude, longitude) => ({
  latitude: Number(Number(latitude).toFixed(7)),
  longitude: Number(Number(longitude).toFixed(7)),
});

export default function DeliveryLocationPicker({ value, onChange }) {
  const mapContainerRef = useRef(null);
  const mapApiRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapContainerRef.current) return undefined;

    const hasInitialPoint = Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
    const initialCenter = hasInitialPoint
      ? [Number(value.longitude), Number(value.latitude)]
      : colombiaCenter;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: hasInitialPoint ? 16 : 5,
      cooperativeGestures: true,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left');

    let marker = null;
    const placeMarker = (point, { notify = true, zoom = false } = {}) => {
      const longitude = Number(point.longitude);
      const latitude = Number(point.latitude);
      const coordinates = [longitude, latitude];
      if (marker) marker.setLngLat(coordinates);
      else {
        marker = new maplibregl.Marker({ color: '#124a7c', draggable: true })
          .setLngLat(coordinates)
          .addTo(map);
        marker.on('dragend', () => {
          const current = marker.getLngLat();
          onChangeRef.current(normalizedPoint(current.lat, current.lng));
        });
      }
      if (zoom) map.easeTo({ center: coordinates, zoom: 17 });
      if (notify) onChangeRef.current(normalizedPoint(latitude, longitude));
    };

    map.on('click', (event) => placeMarker({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    map.on('load', () => {
      setMapError('');
      map.resize();
    });
    map.on('error', () => {
      if (!map.isStyleLoaded()) setMapError('No se pudo cargar el mapa. Intenta recargar la página o marca el punto más tarde.');
    });
    mapApiRef.current = { map, placeMarker };
    if (hasInitialPoint) placeMarker({ latitude: initialCenter[1], longitude: initialCenter[0] }, { notify: false });

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
      <div className="delivery-location-map-frame">
        <div className="delivery-location-map" ref={mapContainerRef} aria-label="Mapa para marcar la ubicación de entrega" />
        {mapError ? <div className="delivery-location-map-error" role="alert">{mapError}</div> : null}
      </div>
      <div className="delivery-location-controls">
        <button type="button" className="btn btn-secondary delivery-location-current" onClick={useCurrentLocation} disabled={locating}>
          <LocateFixed size={16} /> {locating ? 'Buscando ubicación…' : 'Usar mi ubicación'}
        </button>
        <span className={value ? 'delivery-location-status is-selected' : 'delivery-location-status'} role="status">
          <MapPin size={15} /> {value ? 'Punto marcado en el mapa' : 'Haz clic en el mapa para marcar el punto'}
        </span>
      </div>
      {locationError ? <p className="delivery-location-error" role="alert">{locationError}</p> : null}
    </div>
  );
}
