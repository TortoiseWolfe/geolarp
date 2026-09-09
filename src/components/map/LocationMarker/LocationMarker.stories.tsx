import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LocationMarker } from './LocationMarker';
import { MapContainer, TileLayer } from 'react-leaflet';
import { cellOf, cellCentre } from '@/lib/geolarp/cell';
import type { CoarseFix } from '@/lib/geolarp/coarseFix';
import 'leaflet/dist/leaflet.css';

/**
 * FIXED SAMPLE READINGS, never the viewer's own (#113).
 *
 * Storybook is published by `deploy.yml`, so anything these stories can do, a
 * visitor to the gallery can do. They are built from constants and the real
 * quantiser, which is also the point of the demonstration: what the component
 * receives is a cell centre, and the coordinate it came from is already gone.
 */
function sampleFix(lat: number, lon: number, accuracy: number): CoarseFix {
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

const LONDON = (accuracy: number) => sampleFix(51.505, -0.09, accuracy);

const meta = {
  title: 'Features/Map/LocationMarker',
  component: LocationMarker,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '400px', width: '100%' }}>
        <MapContainer
          center={[51.505, -0.09]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Story />
        </MapContainer>
      </div>
    ),
  ],
  argTypes: {
    fix: {
      control: 'object',
      description:
        'A CoarseFix: the cell, its centre, and the device error radius. Never a raw coordinate.',
    },
    showAccuracy: {
      control: 'boolean',
      description: 'Show the uncertainty circle',
    },
    popup: {
      control: 'text',
      description: 'Popup text content',
    },
    draggable: {
      control: 'boolean',
      description: 'Allow the marker to be dragged to pick a cell by hand',
    },
  },
} satisfies Meta<typeof LocationMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { fix: LONDON(50), showAccuracy: true },
};

export const NoAccuracy: Story = {
  args: { fix: LONDON(50), showAccuracy: false },
};

/**
 * The circle is the device error PLUS the distance to the cell centre, so even
 * a 10 m fix draws a circle around 81 m wide. That is the honest figure: the
 * dot is the cell centre, and the reader can be most of a cell away from it.
 */
export const HighAccuracy: Story = {
  args: { fix: LONDON(10), showAccuracy: true },
};

export const LowAccuracy: Story = {
  args: { fix: LONDON(200), showAccuracy: true },
};

export const WithCustomPopup: Story = {
  args: { fix: LONDON(50), popup: 'You are here!' },
};

/** Dragging picks a CELL. The drop point is quantised and never surfaces. */
export const Draggable: Story = {
  args: {
    fix: LONDON(50),
    draggable: true,
    onDragEnd: (cell) => console.log('Moved to cell:', cell),
  },
};

export const MultipleAccuracyLevels: Story = {
  args: { fix: LONDON(20), showAccuracy: true },
  render: (args) => (
    <>
      <LocationMarker {...args} />
      <LocationMarker fix={sampleFix(51.51, -0.1, 100)} showAccuracy />
      <LocationMarker fix={sampleFix(51.5, -0.08, 300)} showAccuracy />
    </>
  ),
};
