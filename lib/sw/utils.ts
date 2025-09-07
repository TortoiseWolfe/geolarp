/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Message types for SW communication
export enum MessageType {
  SKIP_WAITING = 'SKIP_WAITING',
  CLAIM_CLIENTS = 'CLAIM_CLIENTS',
  CACHE_STATUS = 'CACHE_STATUS',
  CLEAR_CACHE = 'CLEAR_CACHE',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  UPDATE_ACTIVATED = 'UPDATE_ACTIVATED',
  OFFLINE_STATUS = 'OFFLINE_STATUS',
  SYNC_STATUS = 'SYNC_STATUS',
}

// Send message to all clients
export async function broadcastMessage(message: Record<string, unknown>): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage(message));
}

// Check if online
export function isOnline(): boolean {
  // In service worker, we need to check differently
  return self.navigator.onLine !== false;
}

// Get cache storage info
export async function getCacheStorageInfo(): Promise<{
  usage: number;
  quota: number;
  caches: Array<{ name: string; size: number }>;
}> {
  const estimate = await navigator.storage.estimate();
  const cacheNames = await caches.keys();
  
  const cacheInfo = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      
      // Estimate size (rough approximation)
      let size = 0;
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          size += blob.size;
        }
      }
      
      return { name, size };
    })
  );

  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
    caches: cacheInfo,
  };
}

// Clear specific cache
export async function clearCache(cacheName?: string): Promise<void> {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log(`[SW] Cleared cache: ${cacheName}`);
  } else {
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Cleared all caches');
  }
  
  await broadcastMessage({
    type: MessageType.CACHE_STATUS,
    action: 'cleared',
    cacheName,
  });
}

// Handle skip waiting
export function handleSkipWaiting(): void {
  self.skipWaiting();
  console.log('[SW] Skip waiting activated');
}

// Handle claim clients
export async function handleClaimClients(): Promise<void> {
  await self.clients.claim();
  console.log('[SW] Clients claimed');
}

// Notify clients about updates
export async function notifyUpdate(): Promise<void> {
  await broadcastMessage({
    type: MessageType.UPDATE_AVAILABLE,
    message: 'A new version of geoLARP is available',
  });
}

// Notify clients about activation
export async function notifyActivation(): Promise<void> {
  await broadcastMessage({
    type: MessageType.UPDATE_ACTIVATED,
    message: 'geoLARP has been updated',
  });
}

// Handle offline/online status changes
export function setupConnectivityListeners(): void {
  self.addEventListener('online', async () => {
    console.log('[SW] Online status detected');
    await broadcastMessage({
      type: MessageType.OFFLINE_STATUS,
      isOffline: false,
    });
  });

  self.addEventListener('offline', async () => {
    console.log('[SW] Offline status detected');
    await broadcastMessage({
      type: MessageType.OFFLINE_STATUS,
      isOffline: true,
    });
  });
}

// Calculate cache age
export function getCacheAge(response: Response): number {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return 0;
  
  const responseDate = new Date(dateHeader).getTime();
  return Date.now() - responseDate;
}

// Create offline response
export function createOfflineResponse(request: Request): Response {
  const url = new URL(request.url);
  
  // API endpoints return JSON error
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This action requires an internet connection',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // HTML pages redirect to offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    return Response.redirect('/offline', 302);
  }
  
  // Default offline response
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
  });
}

// Log SW lifecycle events
export function logLifecycleEvent(event: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[SW][${timestamp}] ${event}`, details || '');
}

// Request/Response helpers
export function isNavigationRequest(request: Request): boolean {
  return request.mode === 'navigate';
}

export function isCacheableResponse(response: Response): boolean {
  if (!response || response.status !== 200) {
    return false;
  }
  
  const contentType = response.headers.get('content-type');
  const cacheControl = response.headers.get('cache-control');
  
  // Don't cache if explicitly set to no-store
  if (cacheControl?.includes('no-store')) {
    return false;
  }
  
  // Cache these content types
  const cacheableTypes = [
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'image/',
    'font/',
  ];
  
  return cacheableTypes.some(type => contentType?.includes(type));
}

// Service worker update check
export async function checkForUpdates(): Promise<void> {
  try {
    await self.registration.update();
    console.log('[SW] Checked for updates');
  } catch (error) {
    console.error('[SW] Update check failed:', error);
  }
}