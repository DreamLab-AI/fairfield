---
title: "System Architecture Reference"
description: "Complete system architecture documentation consolidated from SPARC methodology specifications"
category: reference
tags: ['architecture', 'sparc-methodology', 'system-design', 'deployment', 'testing']
difficulty: intermediate
last-updated: 2026-01-16
related-docs:
  - docs/PRD.md
  - docs/reference/api-reference.md
  - docs/reference/configuration.md
  - docs/deployment/deployment-guide.md
---

# System Architecture Reference

Complete system architecture documentation for the Nostr-based chat system, consolidated from SPARC methodology specifications.

## Overview

This architecture implements a decentralized chat system built on Nostr protocol with:
- **Three-zone structure**: Minimoonoir (social), DreamLab (business), Fairfield Family (family)
- **Zone → Section → Forum hierarchy** for content organization
- **PWA-based client** with offline support
- **Private relay** with deletion capability
- **E2E encrypted private rooms** and DMs

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **SvelteKit Framework** | Smallest runtime (~15KB), compile-time reactivity, NDK integration |
| **Cloudflare Workers Relay** | Serverless auto-scaling, Durable Objects for state |
| **No Federation** | Enables true message deletion, full privacy control |
| **Direct Key Generation** | crypto.getRandomValues for instant nsec creation |
| **Hierarchical Topology** | Zone → Section → Forum provides clear structure |

---

## System Overview

```mermaid
graph TB
    subgraph ClientLayer["CLIENT LAYER"]
        subgraph PWA["PWA (Progressive Web App)"]
            Auth["Auth Module<br/>- Keygen<br/>- NsecBackup<br/>- Storage"]
            Chat["Chat Module<br/>- Channels<br/>- Messages<br/>- DMs"]
            Admin["Admin Module<br/>- User management<br/>- Join approvals<br/>- Moderation"]
        end
        subgraph NDK["Nostr SDK (NDK)"]
            Signing["Event signing"]
            Encryption["NIP-44 encryption"]
            Subs["Subscription mgmt"]
        end
    end

    subgraph RelayLayer["RELAY LAYER (Google Cloud Run)"]
        subgraph Relay["Node.js Relay Service"]
            NIP42["NIP-42 AUTH<br/>- Pubkey whitelist<br/>- Challenge"]
            Groups["Group Logic<br/>- Membership<br/>- Roles<br/>- Moderation"]
            Store["Event Store (PostgreSQL)<br/>- Messages<br/>- Metadata<br/>- Deletion support"]
        end
        Backup["Backup Service<br/>- Cloud SQL backups<br/>- Cloud Storage sync"]
    end

    Auth --> NDK
    Chat --> NDK
    Admin --> NDK
    NDK -->|"WSS (WebSocket Secure)"| Relay
    Relay --> Backup
```

---

## Message Lifecycle & Data Flow

### Complete Message Flow (Creation to Delivery)

```mermaid
sequenceDiagram
    participant U as User (PWA)
    participant UI as UI Components
    participant NDK as NDK Library
    participant WS as WebSocket
    participant R as Relay Service
    participant DB as PostgreSQL
    participant SUB as Subscribers

    Note over U,SUB: Message Creation & Publishing Flow

    U->>UI: 1. Type message in input
    UI->>UI: 2. Validate content (length, format)
    UI->>NDK: 3. Create channel message

    Note over NDK: Event Construction
    NDK->>NDK: 4. Build event object (kind 9)
    NDK->>NDK: 5. Add channel tag ('h', channelId)
    NDK->>NDK: 6. Add timestamp (created_at)
    NDK->>NDK: 7. Sign with privkey (NIP-01)

    NDK->>WS: 8. Publish via WebSocket
    Note over WS: ["EVENT", {event}]

    WS->>R: 9. Relay receives event

    Note over R: NIP-42 Authentication
    R->>R: 10. Verify event signature
    R->>R: 11. Check pubkey in whitelist
    R->>R: 12. Validate channel membership

    alt User not authorised
        R->>WS: 13a. NOTICE: Auth failed
        WS->>UI: 14a. Show error
    else User authorised
        R->>DB: 13b. Store event

        Note over DB: PostgreSQL Storage
        DB->>DB: 14b. INSERT into events table
        DB->>DB: 15b. Update channel index
        DB->>DB: 16b. Update user message count

        R->>SUB: 17. Broadcast to subscribers
        Note over SUB: All connected clients<br/>subscribed to channel

        SUB->>SUB: 18. Update message list
        SUB->>SUB: 19. Render new message

        R->>WS: 20. OK response
        WS->>UI: 21. Message confirmed
        UI->>U: 22. Show success (green checkmark)
    end

    Note over U,SUB: ✅ Message delivered to all members
```

**Key Steps Explained:**

| Step | Layer | Description |
|------|-------|-------------|
| 1-3 | Client | User types message, UI validates, sends to NDK |
| 4-7 | NDK | Event creation: build, tag, timestamp, sign |
| 8-9 | Transport | WebSocket transmission to relay |
| 10-12 | Relay | NIP-42 AUTH: verify signature, whitelist, membership |
| 13-16 | Storage | PostgreSQL: persist event, update indexes |
| 17-19 | Distribution | Broadcast to all channel subscribers |
| 20-22 | Confirmation | Relay confirms, UI shows success |

### Deletion Flow (NIP-09 + NIP-29)

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI
    participant NDK as NDK
    participant R as Relay
    participant DB as PostgreSQL
    participant SUB as Subscribers

    U->>UI: Click "Delete" on message
    UI->>UI: Confirm deletion

    alt User's own message
        UI->>NDK: Create deletion event (kind 5)
        Note over NDK: NIP-09 deletion
        NDK->>NDK: Add 'e' tag (event ID to delete)
        NDK->>NDK: Sign with user's privkey
    else Admin deletion
        UI->>NDK: Create admin deletion (kind 9005)
        Note over NDK: NIP-29 admin action
        NDK->>NDK: Add 'h' tag (channel ID)
        NDK->>NDK: Add 'e' tag (event ID)
        NDK->>NDK: Sign with admin privkey
    end

    NDK->>R: Publish deletion event
    R->>R: Verify deletion authority
    R->>DB: Mark event as deleted
    DB->>DB: Update deletion index

    R->>SUB: Broadcast deletion
    SUB->>SUB: Remove message from UI
```

---

## Component Architecture

### Frontend Components

```mermaid
graph TB
    subgraph SRC["src/"]
        subgraph LIB["lib/"]
            subgraph NOSTR["nostr/"]
                keys["keys.ts - NIP-06 key generation"]
                encryption["encryption.ts - NIP-44 E2E"]
                events["events.ts - Event creation/signing"]
                relay["relay.ts - RelayManager with NIP-42 AUTH"]
                dm["dm.ts - NIP-17/59 DM handling"]
                channels["channels.ts - Channel operations"]
                groups["groups.ts - NIP-29 groups"]
            end
            subgraph STORES["stores/"]
                authStore["auth.ts - Authentication state"]
                channelsStore["channels.ts - Channel subscriptions"]
                messagesStore["messages.ts - Message cache"]
                dmStore["dm.ts - DM state"]
            end
            subgraph UTILS["utils/"]
                storage["storage.ts - localStorage/IndexedDB"]
                crypto["crypto.ts - Key encryption utils"]
            end
        end
        subgraph COMPONENTS["lib/components/"]
            subgraph AUTH["auth/"]
                Signup["Signup.svelte"]
                Login["Login.svelte"]
                NsecBackup["NsecBackup.svelte"]
            end
            subgraph CHAT["chat/"]
                ChannelList["ChannelList.svelte"]
                MessageList["MessageList.svelte"]
                MessageInput["MessageInput.svelte"]
            end
            subgraph ADMIN["admin/"]
                Dashboard["Dashboard.svelte"]
                PendingRequests["PendingRequests.svelte"]
                UserList["UserList.svelte"]
            end
        end
        subgraph ROUTES["routes/"]
            homePage["+page.svelte - Landing"]
            chatPage["chat/+page.svelte - Channels"]
            adminPage["admin/+page.svelte - Admin"]
            dmPage["dm/+page.svelte - DM List"]
        end
    end
```

### Relay Configuration (Google Cloud Run)

```typescript
// services/nostr-relay/src/config.ts
export const relayConfig = {
  info: {
    name: "Nostr-BBS Private Relay",
    description: "Private relay for Nostr-BBS community",
    supported_nips: [1, 2, 9, 11, 29, 42, 44, 59],
  },

  // NIP-42 Authentication Required
  auth: {
    enabled: true,
    challenge_timeout: 60,
  },

  // Write Policy
  writePolicy: {
    // Only authenticated users can write
    require_auth: true,
    // Whitelist managed by admin
    use_pubkey_whitelist: true,
  },

  // No federation
  upstream: [],

  // Storage via PostgreSQL (Cloud SQL)
  storage: {
    type: 'postgresql',
    connectionString: process.env.DATABASE_URL,
    pool: { max: 20, idleTimeoutMillis: 30000 },
  },
};
```

---

## Data Models

### Nostr Event Kinds Used

| Kind | NIP | Purpose |
|------|-----|---------|
| 0 | 01 | User metadata (profile) |
| 1 | 01 | Short text note (channel messages) |
| 4 | 04 | Encrypted DM (legacy, read-only) |
| 5 | 09 | Deletion request |
| 9 | 29 | Group chat message |
| 10 | 29 | Group metadata |
| 11 | 29 | Group admin list |
| 12 | 29 | Group members |
| 1059 | 59 | Gift-wrapped event (DMs) |
| 9000 | 29 | Group add user |
| 9001 | 29 | Group remove user |
| 9005 | 29 | Group delete event |

### IndexedDB Schema (Client-side Cache)

```typescript
interface NostrBBSDB {
  // Cached messages for offline access
  messages: {
    id: string;           // Event ID
    channelId: string;
    pubkey: string;
    content: string;      // Decrypted content
    created_at: number;
    deleted: boolean;
  };

  // Channel metadata
  channels: {
    id: string;
    name: string;
    description: string;
    cohort: "business" | "moomaa-tribe" | "both";
    visibility: "listed" | "unlisted" | "preview";
    memberCount: number;
    isMember: boolean;
    isEncrypted: boolean;
  };

  // Pending requests
  joinRequests: {
    id: string;
    channelId: string;
    requestedAt: number;
    status: "pending" | "approved" | "rejected";
  };

  // User's key material (encrypted)
  keys: {
    pubkey: string;
    encryptedPrivkey: string;  // Encrypted with PIN/passphrase
  };
}
```

---

## Technology Stack

### Frontend

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | SvelteKit | Lightweight, PWA-friendly, good DX |
| Nostr SDK | NDK (@nostr-dev-kit/ndk) | High-level, well-maintained |
| Styling | Tailwind CSS | Rapid UI development |
| Storage | IndexedDB (Dexie) | Offline message cache |
| Build | Vite | Fast HMR, PWA plugin |

### Relay

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Core Relay | Node.js + Express + WS | WebSocket support, npm ecosystem |
| Storage | PostgreSQL (Cloud SQL) | ACID compliance, pgvector for semantic search |
| Group Logic | Custom NIP-29 impl | Full control over group features |
| Hosting | Google Cloud Run | Auto-scaling containers, managed infrastructure |

### Infrastructure

| Component | Technology | Rationale |
|-----------|------------|-----------|
| PWA Hosting | GitHub Pages | Free, fast CDN, simple deployment |
| Relay Hosting | Google Cloud Run | Serverless containers, auto-scaling |
| Database | Cloud SQL PostgreSQL | Managed DB, automatic backups, pgvector |
| File Storage | Google Cloud Storage | Media files, vector indices |
| Monitoring | Cloud Logging + Monitoring | Built-in GCP observability |

---

## Encryption Architecture

### Channel Messages (NIP-29 Groups)

**Non-Encrypted Channels** (Common Rooms, Event Channels)

```mermaid
flowchart LR
    Client -->|"plaintext msg"| Relay
    Relay -->|"plaintext"| Members
```

- Relay can read content
- Admin implicitly has access (relay owner)
- Simple, performant
- NIP-29 membership enforcement

**E2E Encrypted Channels** (Private Course Rooms)

```mermaid
flowchart LR
    subgraph Sender
        S1["1. Get group keys"]
        S2["2. NIP44 encrypt for each member"]
    end
    subgraph Relay
        R1["3. Store encrypted blob"]
    end
    subgraph Recipients
        T1["4. Decrypt with own key"]
    end

    S1 --> S2
    S2 --> R1
    R1 --> T1
```

- Relay sees encrypted blob only
- Admin in room = admin has key = can decrypt
- O(n) encryption per message for n members
- Suitable for <100 member groups

### Direct Messages (NIP-17 + NIP-59)

```mermaid
sequenceDiagram
    participant Sender
    participant Relay
    participant Recipient

    Note over Sender: 1. Create sealed rumor (kind 14)<br/>- Encrypt content with NIP-44<br/>- Real timestamp
    Note over Sender: 2. Wrap with gift-wrap (kind 1059)<br/>- Random sender key<br/>- Fuzzed timestamp<br/>- Encrypt sealed rumor
    Sender->>Relay: Publish gift-wrap
    Note over Relay: Sees only gift-wrap<br/>- Random pubkey<br/>- Fuzzed time<br/>- Encrypted blob
    Relay->>Recipient: Deliver gift-wrap
    Note over Recipient: 3. Unwrap gift
    Note over Recipient: 4. Decrypt rumor
```

**Admin CANNOT read DMs** (no access to recipient's privkey)

---

## Deletion Strategy

### Local Relay Deletion (Supported)

```typescript
// User deletes their own message
async function deleteMessage(eventId: string, privkey: string) {
  // Create NIP-09 deletion event
  const deletionEvent = {
    kind: 5,
    pubkey: getPublicKey(privkey),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["e", eventId],  // Event to delete
    ],
    content: "Deleted by user",
  };

  // Sign and publish
  const signed = await signEvent(deletionEvent, privkey);
  await relay.publish(signed);

  // Local relay WILL honour deletion
  // (configured to respect NIP-09 from event author)
}

// Admin force-delete (NIP-29 kind 9005)
async function adminDeleteMessage(eventId: string, channelId: string) {
  const deletionEvent = {
    kind: 9005,
    tags: [
      ["h", channelId],
      ["e", eventId],
    ],
    content: "Removed by admin",
  };
  // Sign event with admin private key
  return finalizeEvent(event, adminPrivateKey);
}
```

### Why Local-Only Enables True Deletion

**Public Nostr (Federation)**

```mermaid
flowchart LR
    User -->|msg| RelayA["Relay A"]
    RelayA --> RelayB["Relay B"]
    RelayB --> RelayC["Relay C"]
    User -->|delete| RelayA
    RelayA -.->|"???"| RelayB
    RelayB -.->|"???"| RelayC
```

*Problem: No guarantee other relays honour deletion*

**Nostr-BBS (Closed Relay)**

```mermaid
flowchart TB
    User -->|msg| NostrBBSRelay["Nostr-BBS Relay (ONLY)"]
    User -->|delete| NostrBBSRelay
    NostrBBSRelay -->|"Event removed"| PG[(PostgreSQL)]
```

*Guarantee: We control the only relay, deletion is real*

---

## Deployment Architecture

```mermaid
graph TB
    subgraph GitHub["GitHub"]
        subgraph Pages["GitHub Pages"]
            PWA["PWA (static SPA)<br/>Static site hosting"]
        end
        Repo["Source Repository<br/>CI/CD via Actions"]
    end

    subgraph Docker["Docker Containers"]
        DevEnv["Development Environment<br/>Local testing"]
    end

    subgraph GCP["Google Cloud Platform"]
        subgraph CloudRun["Cloud Run"]
            Relay["Relay API<br/>WebSocket endpoint"]
            EmbedAPI["Embedding API<br/>Vector generation"]
            ImageAPI["Image API<br/>Image processing"]
        end

        subgraph Database["Cloud SQL"]
            PostgreSQL["PostgreSQL<br/>Relational data<br/>pgvector extension"]
        end

        subgraph Storage["Cloud Storage"]
            Vectors["Vector Storage<br/>Embeddings"]
            Images["Image Storage<br/>Media files"]
        end

        Relay --> PostgreSQL
        EmbedAPI --> Vectors
        ImageAPI --> Images
        Relay --> Vectors
    end

    PWA -->|"WSS/HTTPS"| Relay
    PWA -->|"HTTPS"| EmbedAPI
    PWA -->|"HTTPS"| ImageAPI
    Repo -->|"Deploy"| Pages
    Docker -->|"Test/Build"| Repo
```

---

## Security Considerations

### Threat Model

```mermaid
graph TD
    subgraph "Threats"
        T1[Key theft from browser]
        T2[Man-in-the-middle]
        T3[Unauthorized relay access]
        T4[Message tampering]
        T5[Admin impersonation]
    end

    subgraph "Mitigations"
        M1[localStorage encryption<br/>+ secure context only]
        M2[WSS + Caddy TLS]
        M3[NIP-42 AUTH + whitelist]
        M4[Event signatures verified]
        M5[Single admin key<br/>+ hardware key future]
    end

    T1 --> M1
    T2 --> M2
    T3 --> M3
    T4 --> M4
    T5 --> M5
```

### Security Checklist

- All relay connections via WSS (TLS)
- NIP-42 AUTH enforced on relay
- Pubkey whitelist managed by admin
- Private keys never leave browser
- E2E encryption for private channels
- Gift-wrap for DM metadata protection
- Content Security Policy headers
- HSTS enabled on Caddy

---

## Related Documentation

- [API Reference](./api-reference.md) - Complete API documentation
- [Authentication Reference](./authentication.md) - Auth system specification
- [Configuration Reference](./configuration.md) - Configuration options
- [NIP Protocol Reference](../developer/reference/nip-protocol-reference.md) - Nostr protocol implementations
- [PRD](../PRD.md) - Product requirements document
- [Deployment Guide](../deployment/deployment-guide.md) - Deployment procedures

---

## Legacy SPARC Documentation

This document consolidates content from the following legacy SPARC methodology files (now superseded):

- `docs/architecture/01-specification.md` - Original requirements specification
- `docs/architecture/02-architecture.md` - System architecture design
- `docs/architecture/03-pseudocode.md` - Algorithm design and flows
- `docs/architecture/04-refinement.md` - Technology selection and testing
- `docs/architecture/05-completion.md` - Deployment and verification

**Note**: The SPARC files remain for historical reference but should not be used for current implementation. This consolidated reference is the authoritative source for architectural documentation.

For current requirements and features, see [PRD](../PRD.md) v2.1.0.
