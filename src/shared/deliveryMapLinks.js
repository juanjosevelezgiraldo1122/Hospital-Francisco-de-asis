export function deliveryMapLinks(location) {
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') return null;
  const latitude = location.latitude;
  const longitude = location.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const point = `${latitude},${longitude}`;
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(point)}&navigate=yes`,
  };
}
