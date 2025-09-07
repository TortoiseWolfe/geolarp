import { AccuracyMode, LocationServiceConfig } from './types';

interface BatteryStatus {
  level: number;
  charging: boolean;
}

/**
 * Get current battery status
 */
export async function getBatteryStatus(): Promise<BatteryStatus | null> {
  if ('getBattery' in navigator) {
    try {
      const battery = await (navigator as any).getBattery();
      return {
        level: battery.level,
        charging: battery.charging
      };
    } catch (error) {
      console.warn('[Battery] Battery API not available:', error);
      return null;
    }
  }
  return null;
}

/**
 * Optimize location settings based on battery level
 */
export async function optimizeForBattery(
  currentConfig: LocationServiceConfig
): Promise<LocationServiceConfig> {
  const battery = await getBatteryStatus();
  
  if (!battery || !currentConfig.enableBatteryOptimization) {
    return currentConfig;
  }

  let accuracyMode: AccuracyMode = currentConfig.accuracyMode;
  let updateInterval = currentConfig.updateInterval;

  if (battery.charging) {
    // When charging, use high accuracy
    accuracyMode = 'high';
    updateInterval = 10000; // 10 seconds
  } else if (battery.level < 0.2) {
    // Low battery: maximum power saving
    accuracyMode = 'low';
    updateInterval = 60000; // 1 minute
    console.log('[Battery] Low battery mode activated (< 20%)');
  } else if (battery.level < 0.5) {
    // Medium battery: balanced mode
    accuracyMode = 'balanced';
    updateInterval = 30000; // 30 seconds
    console.log('[Battery] Balanced mode activated (< 50%)');
  } else {
    // Good battery: normal operation
    accuracyMode = 'high';
    updateInterval = 10000; // 10 seconds
  }

  return {
    ...currentConfig,
    accuracyMode,
    updateInterval
  };
}

/**
 * Convert accuracy mode to Geolocation API options
 */
export function getGeolocationOptions(mode: AccuracyMode): PositionOptions {
  switch (mode) {
    case 'high':
      return {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };
    case 'balanced':
      return {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000
      };
    case 'low':
      return {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000
      };
    default:
      return {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000
      };
  }
}

/**
 * Monitor battery and adjust settings
 */
export function monitorBattery(
  onBatteryChange: (status: BatteryStatus) => void
): (() => void) | null {
  if ('getBattery' in navigator) {
    let cleanup: (() => void) | null = null;
    
    (navigator as any).getBattery().then((battery: any) => {
      const handleChange = () => {
        onBatteryChange({
          level: battery.level,
          charging: battery.charging
        });
      };

      battery.addEventListener('levelchange', handleChange);
      battery.addEventListener('chargingchange', handleChange);

      cleanup = () => {
        battery.removeEventListener('levelchange', handleChange);
        battery.removeEventListener('chargingchange', handleChange);
      };
    }).catch((error: Error) => {
      console.warn('[Battery] Failed to monitor battery:', error);
    });

    return cleanup;
  }
  
  return null;
}