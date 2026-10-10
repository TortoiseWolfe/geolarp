import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationMarker } from './LocationMarker';
import type { LocationMarkerProps } from './LocationMarker';
import { cellOf } from '@/lib/geolarp/cell';
import { deviceFixFrom, type DeviceFix } from '@/lib/geolarp/deviceFix';

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

/** A reading built the way the app builds one, through the socket. */
function fixAt(lat: number, lon: number, accuracy = 10): DeviceFix {
  return deviceFixFrom({
    coords: { latitude: lat, longitude: lon, accuracy },
    timestamp: 1_757_000_000_000,
  } as GeolocationPosition);
}

describe('LocationMarker', () => {
  const FIX = fixAt(51.505, -0.09);
  const defaultProps: LocationMarkerProps = { fix: FIX };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly where the device says the player is (#183)', () => {
    render(<LocationMarker {...defaultProps} />);
    expect(screen.getByTestId('location-marker')).toHaveAttribute(
      'data-marker-at',
      JSON.stringify([51.505, -0.09])
    );
  });

  it('shows the player where they are, their cell and the device error', () => {
    render(<LocationMarker {...defaultProps} />);
    const popup = screen.getByTestId('marker-popup');
    expect(popup).toHaveTextContent('You are here');
    expect(popup).toHaveTextContent(`Cell ${FIX.cell.q}:${FIX.cell.r}`);
    expect(popup).toHaveTextContent('±10 m');
  });

  it('emits the cell a drag lands in: picking a zone by hand', () => {
    const onDragEnd = vi.fn();
    render(
      <LocationMarker {...defaultProps} draggable onDragEnd={onDragEnd} />
    );
    screen.getByTestId('location-marker').click();
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd.mock.calls[0][0]).toEqual(cellOf(35.0456, -85.3097));
  });

  describe('the accuracy circle', () => {
    it('is the device error radius, around the exact position', () => {
      render(<LocationMarker {...defaultProps} showAccuracy />);
      const circle = screen.getByTestId('accuracy-circle');
      expect(Number(circle.getAttribute('data-radius'))).toBe(10);
      expect(circle).toHaveAttribute(
        'data-center',
        JSON.stringify([51.505, -0.09])
      );
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
