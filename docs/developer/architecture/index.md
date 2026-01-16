---
title: "System Architecture"
description: "Comprehensive overview of the platform's architecture, design decisions, and technical infrastructure."
category: explanation
tags: ['architecture', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# System Architecture

Comprehensive overview of the platform's architecture, design decisions, and technical infrastructure.

---

## System Overview

The platform is a **Progressive Web Application (PWA)** built on the **Nostr protocol**, designed for community communication with strong privacy guarantees.

```mermaid
graph TB
    subgraph ClientLayer["CLIENT LAYER"]
        subgraph PWA["PWA (Progressive Web App)"]
            Auth["Auth Module<br/>- Keygen<br/>- Mnemonic<br/>- Storage"]
            Chat["Chat Module<br/>- Channels<br/>- Messages<br/>- DMs"]
            Admin["Admin Module<br/>- User management<br/>- Join approvals<br/>- Moderation"]
        end
        subgraph NDK["Nostr SDK (NDK)"]
            Signing["Event signing"]
            Encryption["NIP-44 encryption"]
            Subs["Subscription mgmt"]
        end
    end

    subgraph RelayLayer["RELAY LAYER"]
        subgraph Relay["Nostr Relay"]
            NIP42["NIP-42 AUTH<br/>- Pubkey whitelist<br/>- Challenge"]
            Groups["Group Logic<br/>- Membership<br/>- Roles<br/>- Moderation"]
            Store["Event Store<br/>- Messages<br/>- Metadata<br/>- Deletion support"]
        end
        Backup["Backup Service<br/>- Database snapshots<br/>- Storage sync"]
    end

    Auth --> NDK
    Chat --> NDK
    Admin --> NDK
    NDK -->|"WSS (WebSocket Secure)"| Relay
    Relay --> Backup
```

### Key Architectural Layers

| Layer | Responsibility | Technologies |
|-------|---------------|--------------|
| **Client** | User interface, local state, event creation | SvelteKit, NDK, IndexedDB |
| **Transport** | Secure WebSocket communication | WSS, NIP-42 AUTH |
| **Relay** | Event routing, storage, access control | Custom Nostr relay, PostgreSQL |
| **Infrastructure** | Hosting, CDN, monitoring | GitHub Pages, Cloud Run |

---

## Message Lifecycle

Understanding how messages flow through the system is essential for development and debugging.

### Complete Message Flow (Creation to Delivery)

```mermaid
sequenceDiagram
    participant U as User (PWA)
    participant UI as UI Components
    participant NDK as NDK Library
    participant WS as WebSocket
    participant R as Relay Worker
    participant DB as Database
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

        Note over DB: Database Storage
        DB->>DB: 14b. Write to storage
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

### Message Flow Steps Explained

| Step | Layer | Description |
|------|-------|-------------|
| 1-3 | Client | User types message, UI validates, sends to NDK |
| 4-7 | NDK | Event creation: build, tag, timestamp, sign |
| 8-9 | Transport | WebSocket transmission to relay |
| 10-12 | Relay | NIP-42 AUTH: verify signature, whitelist, membership |
| 13-16 | Storage | Database: persist event, update indexes |
| 17-19 | Distribution | Broadcast to all channel subscribers |
| 20-22 | Confirmation | Relay confirms, UI shows success |

---

## Deletion Flow

The platform supports message deletion through NIP-09 (user deletion) and NIP-29 (admin deletion).

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI
    participant NDK as NDK
    participant R as Relay
    participant DB as Database
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

### Why Deletion Works

Because we operate a **private relay**, we can guarantee deletion:

| Public Nostr (Federated) | Private Relay |
|--------------------------|---------------|
| Message replicates to many relays | Message exists on one relay |
| Deletion request may be ignored | Deletion is enforced |
| No guarantee of removal | Complete removal guaranteed |
| Data can persist indefinitely | Data lifecycle controlled |

---

## Authentication Architecture

### Key-Based Identity

Users authenticate via cryptographic keys rather than passwords:

```mermaid
sequenceDiagram
    participant User
    participant PWA
    participant Relay
    participant Admin

    User->>PWA: 1. Signup
    PWA->>User: 2. Generate mnemonic
    User->>PWA: 3. Copy & confirm
    PWA->>Relay: 4. Connect WSS
    Relay->>PWA: 5. AUTH challenge
    PWA->>Relay: 6. Sign & respond
    Relay->>PWA: 7. Pubkey not whitelisted
    PWA->>Admin: 8. Request system access
    Admin->>Relay: 9. Admin approves
    Relay->>PWA: 10. Add to whitelist
    PWA->>User: 11. Access granted
```

### Authentication Steps

1. **Key Generation** — BIP-39 mnemonic creates deterministic key pair
2. **Connection** — PWA connects to relay via secure WebSocket
3. **Challenge** — Relay issues NIP-42 authentication challenge
4. **Proof** — PWA signs challenge with private key
5. **Whitelist Check** — Relay verifies pubkey is authorised
6. **Session Established** — User gains access to their zones

---

## Channel Access Model

The platform uses a three-tier access model for channels:

```mermaid
flowchart TD
    A["User requests channel list"] --> B["Filter by user's cohort tag"]
    B --> C["Listed channels"]
    B --> D["Preview channels"]
    B --> E["Unlisted channels"]

    C --> F{"Is member?"}
    F -->|Yes| G["Show channel + msgs"]
    F -->|No| H["Show preview + join button"]

    D --> I["Show name + desc + 'Request Join'"]

    E --> J["Hidden from discovery<br/>(invite only)"]
```

### Channel Visibility Levels

| Level | Discovery | Access | Use Case |
|-------|-----------|--------|----------|
| **Listed** | Visible in channel list | Members can read/write | General channels |
| **Preview** | Visible with limited info | Request to join | Semi-private channels |
| **Unlisted** | Hidden from lists | Invite only | Private channels |

### Cohort-Based Filtering

Users are assigned cohorts that determine which zones they can access:

| Cohort | Zones | Purpose |
|--------|-------|---------|
| `moomaa-tribe` | Minimoonoir | Social community members |
| `business` | DreamLab | Business/creative members |
| `family` | Family | Family group members |
| `both` | Minimoonoir + DreamLab | Multi-zone members |

---

## Encryption Architecture

### Channel Messages

**Non-Encrypted Channels** (Public rooms, event channels):

```mermaid
flowchart LR
    Client -->|"plaintext msg"| Relay
    Relay -->|"plaintext"| Members
```

- Relay can read content for moderation
- Simple, performant
- NIP-29 membership enforcement provides access control

**End-to-End Encrypted Channels** (Private rooms):

```mermaid
flowchart LR
    subgraph Sender
        S1["1. Get group keys"]
        S2["2. NIP-44 encrypt for each member"]
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
- O(n) encryption per message for n members
- Suitable for groups under 100 members

### Direct Messages (NIP-17 + NIP-59)

Private messages use "gift wrapping" for maximum privacy:

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

**What Gift Wrapping Protects:**

| Metadata | Protected? | How |
|----------|------------|-----|
| Message content | ✅ Yes | NIP-44 encryption |
| Sender identity | ✅ Yes | Random wrapper pubkey |
| Timestamp | ✅ Yes | Fuzzed/randomised |
| Recipient | ⚠️ Partially | Visible to relay (necessary for delivery) |

**Key Security Property:** Administrators cannot read DMs — they lack recipients' private keys.

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
```

### Infrastructure Components

| Component | Service | Purpose |
|-----------|---------|---------|
| **PWA Hosting** | GitHub Pages | Static site delivery |
| **Relay** | Cloud Run | WebSocket message handling |
| **Database** | Cloud SQL (PostgreSQL) | Event storage, user data |
| **Media Storage** | Cloud Storage | Images, files |
| **CI/CD** | GitHub Actions | Automated testing and deployment |

---

## Data Models

### Nostr Event Kinds Used

| Kind | NIP | Purpose |
|------|-----|---------|
| 0 | 01 | User metadata (profile) |
| 5 | 09 | Deletion request |
| 9 | 29 | Group chat message |
| 10 | 29 | Group metadata |
| 11 | 29 | Group admin list |
| 12 | 29 | Group members |
| 1059 | 59 | Gift-wrapped event (DMs) |
| 9000 | 29 | Group add user |
| 9001 | 29 | Group remove user |
| 9005 | 29 | Group delete event |
| 31922 | 52 | Calendar event (date-based) |
| 31923 | 52 | Calendar event (time-based) |
| 31925 | 52 | Calendar RSVP |

### Custom Tags

```typescript
// Cohort tag for zone filtering
interface CohortTag {
  tag: "cohort";
  values: ["business" | "moomaa-tribe" | "family" | "both"];
}

// Join request status
interface JoinRequestTag {
  tag: "join-request";
  values: [channelId: string, status: "pending" | "approved" | "rejected"];
}

// Channel visibility
interface VisibilityTag {
  tag: "visibility";
  values: ["listed" | "unlisted" | "preview"];
}
```

### Client-Side Storage (IndexedDB)

```typescript
interface LocalDatabase {
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
    cohort: "business" | "moomaa-tribe" | "family" | "both";
    visibility: "listed" | "unlisted" | "preview";
    memberCount: number;
    isMember: boolean;
    isEncrypted: boolean;
  };

  // User's key material (encrypted)
  keys: {
    pubkey: string;
    encryptedPrivkey: string;  // Encrypted with PIN/passphrase
  };
}
```

---

## Performance Considerations

### Optimisations

| Area | Technique | Benefit |
|------|-----------|---------|
| **Subscriptions** | Filter by channel, limit count | Reduce bandwidth |
| **Caching** | IndexedDB message cache | Offline access, faster loads |
| **Rendering** | Virtual scrolling | Handle thousands of messages |
| **Connections** | Single WebSocket per relay | Reduce overhead |
| **Events** | Batch publishing | Fewer round trips |

### Scalability Limits

| Component | Practical Limit | Mitigation |
|-----------|-----------------|------------|
| E2E encrypted channels | ~100 members | Use non-encrypted for larger groups |
| Message history | ~10,000 per channel | Pagination, archiving |
| Concurrent connections | ~1,000 per relay | Horizontal scaling |
| Real-time subscriptions | ~50 per client | Aggregate subscriptions |

---

## Security Model

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  USER DEVICE (Trusted)                                  │
│  - Private keys                                         │
│  - Decrypted messages                                   │
│  - Local database                                       │
└───────────────────────────┬─────────────────────────────┘
                            │ WSS (Encrypted transport)
┌───────────────────────────▼─────────────────────────────┐
│  RELAY (Partially trusted)                              │
│  - Can see channel messages (non-E2E)                   │
│  - Cannot see DM content                                │
│  - Enforces access control                              │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  DATABASE (Untrusted for sensitive data)                │
│  - Stores encrypted DMs as opaque blobs                 │
│  - Stores plaintext channel messages                    │
│  - Indexes and metadata                                 │
└─────────────────────────────────────────────────────────┘
```

### Security Properties

| Property | Implementation |
|----------|----------------|
| **Authentication** | NIP-42 challenge-response with signing key |
| **Authorisation** | Pubkey whitelist + cohort membership |
| **Integrity** | Schnorr signatures on all events |
| **Confidentiality (DMs)** | NIP-44 ChaCha20-Poly1305 + NIP-59 gift wrap |
| **Forward secrecy** | Not implemented (key compromise exposes history) |

---

## Related Documentation

- [Component Architecture](components.md) — Frontend component structure
- [Data Flow](data-flow.md) — Detailed data flow patterns
- [NIP Protocol Reference](../reference/nip-protocol-reference.md) — Protocol specifications
- [Deployment Guide](../deployment/index.md) — Deployment instructions

---

[← Back to Developer Documentation](../index.md)
