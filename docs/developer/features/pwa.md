---
title: "PWA Implementation"
description: "Technical implementation of Progressive Web App features."
category: tutorial
tags: ['developer', 'pwa', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# PWA Implementation

Technical implementation of Progressive Web App features.

---

## Overview

The platform is a fully-featured PWA providing:

- **Installability** — Add to home screen on any device
- **Offline support** — Core functionality without network
- **Push notifications** — Real-time alerts
- **Background sync** — Queue actions when offline

---

## Manifest Configuration

### Web App Manifest

```json
// static/manifest.json
{
  "name": "Nostr BBS",
  "short_name": "BBS",
  "description": "Decentralised community platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f23",
  "theme_color": "#8b5cf6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "categories": ["social", "communication"],
  "shortcuts": [
    {
      "name": "Messages",
      "url": "/messages",
      "icons": [{"src": "/icons/messages.png", "sizes": "96x96"}]
    },
    {
      "name": "Calendar",
      "url": "/calendar",
      "icons": [{"src": "/icons/calendar.png", "sizes": "96x96"}]
    }
  ]
}
```

### HTML Head Tags

```html
<!-- src/app.html -->
<head>
  <!-- PWA Meta Tags -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#8b5cf6" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Nostr BBS" />

  <!-- iOS Icons -->
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />

  <!-- Splash Screens (iOS) -->
  <link rel="apple-touch-startup-image" href="/splash/iphone.png" />
</head>
```

---

## Service Worker

### Registration

```typescript
// src/lib/services/pwa/register.ts
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      type: 'module'
    });

    console.log('Service Worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}
```

### Service Worker Implementation

```typescript
// static/service-worker.js
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache static assets (injected at build time)
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Cache strategies
// 1. Static assets - Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// 2. Images - Cache First with size limit
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      })
    ]
  })
);

// 3. API requests - Network First
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60 // 5 minutes
      })
    ]
  })
);

// 4. HTML pages - Network First
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 25
      })
    ]
  })
);

// Background sync for offline actions
const bgSyncPlugin = new BackgroundSyncPlugin('message-queue', {
  maxRetentionTime: 24 * 60 // 24 hours
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/messages'),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// Handle offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  }
});
```

---

## Offline Support

### Offline Detection

```typescript
// src/lib/stores/network.ts
import { writable, derived } from 'svelte/store';

interface NetworkState {
  online: boolean;
  effectiveType: string | null;
}

function createNetworkStore() {
  const { subscribe, set } = writable<NetworkState>({
    online: navigator.onLine,
    effectiveType: (navigator as any).connection?.effectiveType || null
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      set({ online: true, effectiveType: (navigator as any).connection?.effectiveType });
    });

    window.addEventListener('offline', () => {
      set({ online: false, effectiveType: null });
    });
  }

  return { subscribe };
}

export const network = createNetworkStore();
export const isOnline = derived(network, $network => $network.online);
```

### Offline Queue

```typescript
// src/lib/services/pwa/offline-queue.ts
import { openDB, DBSchema } from 'idb';

interface OfflineAction {
  id: string;
  type: 'message' | 'rsvp' | 'reaction';
  payload: any;
  timestamp: number;
  retries: number;
}

interface OfflineDB extends DBSchema {
  actions: {
    key: string;
    value: OfflineAction;
    indexes: { 'by-timestamp': number };
  };
}

const dbPromise = openDB<OfflineDB>('offline-queue', 1, {
  upgrade(db) {
    const store = db.createObjectStore('actions', { keyPath: 'id' });
    store.createIndex('by-timestamp', 'timestamp');
  }
});

export async function queueAction(
  type: OfflineAction['type'],
  payload: any
): Promise<void> {
  const db = await dbPromise;
  await db.add('actions', {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retries: 0
  });
}

export async function processQueue(): Promise<void> {
  const db = await dbPromise;
  const actions = await db.getAllFromIndex('actions', 'by-timestamp');

  for (const action of actions) {
    try {
      await processAction(action);
      await db.delete('actions', action.id);
    } catch (error) {
      if (action.retries < 3) {
        await db.put('actions', { ...action, retries: action.retries + 1 });
      } else {
        // Give up after 3 retries
        await db.delete('actions', action.id);
        console.error('Action failed after 3 retries:', action);
      }
    }
  }
}

async function processAction(action: OfflineAction): Promise<void> {
  switch (action.type) {
    case 'message':
      await sendMessage(action.payload);
      break;
    case 'rsvp':
      await submitRSVP(action.payload);
      break;
    case 'reaction':
      await addReaction(action.payload);
      break;
  }
}

// Process queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', processQueue);
}
```

---

## Push Notifications

### Permission Request

```typescript
// src/lib/services/pwa/notifications.ts
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}
```

### Push Subscription

```typescript
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return subscription;
  }

  // Create new subscription
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}
```

### Service Worker Push Handler

```typescript
// In service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Nostr BBS', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});
```

---

## Install Prompt

### Install Store

```typescript
// src/lib/stores/install.ts
import { writable } from 'svelte/store';

interface InstallState {
  canInstall: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
}

function createInstallStore() {
  const { subscribe, update, set } = writable<InstallState>({
    canInstall: false,
    deferredPrompt: null,
    isInstalled: false
  });

  if (typeof window !== 'undefined') {
    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      update(state => ({
        ...state,
        canInstall: true,
        deferredPrompt: e as BeforeInstallPromptEvent
      }));
    });

    // Detect if already installed
    window.addEventListener('appinstalled', () => {
      set({ canInstall: false, deferredPrompt: null, isInstalled: true });
    });

    // Check display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      update(state => ({ ...state, isInstalled: true }));
    }
  }

  return {
    subscribe,

    async promptInstall(): Promise<boolean> {
      let prompt: BeforeInstallPromptEvent | null = null;

      const unsubscribe = subscribe(state => {
        prompt = state.deferredPrompt;
      });
      unsubscribe();

      if (!prompt) return false;

      prompt.prompt();
      const { outcome } = await prompt.userChoice;

      update(state => ({ ...state, canInstall: false, deferredPrompt: null }));

      return outcome === 'accepted';
    }
  };
}

export const install = createInstallStore();
```

### Install Banner Component

```svelte
<!-- src/lib/components/pwa/InstallBanner.svelte -->
<script lang="ts">
  import { install } from '$stores/install';
  import Button from '$components/ui/Button.svelte';

  let dismissed = false;

  async function handleInstall() {
    const installed = await install.promptInstall();
    if (installed) {
      dismissed = true;
    }
  }
</script>

{#if $install.canInstall && !dismissed}
  <div class="install-banner">
    <div class="banner-content">
      <img src="/icons/icon-48.png" alt="" class="app-icon" />
      <div class="banner-text">
        <strong>Install App</strong>
        <span>Add to your home screen for the best experience</span>
      </div>
    </div>
    <div class="banner-actions">
      <Button variant="ghost" on:click={() => dismissed = true}>
        Not now
      </Button>
      <Button variant="primary" on:click={handleInstall}>
        Install
      </Button>
    </div>
  </div>
{/if}
```

---

## Update Handling

```svelte
<!-- src/lib/components/pwa/UpdatePrompt.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$components/ui/Button.svelte';

  let updateAvailable = false;

  onMount(() => {
    window.addEventListener('sw-update-available', () => {
      updateAvailable = true;
    });
  });

  function handleUpdate() {
    window.location.reload();
  }
</script>

{#if updateAvailable}
  <div class="update-toast">
    <span>A new version is available</span>
    <Button variant="primary" size="sm" on:click={handleUpdate}>
      Update
    </Button>
  </div>
{/if}
```

---

## Build Configuration

### Vite PWA Plugin

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: false, // Using static manifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ]
});
```

---

## Related Documentation

- [Mobile App Guide](../../user/features/mobile-app.md) — User installation guide
- [Notifications](../../user/features/notifications.md) — User notification settings
- [Deployment Guide](../deployment/index.md) — PWA deployment

---

[← Back to Developer Documentation](../index.md)
