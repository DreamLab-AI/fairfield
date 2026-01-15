# Solid Protocol Integration

This document describes the Solid Protocol integration layer in Fairfield, enabling decentralized storage and identity bridging between Nostr and Solid pods.

## Overview

The Solid integration provides:
- OIDC authentication with Solid identity providers
- WebID to did:nostr identity bridging
- Encrypted Nostr event storage in user pods
- Web Access Control (WAC) for permission management
- Offline-first storage with background sync

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Fairfield Client                         │
├─────────────────────────────────────────────────────────────┤
│  src/lib/solid/                                              │
│  ├── client.ts      # OIDC auth, session management         │
│  ├── webid.ts       # DID↔WebID bridging                    │
│  ├── storage.ts     # Pod CRUD operations                   │
│  ├── acl.ts         # Access control management             │
│  ├── types.ts       # TypeScript definitions                │
│  └── index.ts       # Module exports                        │
├─────────────────────────────────────────────────────────────┤
│                    Solid Pod Storage                         │
│  ├── nostr/events/       # Public Nostr events              │
│  ├── nostr/encrypted/    # NIP-44 encrypted events          │
│  ├── nostr/profiles/     # Profile data                     │
│  ├── nostr/messages/     # Direct messages                  │
│  └── nostr/preferences/  # User preferences                 │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### Client (`client.ts`)

Session management and OIDC authentication.

```typescript
import {
  initializeSolidClient,
  login,
  logout,
  isLoggedIn,
  getSession,
  handleIncomingRedirect
} from '$lib/solid';

// Initialize client
initializeSolidClient({
  defaultOidcIssuer: 'https://solidcommunity.net',
  clientName: 'Fairfield Nostr'
});

// Login flow
await login({
  oidcIssuer: 'https://solidcommunity.net',
  redirectUrl: window.location.origin
});

// Handle redirect
await handleIncomingRedirect();

// Check login status
if (isLoggedIn()) {
  const session = getSession();
  console.log('WebID:', session.webId);
}
```

### WebID Bridge (`webid.ts`)

Identity bridging between did:nostr and Solid WebID.

```typescript
import {
  didToWebID,
  pubkeyToWebID,
  webIDToPubkey,
  linkNostrIdentityToWebID,
  getLinkedNostrIdentity,
  verifyWebIDNostrLink
} from '$lib/solid';

// Convert Nostr pubkey to WebID
const webId = pubkeyToWebID(nostrPubkey);

// Link Nostr identity to WebID profile
const result = await linkNostrIdentityToWebID(nostrPubkey, relays);

// Get linked Nostr identity from WebID
const nostrLink = await getLinkedNostrIdentity(webId);
```

### Storage (`storage.ts`)

Pod CRUD operations with RDF conversion.

```typescript
import {
  storeNostrEvent,
  retrieveNostrEvent,
  listNostrEvents,
  deleteNostrEvent,
  initializeNostrContainers
} from '$lib/solid';

// Initialize pod containers
await initializeNostrContainers();

// Store event
const result = await storeNostrEvent({
  id: event.id,
  kind: event.kind,
  pubkey: event.pubkey,
  created_at: event.created_at,
  content: event.content,
  sig: event.sig,
  tags: event.tags,
  encrypted: true,
  encryptionMethod: 'nip44'
});

// Retrieve event
const event = await retrieveNostrEvent(eventId);

// List events
const events = await listNostrEvents({ kind: 1 });
```

### ACL (`acl.ts`)

Web Access Control management for pod resources.

```typescript
import {
  grantAccess,
  revokeAccess,
  checkAccess,
  syncNostrPermissionsToACL,
  makePublic,
  makePrivate
} from '$lib/solid';

// Grant read access
await grantAccess(resourceUrl, webId, ['Read']);

// Sync Nostr cohort permissions to ACL
await syncNostrPermissionsToACL({
  resourceUrl: 'https://pod.example.com/nostr/events/',
  nostrPubkeys: ['abc123...', 'def456...'],
  cohorts: ['approved', 'business'],
  modes: ['Read', 'Write']
});

// Check access
const hasRead = await checkAccess(resourceUrl, webId, 'Read');
```

## Quick Start

### Initialize Solid Integration

```typescript
import { initializeSolid } from '$lib/solid';

// On app startup
await initializeSolid({
  defaultOidcIssuer: 'https://solidcommunity.net',
  clientName: 'Fairfield Nostr',
  enableOfflineSync: true
});
```

### Connect Nostr Identity

```typescript
import { connectNostrToSolid } from '$lib/solid';

// After Nostr login
const result = await connectNostrToSolid(nostrPubkey, relays);

if (result.success) {
  console.log('Identity linked:', result.data);
}
```

### Store Events in Pod

```typescript
import { storeEventInPod } from '$lib/solid';

const result = await storeEventInPod({
  id: event.id,
  kind: event.kind,
  pubkey: event.pubkey,
  created_at: event.created_at,
  content: event.content,
  sig: event.sig,
  tags: event.tags
});
```

### Sync Permissions

```typescript
import { syncPermissions } from '$lib/solid';

const result = await syncPermissions({
  resourceUrl: 'https://pod.example.com/nostr/events/',
  nostrPubkeys: cohortMembers,
  cohorts: ['approved'],
  modes: ['Read']
});
```

## Type Definitions

### Session Types

```typescript
interface SolidSession {
  isLoggedIn: boolean;
  webId: string | null;
  fetch: typeof fetch | null;
  expirationDate: Date | null;
}

interface SolidLoginOptions {
  oidcIssuer: string;
  redirectUrl: string;
  clientName?: string;
  clientId?: string;
  tokenType?: 'Bearer' | 'DPoP';
}
```

### Identity Types

```typescript
interface NostrIdentityLink {
  did: string;
  pubkey: string;
  npub: string;
  verificationMethod?: string;
  linkedAt: string;
  relays?: string[];
  verified?: boolean;
}

interface WebIDProfile {
  webId: string;
  name?: string;
  nickname?: string;
  email?: string;
  image?: string;
  storage?: string[];
  linkedNostrDID?: string;
  linkedNostrPubkey?: string;
}

interface DIDWebIDMapping {
  did: string;
  webId: string;
  pubkey: string;
  linkedAt: string;
  verified: boolean;
}
```

### Storage Types

```typescript
interface NostrEventRDF {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  sig: string;
  tags: string[][];
  rdfSubject?: string;
  encrypted?: boolean;
  encryptionMethod?: 'nip44' | 'nip04';
}

interface StorageResult<T = unknown> {
  success: boolean;
  data?: T;
  url?: string;
  error?: StorageError;
}

type StorageErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_DATA'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';
```

### ACL Types

```typescript
type ACLMode = 'Read' | 'Write' | 'Append' | 'Control';

interface ACLEntry {
  subject: ACLSubject;
  modes: ACLMode[];
  resourceUrl: string;
  isDefault?: boolean;
}

interface ACLSubject {
  type: 'agent' | 'group' | 'public' | 'authenticated';
  webId?: string;
  groupUrl?: string;
}

interface PermissionSyncRequest {
  resourceUrl: string;
  nostrPubkeys: string[];
  cohorts: string[];
  modes: ACLMode[];
}
```

## Pod Container Structure

Default container names defined in `POD_CONTAINERS`:

| Container | Path | Purpose |
|-----------|------|---------|
| NOSTR | `nostr/` | Root Nostr container |
| EVENTS | `nostr/events/` | Public events |
| ENCRYPTED | `nostr/encrypted/` | NIP-44 encrypted events |
| PROFILES | `nostr/profiles/` | Profile data |
| MESSAGES | `nostr/messages/` | Direct messages |
| PREFERENCES | `nostr/preferences/` | User settings |
| PUBLIC | `public/` | Public data |
| PRIVATE | `private/` | Private data |

## RDF Namespaces

```typescript
const RDF_NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  solid: 'http://www.w3.org/ns/solid/terms#',
  ldp: 'http://www.w3.org/ns/ldp#',
  acl: 'http://www.w3.org/ns/auth/acl#',
  nostr: 'https://nostr.com/ns#',
  did: 'https://www.w3.org/ns/did#',
};

const NOSTR_RDF_VOCAB = {
  Event: 'https://nostr.com/ns#Event',
  kind: 'https://nostr.com/ns#kind',
  pubkey: 'https://nostr.com/ns#pubkey',
  createdAt: 'https://nostr.com/ns#createdAt',
  content: 'https://nostr.com/ns#content',
  signature: 'https://nostr.com/ns#signature',
  DID: 'https://nostr.com/ns#DID',
};
```

## Offline Sync

The integration includes offline-first capabilities:

```typescript
interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  resourceUrl: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

interface SyncState {
  isOnline: boolean;
  lastSyncTimestamp: number | null;
  pendingItems: number;
  failedItems: number;
  isSyncing: boolean;
}
```

Operations queue locally when offline and sync when connectivity returns:

```typescript
import { getSyncState, processSyncQueue } from '$lib/solid';

// Check sync state
const state = getSyncState();
console.log(`Pending: ${state.pendingItems}, Failed: ${state.failedItems}`);

// Manually trigger sync
await processSyncQueue();
```

## Configuration

```typescript
interface SolidIntegrationConfig {
  defaultOidcIssuer: string;
  clientName: string;
  clientId?: string;
  redirectUrl: string;
  podStoragePaths: Partial<PodStoragePaths>;
  syncInterval: number;  // ms
  maxRetries: number;
  enableOfflineSync: boolean;
}

const DEFAULT_SOLID_CONFIG = {
  defaultOidcIssuer: 'https://solidcommunity.net',
  clientName: 'Fairfield Nostr',
  syncInterval: 30000,
  maxRetries: 3,
  enableOfflineSync: true,
};
```

## Error Handling

All operations return typed results with error information:

```typescript
const result = await storeNostrEvent(event);

if (!result.success) {
  switch (result.error?.code) {
    case 'UNAUTHORIZED':
      // Re-authenticate
      break;
    case 'FORBIDDEN':
      // Insufficient permissions
      break;
    case 'NETWORK_ERROR':
      // Queued for offline sync
      break;
  }
}
```

## Security Considerations

1. **OIDC Authentication**: Uses PKCE flow for secure token exchange
2. **DPoP Tokens**: Optional DPoP token binding for enhanced security
3. **ACL Enforcement**: Server-side access control via WAC
4. **Encrypted Storage**: NIP-44 encrypted events stored in separate container
5. **Identity Verification**: Cryptographic verification of Nostr-WebID links

## Related Documentation

- [did:nostr Implementation](./did-nostr.md)
- [Authentication](./authentication.md)
- [Admin Security](../security/admin-security.md)

## External Resources

- [Solid Project](https://solidproject.org/)
- [Solid Specification](https://solidproject.org/TR/)
- [Inrupt Solid Client Libraries](https://docs.inrupt.com/developer-tools/javascript/client-libraries/)
