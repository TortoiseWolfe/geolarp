import { useState, useEffect, useCallback, useRef } from 'react';
import {
  clearDeviceWatch,
  getDeviceFix,
  isGeolocationSupported,
  watchDeviceFix,
  type DeviceFix,
} from '@/lib/geolarp/deviceFix';

export interface GeolocationState {
  /** The device's exact reading and the cell it is in (#183). */
  fix: DeviceFix | null;
  permission: PermissionState;
  loading: boolean;
  error: GeolocationPositionError | null;
  lastUpdated: Date | null;
  /** The device's error radius in metres. */
  accuracy: number | null;
}

/**
 * NO LONGER `extends PositionOptions` (#39).
 *
 * The ask is stated once, in `GRID_POSITION_OPTIONS`, and nothing may restate it.
 * While a caller could pass `enableHighAccuracy`, the product had three different
 * answers to "what does this app request of a device" living in three files, and no
 * way to read the real one. `watch` is a caller's business; the ask is not.
 */
export interface UseGeolocationOptions {
  watch?: boolean;
}

export interface UseGeolocationReturn extends GeolocationState {
  getCurrentPosition: () => void;
  clearWatch: () => void;
  isSupported: boolean;
}

/**
 * Hook for managing geolocation state and permissions
 */
export function useGeolocation(
  options?: UseGeolocationOptions
): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    fix: null,
    permission: 'prompt',
    loading: false,
    error: null,
    lastUpdated: null,
    accuracy: null,
  });

  const watchId = useRef<number | null>(null);
  const isSupported = isGeolocationSupported();

  // Check permission status
  useEffect(() => {
    if (!isSupported) return;

    let permissionStatus: PermissionStatus | null = null;
    let handleChange: (() => void) | null = null;

    if ('permissions' in navigator && navigator.permissions) {
      try {
        const permissionsQuery = navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        if (permissionsQuery && typeof permissionsQuery.then === 'function') {
          permissionsQuery
            .then((status) => {
              permissionStatus = status;
              setState((prev) => ({
                ...prev,
                permission: status.state,
              }));

              // Listen for permission changes (if supported)
              if (typeof status.addEventListener === 'function') {
                handleChange = () => {
                  setState((prev) => ({
                    ...prev,
                    permission: status.state,
                  }));
                };

                status.addEventListener('change', handleChange);
              }
            })
            .catch(() => {
              // Permissions API not supported or failed, continue with default
            });
        }
      } catch {
        // Permissions API not available, continue without it
      }
    }

    return () => {
      if (
        permissionStatus &&
        handleChange &&
        typeof permissionStatus.removeEventListener === 'function'
      ) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, [isSupported]);

  // Handle success
  const handleSuccess = useCallback((fix: DeviceFix) => {
    setState({
      fix,
      permission: 'granted',
      loading: false,
      error: null,
      lastUpdated: new Date(),
      accuracy: fix.accuracy,
    });
  }, []);

  // Handle error
  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      loading: false,
      error,
      lastUpdated: new Date(),
      // Only update permission if it's a permission denied error
      permission:
        error.code === error.PERMISSION_DENIED ? 'denied' : prev.permission,
    }));
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(() => {
    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        error: {
          code: 0,
          message: 'Geolocation is not supported by this browser',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    // No options object is built here any more. The ask lives in
    // GRID_POSITION_OPTIONS, inside the socket, and cannot be varied per caller.
    if (options?.watch) {
      // Clear existing watch if any
      if (watchId.current !== null) {
        clearDeviceWatch(watchId.current);
      }
      watchId.current = watchDeviceFix(handleSuccess, handleError);
    } else {
      getDeviceFix(handleSuccess, handleError);
    }
  }, [isSupported, options, handleSuccess, handleError]);

  // Clear watch
  const clearWatch = useCallback(() => {
    if (watchId.current !== null && isSupported) {
      clearDeviceWatch(watchId.current);
      watchId.current = null;
    }
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null && isSupported) {
        clearDeviceWatch(watchId.current);
      }
    };
  }, [isSupported]);

  return {
    ...state,
    getCurrentPosition,
    clearWatch,
    isSupported,
  };
}
