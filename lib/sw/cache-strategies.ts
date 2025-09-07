import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'serwist';
import type { RuntimeCaching } from 'serwist';

// Cache names
export const CACHE_NAMES = {
  MAP_TILES: 'map-tiles-v1',
  GAME_DATA: 'game-data-v1',
  IMAGES: 'images-v1',
  STATIC: 'static-v1',
} as const;

// Cache expiration settings
const CACHE_EXPIRATION = {
  MAP_TILES_DAYS: 30,
  GAME_DATA_HOURS: 24,
  IMAGES_DAYS: 7,
  MAX_ENTRIES: 500,
} as const;

// Runtime caching strategies
export const runtimeCaching: RuntimeCaching[] = [
  // Map tiles - Cache first with 30-day expiry
  {
    matcher: ({ url }) => url.pathname.includes('/tiles/') || 
                          url.hostname.includes('tile.openstreetmap.org'),
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.MAP_TILES,
      plugins: [
        {
          handlerDidError: async () => undefined,
          cacheWillUpdate: async ({ response }) => {
            if (response && response.status === 200) {
              return response;
            }
            return null;
          },
        },
        {
          cachedResponseWillBeUsed: async ({ cachedResponse, state }) => {
            if (!cachedResponse) return null;
            
            // Check if cache is expired (30 days)
            const cacheDate = cachedResponse.headers.get('date');
            if (cacheDate) {
              const age = Date.now() - new Date(cacheDate).getTime();
              const maxAge = CACHE_EXPIRATION.MAP_TILES_DAYS * 24 * 60 * 60 * 1000;
              
              if (age > maxAge) {
                // Delete expired entry
                if (state?.cacheName) {
                  const cache = await caches.open(state.cacheName);
                  await cache.delete(state.url || '');
                }
                return null;
              }
            }
            
            return cachedResponse;
          },
        },
      ],
    }),
  },

  // Game data - Network first with 10s timeout
  {
    matcher: ({ url }) => url.pathname.includes('/api/game/') ||
                          url.pathname.includes('/api/character/'),
    handler: new NetworkFirst({
      cacheName: CACHE_NAMES.GAME_DATA,
      networkTimeoutSeconds: 10,
      plugins: [
        {
          handlerDidError: async () => undefined,
          cacheWillUpdate: async ({ response }) => {
            if (response && response.status === 200) {
              return response;
            }
            return null;
          },
        },
      ],
    }),
  },

  // Images - Stale while revalidate
  {
    matcher: ({ request }) => request.destination === 'image',
    handler: new StaleWhileRevalidate({
      cacheName: CACHE_NAMES.IMAGES,
      plugins: [
        {
          handlerDidError: async () => undefined,
          cacheWillUpdate: async ({ response }) => {
            if (response && response.status === 200) {
              return response;
            }
            return null;
          },
        },
      ],
    }),
  },

  // API calls - Network only (except game data)
  {
    matcher: ({ url }) => url.pathname.includes('/api/') &&
                          !url.pathname.includes('/api/game/') &&
                          !url.pathname.includes('/api/character/'),
    handler: new NetworkOnly({
      plugins: [
        {
          handlerDidError: async () => new Response(
            JSON.stringify({ error: 'Network request failed' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          ),
        },
      ],
    }),
  },

  // Static assets - Cache first
  {
    matcher: ({ request }) => 
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font',
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.STATIC,
      plugins: [
        {
          handlerDidError: async () => undefined,
        },
      ],
    }),
  },
];

// Cache cleanup function
export async function cleanupCaches(): Promise<void> {
  const cacheWhitelist = Object.values(CACHE_NAMES);
  const cacheNames = await caches.keys();
  
  await Promise.all(
    cacheNames.map(async (cacheName) => {
      if (!cacheWhitelist.includes(cacheName as typeof CACHE_NAMES[keyof typeof CACHE_NAMES])) {
        console.log(`[SW] Deleting old cache: ${cacheName}`);
        await caches.delete(cacheName);
      }
    })
  );
  
  // Enforce cache size limits
  for (const cacheName of Object.values(CACHE_NAMES)) {
    await enforceCacheLimit(cacheName, CACHE_EXPIRATION.MAX_ENTRIES);
  }
}

// Enforce cache size limit
async function enforceCacheLimit(cacheName: string, maxEntries: number): Promise<void> {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > maxEntries) {
    console.log(`[SW] Cache ${cacheName} exceeded limit (${requests.length}/${maxEntries})`);
    
    // Delete oldest entries (FIFO)
    const entriesToDelete = requests.length - maxEntries;
    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(requests[i]);
    }
  }
}

// Precache assets list
export const precacheAssets = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/next.svg',
  '/vercel.svg',
  '/file.svg',
  '/globe.svg',
  '/window.svg',
];