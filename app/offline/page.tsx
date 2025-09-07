'use client';

import { useEffect, useState } from 'react';
import { useCharacters } from '@/hooks/useDatabase';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [cachedPages, setCachedPages] = useState<string[]>([]);
  const { characters } = useCharacters();

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check cached pages
    checkCachedContent();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkCachedContent = async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const pages: string[] = [];
        
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          
          requests.forEach(request => {
            const url = new URL(request.url);
            if (url.pathname !== '/offline' && !pages.includes(url.pathname)) {
              pages.push(url.pathname);
            }
          });
        }
        
        setCachedPages(pages);
      } catch (error) {
        console.error('Error checking caches:', error);
      }
    }
  };

  const retry = () => {
    if (navigator.onLine) {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <svg
            className="w-32 h-32 mx-auto text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        <h1 className="text-4xl font-bold mb-4">
          {isOnline ? 'Connection Restored!' : 'You\'re Offline'}
        </h1>
        
        <p className="text-xl text-gray-400 mb-8">
          {isOnline 
            ? 'Your internet connection has been restored. Click below to continue your adventure.'
            : 'Don\'t worry! geoLARP works offline. Your game data is saved locally.'}
        </p>

        {/* Offline Content Available */}
        {!isOnline && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Available Offline</h2>
            
            {/* Characters */}
            {characters.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Your Characters ({characters.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {characters.map(char => (
                    <div key={char.id} className="bg-gray-700 px-3 py-2 rounded text-sm">
                      {char.name} - Level {char.level}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cached Pages */}
            {cachedPages.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Cached Pages</h3>
                <div className="text-sm text-gray-400">
                  {cachedPages.length} pages available offline
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={retry}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isOnline
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isOnline ? 'Continue Adventure' : 'Try Again'}
          </button>
          
          {!isOnline && characters.length > 0 && (
            <button
              onClick={() => window.location.href = '/database-demo'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
            >
              Manage Characters
            </button>
          )}
        </div>

        {/* Status Indicator */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm text-gray-400">
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>

        {/* Tips */}
        {!isOnline && (
          <div className="mt-8 text-sm text-gray-500">
            <p className="mb-2">💡 Tip: Your game progress is saved locally</p>
            <p>When you reconnect, all your actions will sync automatically</p>
          </div>
        )}
      </div>
    </div>
  );
}