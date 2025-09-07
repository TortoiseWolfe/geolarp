import {
  Coordinates,
  PrivacyCoordinates,
  GeofenceArea,
  LocationPermissionState,
  LocationServiceConfig,
  LocationCallback,
  ErrorCallback,
  Zone
} from './types';
import { roundToGrid, calculateDistance, isWithinGeofence } from './privacy';
import { optimizeForBattery, getGeolocationOptions, monitorBattery } from './battery-optimization';
import { getLocationFromIP, parseManualCoordinates, getZoneById, FALLBACK_ZONES } from './fallback-strategies';

export class LocationService {
  private config: LocationServiceConfig;
  private watchId: number | null = null;
  private lastPosition: PrivacyCoordinates | null = null;
  private permissionState: LocationPermissionState;
  private locationCallbacks: Set<LocationCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private geofences: Map<string, GeofenceArea> = new Map();
  private batteryCleanup: (() => void) | null = null;

  constructor(config?: Partial<LocationServiceConfig>) {
    this.config = {
      accuracyMode: 'balanced',
      updateInterval: 30000,
      distanceFilter: 10,
      enablePrivacy: true,
      enableBatteryOptimization: true,
      ...config
    };

    this.permissionState = {
      permission: 'prompt',
      lastChecked: Date.now()
    };

    // Start battery monitoring if enabled
    if (this.config.enableBatteryOptimization) {
      this.startBatteryMonitoring();
    }

    // Load last known position from localStorage
    this.loadLastPosition();
  }

  /**
   * Request location permission with explanation
   */
  async requestPermission(): Promise<PermissionState> {
    try {
      // Check if geolocation is available
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation is not supported by your browser');
      }

      // Check permission API if available
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        this.permissionState = {
          permission: result.state,
          lastChecked: Date.now()
        };

        // Listen for permission changes
        result.addEventListener('change', () => {
          this.permissionState = {
            permission: result.state,
            lastChecked: Date.now()
          };
        });

        return result.state;
      }

      // Fallback: try to get position to trigger permission prompt
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            this.permissionState = {
              permission: 'granted',
              lastChecked: Date.now()
            };
            resolve('granted');
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              this.permissionState = {
                permission: 'denied',
                lastChecked: Date.now()
              };
              resolve('denied');
            } else {
              this.permissionState = {
                permission: 'prompt',
                lastChecked: Date.now()
              };
              resolve('prompt');
            }
          },
          { timeout: 5000 }
        );
      });
    } catch (error) {
      console.error('[Location] Permission check failed:', error);
      return 'denied';
    }
  }

  /**
   * Get current position with fallback strategies
   */
  async getCurrentPosition(): Promise<PrivacyCoordinates> {
    // Try primary strategy: Browser Geolocation
    try {
      const position = await this.getBrowserPosition();
      if (position) {
        return this.processPosition(position);
      }
    } catch (error) {
      console.warn('[Location] Browser geolocation failed:', error);
    }

    // Fallback 1: IP-based geolocation
    if (this.permissionState.permission === 'denied' || !('geolocation' in navigator)) {
      try {
        const ipLocation = await getLocationFromIP();
        if (ipLocation) {
          this.permissionState.fallbackMode = 'ip';
          return this.processPosition(ipLocation);
        }
      } catch (error) {
        console.warn('[Location] IP geolocation failed:', error);
      }
    }

    // Fallback 2: Use last known position
    if (this.lastPosition) {
      console.log('[Location] Using last known position');
      return this.lastPosition;
    }

    // Fallback 3: Default to first zone
    if (FALLBACK_ZONES.length > 0) {
      this.permissionState.fallbackMode = 'zone';
      return this.processPosition(FALLBACK_ZONES[0].center);
    }

    throw new Error('Unable to determine location');
  }

  /**
   * Watch position with updates
   */
  watchPosition(callback: LocationCallback, errorCallback?: ErrorCallback): number {
    this.locationCallbacks.add(callback);
    if (errorCallback) {
      this.errorCallbacks.add(errorCallback);
    }

    // Start watching if not already
    if (this.watchId === null && 'geolocation' in navigator) {
      const options = getGeolocationOptions(this.config.accuracyMode);
      
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        options
      );
    }

    // Return a unique ID for this callback
    return Date.now();
  }

  /**
   * Clear position watch
   */
  clearWatch(callbackId?: number): void {
    if (callbackId) {
      // In a real implementation, track callbacks by ID
      // For now, clear all if no callbacks remain
      if (this.locationCallbacks.size === 0 && this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    } else {
      // Clear all watches
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.locationCallbacks.clear();
      this.errorCallbacks.clear();
    }
  }

  /**
   * Get distance to target
   */
  getDistanceTo(target: Coordinates): number {
    if (!this.lastPosition) {
      throw new Error('No current position available');
    }
    return calculateDistance(this.lastPosition, target);
  }

  /**
   * Enter a geofence area
   */
  enterGeofence(area: GeofenceArea): void {
    this.geofences.set(area.id, area);
    
    // Check if already inside
    if (this.lastPosition && isWithinGeofence(this.lastPosition, area.center, area.radius)) {
      console.log(`[Geofence] Already inside ${area.name}`);
    }
  }

  /**
   * Set accuracy mode
   */
  async setAccuracy(mode: 'high' | 'balanced' | 'low'): Promise<void> {
    this.config.accuracyMode = mode;
    
    // Update battery optimization
    if (this.config.enableBatteryOptimization) {
      this.config = await optimizeForBattery(this.config);
    }
    
    // Restart watching with new settings
    if (this.watchId !== null) {
      const callbacks = [...this.locationCallbacks];
      const errorCallbacks = [...this.errorCallbacks];
      
      this.clearWatch();
      
      callbacks.forEach(cb => this.locationCallbacks.add(cb));
      errorCallbacks.forEach(cb => this.errorCallbacks.add(cb));
      
      if (callbacks.length > 0) {
        this.watchPosition(callbacks[0]);
      }
    }
  }

  /**
   * Set location from manual input
   */
  setManualLocation(input: string): PrivacyCoordinates | null {
    const coords = parseManualCoordinates(input);
    if (coords) {
      this.permissionState.fallbackMode = 'manual';
      const processed = this.processPosition(coords);
      this.notifyCallbacks(processed);
      return processed;
    }
    return null;
  }

  /**
   * Set location from zone selection
   */
  setZoneLocation(zoneId: string): PrivacyCoordinates | null {
    const zone = getZoneById(zoneId);
    if (zone) {
      this.permissionState.fallbackMode = 'zone';
      const processed = this.processPosition(zone.center);
      this.notifyCallbacks(processed);
      return processed;
    }
    return null;
  }

  /**
   * Get available zones
   */
  getAvailableZones(): Zone[] {
    return FALLBACK_ZONES;
  }

  /**
   * Get current permission state
   */
  getPermissionState(): LocationPermissionState {
    return this.permissionState;
  }

  /**
   * Get last known position
   */
  getLastPosition(): PrivacyCoordinates | null {
    return this.lastPosition;
  }

  // Private methods

  private async getBrowserPosition(): Promise<Coordinates | null> {
    return new Promise((resolve, reject) => {
      const options = getGeolocationOptions(this.config.accuracyMode);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp
          });
        },
        reject,
        options
      );
    });
  }

  private processPosition(coords: Coordinates): PrivacyCoordinates {
    const processed = this.config.enablePrivacy 
      ? roundToGrid(coords)
      : {
          lat: coords.lat,
          lng: coords.lng,
          gridCell: `${coords.lat}_${coords.lng}`,
          timestamp: coords.timestamp
        };
    
    this.lastPosition = processed;
    this.saveLastPosition();
    
    // Check geofences
    this.checkGeofences(processed);
    
    return processed;
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const coords: Coordinates = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined,
      timestamp: position.timestamp
    };

    // Check distance filter
    if (this.lastPosition) {
      const distance = calculateDistance(this.lastPosition, coords);
      if (distance < this.config.distanceFilter) {
        return; // Not enough movement
      }
    }

    const processed = this.processPosition(coords);
    this.notifyCallbacks(processed);
  }

  private handlePositionError(error: GeolocationPositionError): void {
    // Log more detailed error information
    const errorMessages: { [key: number]: string } = {
      1: 'Permission denied - Please allow location access',
      2: 'Position unavailable - Location services may be disabled',
      3: 'Timeout - Location request took too long'
    };
    
    const errorMessage = errorMessages[error.code] || 'Unknown location error';
    console.warn(`[Location] ${errorMessage}`, {
      code: error.code,
      message: error.message
    });
    
    this.errorCallbacks.forEach(callback => {
      callback(error);
    });

    // Try fallback strategies
    if (error.code === error.PERMISSION_DENIED) {
      this.permissionState.permission = 'denied';
      this.permissionState.fallbackMode = 'ip';
      
      // Automatically try IP fallback
      getLocationFromIP().then(ipLocation => {
        if (ipLocation) {
          const processed = this.processPosition(ipLocation);
          this.notifyCallbacks(processed);
        }
      }).catch(err => {
        console.warn('[Location] IP fallback also failed:', err);
      });
    }
  }

  private notifyCallbacks(position: PrivacyCoordinates): void {
    this.locationCallbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('[Location] Callback error:', error);
      }
    });
  }

  private checkGeofences(position: PrivacyCoordinates): void {
    this.geofences.forEach((area) => {
      const inside = isWithinGeofence(position, area.center, area.radius);
      
      if (inside && !area.active) {
        area.active = true;
        console.log(`[Geofence] Entered ${area.name}`);
        // Could emit enter event
      } else if (!inside && area.active) {
        area.active = false;
        console.log(`[Geofence] Exited ${area.name}`);
        // Could emit exit event
      }
    });
  }

  private startBatteryMonitoring(): void {
    this.batteryCleanup = monitorBattery(async (status) => {
      console.log(`[Battery] Level: ${(status.level * 100).toFixed(0)}%, Charging: ${status.charging}`);
      this.config = await optimizeForBattery(this.config);
    });
  }

  private saveLastPosition(): void {
    if (this.lastPosition) {
      try {
        localStorage.setItem('geolarp_last_position', JSON.stringify(this.lastPosition));
      } catch (error) {
        console.warn('[Location] Failed to save position:', error);
      }
    }
  }

  private loadLastPosition(): void {
    try {
      const stored = localStorage.getItem('geolarp_last_position');
      if (stored) {
        this.lastPosition = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[Location] Failed to load last position:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearWatch();
    if (this.batteryCleanup) {
      this.batteryCleanup();
    }
  }
}