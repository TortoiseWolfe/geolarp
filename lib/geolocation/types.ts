export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface PrivacyCoordinates {
  lat: number;
  lng: number;
  gridCell: string; // e.g., "37.77_-122.41"
  timestamp: number;
}

export interface GeofenceArea {
  id: string;
  name: string;
  center: Coordinates;
  radius: number; // meters
  active: boolean;
}

export interface LocationPermissionState {
  permission: PermissionState;
  lastChecked: number;
  fallbackMode?: 'ip' | 'manual' | 'zone';
}

export type AccuracyMode = 'high' | 'balanced' | 'low';

export interface LocationServiceConfig {
  accuracyMode: AccuracyMode;
  updateInterval: number; // milliseconds
  distanceFilter: number; // meters
  enablePrivacy: boolean;
  enableBatteryOptimization: boolean;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: Coordinates;
}

export type LocationCallback = (location: PrivacyCoordinates) => void;
export type ErrorCallback = (error: GeolocationPositionError | Error) => void;