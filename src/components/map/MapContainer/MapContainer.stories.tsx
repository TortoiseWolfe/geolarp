import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MapContainer } from './MapContainer';
import { LocationMarker } from '../LocationMarker';
import { deviceFixFrom, type DeviceFix } from '@/lib/geolarp/deviceFix';

/**
 * A FIXED SAMPLE READING. The gallery never asks the visitor where they are (#113).
 *
 * `deploy.yml` publishes Storybook, so this page is public. `showUserLocation`
 * renders a `LocationButton`, and pressing it calls the platform through
 * `getDeviceFix`: a real permission prompt, on a component gallery, outside the
 * app's own consent gate. So the story uses a constant reading instead.
 */
const SAMPLE_FIX: DeviceFix = deviceFixFrom({
  coords: { latitude: 51.505, longitude: -0.09, accuracy: 25 },
  timestamp: 1_757_000_000_000,
} as GeolocationPosition);

const meta = {
  title: 'Features/Map/MapContainer',
  component: MapContainer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    center: {
      control: 'object',
      description: 'Map center coordinates [lat, lng]',
    },
    zoom: {
      control: { type: 'range', min: 1, max: 18 },
      description: 'Initial zoom level',
    },
    height: {
      control: 'text',
      description: 'Map height',
    },
    width: {
      control: 'text',
      description: 'Map width',
    },
    showUserLocation: {
      control: 'boolean',
      description: 'Show user location on map',
    },
  },
} satisfies Meta<typeof MapContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    height: '400px',
    width: '100%',
  },
};

export const WithUserLocation: Story = {
  args: {
    height: '400px',
    width: '100%',
    // NOT `showUserLocation: true`. That renders the live location button, which
    // prompts the visitor for real (#113). See SAMPLE_FIX above.
    showUserLocation: false,
    children: <LocationMarker fix={SAMPLE_FIX} showAccuracy />,
  },
};

export const WithMarkers: Story = {
  args: {
    height: '400px',
    width: '100%',
    markers: [
      {
        id: '1',
        position: [51.505, -0.09] as [number, number],
        popup: 'Marker 1',
      },
      {
        id: '2',
        position: [51.51, -0.1] as [number, number],
        popup: 'Marker 2',
      },
      {
        id: '3',
        position: [51.5, -0.08] as [number, number],
        popup: 'Marker 3',
      },
    ],
  },
};

export const CustomCenter: Story = {
  args: {
    height: '400px',
    width: '100%',
    center: [40.7128, -74.006] as [number, number], // New York
    zoom: 12,
  },
};

export const SmallMap: Story = {
  args: {
    height: '200px',
    width: '300px',
  },
};

export const FullWidth: Story = {
  args: {
    height: '600px',
    width: '100%',
    zoom: 10,
  },
};
