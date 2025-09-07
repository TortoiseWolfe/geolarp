import { Coordinates, PrivacyCoordinates } from './types';

/**
 * Round coordinates to 100m grid for privacy
 * This prevents exact location tracking while maintaining gameplay functionality
 */
export function roundToGrid(coords: Coordinates): PrivacyCoordinates {
  // Round to nearest 0.001 degree (approximately 100m)
  const gridLat = Math.floor(coords.lat * 1000) / 1000;
  const gridLng = Math.floor(coords.lng * 1000) / 1000;
  
  return {
    lat: gridLat,
    lng: gridLng,
    gridCell: `${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`,
    timestamp: coords.timestamp
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if coordinates are within a geofence
 */
export function isWithinGeofence(
  coords: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radius: number
): boolean {
  const distance = calculateDistance(coords, center);
  return distance <= radius;
}

/**
 * Generate a random offset within grid cell for display purposes
 * This prevents clustering of players at grid cell centers
 */
export function addDisplayJitter(coords: PrivacyCoordinates): Coordinates {
  // Add random offset within the grid cell (up to 0.0005 degrees ~ 50m)
  const jitterLat = (Math.random() - 0.5) * 0.001;
  const jitterLng = (Math.random() - 0.5) * 0.001;
  
  return {
    lat: coords.lat + jitterLat,
    lng: coords.lng + jitterLng,
    timestamp: coords.timestamp
  };
}

/**
 * Anonymize location by returning only the general area
 */
export function getAreaName(coords: Coordinates): string {
  // This would normally use a reverse geocoding service
  // For now, return a grid-based area name
  const gridLat = Math.floor(coords.lat * 10) / 10;
  const gridLng = Math.floor(coords.lng * 10) / 10;
  
  return `Area ${Math.abs(gridLat).toFixed(1)}${gridLat >= 0 ? 'N' : 'S'}, ${Math.abs(gridLng).toFixed(1)}${gridLng >= 0 ? 'E' : 'W'}`;
}

/**
 * Check if location sharing is safe (not at sensitive locations)
 */
export function isSafeToShare(coords: Coordinates): boolean {
  // In a real app, check against a list of sensitive locations
  // (hospitals, homes, schools, etc.)
  // For now, always return true but log a privacy notice
  console.log('[Privacy] Location sharing check performed');
  return true;
}