---
title: "API Reference"
description: "Internal API documentation for services and utilities."
category: reference
tags: ['developer', 'reference', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# API Reference

Internal API documentation for services and utilities.

---

## Overview

The platform's internal APIs are organised into:

- **Stores** — Reactive state containers
- **Services** — Business logic functions
- **Utilities** — Helper functions

---

## Stores

### Auth Store

```typescript
// src/lib/stores/auth.ts

interface AuthState {
  user: NDKUser | null;
  pubkey: string | null;
  privkey: Uint8Array | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  cohorts: string[];
}

const auth: Writable<AuthState>;

// Derived stores
const currentUser: Readable<NDKUser | null>;
const isAuthenticated: Readable<boolean>;
const userCohorts: Readable<string[]>;
```

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `login` | `privkey: string` | `Promise<void>` | Authenticate with private key |
| `loginWithMnemonic` | `mnemonic: string` | `Promise<void>` | Authenticate with recovery phrase |
| `logout` | — | `void` | Clear session |
| `updateProfile` | `profile: Partial<Profile>` | `Promise<void>` | Update user metadata |

---

### Messages Store

```typescript
// src/lib/stores/messages.ts

interface MessagesState {
  messages: Map<string, NDKEvent[]>;
  loading: Map<string, boolean>;
  hasMore: Map<string, boolean>;
}

const messages: CustomStore<MessagesState>;

// Derived
function channelMessages(channelId: string): Readable<NDKEvent[]>;
```

**Methods:**

| Method | Parameters | Description |
|--------|------------|-------------|
| `addMessage` | `channelId: string, event: NDKEvent` | Add message to channel |
| `removeMessage` | `channelId: string, eventId: string` | Remove message |
| `replaceMessage` | `channelId: string, oldId: string, newEvent: NDKEvent` | Replace (for optimistic updates) |
| `setLoading` | `channelId: string, loading: boolean` | Set loading state |
| `clearChannel` | `channelId: string` | Clear all messages |

---

### Channels Store

```typescript
// src/lib/stores/channels.ts

interface Channel {
  id: string;
  name: string;
  description: string;
  cohort: string;
  visibility: 'listed' | 'unlisted' | 'preview';
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
}

interface ChannelsState {
  channels: Map<string, Channel>;
  loading: boolean;
}

const channels: CustomStore<ChannelsState>;

// Derived
const channelList: Readable<Channel[]>;
function channelById(id: string): Readable<Channel | undefined>;
function channelsByCohort(cohort: string): Readable<Channel[]>;
```

---

### Calendar Store

```typescript
// src/lib/stores/calendar.ts

interface CalendarEvent {
  id: string;
  dTag: string;
  title: string;
  description: string;
  start: Date;
  end?: Date;
  location?: string;
  timezone?: string;
  channelId?: string;
  cohort?: string;
  rsvps: Map<string, RSVPStatus>;
  pubkey: string;
}

type RSVPStatus = 'accepted' | 'declined' | 'tentative';

interface CalendarState {
  events: Map<string, CalendarEvent>;
  loading: boolean;
  viewDate: Date;
  viewMode: 'month' | 'week' | 'day';
}

const calendar: CustomStore<CalendarState>;
const visibleEvents: Readable<CalendarEvent[]>;
```

---

### DM Store

```typescript
// src/lib/stores/dm.ts

interface DMMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  isOwn: boolean;
}

interface Conversation {
  pubkey: string;
  messages: DMMessage[];
  lastMessage: number;
  unreadCount: number;
}

interface DMState {
  conversations: Map<string, Conversation>;
  loading: boolean;
}

const dmStore: CustomStore<DMState>;
const sortedConversations: Readable<Conversation[]>;
```

---

## Services

### Authentication Service

```typescript
// src/lib/services/auth/index.ts

/**
 * Generate new keypair with mnemonic
 */
function generateKeys(): {
  mnemonic: string;
  privkey: string;
  pubkey: string;
}

/**
 * Recover keypair from mnemonic
 */
function recoverFromMnemonic(mnemonic: string): {
  privkey: string;
  pubkey: string;
}

/**
 * Validate mnemonic phrase
 */
function validateMnemonic(mnemonic: string): boolean;

/**
 * Store encrypted private key
 */
async function storeEncryptedKey(
  pubkey: string,
  privkey: string,
  passphrase: string
): Promise<void>

/**
 * Retrieve and decrypt private key
 */
async function getDecryptedKey(
  pubkey: string,
  passphrase: string
): Promise<string | null>
```

---

### Messaging Service

```typescript
// src/lib/services/messaging/messages.ts

/**
 * Load messages for a channel
 */
async function loadMessages(
  channelId: string,
  options?: {
    limit?: number;
    until?: number;
    since?: number;
  }
): Promise<void>

/**
 * Send a message to a channel
 */
async function sendMessage(
  channelId: string,
  content: string,
  options?: {
    replyTo?: string;
  }
): Promise<NDKEvent>

/**
 * Delete a message
 */
async function deleteMessage(
  channelId: string,
  eventId: string,
  isAdmin?: boolean
): Promise<void>

/**
 * Edit a message (delete + republish)
 */
async function editMessage(
  channelId: string,
  eventId: string,
  newContent: string
): Promise<NDKEvent>
```

---

### Subscription Service

```typescript
// src/lib/services/messaging/subscriptions.ts

/**
 * Subscribe to real-time channel updates
 */
function subscribeToChannel(channelId: string): void

/**
 * Unsubscribe from channel updates
 */
function unsubscribeFromChannel(channelId: string): void

/**
 * Check if subscribed to a channel
 */
function isSubscribed(channelId: string): boolean

/**
 * Get all active subscriptions
 */
function getActiveSubscriptions(): string[]
```

---

### DM Service

```typescript
// src/lib/services/messaging/dm-service.ts

/**
 * Send an encrypted direct message
 */
async function sendDM(
  recipientPubkey: string,
  content: string
): Promise<void>

/**
 * Load all DM conversations
 */
async function loadDMs(): Promise<void>

/**
 * Subscribe to incoming DMs
 */
function subscribeToDMs(): void

/**
 * Get conversation with a specific user
 */
function getConversation(pubkey: string): Conversation | undefined
```

---

### Calendar Service

```typescript
// src/lib/services/calendar/events.ts

/**
 * Load events for a date range
 */
async function loadEvents(
  startDate: Date,
  endDate: Date,
  cohort?: string
): Promise<void>

/**
 * Create a new calendar event
 */
async function createEvent(
  eventData: Omit<CalendarEvent, 'id' | 'rsvps' | 'pubkey'>
): Promise<string>

/**
 * Update an existing event
 */
async function updateEvent(
  dTag: string,
  updates: Partial<CalendarEvent>
): Promise<void>

/**
 * Delete a calendar event
 */
async function deleteEvent(dTag: string): Promise<void>
```

---

### RSVP Service

```typescript
// src/lib/services/calendar/rsvp.ts

/**
 * Submit RSVP for an event
 */
async function submitRSVP(
  eventDTag: string,
  eventRef: string,
  status: RSVPStatus,
  message?: string
): Promise<void>

/**
 * Load RSVPs for an event
 */
async function loadRSVPs(eventDTag: string): Promise<void>

/**
 * Get user's RSVP for an event
 */
function getUserRSVP(eventDTag: string): RSVPStatus | null
```

---

## Utilities

### Crypto Utilities

```typescript
// src/lib/utils/crypto.ts

/**
 * NIP-44 encryption
 */
function encrypt(
  plaintext: string,
  senderPrivkey: Uint8Array,
  recipientPubkey: string
): string

/**
 * NIP-44 decryption
 */
function decrypt(
  ciphertext: string,
  recipientPrivkey: Uint8Array,
  senderPubkey: string
): string

/**
 * Generate random bytes
 */
function randomBytes(length: number): Uint8Array

/**
 * Hash data with SHA-256
 */
function sha256(data: string | Uint8Array): Uint8Array
```

---

### Formatting Utilities

```typescript
// src/lib/utils/formatting.ts

/**
 * Format relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(timestamp: number): string

/**
 * Format absolute date
 */
function formatDate(
  date: Date,
  format?: 'short' | 'medium' | 'long'
): string

/**
 * Format user display name
 */
function formatDisplayName(
  pubkey: string,
  profile?: Profile
): string

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string

/**
 * Format file size
 */
function formatFileSize(bytes: number): string
```

---

### Validation Utilities

```typescript
// src/lib/utils/validation.ts

/**
 * Validate public key format
 */
function isValidPubkey(pubkey: string): boolean

/**
 * Validate event ID format
 */
function isValidEventId(id: string): boolean

/**
 * Validate relay URL
 */
function isValidRelayUrl(url: string): boolean

/**
 * Sanitise HTML content
 */
function sanitiseHtml(html: string): string

/**
 * Validate message content
 */
function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
}
```

---

### Nostr Utilities

```typescript
// src/lib/utils/nostr.ts

/**
 * Parse NIP-19 encoded string (npub, nsec, note, etc.)
 */
function parseNip19(encoded: string): {
  type: 'npub' | 'nsec' | 'note' | 'nevent' | 'nprofile' | 'naddr';
  data: any;
}

/**
 * Encode to NIP-19 format
 */
function encodeNpub(pubkey: string): string
function encodeNote(eventId: string): string

/**
 * Extract tags from event
 */
function getTagValue(event: NDKEvent, tagName: string): string | undefined
function getTagValues(event: NDKEvent, tagName: string): string[]

/**
 * Create event filter
 */
function createFilter(options: {
  kinds?: number[];
  authors?: string[];
  tags?: Record<string, string[]>;
  since?: number;
  until?: number;
  limit?: number;
}): NDKFilter
```

---

## Type Definitions

```typescript
// src/lib/types/index.ts

// Re-export all types
export * from './nostr';
export * from './channel';
export * from './user';
export * from './message';
export * from './calendar';
export * from './api';
```

See individual type files for complete definitions.

---

## Related Documentation

- [Configuration Reference](configuration.md) — Environment variables
- [Event Kinds](event-kinds.md) — Nostr event types
- [NIP Protocol Reference](nip-protocol-reference.md) — Protocol specs

---

[← Back to Developer Documentation](../index.md)
