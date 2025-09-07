'use client';

import { useState } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getAreaName } from '@/lib/geolocation/privacy';

export default function GeolocationDemo() {
  const {
    position,
    permission,
    isLoading,
    error,
    requestPermission,
    getCurrentPosition,
    startWatching,
    stopWatching,
    setManualLocation,
    setZoneLocation,
    getDistanceTo,
    addGeofence,
    getAvailableZones,
    setAccuracyMode
  } = useGeolocation({
    enablePrivacy: true,
    enableBatteryOptimization: true,
    autoStart: false
  });

  const [isWatching, setIsWatching] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [accuracyMode, setAccuracyModeState] = useState<'high' | 'balanced' | 'low'>('balanced');
  const [testTarget] = useState({ lat: 37.7749, lng: -122.4194 }); // SF coordinates

  const zones = getAvailableZones();
  const distance = position ? getDistanceTo(testTarget) : null;

  const handleStartWatching = () => {
    startWatching();
    setIsWatching(true);
  };

  const handleStopWatching = () => {
    stopWatching();
    setIsWatching(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = setManualLocation(manualInput);
    if (success) {
      setManualInput('');
    } else {
      alert('Invalid coordinates. Try format: 37.7749, -122.4194');
    }
  };

  const handleZoneSelect = () => {
    if (selectedZone) {
      setZoneLocation(selectedZone);
    }
  };

  const handleAccuracyChange = async (mode: 'high' | 'balanced' | 'low') => {
    await setAccuracyMode(mode);
    setAccuracyModeState(mode);
  };

  const handleAddGeofence = () => {
    if (position) {
      addGeofence({
        id: 'demo-fence',
        name: 'Demo Geofence',
        center: position,
        radius: 100,
        active: false
      });
      alert('Geofence added at current location (100m radius)');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Geolocation Demo</h1>

        {/* Permission Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Permission Status</h2>
          <div className="space-y-2">
            <p>Status: <span className={`font-bold ${
              permission.permission === 'granted' ? 'text-green-500' :
              permission.permission === 'denied' ? 'text-red-500' :
              'text-yellow-500'
            }`}>{permission.permission}</span></p>
            {permission.fallbackMode && (
              <p>Fallback Mode: <span className="text-blue-400">{permission.fallbackMode}</span></p>
            )}
            {!permission.permission || permission.permission === 'prompt' ? (
              <button
                onClick={requestPermission}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
              >
                Request Permission
              </button>
            ) : null}
          </div>
        </div>

        {/* Current Position */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Current Position</h2>
          {position ? (
            <div className="space-y-2">
              <p>Grid Cell: <span className="font-mono text-green-400">{position.gridCell}</span></p>
              <p>Latitude: <span className="font-mono">{position.lat.toFixed(3)}</span></p>
              <p>Longitude: <span className="font-mono">{position.lng.toFixed(3)}</span></p>
              <p>Area: <span className="text-blue-400">{getAreaName(position)}</span></p>
              {distance !== null && (
                <p>Distance to SF: <span className="text-yellow-400">{(distance / 1000).toFixed(2)} km</span></p>
              )}
              <p className="text-sm text-gray-400">
                Last Updated: {new Date(position.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-400">No position available</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={getCurrentPosition}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:opacity-50"
            >
              {isLoading ? 'Getting...' : 'Get Position'}
            </button>
            
            {!isWatching ? (
              <button
                onClick={handleStartWatching}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                Start Tracking
              </button>
            ) : (
              <button
                onClick={handleStopWatching}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              >
                Stop Tracking
              </button>
            )}

            <button
              onClick={handleAddGeofence}
              disabled={!position}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded disabled:opacity-50"
            >
              Add Geofence
            </button>
          </div>
        </div>

        {/* Accuracy Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Accuracy Settings</h2>
          <div className="flex gap-2">
            {(['high', 'balanced', 'low'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleAccuracyChange(mode)}
                className={`px-4 py-2 rounded capitalize ${
                  accuracyMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Current mode affects battery usage and accuracy
          </p>
        </div>

        {/* Fallback Strategies */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Fallback Strategies</h2>
          
          {/* Manual Entry */}
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Manual Coordinates</h3>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g., 37.7749, -122.4194"
                className="flex-1 bg-gray-700 px-3 py-2 rounded"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                Set Location
              </button>
            </form>
          </div>

          {/* Zone Selection */}
          <div>
            <h3 className="text-lg font-medium mb-2">Zone Selection</h3>
            <div className="flex gap-2">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="flex-1 bg-gray-700 px-3 py-2 rounded"
              >
                <option value="">No zone selected</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} - {zone.description}
                  </option>
                ))}
              </select>
              <button
                onClick={handleZoneSelect}
                disabled={!selectedZone}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
              >
                Use Zone
              </button>
              {selectedZone && (
                <button
                  onClick={() => setSelectedZone('')}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">🔒 Privacy Protection</h2>
          <ul className="space-y-2 text-sm">
            <li>✓ Location rounded to 100m grid for privacy</li>
            <li>✓ No exact coordinates stored or transmitted</li>
            <li>✓ Battery-aware tracking optimization</li>
            <li>✓ Multiple fallback strategies if GPS unavailable</li>
            <li>✓ All location data stays on your device</li>
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
            <p className="text-red-300 font-semibold">Location Error</p>
            <p className="text-red-200 mt-2">
              {error.message || 'Unable to get location'}
            </p>
            {permission.permission === 'denied' && (
              <div className="mt-3 text-sm">
                <p className="text-yellow-300">📍 Location access was denied</p>
                <p className="text-gray-300 mt-1">You can still:</p>
                <ul className="list-disc list-inside text-gray-300 mt-1">
                  <li>Enter coordinates manually</li>
                  <li>Select a zone from the dropdown</li>
                  <li>Use IP-based location (less accurate)</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}