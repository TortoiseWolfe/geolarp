'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LocationService } from '@/lib/geolocation/location-service';
import { 
  PrivacyCoordinates, 
  LocationPermissionState, 
  LocationServiceConfig,
  GeofenceArea,
  Zone
} from '@/lib/geolocation/types';

interface UseGeolocationOptions extends Partial<LocationServiceConfig> {
  autoStart?: boolean;
  onError?: (error: Error | GeolocationPositionError) => void;
}

interface UseGeolocationReturn {
  position: PrivacyCoordinates | null;
  permission: LocationPermissionState;
  isLoading: boolean;
  error: Error | null;
  accuracy: number | null;
  requestPermission: () => Promise<PermissionState>;
  getCurrentPosition: () => Promise<void>;
  startWatching: () => void;
  stopWatching: () => void;
  setManualLocation: (input: string) => boolean;
  setZoneLocation: (zoneId: string) => boolean;
  getDistanceTo: (target: { lat: number; lng: number }) => number | null;
  addGeofence: (area: GeofenceArea) => void;
  getAvailableZones: () => Zone[];
  setAccuracyMode: (mode: 'high' | 'balanced' | 'low') => Promise<void>;
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const [position, setPosition] = useState<PrivacyCoordinates | null>(null);
  const [permission, setPermission] = useState<LocationPermissionState>({
    permission: 'prompt',
    lastChecked: Date.now()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  
  const serviceRef = useRef<LocationService | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Initialize service
  useEffect(() => {
    serviceRef.current = new LocationService({
      accuracyMode: options.accuracyMode,
      updateInterval: options.updateInterval,
      distanceFilter: options.distanceFilter,
      enablePrivacy: options.enablePrivacy,
      enableBatteryOptimization: options.enableBatteryOptimization
    });

    // Get initial permission state
    setPermission(serviceRef.current.getPermissionState());

    // Load last position
    const lastPosition = serviceRef.current.getLastPosition();
    if (lastPosition) {
      setPosition(lastPosition);
    }

    // Auto-start if requested
    if (options.autoStart) {
      getCurrentPosition();
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.destroy();
      }
    };
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!serviceRef.current) {
      throw new Error('Location service not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const state = await serviceRef.current.requestPermission();
      setPermission(serviceRef.current.getPermissionState());
      
      return state;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Permission request failed');
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
      return 'denied';
    } finally {
      setIsLoading(false);
    }
  }, [options.onError]);

  // Get current position
  const getCurrentPosition = useCallback(async () => {
    if (!serviceRef.current) {
      throw new Error('Location service not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const pos = await serviceRef.current.getCurrentPosition();
      setPosition(pos);
      setPermission(serviceRef.current.getPermissionState());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get position');
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [options.onError]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (!serviceRef.current || watchIdRef.current !== null) {
      return;
    }

    watchIdRef.current = serviceRef.current.watchPosition(
      (pos) => {
        setPosition(pos);
        setError(null);
      },
      (err) => {
        const error = err instanceof Error ? err : new Error('Position watch error');
        setError(error);
        if (options.onError) {
          options.onError(err);
        }
      }
    );
  }, [options.onError]);

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (serviceRef.current && watchIdRef.current !== null) {
      serviceRef.current.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Set manual location
  const setManualLocation = useCallback((input: string): boolean => {
    if (!serviceRef.current) {
      return false;
    }

    const pos = serviceRef.current.setManualLocation(input);
    if (pos) {
      setPosition(pos);
      setPermission(serviceRef.current.getPermissionState());
      return true;
    }
    return false;
  }, []);

  // Set zone location
  const setZoneLocation = useCallback((zoneId: string): boolean => {
    if (!serviceRef.current) {
      return false;
    }

    const pos = serviceRef.current.setZoneLocation(zoneId);
    if (pos) {
      setPosition(pos);
      setPermission(serviceRef.current.getPermissionState());
      return true;
    }
    return false;
  }, []);

  // Get distance to target
  const getDistanceTo = useCallback((target: { lat: number; lng: number }): number | null => {
    if (!serviceRef.current || !position) {
      return null;
    }

    try {
      return serviceRef.current.getDistanceTo({
        ...target,
        timestamp: Date.now()
      });
    } catch {
      return null;
    }
  }, [position]);

  // Add geofence
  const addGeofence = useCallback((area: GeofenceArea) => {
    if (serviceRef.current) {
      serviceRef.current.enterGeofence(area);
    }
  }, []);

  // Get available zones
  const getAvailableZones = useCallback((): Zone[] => {
    if (!serviceRef.current) {
      return [];
    }
    return serviceRef.current.getAvailableZones();
  }, []);

  // Set accuracy mode
  const setAccuracyMode = useCallback(async (mode: 'high' | 'balanced' | 'low') => {
    if (serviceRef.current) {
      await serviceRef.current.setAccuracy(mode);
    }
  }, []);

  return {
    position,
    permission,
    isLoading,
    error,
    accuracy,
    requestPermission,
    getCurrentPosition,
    startWatching,
    stopWatching,
    setManualLocation,
    setZoneLocation,
    getDistanceTo,
    addGeofence,
    getAvailableZones,
    setAccuracyMode
  };
}