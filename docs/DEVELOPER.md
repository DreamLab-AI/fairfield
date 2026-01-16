# Developer Documentation

Comprehensive technical documentation for the Nostr BBS platform.

**Version:** 1.0.0
**Last Updated:** 2026-01-16

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Key Components](#key-components)
5. [Nostr Protocol Integration](#nostr-protocol-integration)
6. [Security Model](#security-model)
7. [Testing Strategy](#testing-strategy)
8. [Deployment](#deployment)

---

## Architecture Overview

The platform is a **Progressive Web Application (PWA)** built on the **Nostr protocol**, designed for community communication with strong privacy guarantees.

### System Architecture

```mermaid
graph TB
    subgraph ClientLayer["CLIENT LAYER"]
        subgraph PWA["PWA (SvelteKit SPA)"]
            Auth["Auth Module<br/>- Key Generation<br/>- NIP-07 Integration<br/>- Session Management"]
            Chat["Chat Module<br/>- Channels (NIP-29)<br/>- Messages<br/>- Reactions"]
            DM["DM Module<br/>- NIP-17 Private Messages<br/>- NIP-59 Gift Wrap<br/>- NIP-44 Encryption"]
            Calendar["Calendar Module<br/>- NIP-52 Events<br/>- RSVPs"]
            Admin["Admin Module<br/>- User Management<br/>- Join Approvals<br/>- Moderation"]
        end
        subgraph ClientStorage["Client Storage"]
            IndexedDB["IndexedDB<br/>- Message Cache<br/>- Profile Cache<br/>- Encrypted Keys"]
        end
        subgraph NDK["Nostr SDK (NDK)"]
            Signing["Event Signing"]
            Encryption["NIP-44 Encryption"]
            Subs["Subscription Manager"]
        end
    end

    subgraph RelayLayer["RELAY LAYER"]
        subgraph Relay["Private Nostr Relay"]
            NIP42["NIP-42 AUTH<br/>- Challenge-Response<br/>- Pubkey Whitelist"]
            Groups["NIP-29 Groups<br/>- Membership<br/>- Roles<br/>- Moderation"]
            Store["Event Store<br/>- Messages<br/>- Metadata<br/>- Deletions"]
        end
    end

    subgraph DataLayer["DATA LAYER"]
        PostgreSQL["PostgreSQL<br/>- Event Storage<br/>- User Data<br/>- pgvector Extension"]
        ObjectStorage["Object Storage<br/>- Images<br/>- Media Files"]
    end

    Auth --> NDK
    Chat --> NDK
    DM --> NDK
    Calendar --> NDK
    Admin --> NDK
    PWA --> IndexedDB
    NDK -->|"WSS (WebSocket Secure)"| Relay
    Relay --> PostgreSQL
    Relay --> ObjectStorage
```

### Key Architectural Layers

| Layer | Responsibility | Technologies |
|-------|---------------|--------------|
| **Client** | User interface, local state, event creation | SvelteKit, NDK, IndexedDB |
| **Transport** | Secure WebSocket communication | WSS, NIP-42 AUTH |
| **Relay** | Event routing, storage, access control | Custom Nostr relay, NIP-29 |
| **Data** | Persistent storage, search | PostgreSQL, pgvector |

### Data Flow Overview

```mermaid
flowchart LR
    subgraph Client["Client"]
        UI["UI Components"]
        Store["Svelte Stores"]
        Cache["IndexedDB"]
    end

    subgraph Service["Service Layer"]
        NDK["NDK Client"]
        Crypto["Encryption"]
    end

    subgraph Network["Network"]
        WS["WebSocket"]
        Relay["Relay"]
    end

    UI -->|"User Action"| Store
    Store -->|"State Change"| NDK
    NDK -->|"Sign Event"| Crypto
    Crypto -->|"Publish"| WS
    WS -->|"Send"| Relay
    Relay -->|"Broadcast"| WS
    WS -->|"Receive"| NDK
    NDK -->|"Update"| Store
    Store -->|"Persist"| Cache
    Store -->|"Re-render"| UI
```

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **SvelteKit** | 2.x | Application framework |
| **Svelte** | 4.x | UI components |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.x | Styling |
| **DaisyUI** | 4.x | Component library |
| **Lucide** | Latest | Icons |

### Nostr Libraries

| Library | Purpose |
|---------|---------|
| **@nostr-dev-kit/ndk** | Core Nostr functionality |
| **@nostr-dev-kit/ndk-svelte** | Svelte bindings for NDK |
| **@nostr-dev-kit/ndk-cache-dexie** | IndexedDB caching |
| **nostr-tools** | Low-level Nostr utilities |

### Cryptography

| Library | Purpose |
|---------|---------|
| **@scure/bip32** | HD key derivation |
| **@scure/bip39** | Mnemonic generation |
| **@noble/hashes** | SHA-256, HMAC |
| **@noble/curves** | secp256k1, Schnorr signatures |

### Storage & Search

| Technology | Purpose |
|------------|---------|
| **Dexie** | IndexedDB wrapper |
| **hnswlib-wasm** | Vector search (semantic search) |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Vite** | Build tool |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **ESLint** | Linting |
| **Prettier** | Code formatting |

---

## Project Structure

```
nostr-bbs/
├── src/
│   ├── lib/
│   │   ├── components/          # Svelte components
│   │   │   ├── ui/             # Generic UI (Button, Input, Modal)
│   │   │   ├── chat/           # Chat components
│   │   │   ├── dm/             # Direct message components
│   │   │   ├── calendar/       # Calendar components
│   │   │   ├── admin/          # Admin panel components
│   │   │   ├── auth/           # Authentication components
│   │   │   ├── navigation/     # Navigation components
│   │   │   └── zones/          # Zone-specific components
│   │   ├── stores/             # Svelte stores (state)
│   │   │   ├── auth.ts         # Authentication state
│   │   │   ├── ndk.ts          # NDK instance
│   │   │   ├── channelStore.ts # Channel data
│   │   │   ├── notifications.ts # Notifications
│   │   │   └── settings.ts     # User preferences
│   │   ├── nostr/              # Nostr-specific logic
│   │   │   ├── ndk.ts          # NDK initialisation
│   │   │   ├── dm.ts           # NIP-17/59 DM handling
│   │   │   ├── groups.ts       # NIP-29 group operations
│   │   │   ├── calendar.ts     # NIP-52 calendar events
│   │   │   ├── encryption.ts   # NIP-44 encryption
│   │   │   └── events.ts       # Event creation/validation
│   │   ├── utils/              # Utility functions
│   │   │   ├── crypto.ts       # Cryptography helpers
│   │   │   ├── validation.ts   # Input validation
│   │   │   └── storage.ts      # Local storage helpers
│   │   ├── types/              # TypeScript types
│   │   └── config/             # Configuration
│   ├── routes/                 # SvelteKit routes
│   │   ├── +layout.svelte      # Root layout
│   │   ├── +page.svelte        # Home page
│   │   ├── setup/              # Setup wizard
│   │   ├── chat/               # Chat routes
│   │   ├── dm/                 # DM routes
│   │   ├── forums/             # Forum routes
│   │   ├── admin/              # Admin routes
│   │   └── [category]/         # Dynamic zone routes
│   └── service-worker.ts       # PWA service worker
├── static/                     # Static assets
├── tests/                      # Test files
├── docs/                       # Documentation
└── config files               # Configuration
```

### Path Aliases

| Alias | Path |
|-------|------|
| `$lib` | `src/lib` |
| `$components` | `src/lib/components` |
| `$stores` | `src/lib/stores` |

---

## Key Components

### Component Hierarchy

```mermaid
graph TB
    subgraph Pages["Pages (Routes)"]
        Home["+page.svelte<br/>(Home)"]
        Chat["chat/[channelId]<br/>(Channel View)"]
        DM["dm/[pubkey]<br/>(DM Thread)"]
        Calendar["calendar<br/>(Events)"]
        Admin["admin<br/>(Admin Panel)"]
    end

    subgraph Layouts["Layouts"]
        Root["+layout.svelte<br/>(Root)"]
        Zone["[zone]/+layout.svelte<br/>(Zone Layout)"]
    end

    subgraph Features["Feature Components"]
        MessageList["MessageList"]
        MessageInput["MessageInput"]
        ChannelHeader["ChannelHeader"]
        ConversationList["ConversationList"]
        EventCalendar["EventCalendar"]
        UserList["UserList"]
    end

    subgraph UI["UI Components"]
        Button["Button"]
        Input["Input"]
        Modal["Modal"]
        Avatar["Avatar"]
        Toast["Toast"]
    end

    Root --> Pages
    Zone --> Chat
    Pages --> Features
    Features --> UI
```

### Message Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as MessageInput
    participant Store as Svelte Store
    participant NDK as NDK Client
    participant Relay as Nostr Relay
    participant Sub as Subscribers

    U->>UI: Type message
    UI->>UI: Validate content

    Note over UI,Store: Optimistic Update
    UI->>Store: Add pending message
    Store-->>UI: Re-render (pending state)

    UI->>NDK: Create kind 9 event
    NDK->>NDK: Add 'h' tag (channel)
    NDK->>NDK: Sign with privkey

    NDK->>Relay: Publish event
    Relay->>Relay: Verify signature
    Relay->>Relay: Check membership

    alt Authorised
        Relay->>Relay: Store event
        Relay->>Sub: Broadcast to members
        Relay->>NDK: OK response
        NDK->>Store: Confirm message
        Store-->>UI: Update (confirmed)
    else Not Authorised
        Relay->>NDK: Error response
        NDK->>Store: Remove pending
        Store-->>UI: Show error
    end
```

### State Management Pattern

```mermaid
graph LR
    subgraph Stores["Svelte Stores"]
        Auth["auth<br/>(user, pubkey)"]
        Channels["channels<br/>(list, metadata)"]
        Messages["messages<br/>(cache by channel)"]
        Settings["settings<br/>(preferences)"]
    end

    subgraph Derived["Derived Stores"]
        CurrentUser["currentUser"]
        UnreadCount["unreadCount"]
        ChannelMessages["channelMessages(id)"]
    end

    subgraph Components["Components"]
        C1["Component A"]
        C2["Component B"]
    end

    Auth --> CurrentUser
    Messages --> UnreadCount
    Messages --> ChannelMessages

    Stores -->|"subscribe"| Components
    Components -->|"update"| Stores
    Derived -->|"auto-update"| Components
```

---

## Nostr Protocol Integration

### NIP Implementation Status

| NIP | Name | Status | Usage |
|-----|------|--------|-------|
| **NIP-01** | Basic Protocol | Full | Event structure, signatures |
| **NIP-06** | Key Derivation | Full | BIP-39 mnemonic to keys |
| **NIP-07** | Browser Extension | Full | Alby, nos2x integration |
| **NIP-09** | Event Deletion | Full | User message deletion |
| **NIP-10** | Text Notes | Full | Threading with markers |
| **NIP-17** | Private DMs | Full | Sealed rumours |
| **NIP-25** | Reactions | Full | Emoji reactions |
| **NIP-29** | Groups | Full | Primary chat mechanism |
| **NIP-42** | Authentication | Full | Relay AUTH |
| **NIP-44** | Encryption | Full | ChaCha20-Poly1305 |
| **NIP-52** | Calendar | Full | Events and RSVPs |
| **NIP-59** | Gift Wrap | Full | Metadata hiding for DMs |

### Event Kinds Used

| Kind | NIP | Purpose |
|------|-----|---------|
| 0 | 01 | User metadata (profile) |
| 5 | 09 | Deletion request |
| 7 | 25 | Reaction (like, emoji) |
| 9 | 29 | Group chat message |
| 1059 | 59 | Gift-wrapped event (DMs) |
| 9000 | 29 | Group add user |
| 9001 | 29 | Group remove user |
| 9005 | 29 | Group delete event |
| 9007 | 29 | Join request |
| 22242 | 42 | AUTH challenge response |
| 31923 | 52 | Calendar event |
| 31925 | 52 | Calendar RSVP |
| 39000 | 29 | Group metadata |

### Channel Message Flow (NIP-29)

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Relay
    participant Members

    User->>Client: Send message
    Client->>Client: Create kind 9 event
    Client->>Client: Add 'h' tag (group ID)
    Client->>Client: Sign with Schnorr

    Client->>Relay: Publish event
    Relay->>Relay: Verify signature (NIP-01)
    Relay->>Relay: Check NIP-42 AUTH
    Relay->>Relay: Verify membership (NIP-29)

    alt Member verified
        Relay->>Relay: Store event
        Relay->>Members: Broadcast to subscribers
        Relay->>Client: OK
    else Not a member
        Relay->>Client: NOTICE "Not a member"
    end
```

### Private DM Flow (NIP-17 + NIP-59)

```mermaid
sequenceDiagram
    participant Sender
    participant Client
    participant Relay
    participant Recipient

    Sender->>Client: Compose DM

    Note over Client: Layer 1: Content
    Client->>Client: Encrypt with NIP-44<br/>(ChaCha20-Poly1305)

    Note over Client: Layer 2: Sealed Rumor
    Client->>Client: Create kind 14 rumor<br/>(encrypted content)

    Note over Client: Layer 3: Gift Wrap
    Client->>Client: Generate random keypair
    Client->>Client: Create kind 1059 wrapper
    Client->>Client: Fuzz timestamp (plus/minus 2 days)
    Client->>Client: Encrypt rumor for recipient

    Client->>Relay: Publish gift wrap

    Note over Relay: Relay sees only:<br/>- Random pubkey<br/>- Fuzzed timestamp<br/>- Encrypted blob<br/>- Recipient tag

    Relay->>Recipient: Deliver gift wrap

    Note over Recipient: Unwrap
    Recipient->>Recipient: Decrypt outer layer
    Recipient->>Recipient: Extract sealed rumor
    Recipient->>Recipient: Decrypt content
    Recipient->>Recipient: Recover real sender/time
```

### Zone/Section Hierarchy

```mermaid
graph TB
    subgraph Zones["Zones (UI Grouping)"]
        Z1["Minimoonoir Zone"]
        Z2["DreamLab Zone"]
        Z3["Family Zone"]
    end

    subgraph Sections["Sections (Access Control)"]
        S1["General Section<br/>(cohort: moomaa-tribe)"]
        S2["Events Section<br/>(cohort: moomaa-tribe)"]
        S3["Business Section<br/>(cohort: business)"]
        S4["Creative Section<br/>(cohort: business)"]
        S5["Family Section<br/>(cohort: family)"]
    end

    subgraph Channels["Channels (NIP-29 Groups)"]
        C1["#welcome"]
        C2["#announcements"]
        C3["#event-planning"]
        C4["#projects"]
        C5["#ideas"]
        C6["#family-chat"]
    end

    Z1 --> S1
    Z1 --> S2
    Z2 --> S3
    Z2 --> S4
    Z3 --> S5

    S1 --> C1
    S1 --> C2
    S2 --> C3
    S3 --> C4
    S4 --> C5
    S5 --> C6
```

### Cohort-Based Access Control

```mermaid
flowchart TD
    User["User Request"]
    User --> CheckAuth{"NIP-42<br/>Authenticated?"}

    CheckAuth -->|No| Reject1["Reject: AUTH required"]
    CheckAuth -->|Yes| CheckWhitelist{"Pubkey in<br/>Whitelist?"}

    CheckWhitelist -->|No| Reject2["Reject: Not whitelisted"]
    CheckWhitelist -->|Yes| GetCohort["Get User Cohort"]

    GetCohort --> CheckCohort{"Channel Cohort<br/>Matches?"}

    CheckCohort -->|No| Reject3["Reject: Wrong cohort"]
    CheckCohort -->|Yes| CheckMember{"Is Channel<br/>Member?"}

    CheckMember -->|No| JoinFlow["Show Join Request"]
    CheckMember -->|Yes| Allow["Allow Access"]
```

---

## Security Model

### Trust Boundaries

```mermaid
graph TB
    subgraph Trusted["USER DEVICE (Fully Trusted)"]
        PrivKey["Private Keys"]
        Decrypted["Decrypted Content"]
        Session["Session Data"]
        LocalDB["IndexedDB Cache"]
    end

    subgraph Partial["RELAY (Partially Trusted)"]
        ChannelMsg["Can read channel messages"]
        CantReadDM["Cannot read DM content"]
        Enforces["Enforces access control"]
        MayCompromise["May be compromised"]
    end

    subgraph Untrusted["DATABASE (Untrusted for Sensitive)"]
        EncryptedDM["Encrypted DMs (opaque blobs)"]
        PlainChannel["Plaintext channel messages"]
        Indexes["Indexes and metadata"]
    end

    Trusted -->|"WSS (TLS 1.3)"| Partial
    Partial --> Untrusted
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant PWA
    participant Relay
    participant Admin

    Note over User,Admin: Key Generation (Signup)
    User->>PWA: Click "Create Account"
    PWA->>PWA: Generate BIP-39 mnemonic
    PWA->>PWA: Derive keypair (NIP-06)
    PWA->>User: Display recovery phrase

    Note over User,Admin: Connection & AUTH
    PWA->>Relay: Connect (WSS)
    Relay->>PWA: AUTH challenge (random string)
    PWA->>PWA: Sign challenge (kind 22242)
    PWA->>Relay: AUTH response

    Relay->>Relay: Verify signature
    Relay->>Relay: Check pubkey whitelist

    alt Not whitelisted
        Relay->>PWA: NOTICE "Not authorised"
        PWA->>Admin: Request access (kind 9007)
        Admin->>Relay: Approve user (kind 9000)
        Relay->>PWA: Access granted
    else Whitelisted
        Relay->>PWA: OK (authenticated)
    end

    PWA->>User: Session established
```

### NIP-07 Browser Extension Flow

```mermaid
sequenceDiagram
    participant User
    participant PWA
    participant Extension as Browser Extension<br/>(Alby/nos2x)
    participant Relay

    User->>PWA: Click "Login with Extension"
    PWA->>PWA: Check window.nostr exists

    alt Extension detected
        PWA->>Extension: getPublicKey()
        Extension->>User: Permission dialog
        User->>Extension: Approve
        Extension->>PWA: Return pubkey

        Note over PWA,Relay: AUTH Flow
        Relay->>PWA: AUTH challenge
        PWA->>Extension: signEvent(authEvent)
        Extension->>User: Signing prompt
        User->>Extension: Approve
        Extension->>PWA: Signed event
        PWA->>Relay: AUTH response
        Relay->>PWA: OK
    else No extension
        PWA->>User: Show "Install Extension" link
    end
```

### Encryption Architecture

```mermaid
graph TB
    subgraph ChannelEncryption["Channel Messages (Non-E2E)"]
        CM1["Plaintext Content"]
        CM2["Signed with User Key"]
        CM3["Relay Can Read"]
        CM4["Access via NIP-29 Membership"]
        CM1 --> CM2 --> CM3 --> CM4
    end

    subgraph DMEncryption["Private Messages (E2E)"]
        DM1["Plaintext"]
        DM2["NIP-44 Encrypt<br/>(ChaCha20-Poly1305)"]
        DM3["Sealed Rumor<br/>(kind 14)"]
        DM4["Gift Wrap<br/>(kind 1059)"]
        DM5["Random Pubkey"]
        DM6["Fuzzed Timestamp"]

        DM1 --> DM2
        DM2 --> DM3
        DM3 --> DM4
        DM4 --> DM5
        DM4 --> DM6
    end

    subgraph RelayView["What Relay Sees"]
        RV1["Channel: Full content"]
        RV2["DM: Encrypted blob only"]
    end

    ChannelEncryption --> RV1
    DMEncryption --> RV2
```

### Security Properties

| Property | Implementation |
|----------|----------------|
| **Authentication** | NIP-42 challenge-response with signing key |
| **Authorisation** | Pubkey whitelist + cohort membership |
| **Integrity** | Schnorr signatures on all events |
| **Confidentiality (DMs)** | NIP-44 ChaCha20-Poly1305 + NIP-59 gift wrap |
| **Metadata Protection (DMs)** | Random sender key, fuzzed timestamps |
| **Forward Secrecy** | Not implemented (key compromise exposes history) |

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| Key Theft | Encrypted storage, optional passphrase |
| MITM Attack | TLS 1.3 (WSS) |
| Relay Compromise | E2E encryption for DMs |
| Replay Attack | Timestamp validation |
| Impersonation | Schnorr signature verification |
| XSS | Content sanitisation (DOMPurify), CSP headers |

---

## Testing Strategy

### Test Pyramid

```mermaid
graph TB
    subgraph E2E["E2E Tests (Playwright)"]
        E1["Login Flow"]
        E2["Message Flow"]
        E3["Admin Actions"]
    end

    subgraph Integration["Integration Tests"]
        I1["Auth + Relay"]
        I2["Messaging + Store"]
        I3["DM Encryption"]
    end

    subgraph Unit["Unit Tests (Vitest)"]
        U1["Components"]
        U2["Stores"]
        U3["Utils"]
        U4["Services"]
    end

    E2E --> Integration --> Unit
```

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

### Test Structure

```
tests/
├── unit/
│   ├── components/
│   │   ├── Button.test.ts
│   │   └── MessageBubble.test.ts
│   ├── stores/
│   │   └── messages.test.ts
│   ├── services/
│   │   └── messaging.test.ts
│   └── utils/
│       └── validation.test.ts
├── integration/
│   ├── auth.test.ts
│   └── messaging.test.ts
├── e2e/
│   └── flows/
│       ├── login.test.ts
│       └── messaging.test.ts
└── fixtures/
    ├── events.ts
    └── users.ts
```

### Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

### Test Patterns

**Component Testing:**
```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Button from '$components/ui/Button.svelte';

describe('Button', () => {
  it('renders with default props', () => {
    render(Button, { props: { children: 'Click' } });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const { component } = render(Button);
    const handleClick = vi.fn();
    component.$on('click', handleClick);

    await fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

**Store Testing:**
```typescript
import { get } from 'svelte/store';
import { messages } from '$stores/messages';

describe('messages store', () => {
  beforeEach(() => messages.reset());

  it('adds message to channel', () => {
    messages.addMessage('ch-1', { id: 'msg-1', content: 'Hello' });
    const $msgs = get(messages);
    expect($msgs.messages.get('ch-1')).toHaveLength(1);
  });
});
```

---

## Deployment

### Deployment Options

| Option | Best For | Complexity |
|--------|----------|------------|
| **GitHub Pages** | Static hosting, simplest | Low |
| **Cloud Run** | Scalable, serverless | Medium |
| **Self-Hosted** | Full control | High |

### Deployment Architecture

```mermaid
graph TB
    subgraph GitHub["GitHub"]
        Pages["GitHub Pages<br/>(Static PWA)"]
        Actions["GitHub Actions<br/>(CI/CD)"]
        Repo["Source Repository"]
    end

    subgraph GCP["Google Cloud Platform"]
        CloudRun["Cloud Run<br/>(Relay API)"]
        CloudSQL["Cloud SQL<br/>(PostgreSQL + pgvector)"]
        Storage["Cloud Storage<br/>(Media)"]
    end

    subgraph External["External"]
        Users["Users"]
        CDN["CDN (Optional)"]
    end

    Users -->|"HTTPS"| CDN
    CDN --> Pages
    Users -->|"WSS"| CloudRun
    Pages -->|"WSS"| CloudRun
    CloudRun --> CloudSQL
    CloudRun --> Storage
    Repo -->|"Deploy"| Actions
    Actions --> Pages
    Actions --> CloudRun
```

### Environment Variables

**Required:**
| Variable | Description |
|----------|-------------|
| `PUBLIC_RELAY_URL` | WebSocket relay URL |
| `PUBLIC_APP_URL` | Public application URL |
| `DATABASE_URL` | PostgreSQL connection string |

**Optional:**
| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_APP_NAME` | "Nostr BBS" | Application name |
| `LOG_LEVEL` | "info" | Logging verbosity |
| `RATE_LIMIT_MAX` | 100 | Max requests per window |

### GitHub Pages Deployment

```bash
# Build static site
npm run build

# Deploy via GitHub Actions (automatic on push)
git push origin main
```

### Cloud Run Deployment

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT/relay

# Deploy
gcloud run deploy relay \
  --image gcr.io/PROJECT/relay \
  --platform managed \
  --region europe-west2 \
  --set-env-vars "DATABASE_URL=postgres://..."
```

### Scaling Architecture

```mermaid
graph TB
    LB["Load Balancer"]

    subgraph Instances["Cloud Run Instances"]
        I1["Instance 1"]
        I2["Instance 2"]
        I3["Instance N"]
    end

    subgraph Shared["Shared Resources"]
        DB["PostgreSQL (Primary)"]
        DBR["Read Replica (Optional)"]
        Cache["Redis (Optional)"]
    end

    LB --> I1
    LB --> I2
    LB --> I3

    I1 --> DB
    I2 --> DB
    I3 --> DB

    I1 -.->|"Reads"| DBR
    I2 -.->|"Reads"| DBR

    I1 --> Cache
    I2 --> Cache
    I3 --> Cache
```

### Health Check Endpoint

```
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "relay": "connected"
  }
}
```

### Security Checklist

**Pre-deployment:**
- [ ] SSL/TLS enabled (HTTPS/WSS only)
- [ ] Strong database passwords
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] CSP and security headers enabled
- [ ] Firewall rules configured

**Ongoing:**
- [ ] Regular security updates
- [ ] Log monitoring
- [ ] Backup verification
- [ ] Annual penetration testing

---

## Related Documentation

- [NIP Protocol Reference](developer/reference/nip-protocol-reference.md) - Detailed NIP specifications
- [Component Architecture](developer/architecture/components.md) - UI component patterns
- [Data Flow](developer/architecture/data-flow.md) - State management details
- [Security Model](developer/architecture/security.md) - Security implementation
- [Deployment Guides](developer/deployment/index.md) - Platform-specific deployment

---

## Quick Reference

### Key Commands

```bash
# Development
npm run dev          # Start dev server
npm run check        # Type check
npm run lint         # Lint code
npm run format       # Format code

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run test:coverage # Coverage report

# Build & Deploy
npm run build        # Production build
npm run preview      # Preview build
```

### Important Paths

| Path | Purpose |
|------|---------|
| `src/lib/nostr/dm.ts` | NIP-17/59 DM implementation |
| `src/lib/nostr/groups.ts` | NIP-29 group operations |
| `src/lib/nostr/ndk.ts` | NDK initialisation |
| `src/lib/stores/` | All Svelte stores |
| `src/lib/components/` | UI components |

### Event Kind Quick Reference

| Action | Kind | NIP |
|--------|------|-----|
| Send channel message | 9 | NIP-29 |
| Send DM (wrapped) | 1059 | NIP-59 |
| React to message | 7 | NIP-25 |
| Delete own message | 5 | NIP-09 |
| Admin delete | 9005 | NIP-29 |
| Create calendar event | 31923 | NIP-52 |
| RSVP to event | 31925 | NIP-52 |

---

[Back to Documentation Index](README.md)
