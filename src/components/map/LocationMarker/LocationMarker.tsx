'use client';

import React, { useEffect } from 'react';
import { Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cellOf, type Cell } from '@/lib/geolarp/cell';
import type { DeviceFix } from '@/lib/geolarp/deviceFix';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

/**
 * The player's position on a map: exactly where the device says it is (#183).
 *
 * It takes a `DeviceFix`, the one shape a reading has after the socket in
 * `lib/geolarp/deviceFix.ts`, and draws the dot at the reading with a circle of the
 * device's own error radius. (Under #39 it drew a cell centre with a circle widened
 * to cover the whole cell; the owner wants the exact position, #183.)
 */
export interface LocationMarkerProps {
  /** The device's exact reading and its cell. */
  fix: DeviceFix;
  /** Draw the device's error circle. */
  showAccuracy?: boolean;
  popup?: string;
  /** Allow the player to place themselves by hand — see `onDragEnd`. */
  draggable?: boolean;
  /** Emits the CELL the marker was dropped in: picking a zone by hand. */
  onDragEnd?: (cell: Cell) => void;
  testId?: string;
}

// Custom blue marker icon for user location
const userLocationIcon =
  typeof window !== 'undefined'
    ? L.divIcon({
        className: 'user-location-marker',
        html: `
    <div class="relative">
      <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-75"></div>
      <div class="relative bg-primary rounded-full w-4 h-4 border-2 border-white shadow-lg"></div>
    </div>
  `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
    : undefined;

export const LocationMarker: React.FC<LocationMarkerProps> = ({
  fix,
  showAccuracy = true,
  popup,
  draggable = false,
  onDragEnd,
  testId = 'user-location-marker',
}) => {
  const map = useMap();
  const position: [number, number] = [fix.lat, fix.lon];

  // Accuracy circle tracks the active DaisyUI theme's primary color (issue #37),
  // matching the marker dot (which uses the `bg-primary` class). The hook
  // re-renders on theme switch so the circle recolors live.
  const { hexWithHash: themeColor } = useEmbedThemeColor('p');

  useEffect(() => {
    map.setView(position, map.getZoom());
    // `fix.lat`/`fix.lon` rather than the array, which is a new identity each
    // render and would re-pan the map on every parent update.
  }, [fix.lat, fix.lon, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragEnd = (event: L.DragEndEvent) => {
    if (!onDragEnd) return;
    const dropped = event.target.getLatLng();
    onDragEnd(cellOf(dropped.lat, dropped.lng));
  };

  return (
    <>
      {showAccuracy && (
        <Circle
          center={position}
          radius={fix.accuracy}
          pathOptions={{
            color: themeColor,
            fillColor: themeColor,
            fillOpacity: 0.2,
            weight: 1,
          }}
          data-testid="accuracy-circle"
        />
      )}

      <Marker
        position={position}
        draggable={draggable}
        icon={userLocationIcon}
        eventHandlers={{
          dragend: handleDragEnd,
        }}
      >
        <Popup>
          <div data-testid={testId} data-cell={`${fix.cell.q}:${fix.cell.r}`}>
            {popup ?? (
              <>
                <strong>You are here</strong>
                <br />
                Cell {fix.cell.q}:{fix.cell.r}
                <br />±{Math.round(fix.accuracy)} m
              </>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
};
