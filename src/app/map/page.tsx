'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { LocationButton } from '@/components/map/LocationButton';
import {
  GeolocationConsent,
  GeolocationPurpose,
} from '@/components/map/GeolocationConsent';
import type { LatLngTuple } from 'leaflet';

// Dynamic import for MapContainer to avoid SSR issues
const MapContainer = dynamicImport(
  () =>
    import('@/components/map/MapContainer').then((mod) => ({
      default: mod.MapContainer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-base-200 flex h-[600px] items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    ),
  }
);

export default function MapPage() {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngTuple>([51.505, -0.09]); // Default to London

  // No options (#39): the ask is stated once in GRID_POSITION_OPTIONS and callers
  // cannot restate it. `fix` is a cell centre, never a device reading.
  const {
    fix,
    permission,
    loading,
    error,
    accuracy,
    getCurrentPosition,
    isSupported,
  } = useGeolocation();

  // Check localStorage after mount
  useEffect(() => {
    const consent = localStorage.getItem('geolocation-consent');
    if (consent) {
      try {
        const parsed = JSON.parse(consent);
        if (parsed.consentGiven === true) {
          setHasConsent(true);
        }
      } catch {
        // Invalid consent data, keep as false
      }
    }
  }, []);

  const handleLocationRequest = useCallback(() => {
    if (!hasConsent) {
      setShowConsentModal(true);
    } else {
      getCurrentPosition();
    }
  }, [hasConsent, getCurrentPosition]);

  const handleConsentAccept = useCallback(
    (purposes: GeolocationPurpose[]) => {
      // Save consent to localStorage
      const consentData = {
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes,
        expiryDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(), // 1 year
      };
      localStorage.setItem('geolocation-consent', JSON.stringify(consentData));

      setHasConsent(true);
      setShowConsentModal(false);

      // Request location after consent
      getCurrentPosition();
    },
    [getCurrentPosition]
  );

  const handleConsentDecline = useCallback(() => {
    // Save rejection to localStorage
    const consentData = {
      consentGiven: false,
      consentDate: new Date().toISOString(),
      purposes: [],
    };
    localStorage.setItem('geolocation-consent', JSON.stringify(consentData));

    setHasConsent(false);
    setShowConsentModal(false);
  }, []);

  // Update location when the cell changes.
  //
  // `userLocation` is the CELL CENTRE, so everything downstream of it is too: the
  // marker, the popup, the map centre, and — the reason this matters most — the
  // z/x/y tile requests those drive to a third-party CDN. Before #39 that centred
  // OpenStreetMap's view of the visitor on their actual position.
  React.useEffect(() => {
    if (fix) {
      const newLocation: LatLngTuple = [fix.lat, fix.lon];
      setUserLocation(newLocation);
      setMapCenter(newLocation);
    }
  }, [fix]);

  // Example markers for demo purposes
  const demoMarkers = [
    {
      id: 'marker1',
      position: [51.51, -0.1] as LatLngTuple,
      popup: 'Test Marker 1',
    },
    {
      id: 'marker2',
      position: [51.5, -0.08] as LatLngTuple,
      popup: 'Test Marker 2',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-base-content mb-2 font-mono text-xs tracking-[.14em] uppercase">
          Live demo
        </p>
        <h1 className="text-base-content font-display mb-4 text-4xl tracking-[-0.025em] sm:text-5xl">
          Interactive Map
        </h1>
        <p className="text-base-content mt-2">
          Explore the map and enable location services to see your current
          position.
          {mounted && !isSupported && (
            <span className="text-error ml-2">
              (Geolocation is not supported by your browser)
            </span>
          )}
        </p>
      </header>

      <section className="sh-plate bg-base-100 rounded-box">
        <div className="p-4 sm:p-6">
          <div className="sh-groove bg-base-100 rounded-box mb-4 flex flex-wrap items-center gap-4 p-3">
            <LocationButton
              onClick={handleLocationRequest}
              loading={loading}
              disabled={!mounted || !isSupported || permission === 'denied'}
              hasLocation={!!userLocation}
              permissionState={permission}
            />

            {error && (
              <div className="alert alert-error">
                <span>{error.message}</span>
              </div>
            )}

            {userLocation && (
              <div className="stats">
                <div className="stat">
                  <div className="stat-title">Your 100-metre cell</div>
                  {/*
                    `toFixed(4)` is unchanged and was never the problem — what
                    changed is what is fed to it. These are cell-centre
                    coordinates, so the four decimals describe the cell, not the
                    reader. EncounterCard already prints the identical formatter
                    on a cell centre.
                  */}
                  <div className="stat-value text-lg">
                    {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </div>
                  {accuracy && (
                    <div className="stat-desc">
                      ±{accuracy.toFixed(0)}m device fix, rounded to a 100 m
                      cell before display
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ring-base-300/50 relative overflow-hidden rounded-xl ring-1">
            <MapContainer
              center={mapCenter}
              zoom={13}
              height="600px"
              width="100%"
              showUserLocation={false} // We'll manage location manually
              config={{ scrollWheelZoom: true }}
              markers={[
                ...demoMarkers,
                ...(userLocation
                  ? [
                      {
                        id: 'user-location',
                        position: userLocation,
                        popup: `Your 100-metre cell (device fix was ±${accuracy?.toFixed(0) || 0}m)`,
                      },
                    ]
                  : []),
              ]}
              testId="map-container"
            />
          </div>
        </div>
      </section>

      {/*
        ASK FOR WHAT YOU DO, AND NOTHING ELSE (#39).
        The modal's default purpose list is all four of the enum, including
        LOCATION_ANALYTICS and PERSONALIZATION. This product does neither — there
        are no geo columns anywhere in the schema, and the published post says so —
        so the live page was asking a visitor to consent to processing that does not
        exist. Over-asking is the same defect as the rounding it sits next to: a
        statement about location that is not true. "explore nearby places" goes for
        the same reason; nothing here searches anything.
      */}
      <GeolocationConsent
        isOpen={showConsentModal}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        onClose={() => setShowConsentModal(false)}
        purposes={[GeolocationPurpose.USER_LOCATION_DISPLAY]}
        title="Enable Location Services"
        description="We'd like to show which 100-metre cell you are in. Your precise location is rounded before anything is done with it, and never leaves your device."
        privacyPolicyUrl="/privacy"
      />
    </main>
  );
}
