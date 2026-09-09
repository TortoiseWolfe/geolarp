import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GRID_POSITION_OPTIONS } from '@/lib/geolarp/coarseFix';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

type PositionCallback = (position: GeolocationPosition) => void;
type PositionErrorCallback = (error: GeolocationPositionError) => void;

describe('useGeolocation', () => {
  let mockGeolocation: any;
  let mockPermissions: any;

  beforeEach(() => {
    // Mock geolocation API
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    // Mock permissions API
    mockPermissions = {
      query: vi.fn(),
    };

    // Apply mocks to navigator
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global.navigator, 'permissions', {
      value: mockPermissions,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset navigator mocks
    vi.unstubAllGlobals();
  });

  it('should initialize with default state', () => {
    mockPermissions.query.mockResolvedValue({ state: 'prompt' });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.fix).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.permission).toBe('prompt');
    expect(result.current.isSupported).toBe(true);
  });

  it('should get current position when requested', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 51.505,
        longitude: -0.09,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({ latitude: 51.505, longitude: -0.09, accuracy: 10 }),
      } as GeolocationCoordinates,
      timestamp: Date.now(),
      toJSON: () => ({
        coords: { latitude: 51.505, longitude: -0.09, accuracy: 10 },
        timestamp: Date.now(),
      }),
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback) => {
        setTimeout(() => success(mockPosition), 0);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      result.current.getCurrentPosition();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      // THE CELL, NOT THE READING (#39). Hardcoded rather than re-derived from
      // cellOf/cellCentre: an expectation computed by the code under test cannot
      // detect that code changing. 51.505/-0.09 lands in cell {r:66205, q:-63},
      // whose centre is 51.505250512262535 / -0.0894785551339524.
      expect(result.current.fix).toEqual({
        cell: { r: 66205, q: -63 },
        lat: 51.505250512262535,
        lon: -0.0894785551339524,
        accuracy: 10,
        timestamp: mockPosition.timestamp,
      });
      // The raw pair must be absent, not merely unused.
      expect(Object.keys(result.current.fix!).sort()).toEqual([
        'accuracy',
        'cell',
        'lat',
        'lon',
        'timestamp',
      ]);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should handle permission denied error', async () => {
    const mockError: GeolocationPositionError = {
      code: 1,
      message: 'User denied geolocation',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'prompt' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('denied');
    });
  });

  it('should handle position unavailable error', async () => {
    const mockError: GeolocationPositionError = {
      code: 2,
      message: 'Position unavailable',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      // Permission should remain granted as this is not a permission error
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should handle timeout error', async () => {
    const mockError: GeolocationPositionError = {
      code: 3,
      message: 'Timeout',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should watch position when watch option is true', () => {
    const watchId = 123;
    mockGeolocation.watchPosition.mockReturnValue(watchId);
    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation({ watch: true }));

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(mockGeolocation.watchPosition).toHaveBeenCalled();
  });

  it('should clear watch when clearWatch is called', () => {
    const watchId = 123;
    mockGeolocation.watchPosition.mockReturnValue(watchId);
    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation({ watch: true }));

    act(() => {
      result.current.getCurrentPosition();
    });

    act(() => {
      result.current.clearWatch();
    });

    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId);
  });

  /*
   * `distanceFrom` and its test are GONE (#39).
   *
   * The test computed haversine metres between the raw fix and a target — which
   * required the hook to hold the raw pair, the one thing this change exists to
   * stop. It was also a probe that could not fail: its assertions sat inside a
   * `waitFor` callback whose returned promise was never awaited, so the block
   * never ran. cell.ts refuses this calculation on purpose ("a metre figure
   * derived from cell centres would imply a precision the grid does not carry");
   * `offsetMetres` is the grid-aware answer if one is ever wanted.
   */

  it('should handle missing geolocation API', () => {
    // Save original geolocation
    const originalGeolocation = global.navigator.geolocation;

    // Completely remove geolocation from navigator
    delete (global.navigator as any).geolocation;

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.isSupported).toBe(false);

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('not supported');

    // Restore original geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: originalGeolocation,
      writable: true,
      configurable: true,
    });
  });

  it('should handle missing permissions API gracefully', async () => {
    // Remove permissions from navigator
    Object.defineProperty(global.navigator, 'permissions', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    // Should still work, just without pre-checking permission
    expect(result.current.permission).toBe('prompt');
  });

  it('should update permission state when it changes', async () => {
    const mockPermissionStatus = {
      state: 'prompt',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockPermissions.query.mockResolvedValue(mockPermissionStatus);

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.permission).toBe('prompt');
    });

    // Simulate permission change
    act(() => {
      mockPermissionStatus.state = 'granted';
      const changeHandler =
        mockPermissionStatus.addEventListener.mock.calls[0][1];
      changeHandler();
    });

    await waitFor(() => {
      expect(result.current.permission).toBe('granted');
    });
  });

  /**
   * INVERTED BY #39. This used to assert that a caller's own options were passed
   * through to the device, which is exactly the property that had to go: the
   * product had three different answers to "what does this app request" living in
   * three files, and an external reviewer had no single thing to read.
   *
   * `toEqual` rather than `toMatchObject`, kept from the original: removing a key
   * from GRID_POSITION_OPTIONS must fail this, not silently pass.
   */
  it('always makes the same ask, and no caller can change it', () => {
    type PositionOptions = {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    };
    let seen: PositionOptions | null = null;
    mockGeolocation.getCurrentPosition.mockImplementation(
      (
        success: PositionCallback,
        error: PositionErrorCallback,
        options: PositionOptions
      ) => {
        seen = options;
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    expect(seen).toEqual(GRID_POSITION_OPTIONS);
    expect(seen).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
  });
});
