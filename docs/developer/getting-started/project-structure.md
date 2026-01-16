---
title: "Project Structure"
description: "Understand the codebase layout and where to find things."
category: tutorial
tags: ['developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Project Structure

Understand the codebase layout and where to find things.

---

## Overview

The project follows SvelteKit conventions with additional organisation for Nostr-specific functionality.

```
nostr-bbs/
├── src/                    # Application source code
│   ├── lib/               # Shared libraries and components
│   │   ├── components/    # Svelte components
│   │   ├── stores/        # Svelte stores (state management)
│   │   ├── services/      # Business logic and API clients
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript type definitions
│   ├── routes/            # SvelteKit routes (pages)
│   └── app.html           # HTML template
├── static/                 # Static assets
├── tests/                  # Test files
├── docs/                   # Documentation
└── config files           # Configuration
```

---

## Source Code (`src/`)

### Routes (`src/routes/`)

SvelteKit file-based routing:

```
src/routes/
├── +layout.svelte         # Root layout (navigation, theme)
├── +page.svelte           # Home page
├── +error.svelte          # Error page
├── auth/
│   ├── login/+page.svelte
│   ├── signup/+page.svelte
│   └── recover/+page.svelte
├── zones/
│   ├── [zone]/            # Dynamic zone routes
│   │   ├── +page.svelte   # Zone landing page
│   │   └── [section]/
│   │       └── [channel]/
│   │           └── +page.svelte
├── calendar/
│   └── +page.svelte
├── messages/              # Direct messages
│   └── +page.svelte
├── settings/
│   └── +page.svelte
└── admin/
    ├── +page.svelte
    ├── users/+page.svelte
    └── channels/+page.svelte
```

**Key conventions:**
- `+page.svelte` — Page component
- `+layout.svelte` — Layout wrapper
- `+page.ts` — Page load function
- `+page.server.ts` — Server-side load function
- `[param]` — Dynamic route parameter

### Components (`src/lib/components/`)

Organised by feature area:

```
src/lib/components/
├── ui/                    # Generic UI components
│   ├── Button.svelte
│   ├── Input.svelte
│   ├── Modal.svelte
│   ├── Card.svelte
│   ├── Avatar.svelte
│   └── Dropdown.svelte
├── chat/                  # Messaging components
│   ├── MessageList.svelte
│   ├── MessageInput.svelte
│   ├── MessageBubble.svelte
│   ├── ChannelHeader.svelte
│   └── ChannelSidebar.svelte
├── dm/                    # Direct message components
│   ├── ConversationList.svelte
│   ├── DMThread.svelte
│   └── DMComposer.svelte
├── calendar/              # Calendar components
│   ├── CalendarGrid.svelte
│   ├── EventCard.svelte
│   ├── EventModal.svelte
│   └── RSVPButton.svelte
├── admin/                 # Admin panel components
│   ├── UserTable.svelte
│   ├── JoinRequestList.svelte
│   └── ModerationQueue.svelte
├── auth/                  # Authentication components
│   ├── LoginForm.svelte
│   ├── SignupWizard.svelte
│   └── MnemonicDisplay.svelte
└── layout/                # Layout components
    ├── Navbar.svelte
    ├── Sidebar.svelte
    ├── ZoneSwitcher.svelte
    └── Footer.svelte
```

### Stores (`src/lib/stores/`)

Svelte stores for state management:

```
src/lib/stores/
├── auth.ts                # User authentication state
├── ndk.ts                 # NDK instance and connection
├── channels.ts            # Channel list and metadata
├── messages.ts            # Message cache
├── notifications.ts       # Push notification state
├── settings.ts            # User preferences
└── ui.ts                  # UI state (modals, sidebars)
```

**Example store pattern:**

```typescript
// src/lib/stores/auth.ts
import { writable, derived } from 'svelte/store';
import type { NDKUser } from '@nostr-dev-kit/ndk';

interface AuthState {
  user: NDKUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true
};

export const auth = writable<AuthState>(initialState);

export const currentUser = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => $auth.isAuthenticated);
```

### Services (`src/lib/services/`)

Business logic separated from components:

```
src/lib/services/
├── ndk/
│   ├── client.ts          # NDK client initialisation
│   ├── signer.ts          # Event signing
│   └── subscriptions.ts   # Subscription management
├── auth/
│   ├── keygen.ts          # Key generation (BIP-39)
│   ├── storage.ts         # Secure key storage
│   └── session.ts         # Session management
├── messaging/
│   ├── channels.ts        # Channel operations
│   ├── messages.ts        # Message CRUD
│   └── dm.ts              # Direct message handling
├── calendar/
│   ├── events.ts          # Calendar event operations
│   └── rsvp.ts            # RSVP management
├── admin/
│   ├── users.ts           # User management
│   ├── moderation.ts      # Content moderation
│   └── whitelist.ts       # Access control
└── storage/
    ├── indexeddb.ts       # Local storage
    └── cache.ts           # Message caching
```

### Types (`src/lib/types/`)

TypeScript type definitions:

```
src/lib/types/
├── index.ts               # Re-exports
├── nostr.ts               # Nostr event types
├── channel.ts             # Channel/zone types
├── user.ts                # User profile types
├── message.ts             # Message types
├── calendar.ts            # Calendar event types
└── api.ts                 # API response types
```

### Utilities (`src/lib/utils/`)

Helper functions:

```
src/lib/utils/
├── crypto.ts              # Encryption helpers
├── formatting.ts          # Date/text formatting
├── validation.ts          # Input validation
├── nostr.ts               # Nostr utility functions
└── constants.ts           # App constants
```

---

## Static Assets (`static/`)

Files served directly:

```
static/
├── favicon.png
├── manifest.json          # PWA manifest
├── service-worker.js      # Service worker
├── images/
│   ├── zones/            # Zone hero images
│   │   ├── minimoonoir-hero.jpg
│   │   ├── dreamlab-hero.jpg
│   │   └── family-hero.jpg
│   ├── logos/            # Zone logos
│   └── icons/            # App icons
└── fonts/                # Custom fonts (if any)
```

---

## Tests (`tests/`)

Test organisation:

```
tests/
├── unit/                  # Unit tests
│   ├── components/
│   ├── services/
│   ├── stores/
│   └── utils/
├── integration/           # Integration tests
│   ├── auth.test.ts
│   ├── messaging.test.ts
│   └── calendar.test.ts
├── e2e/                   # End-to-end tests
│   └── flows/
└── fixtures/              # Test data
    ├── events.ts
    └── users.ts
```

---

## Configuration Files

### Root Configuration

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `svelte.config.js` | SvelteKit configuration |
| `vite.config.ts` | Vite bundler configuration |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `.eslintrc.cjs` | ESLint rules |
| `.prettierrc` | Prettier formatting rules |

### SvelteKit Configuration

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',  // SPA mode
      precompress: false
    }),
    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $services: 'src/lib/services',
      $types: 'src/lib/types',
      $utils: 'src/lib/utils'
    }
  }
};
```

### Path Aliases

Import shortcuts configured in `svelte.config.js`:

```typescript
// Instead of:
import Button from '../../../lib/components/ui/Button.svelte';

// Use:
import Button from '$components/ui/Button.svelte';
```

| Alias | Path |
|-------|------|
| `$lib` | `src/lib` |
| `$components` | `src/lib/components` |
| `$stores` | `src/lib/stores` |
| `$services` | `src/lib/services` |
| `$types` | `src/lib/types` |
| `$utils` | `src/lib/utils` |

---

## Key Files

### Entry Points

| File | Purpose |
|------|---------|
| `src/app.html` | HTML template |
| `src/routes/+layout.svelte` | Root layout |
| `src/routes/+page.svelte` | Home page |
| `src/lib/services/ndk/client.ts` | NDK initialisation |

### Important Services

| File | Purpose |
|------|---------|
| `src/lib/services/auth/keygen.ts` | BIP-39 key generation |
| `src/lib/services/messaging/dm.ts` | NIP-17/59 DM implementation |
| `src/lib/services/messaging/channels.ts` | NIP-29 group messaging |
| `src/lib/services/calendar/events.ts` | NIP-52 calendar events |

---

## Related Documentation

- [Development Setup](development-setup.md) — Set up your environment
- [First Contribution](first-contribution.md) — Make your first change
- [Component Architecture](../architecture/components.md) — Component design patterns

---

[← Back to Developer Documentation](../index.md)
