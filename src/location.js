import { stations } from './network.js';

export function distanceMetres(latitude, longitude, station) {
  const radians = n => n * Math.PI / 180;
  const lat = radians(station.latitude - latitude), lon = radians(station.longitude - longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(station.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function nearestStation(coords) {
  if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude) || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) throw new Error('Invalid device location');
  return Object.values(stations).map(station => ({ station, distance:distanceMetres(coords.latitude, coords.longitude, station) })).sort((a,b)=>a.distance-b.distance)[0];
}

export function locationDescription(nearest, accuracy) {
  const distance = nearest.distance < 1000 ? `${Math.round(nearest.distance / 10) * 10} m` : `${(nearest.distance / 1000).toFixed(1)} km`;
  const precision = Number.isFinite(accuracy) && accuracy > 100 ? ` Device accuracy is about ${Math.round(accuracy)} m; another station may be closer.` : '';
  return `Nearest: ${nearest.station.name} · ${distance} away in a straight line.${precision}`;
}

export function locationError(error) {
  if (error?.code === 1) return 'Location access was denied. You can enable it in your browser settings, or choose a station on the map.';
  if (error?.code === 3) return 'Finding your location timed out. Try again, or choose a station on the map.';
  return 'Your device location is unavailable. Try again, or choose a station on the map.';
}
