'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceWorkerStatus {
  isInstalled: boolean;
  isWaiting: boolean;
  isActive: boolean;
  isOffline: boolean;
  updateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

interface SyncStatus {
  pending: number;
  lastSync: Date | null;
  isSyncing: boolean;
}

export function useServiceWorker() {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isInstalled: false,
    isWaiting: false,
    isActive: false,
    isOffline: !navigator.onLine,
    updateAvailable: false,
    registration: null,
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: 0,
    lastSync: null,
    isSyncing: false,
  });

  const [cacheSize, setCacheSize] = useState<number>(0);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (status.registration?.waiting) {
      // Tell SW to skip waiting
      status.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload once activated
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, [status.registration]);

  // Clear cache
  const clearCache = useCallback(async (cacheName?: string) => {
    if ('caches' in window) {
      try {
        if (cacheName) {
          await caches.delete(cacheName);
        } else {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        
        // Recalculate cache size
        await calculateCacheSize();
        
        return true;
      } catch (error) {
        console.error('Error clearing cache:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Calculate cache size
  const calculateCacheSize = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setCacheSize(estimate.usage || 0);
      } catch (error) {
        console.error('Error estimating storage:', error);
      }
    }
  }, []);

  // Force sync
  const forceSync = useCallback(async () => {
    if (status.registration && 'sync' in status.registration) {
      try {
        setSyncStatus(prev => ({ ...prev, isSyncing: true }));
        await status.registration.sync.register('sync-game-data');
        return true;
      } catch (error) {
        console.error('Error triggering sync:', error);
        return false;
      } finally {
        setSyncStatus(prev => ({ ...prev, isSyncing: false }));
      }
    }
    return false;
  }, [status.registration]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          
          setStatus(prev => ({
            ...prev,
            isInstalled: true,
            isActive: !!registration.active,
            isWaiting: !!registration.waiting,
            registration,
          }));

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setStatus(prev => ({
                  ...prev,
                  updateAvailable: true,
                  isWaiting: true,
                }));
              }
            });
          });

          // Initial cache size calculation
          await calculateCacheSize();
        } catch (error) {
          console.error('Service worker registration failed:', error);
        }
      };

      registerSW();

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, ...data } = event.data;
        
        switch (type) {
          case 'UPDATE_AVAILABLE':
            setStatus(prev => ({ ...prev, updateAvailable: true }));
            break;
            
          case 'UPDATE_ACTIVATED':
            setStatus(prev => ({ ...prev, updateAvailable: false }));
            break;
            
          case 'OFFLINE_STATUS':
            setStatus(prev => ({ ...prev, isOffline: data.isOffline }));
            break;
            
          case 'SYNC_SUCCESS':
          case 'SYNC_FAILED':
            setSyncStatus(prev => ({
              ...prev,
              lastSync: new Date(),
              isSyncing: false,
              pending: Math.max(0, prev.pending - 1),
            }));
            break;
            
          case 'CACHE_STATUS':
            calculateCacheSize();
            break;
        }
      });

      // Listen for online/offline events
      const handleOnline = () => setStatus(prev => ({ ...prev, isOffline: false }));
      const handleOffline = () => setStatus(prev => ({ ...prev, isOffline: true }));
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [calculateCacheSize]);

  return {
    ...status,
    syncStatus,
    cacheSize,
    updateServiceWorker,
    clearCache,
    forceSync,
    calculateCacheSize,
  };
}

// Hook for offline queue
export function useOfflineQueue() {
  const [queueSize, setQueueSize] = useState(0);
  
  useEffect(() => {
    // Check IndexedDB for queued requests
    const checkQueue = async () => {
      if ('indexedDB' in window) {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('geolarp-sync-queue', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          const transaction = db.transaction(['syncQueue'], 'readonly');
          const store = transaction.objectStore('syncQueue');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            setQueueSize(countRequest.result);
          };
        } catch (error) {
          console.error('Error checking offline queue:', error);
        }
      }
    };
    
    checkQueue();
    
    // Check periodically
    const interval = setInterval(checkQueue, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return queueSize;
}