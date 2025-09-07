/// <reference lib="webworker" />

interface SyncRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

// Queue for offline requests
class BackgroundSyncQueue {
  private readonly queueName = 'geolarp-sync-queue';
  private readonly maxRetries = 3;
  private readonly db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if ('indexedDB' in self) {
      const request = indexedDB.open(this.queueName, 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          (this as any).db = request.result;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  async addRequest(request: Omit<SyncRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.init();
    
    const syncRequest: SyncRequest = {
      ...request,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await store.add(syncRequest);

    // Register sync event
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-game-data');
    }
  }

  async getAll(): Promise<SyncRequest[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await store.delete(id);
  }

  async updateRetryCount(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const syncRequest = request.result;
        if (syncRequest) {
          syncRequest.retryCount++;
          store.put(syncRequest);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async processQueue(): Promise<void> {
    const requests = await this.getAll();
    console.log(`[SW] Processing ${requests.length} queued requests`);

    for (const syncRequest of requests) {
      try {
        const response = await fetch(syncRequest.url, {
          method: syncRequest.method,
          headers: syncRequest.headers,
          body: syncRequest.body,
        });

        if (response.ok) {
          // Success - remove from queue
          await this.remove(syncRequest.id);
          console.log(`[SW] Successfully synced request ${syncRequest.id}`);
          
          // Notify clients
          await self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                url: syncRequest.url,
                id: syncRequest.id,
              });
            });
          });
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          await this.remove(syncRequest.id);
          console.error(`[SW] Request ${syncRequest.id} failed with status ${response.status}`);
        } else {
          // Server error - retry
          throw new Error(`Server error: ${response.status}`);
        }
      } catch (error) {
        // Network error - update retry count
        await this.updateRetryCount(syncRequest.id);
        
        if (syncRequest.retryCount >= this.maxRetries) {
          // Max retries reached - remove from queue
          await this.remove(syncRequest.id);
          console.error(`[SW] Request ${syncRequest.id} failed after ${this.maxRetries} retries`);
          
          // Notify clients of failure
          await self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_FAILED',
                url: syncRequest.url,
                id: syncRequest.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            });
          });
        } else {
          console.log(`[SW] Request ${syncRequest.id} will be retried (attempt ${syncRequest.retryCount + 1}/${this.maxRetries})`);
        }
      }
    }
  }
}

// Export singleton instance
export const syncQueue = new BackgroundSyncQueue();

// Handle sync event
export async function handleSync(event: any): Promise<void> {
  if (event.tag === 'sync-game-data') {
    await syncQueue.processQueue();
  }
}

// Queue offline requests
export async function queueOfflineRequest(
  url: string,
  options: RequestInit = {}
): Promise<void> {
  const headers: Record<string, string> = {};
  
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  await syncQueue.addRequest({
    url,
    method: options.method || 'GET',
    headers,
    body: options.body as string,
  });

  console.log(`[SW] Request queued for background sync: ${url}`);
}

// Check if request should be queued
export function shouldQueueRequest(request: Request): boolean {
  // Queue mutations (POST, PUT, DELETE) to game/character endpoints
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (url.pathname.includes('/api/game/') || 
        url.pathname.includes('/api/character/') ||
        url.pathname.includes('/api/encounter/')) {
      return true;
    }
  }
  
  return false;
}

// Initialize on service worker install
export async function initBackgroundSync(): Promise<void> {
  await syncQueue.init();
  console.log('[SW] Background sync initialized');
}