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
      // Expose map instance to window for testing
      if (typeof window !== 'undefined') {
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
