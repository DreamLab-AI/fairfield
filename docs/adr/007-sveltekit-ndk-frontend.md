---
title: "ADR-007: SvelteKit + NDK Frontend"
description: "Decision to use SvelteKit with NDK for frontend development"
category: reference
tags: ['adr', 'architecture', 'frontend', 'svelte', 'ndk']
difficulty: intermediate
last-updated: 2026-01-16
---

# ADR-007: SvelteKit + NDK Frontend

## Status

Accepted

## Date

2024-01-10

## Context

Frontend framework requirements:
- Reactive UI for real-time messages
- Nostr protocol integration
- Static site generation (GitHub Pages)
- TypeScript support
- Component library ecosystem

Nostr client library requirements:
- Event signing and verification
- Subscription management
- Relay connection handling
- Caching layer

## Decision

Use SvelteKit 2.x with NDK (Nostr Development Kit) for frontend.

### Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Stack                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Framework: SvelteKit 2.x                              │
│  ├── Static adapter (GitHub Pages)                     │
│  ├── TypeScript strict mode                            │
│  └── Vite build system                                 │
│                                                         │
│  Nostr: NDK (Nostr Development Kit)                    │
│  ├── @nostr-dev-kit/ndk                               │
│  ├── @nostr-dev-kit/ndk-svelte                        │
│  └── @nostr-dev-kit/ndk-cache-dexie                   │
│                                                         │
│  UI: DaisyUI + Tailwind CSS                            │
│  ├── Component primitives                              │
│  ├── Theme system                                      │
│  └── Responsive utilities                              │
│                                                         │
│  State: Svelte Stores + NDK Subscriptions              │
│  ├── Reactive subscriptions                            │
│  ├── Local storage persistence                         │
│  └── IndexedDB caching (Dexie)                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### NDK Configuration

```typescript
// src/lib/nostr/ndk.ts
import NDK, { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

export const ndk = new NDK({
  explicitRelayUrls: [RELAY_URL],
  cacheAdapter: new NDKCacheAdapterDexie({ dbName: 'nostr-bbs-cache' }),
  signer: new NDKNip07Signer() // Browser extension support
});

// Reactive subscription pattern
export function useEvents(filter: NDKFilter) {
  const events = writable<NDKEvent[]>([]);

  const sub = ndk.subscribe(filter, { closeOnEose: false });
  sub.on('event', (event) => {
    events.update(e => [...e, event]);
  });

  return { events, unsubscribe: () => sub.stop() };
}
```

### Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   │   ├── chat/       # Message components
│   │   ├── layout/     # Navigation, sidebar
│   │   └── ui/         # DaisyUI wrappers
│   ├── config/         # sections.yaml, permissions
│   ├── nostr/          # NDK setup, encryption
│   ├── stores/         # Svelte stores
│   └── utils/          # Helpers
├── routes/
│   ├── +layout.svelte  # App shell
│   ├── +page.svelte    # Landing
│   ├── chat/           # Forum views
│   ├── login/          # Auth flow
│   └── admin/          # Admin panel
└── app.html
```

## Consequences

### Positive
- Excellent reactivity for real-time
- NDK handles Nostr complexity
- Small bundle size (~150KB gzipped)
- Static hosting (free, fast)
- Strong TypeScript integration

### Negative
- Smaller ecosystem than React
- NDK learning curve
- Static limits (no SSR)

### Neutral
- Component patterns differ from React
- Store-based state management

## Alternatives Considered

### React + nostr-tools
- Larger ecosystem
- Rejected: Bundle size, less reactive

### Vue + Nostr libraries
- Good reactivity
- Rejected: Less mature Nostr tooling

### Vanilla JS
- Smallest bundle
- Rejected: Development velocity

## References

- [SvelteKit Docs](https://kit.svelte.dev/)
- [NDK Documentation](https://ndk.fyi/)
- [DaisyUI](https://daisyui.com/)
- Deployment: GitHub Pages via `@sveltejs/adapter-static`
