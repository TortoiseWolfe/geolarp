'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import { fixLeafletIconPaths, DEFAULT_MAP_CONFIG } from '@/utils/map-utils';
import { LocationButton } from '@/components/map/LocationButton';
import 'leaflet/dist/leaflet.css';
import { getDeviceFix, type DeviceFix } from '@/lib/geolarp/deviceFix';

export interface MapContainerProps {
  center?: LatLngTuple;
  zoom?: number;
  height?: string;
  width?: string;
  showUserLocation?: boolean;
  markers?: Array<{
    position: LatLngTuple;
    popup?: string;
    id: string;
  }>;
  /** Emits a `DeviceFix`: the exact reading and its cell, through the one socket. */
  onLocationFound?: (fix: DeviceFix) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
  onMapReady?: (map: LeafletMap) => void;
  className?: string;
  testId?: string;
  style?: React.CSSProperties;
  config?: {
    center?: LatLngTuple;
    zoom?: number;
    height?: string;
    showUserLocation?: boolean;
    allowZoom?: boolean;
    allowPan?: boolean;
    scrollWheelZoom?: boolean;
    keyboardNavigation?: boolean;
    zoomControl?: boolean;
    tileUrl?: string;
    attribution?: string;
  };
  children?: React.ReactNode;
}

const MapContainerInner = dynamic(() => import('./MapContainerInner'), {
  ssr: false,
  loading: () => (
    <div className="bg-base-200 flex h-full items-center justify-center">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  ),
});

export const MapContainer: React.FC<MapContainerProps> = ({
  center = DEFAULT_MAP_CONFIG.center,
  zoom = DEFAULT_MAP_CONFIG.zoom,
  height = DEFAULT_MAP_CONFIG.height,
  width = DEFAULT_MAP_CONFIG.width,
  showUserLocation = false,
  markers = [],
  onLocationFound,
  onLocationError,
  onMapReady,
  className = '',
  testId = 'map-container',
  style,
  config,
  children,
}) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    fixLeafletIconPaths();
  }, []);

  const handleMapReady = useCallback(
    (map: LeafletMap) => {
      mapRef.current = map;
      /*
        A TEST CONVENIENCE, NOW WITH A DIRECTION (#113).

        This handle is how `tests/e2e/map.spec.ts` drives the map — it reads it in
        a dozen places. But the guard used to be `typeof window !== 'undefined'`,
        which is an SSR check, not an environment check: it ran in production too,
        handing any script on the page the live Leaflet instance, its centre and
        its zoom. CLAUDE.md's rule is that an environment guard has a direction —
        a convenience MAY be limited to development, a protection may not — and
        "for testing" and "always on" should not both be true.

        `NODE_ENV === 'development'` ALONE WOULD BREAK CI, which is why the second
        clause is here rather than being the obvious one-liner. The E2E lanes build
        with `pnpm build` and serve the static export (`npx serve out`), so
        NODE_ENV is `production` in exactly the runs that need this handle. The
        build sets `NEXT_PUBLIC_E2E` instead; `deploy.yml` does not, and
        `scripts/__tests__/e2e-map-handle.test.js` fails if that ever changes.
      */
      const exposeForTests =
        process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_E2E === 'true';
      if (typeof window !== 'undefined' && exposeForTests) {
        (window as Window & { leafletMap?: LeafletMap }).leafletMap = map;
      }
      if (onMapReady) {
        onMapReady(map);
      }
    },
    [onMapReady]
  );

  const handleLocationClick = useCallback(() => {
    if (!mapRef.current) return;

    setLocationLoading(true);

    if (!navigator.geolocation) {
      setLocationLoading(false);
      if (onLocationError) {
        const error: GeolocationPositionError = {
          code: 2,
          message: 'Geolocation is not supported by this browser',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        };
        onLocationError(error);
      }
      return;
    }

    // Through the one socket (#39): this component used to have its own
    // `navigator.geolocation` call with its own options.
    getDeviceFix(
      (fix) => {
        setLocationLoading(false);
        if (onLocationFound) {
          onLocationFound(fix);
        }
        if (mapRef.current) {
          mapRef.current.setView([fix.lat, fix.lon], 16);
        }
      },
      (error) => {
        setLocationLoading(false);
        if (onLocationError) {
          onLocationError(error);
        }
      }
    );
  }, [onLocationFound, onLocationError]);

  return (
    <div
      data-testid={testId}
      className={`relative ${className}`}
      style={{ height: config?.height || height, width, ...style }}
      role="application"
      aria-label="Interactive map"
    >
      <MapContainerInner
        center={config?.center || center}
        zoom={config?.zoom || zoom}
        markers={markers}
        onMapReady={handleMapReady}
        tileUrl={config?.tileUrl}
        attribution={config?.attribution}
        scrollWheelZoom={config?.scrollWheelZoom}
        zoomControl={config?.zoomControl}
        keyboardNavigation={config?.keyboardNavigation}
      >
        {children}
      </MapContainerInner>
      {showUserLocation && (
        <LocationButton
          onClick={handleLocationClick}
          loading={locationLoading}
          className="absolute top-4 right-4 z-[1000]"
        />
      )}
    </div>
  );
};
