import React, { useEffect } from 'react';
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import L from 'leaflet';
import { DEFAULT_MAP_CONFIG } from '@/utils/map-utils';
import { useMapTheme } from '@/hooks/useMapTheme';

interface MapContainerInnerProps {
  center: LatLngTuple;
  zoom: number;
  markers?: Array<{
    position: LatLngTuple;
    popup?: string;
    id: string;
  }>;
  onMapReady?: (map: LeafletMap) => void;
  tileUrl?: string;
  attribution?: string;
  scrollWheelZoom?: boolean;
  zoomControl?: boolean;
  keyboardNavigation?: boolean;
  children?: React.ReactNode;
}

// Component to handle center updates after map is rendered
const MapCenterUpdater: React.FC<{ center: LatLngTuple }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [map, center]);

  return null;
};

/*
 * THIS USED TO BE A DEVICE-LOCATION ENTRY POINT, AND NOTHING KNEW (#39).
 *
 * It called `map.locate({ setView: true, maxZoom: 16 })` — Leaflet's own
 * geolocation, not `navigator.geolocation` — from a `useEffect` on mount. So it
 * asked for the device position with no user gesture, bypassed /map's own consent
 * modal, moved the viewport onto the real fix, and then rebuilt a synthetic
 * `GeolocationPosition` out of `e.latlng` and handed it back into the app.
 *
 * The ticket listed three entry points, all found by grepping `enableHighAccuracy`.
 * This one never matched that grep, and would have survived a fix to all three
 * while still centring the map correctly — so it would have looked fixed.
 *
 * Deleted rather than quantised: the legitimate trigger is the LocationButton in
 * MapContainer, which is a user gesture and now routes through the socket in
 * lib/geolarp/coarseFix.ts. Removing an entry point is worth more than rounding one.
 * `<MapContainer showUserLocation>` therefore no longer auto-centres on mount; it
 * still renders the button that does.
 */
const MapEventHandler: React.FC<{
  onMapReady?: (map: LeafletMap) => void;
}> = ({ onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
};

const MapContainerInner: React.FC<MapContainerInnerProps> = ({
  center,
  zoom,
  markers = [],
  onMapReady,
  tileUrl: tileUrlProp,
  attribution: attributionProp,
  scrollWheelZoom = DEFAULT_MAP_CONFIG.scrollWheelZoom,
  zoomControl = DEFAULT_MAP_CONFIG.zoomControl,
  keyboardNavigation = DEFAULT_MAP_CONFIG.keyboardNavigation,
  children,
}) => {
  const themeConfig = useMapTheme();

  // Props override the hook when explicitly provided
  const tileUrl = tileUrlProp ?? themeConfig.tileUrl;
  const attribution = attributionProp ?? themeConfig.attribution;

  return (
    <LeafletMapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className="h-full w-full"
      zoomControl={zoomControl}
      keyboard={keyboardNavigation}
    >
      <TileLayer key={tileUrl} attribution={attribution} url={tileUrl} />

      <MapEventHandler onMapReady={onMapReady} />

      <MapCenterUpdater center={center} />

      {markers.map((marker) => (
        <Marker key={marker.id} position={marker.position}>
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      ))}

      {children}
    </LeafletMapContainer>
  );
};

export default MapContainerInner;
