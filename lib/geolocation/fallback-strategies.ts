import { Coordinates, Zone } from './types';

/**
 * Predefined zones for fallback selection
 */
export const FALLBACK_ZONES: Zone[] = [
  {
    id: 'sf-downtown',
    name: 'San Francisco Downtown',
    description: 'Financial District and Union Square area',
    bounds: {
      north: 37.7955,
      south: 37.7755,
      east: -122.3937,
      west: -122.4137
    },
    center: {
      lat: 37.7855,
      lng: -122.4037,
      timestamp: Date.now()
    }
  },
  {
    id: 'sf-golden-gate',
    name: 'Golden Gate Park',
    description: 'Golden Gate Park and surrounding areas',
    bounds: {
      north: 37.7794,
      south: 37.7594,
      east: -122.4533,
      west: -122.5133
    },
    center: {
      lat: 37.7694,
      lng: -122.4833,
      timestamp: Date.now()
    }
  },
  {
    id: 'sf-mission',
    name: 'Mission District',
    description: 'Mission District and Dolores Park',
    bounds: {
      north: 37.7699,
      south: 37.7499,
      east: -122.4103,
      west: -122.4303
    },
    center: {
      lat: 37.7599,
      lng: -122.4203,
      timestamp: Date.now()
    }
  },
  {
    id: 'oakland-downtown',
    name: 'Oakland Downtown',
    description: 'Oakland city center and Lake Merritt',
    bounds: {
      north: 37.8144,
      south: 37.7944,
      east: -122.2508,
      west: -122.2808
    },
    center: {
      lat: 37.8044,
      lng: -122.2708,
      timestamp: Date.now()
    }
  },
  {
    id: 'berkeley',
    name: 'Berkeley',
    description: 'UC Berkeley campus and downtown',
    bounds: {
      north: 37.8816,
      south: 37.8616,
      east: -122.2527,
      west: -122.2727
    },
    center: {
      lat: 37.8716,
      lng: -122.2627,
      timestamp: Date.now()
    }
  }
];

/**
 * Get approximate location from IP address
 * Note: This requires a backend service or third-party API
 */
export async function getLocationFromIP(): Promise<Coordinates | null> {
  try {
    // Using a free IP geolocation service
    // In production, use your own backend endpoint
    const response = await fetch('https://ipapi.co/json/');
    
    if (!response.ok) {
      throw new Error('Failed to get IP location');
    }
    
    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      return {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        accuracy: 5000, // IP geolocation is typically accurate to city level
        timestamp: Date.now()
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Fallback] IP geolocation failed:', error);
    return null;
  }
}

/**
 * Parse manual coordinate input
 */
export function parseManualCoordinates(input: string): Coordinates | null {
  // Support various formats:
  // "37.7749, -122.4194"
  // "37.7749 -122.4194"
  // "37.7749N 122.4194W"
  
  const cleaned = input.replace(/[^\d\s,.-]/g, '').trim();
  const parts = cleaned.split(/[\s,]+/);
  
  if (parts.length !== 2) {
    return null;
  }
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  
  return {
    lat,
    lng,
    accuracy: 100, // Manual entry assumed to be approximate
    timestamp: Date.now()
  };
}

/**
 * Get zone by ID
 */
export function getZoneById(zoneId: string): Zone | undefined {
  return FALLBACK_ZONES.find(zone => zone.id === zoneId);
}

/**
 * Get nearest zone to coordinates
 */
export function getNearestZone(coords: Coordinates): Zone | null {
  if (FALLBACK_ZONES.length === 0) {
    return null;
  }
  
  let nearestZone = FALLBACK_ZONES[0];
  let minDistance = Number.MAX_VALUE;
  
  for (const zone of FALLBACK_ZONES) {
    const distance = calculateSimpleDistance(coords, zone.center);
    if (distance < minDistance) {
      minDistance = distance;
      nearestZone = zone;
    }
  }
  
  return nearestZone;
}

/**
 * Simple distance calculation for zone selection
 */
function calculateSimpleDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const latDiff = coord1.lat - coord2.lat;
  const lngDiff = coord1.lng - coord2.lng;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

/**
 * Check if coordinates are within zone bounds
 */
export function isInZone(coords: Coordinates, zone: Zone): boolean {
  return (
    coords.lat >= zone.bounds.south &&
    coords.lat <= zone.bounds.north &&
    coords.lng >= zone.bounds.west &&
    coords.lng <= zone.bounds.east
  );
}

/**
 * Get all zones that contain the given coordinates
 */
export function getContainingZones(coords: Coordinates): Zone[] {
  return FALLBACK_ZONES.filter(zone => isInZone(coords, zone));
}