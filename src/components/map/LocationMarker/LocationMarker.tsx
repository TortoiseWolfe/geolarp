'use client';

import React, { useEffect } from 'react';
import { Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cellOf, CELL_METRES, type Cell } from '@/lib/geolarp/cell';
import type { CoarseFix } from '@/lib/geolarp/coarseFix';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

/**
 * The user's position on a map, at the only precision this product holds (#113).
 *
 * THIS COMPONENT USED TO BE A #39 RELAPSE WAITING FOR AN IMPORT. It took a raw
 * `LatLngTuple`, and then published it three ways: `data-position` carried the
 * serialised pair into the rendered markup, the popup printed
 * `Lat: {position[0].toFixed(4)}` — ~11 m, the exact display defect #39 removed
 * from `/map` — and `onDragEnd` handed a raw pair back to its consumer.
 *
 * Nothing imported it, which is why none of that was live. It is also why the
 * defect would have returned silently: #39's gate asserts who may CALL the
 * platform, not who may HOLD a coordinate, so an import of this file would have
 * passed every check in the repo.
 *
 * The fix is the type. `CoarseFix` is already "a device reading with the position
 * gone", and taking it makes TypeScript the enforcement rather than a reviewer's
 * memory — a raw pair no longer compiles.
 */
export interface LocationMarkerProps {
  /**
   * A reading with the position already rounded away. `fix.lat`/`fix.lon` are
   * the CELL CENTRE; the device's own coordinate cannot be recovered from them.
   */
  fix: CoarseFix;
  /** Draw the uncertainty circle. */
  showAccuracy?: boolean;
  popup?: string;
  /** Allow the player to place themselves by hand — see `onDragEnd`. */
  draggable?: boolean;
  /**
   * Emits a CELL, never a coordinate.
   *
   * Dragging is how a player picks a zone by hand, which the published post
   * offers as the no-GPS path. It used to emit a `LatLngTuple` — the drop point
   * at full precision, which is a coordinate the product is not supposed to
   * hold, and worse, one the USER produced rather than the device. Quantising
   * here keeps the same capability and gives it the same resolution as
   * everything else.
   */
  onDragEnd?: (cell: Cell) => void;
  testId?: string;
}

/**
 * The furthest any point in a cell can be from that cell's centre, in metres.
 *
 * NOT THE HEX CIRCUMRADIUS, and getting that wrong is the reason this comment is
 * long. A pointy-top hexagon of flat-to-flat width `CELL_METRES` has circumradius
 * `CELL_METRES / √3` ≈ 57.7 m, which is what this constant said first — and a
 * sweep of 400,000 real coordinates measured **66.14 m**, at the equator near
 * λ = 45. The lattice is not a regular hexagon on the ground: each row indexes
 * its columns from the prime meridian using its own longitude quantum, so the
 * cells shear with grid convergence (#87). `cell.test.ts` records making exactly
 * this mistake once — "comparing a sheared lattice against an unsheared ideal" —
 * and the ideal is wrong in the UNSAFE direction here, drawing a circle that
 * excludes places the reader can actually be.
 *
 * `CELL_METRES / √2` ≈ 70.7 m is used instead: it clears the measured 66.14 with
 * margin, and it is already the repo's bound for this quantity —
 * `coarse-fix.test.ts` asserts the same sweep stays under 71 m.
 */
export const CELL_CENTRE_UNCERTAINTY_M = CELL_METRES / Math.SQRT2;

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
    // Pan to the CELL, not the reader.
    map.setView(position, map.getZoom());
    // `fix.lat`/`fix.lon` rather than the array, which is a new identity each
    // render and would re-pan the map on every parent update.
  }, [fix.lat, fix.lon, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragEnd = (event: L.DragEndEvent) => {
    if (!onDragEnd) return;
    const dropped = event.target.getLatLng();
    // Quantise at the boundary. The drop point dies here the same way a device
    // reading dies inside `coarseFixFrom`.
    onDragEnd(cellOf(dropped.lat, dropped.lng));
  };

  /**
   * WHAT THE CIRCLE HONESTLY CLAIMS.
   *
   * It used to be `radius={accuracy}` around `position`, which read as "the
   * reader is within ±accuracy of this dot". Once `position` became a cell
   * centre that was a FALSE statement rather than a coarse one: the true reading
   * can be most of a cell away from the centre, so a ±10 m circle drawn around a
   * cell centre excludes the very place the reader actually is.
   *
   * The circle now covers both terms — the device's own error, plus how far the
   * centre can be from the reading — so the reader is inside it by construction.
   */
  const uncertaintyRadius = fix.accuracy + CELL_CENTRE_UNCERTAINTY_M;

  return (
    <>
      {showAccuracy && (
        <Circle
          center={position}
          radius={uncertaintyRadius}
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
          {/*
            NO `data-position`. It used to carry `JSON.stringify(position)` into
            the markup, where it survives in `page.content()` and a text-only
            assertion would miss it. The cell id is the coarsest honest handle
            and is what a test should be keying on anyway.
          */}
          <div data-testid={testId} data-cell={`${fix.cell.q}:${fix.cell.r}`}>
            {popup ?? (
              <>
                <strong>Your cell</strong>
                <br />
                {/*
                  The CELL, not `toFixed(4)` of a coordinate. Four decimal places
                  is ~11 m — finer than the 100 m the product promises, and the
                  precise defect #39 removed from `/map`.
                */}
                Cell {fix.cell.q}:{fix.cell.r}
                <br />
                Within ~{Math.round(uncertaintyRadius)} m
              </>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
};
