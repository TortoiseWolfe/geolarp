'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import { fixLeafletIconPaths, DEFAULT_MAP_CONFIG } from '@/utils/map-utils';
import { LocationButton } from '@/components/map/LocationButton';
import 'leaflet/dist/leaflet.css';
import { getCoarseFix, type CoarseFix } from '@/lib/geolarp/coarseFix';

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
  /**
   * BREAKING: emits a `CoarseFix`, not a `GeolocationPosition` (#39).
   *
   * A deliberate change to a published template API. A fork that genuinely wants
   * raw coordinates must now write its own `navigator.geolocation` call, which is
   * the loud failure rather than the quiet one — the previous signature let a
   * consumer receive a full-precision reading and look correct doing it.
   */
  onLocationFound?: (fix: CoarseFix) => void;
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

    // Through the socket (#39). This component had its OWN `navigator.geolocation`
    // call with a hardcoded `enableHighAccuracy: true`, so quantising inside
    // `useGeolocation` — which is what the ticket proposed — would have left it
    // untouched. Both sinks below now receive a cell centre: the callback the
    // consumer sees, and the `setView` that drives position-derived tile requests
    // to a third-party CDN.
    getCoarseFix(
      (fix) => {
        setLocationLoading(false);
        if (onLocationFound) {
          onLocationFound(fix);
        }
        // Pan map to the cell, not the reader. At z=16 a cell centre is off by at
        // most ~48px on a 600px map; the marker icon alone is 25x41.
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
