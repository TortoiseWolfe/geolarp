import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationMarker, CELL_CENTRE_UNCERTAINTY_M } from './LocationMarker';
import type { LocationMarkerProps } from './LocationMarker';
import { cellOf, cellCentre } from '@/lib/geolarp/cell';
import type { CoarseFix } from '@/lib/geolarp/coarseFix';

/*
  The mock's own position attribute is `data-marker-at`, NOT `data-position`.

  Deliberate: `data-position` is the name of the leak this rewrite removed (#113),
  and one assertion below is that the string never appears in the rendered output.
  A mock that emits it would make that assertion permanently red, and the obvious
  way to "fix" that is to delete the assertion — so the mock uses a different name
  and the real one stays a reliable tripwire.
*/
vi.mock('react-leaflet', () => ({
  Marker: ({ position, children, eventHandlers }: any) => (
    <div
      data-testid="location-marker"
      data-marker-at={JSON.stringify(position)}
      onClick={() =>
        eventHandlers?.dragend?.({
          target: { getLatLng: () => ({ lat: 35.0456, lng: -85.3097 }) },
        })
      }
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => (
    <div data-testid="marker-popup">{children}</div>
  ),
  Circle: ({ center, radius, pathOptions }: any) => (
    <div
      data-testid="accuracy-circle"
      data-center={JSON.stringify(center)}
      data-radius={radius}
      data-options={JSON.stringify(pathOptions)}
    />
  ),
  useMap: () => ({
    setView: vi.fn(),
    panTo: vi.fn(),
    getZoom: () => 13,
  }),
}));

vi.mock('leaflet', () => ({
  default: { icon: vi.fn(() => ({})), divIcon: vi.fn(() => ({})) },
}));

const THEME_COLOR = '#aabbcc';
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => ({
    hex: 'aabbcc',
    hexWithHash: THEME_COLOR,
    isDark: false,
  }),
}));

/** A reading whose coordinate is already gone, built the way the app builds one. */
function fixAt(lat: number, lon: number, accuracy = 10): CoarseFix {
  const cell = cellOf(lat, lon);
  const centre = cellCentre(cell);
  return {
    cell,
    lat: centre.lat,
    lon: centre.lon,
    accuracy,
    timestamp: 1_757_000_000_000,
  };
}

describe('LocationMarker', () => {
  const FIX = fixAt(51.505, -0.09);
  const defaultProps: LocationMarkerProps = { fix: FIX };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders at the cell centre, which is the only position it is given', () => {
    render(<LocationMarker {...defaultProps} />);
    expect(screen.getByTestId('location-marker')).toHaveAttribute(
      'data-marker-at',
      JSON.stringify([FIX.lat, FIX.lon])
    );
  });

  /**
   * THE THREE LEAKS THIS COMPONENT USED TO HAVE (#113), asserted directly.
   *
   * None was ever live — nothing imported the file. That is exactly why they
   * needed pinning: #39's gate asserts who may CALL the platform, not who may
   * HOLD a coordinate, so an import would have reintroduced all three and passed
   * every check in the repo.
   */
  describe('publishes no coordinate', () => {
    it('does not serialise a position into the markup', () => {
      const { container } = render(<LocationMarker {...defaultProps} />);
      expect(
        container.innerHTML,
        'data-position is back: it carried the raw pair into the rendered ' +
          'markup, where it survives in page.content() and a text-only ' +
          'assertion would miss it'
      ).not.toContain('data-position');
    });

    it('shows the cell in the popup, not latitude and longitude', () => {
      render(<LocationMarker {...defaultProps} />);
      const popup = screen.getByTestId('marker-popup');
      expect(popup).toHaveTextContent(`Cell ${FIX.cell.q}:${FIX.cell.r}`);
      // The old default popup printed `Lat: {position[0].toFixed(4)}` — ~11 m,
      // the same display defect #39 removed from /map.
      expect(popup.textContent).not.toMatch(/Lat:|Lng:/);
      expect(
        popup.textContent,
        'a coordinate at 3+ decimal places is finer than the 100 m the ' +
          'product promises'
      ).not.toMatch(/-?\d+\.\d{3,}/);
    });

    it('emits a CELL from a drag, never the point that was dropped', () => {
      const onDragEnd = vi.fn();
      render(
        <LocationMarker {...defaultProps} draggable onDragEnd={onDragEnd} />
      );
      screen.getByTestId('location-marker').click();

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const emitted = onDragEnd.mock.calls[0][0];
      // The mock drops the marker on Chattanooga; the cell for that point is
      // what must come back, not 35.0456/-85.3097.
      expect(emitted).toEqual(cellOf(35.0456, -85.3097));
      expect(Object.keys(emitted).sort()).toEqual(['q', 'r']);
      expect(JSON.stringify(emitted)).not.toContain('35.0456');
    });
  });

  describe('the uncertainty circle', () => {
    /**
     * The old circle was `radius={accuracy}` around the position. Once the
     * position became a cell centre that became a FALSE claim rather than a
     * coarse one — a ±10 m circle around a cell centre excludes most of the
     * cell, including wherever the reader actually is.
     */
    it('covers the device error AND the distance to the cell centre', () => {
      render(<LocationMarker {...defaultProps} showAccuracy />);
      const radius = Number(
        screen.getByTestId('accuracy-circle').getAttribute('data-radius')
      );
      expect(radius).toBeCloseTo(10 + CELL_CENTRE_UNCERTAINTY_M, 6);
      expect(
        radius,
        'the circle is back to the bare accuracy figure, which asserts the ' +
          'reader is somewhere they provably need not be'
      ).toBeGreaterThan(FIX.accuracy);
    });

    it('is wide enough to contain the reading it was built from', () => {
      // The property that makes the circle honest, checked rather than asserted:
      // sweep real points, and the true reading must fall inside the circle
      // drawn around its own cell centre every time.
      // Swept globally rather than near London, because the error is driven by
      // grid convergence: at λ ≈ 0 it is structurally invisible, and the worst
      // case measured (66.14 m) sits at the equator near λ = 45.
      const M_PER_DEG_LAT = 111_320;
      for (let i = 0; i < 20000; i++) {
        const lat = -75 + ((i * 37) % 150000) / 1000;
        const lon = -180 + ((i * 97) % 360000) / 1000;
        const f = fixAt(lat, lon, 5);
        const dN = (f.lat - lat) * M_PER_DEG_LAT;
        const dE =
          (f.lon - lon) * M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
        expect(Math.hypot(dN, dE)).toBeLessThanOrEqual(
          f.accuracy + CELL_CENTRE_UNCERTAINTY_M
        );
      }
    });

    /**
     * THE IDEAL IS THE WRONG NUMBER, and it fails in the unsafe direction.
     *
     * A regular pointy-top hex of width CELL_METRES has circumradius 57.735 m,
     * and this constant was that value first. The sweep above caught it: real
     * readings reach 66.14 m from their cell centre, because the lattice shears
     * with grid convergence (#87) and is not regular on the ground. A circle
     * drawn at 57.7 m would exclude places the reader can actually be — which is
     * precisely the false claim this rewrite exists to stop making.
     */
    it('is not the unsheared hex circumradius', () => {
      expect(CELL_CENTRE_UNCERTAINTY_M).toBeCloseTo(70.711, 3);
      expect(
        CELL_CENTRE_UNCERTAINTY_M,
        'this is the ideal 100/√3, which a 400k-point sweep exceeds at 66.14 m'
      ).toBeGreaterThan(57.736);
      // And it must still clear the measured worst case, with room.
      expect(CELL_CENTRE_UNCERTAINTY_M).toBeGreaterThan(66.15);
    });

    it('colors with the theme primary, not a hardcoded blue (#37)', () => {
      render(<LocationMarker {...defaultProps} showAccuracy />);
      const options = JSON.parse(
        screen.getByTestId('accuracy-circle').getAttribute('data-options') ||
          '{}'
      );
      expect(options.color).toBe(THEME_COLOR);
      expect(options.fillColor).toBe(THEME_COLOR);
      expect(options.color).not.toBe('blue');
      expect(options.fillColor).not.toBe('lightblue');
    });

    it('is absent when showAccuracy is false', () => {
      render(<LocationMarker {...defaultProps} showAccuracy={false} />);
      expect(screen.queryByTestId('accuracy-circle')).not.toBeInTheDocument();
    });
  });

  it('renders custom popup content when given', () => {
    render(<LocationMarker {...defaultProps} popup="You are here" />);
    expect(screen.getByTestId('marker-popup')).toHaveTextContent(
      'You are here'
    );
  });

  it('exposes the cell as a test handle', () => {
    render(<LocationMarker {...defaultProps} testId="me" />);
    expect(screen.getByTestId('me')).toHaveAttribute(
      'data-cell',
      `${FIX.cell.q}:${FIX.cell.r}`
    );
  });
});
