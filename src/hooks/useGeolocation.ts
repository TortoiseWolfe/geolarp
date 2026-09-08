import { useState, useEffect, useCallback, useRef } from 'react';
import {
  clearCoarseWatch,
  getCoarseFix,
  isGeolocationSupported,
  watchCoarseFix,
  type CoarseFix,
} from '@/lib/geolarp/coarseFix';

export interface GeolocationState {
  /**
   * The cell the device is in, and its centre. NEVER the reading (#39).
   *
   * RENAMED FROM `position`, deliberately, rather than retyped in place. This hook
   * used to hold the raw `GeolocationPosition` here and hand it to every consumer,
   * which is what made the published sentence "rounded to 100 metres before
   * anything is done with it" false. A same-named field with a new type produces
   * vague errors at each call site; a new name produces one clear error per
   * consumer, so the compiler walks them all.
   */
  fix: CoarseFix | null;
  permission: PermissionState;
  loading: boolean;
  error: GeolocationPositionError | null;
  lastUpdated: Date | null;
  /** The device's error radius in metres — a scalar, carrying no position. */
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
  // Takes a CoarseFix, not a GeolocationPosition: the rounding already happened,
  // inside the socket, in the callback the platform invoked. Nothing raw reaches
  // this function, so nothing raw can reach state (#39).
  const handleSuccess = useCallback((fix: CoarseFix) => {
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
        clearCoarseWatch(watchId.current);
      }
      watchId.current = watchCoarseFix(handleSuccess, handleError);
    } else {
      getCoarseFix(handleSuccess, handleError);
    }
  }, [isSupported, options, handleSuccess, handleError]);

  // Clear watch
  const clearWatch = useCallback(() => {
    if (watchId.current !== null && isSupported) {
      clearCoarseWatch(watchId.current);
      watchId.current = null;
    }
  }, [isSupported]);

  /*
   * `distanceFrom` IS GONE (#39), not quantised.
   *
   * It computed haversine metres between the raw fix and a target — which required
   * holding the raw pair, and is the one thing cell.ts explicitly refuses to do:
   * "a metre figure derived from cell centres would imply a precision the grid does
   * not carry". Quantising it would have produced a number that looks precise and
   * is not. It had no production consumer — only this hook, one test, and two test
   * mocks — so deleting is cheaper than inventing an honest replacement nobody
   * asked for. `offsetMetres` in cell.ts is the grid-aware answer if one is ever
   * wanted.
   */

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null && isSupported) {
        clearCoarseWatch(watchId.current);
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
