/// <reference lib="webworker" />
import { type PrecacheEntry, Serwist } from "serwist";
import { runtimeCaching, cleanupCaches, precacheAssets } from "@/lib/sw/cache-strategies";
import { 
  initBackgroundSync, 
  handleSync, 
  queueOfflineRequest, 
  shouldQueueRequest 
} from "@/lib/sw/background-sync";
import {
  handleSkipWaiting,
  handleClaimClients,
  notifyActivation,
  setupConnectivityListeners,
  logLifecycleEvent,
  isNavigationRequest,
  MessageType,
  checkForUpdates
} from "@/lib/sw/utils";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

// Combine precache manifest with our custom assets
const precacheEntries = [
  ...(self.__SW_MANIFEST || []),
  ...precacheAssets,
];

// Initialize Serwist with comprehensive configuration
const serwist = new Serwist({
  precacheEntries,
  skipWaiting: false, // We'll handle this manually
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => isNavigationRequest(request),
      },
    ],
  },
});

// Install event - cache assets and initialize background sync
self.addEventListener("install", (event) => {
  logLifecycleEvent("Install", { version: "1.0.0" });
  
  event.waitUntil(
    Promise.all([
      // Initialize background sync
      initBackgroundSync(),
      // Serwist handles precaching
      serwist.handleInstall(event),
    ]).then(() => {
      logLifecycleEvent("Install completed");
      // Don't skip waiting automatically
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  logLifecycleEvent("Activate");
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupCaches(),
      // Claim clients
      handleClaimClients(),
      // Serwist activation
      serwist.handleActivate(event),
    ]).then(() => {
      logLifecycleEvent("Activate completed");
      notifyActivation();
    })
  );
});

// Fetch event - handle requests with offline support
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }
  
  // Handle offline queue for mutations
  if (!navigator.onLine && shouldQueueRequest(request)) {
    event.respondWith(
      queueOfflineRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" ? request.body : undefined,
      }).then(() => {
        return new Response(
          JSON.stringify({ 
            queued: true, 
            message: "Request queued for sync when online" 
          }),
          {
            status: 202,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }
  
  // Let Serwist handle with our runtime caching strategies
  serwist.handleFetch(event);
});

// Background sync event
self.addEventListener("sync", (event: ExtendableEvent & { tag: string }) => {
  logLifecycleEvent("Sync", { tag: event.tag });
  event.waitUntil(handleSync(event));
});

// Message event - handle messages from clients
self.addEventListener("message", (event) => {
  const { type } = event.data;
  
  switch (type) {
    case MessageType.SKIP_WAITING:
      handleSkipWaiting();
      break;
      
    case MessageType.CLAIM_CLIENTS:
      event.waitUntil(handleClaimClients());
      break;
      
    case MessageType.CLEAR_CACHE:
      event.waitUntil(
        cleanupCaches().then(() => {
          event.ports[0]?.postMessage({ success: true });
        })
      );
      break;
      
    default:
      logLifecycleEvent("Unknown message", { type });
  }
});

// Push event (for future push notifications)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {
    title: "geoLARP",
    body: "New adventure awaits!",
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "geolarp-notification",
      data: data.url || "/",
    })
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url === event.notification.data && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data);
      }
    })
  );
});

// Set up connectivity listeners
setupConnectivityListeners();

// Check for updates every hour
setInterval(() => {
  checkForUpdates();
}, 60 * 60 * 1000);

// Add Serwist event listeners
serwist.addEventListeners();

logLifecycleEvent("Service Worker initialized");