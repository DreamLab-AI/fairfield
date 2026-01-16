# Fairfield Nostr BBS - Product Requirements Document

**Version:** 1.0.0
**Generated:** 2026-01-16
**Status:** Retrospective Engineering Analysis

---

## Executive Summary

**Fairfield Nostr BBS** is a private, whitelist-gated community platform built on the Nostr protocol. The application combines traditional BBS-style hierarchical navigation (Zone > Section > Category > Channel) with modern real-time messaging, encrypted DMs, calendar functionality, and decentralized identity.

| Attribute | Value |
|-----------|-------|
| **Application Version** | 0.1.0 |
| **Relay Version** | 2.3.0 |
| **Frontend Framework** | SvelteKit 2.49.2 + Svelte 4.2.20 |
| **Backend** | Node.js 20 WebSocket Relay + PostgreSQL |
| **Deployment** | GitHub Pages (frontend) + GCP Cloud Run (services) |
| **Authentication** | Nostr keypairs (secp256k1) with NIP-98 HTTP auth |
| **Identity Standard** | W3C DID:nostr |

---

## 1. Product Vision

### 1.1 Problem Statement

Traditional community platforms (Discord, Slack, forums) suffer from:
- **Centralized control**: Users don't own their identity or data
- **Platform lock-in**: Migration requires rebuilding social graphs
- **Privacy concerns**: Server operators have full access to messages
- **Single points of failure**: Platform outages affect all users

### 1.2 Solution

A **decentralized, censorship-resistant community platform** where:
- Users own their cryptographic identity (Nostr keypairs)
- Messages are signed and verifiable
- E2E encryption protects private conversations
- The whitelist model enables private communities while preserving user sovereignty
- W3C DID:nostr provides interoperable identity across systems

### 1.3 Target Users

1. **Private Communities**: Family groups, organizations, clubs requiring controlled membership
2. **Privacy-Conscious Users**: People wanting cryptographic proof of message authenticity
3. **Nostr Ecosystem Participants**: Users with existing Nostr identities seeking private spaces

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (SvelteKit)                      │
│                         GitHub Pages                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   Auth   │ │   Chat   │ │  Admin   │ │     Calendar     │   │
│  │ 7 comps  │ │ 18 comps │ │ 9 comps  │ │     7 comps      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                    30 Svelte Stores                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ WebSocket (NIP-01)
┌─────────────────────────────▼───────────────────────────────────┐
│                     Nostr Relay (Node.js)                        │
│                       Cloud Run                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NIP-01   NIP-11   NIP-16   NIP-29   NIP-98   DID:nostr  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              PostgreSQL (Cloud SQL)                       │   │
│  │         events (JSONB) + whitelist (cohorts)             │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Supporting Services                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │ Embedding  │ │   Image    │ │    Link    │                  │
│  │    API     │ │    API     │ │  Preview   │                  │
│  │ (ML/HNSW)  │ │  (Sharp)   │ │  (OpenGraph)│                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend Architecture

**Framework Stack:**
- **SvelteKit 2.49.2** with adapter-static for GitHub Pages
- **Vite 5.4.21** build tool with PWA plugin
- **TypeScript 5.6.2** (strict mode)
- **TailwindCSS 3.4.19** + **DaisyUI 4.12.10**

**Component Inventory (86 total):**

| Category | Count | Key Components |
|----------|-------|----------------|
| Auth | 7 | Signup, Login, NsecBackup, NicknameSetup, PendingApproval |
| UI | 20 | Modal, Button, Toast, ScreenReaderAnnouncer, ErrorBoundary |
| Chat | 18 | MessageList, MessageItem, PinnedMessages, ReactionPicker |
| Admin | 9 | AdminStats, UserManagement, UserRegistrations |
| Calendar | 7 | EventCalendar, CreateEventModal, MiniCalendar |
| Navigation | 8 | Sidebar, CategoryNav, SectionNav, BreadcrumbNav |
| Profile | 5 | ProfileCard, ProfileEditor, AvatarUpload |
| DM | 6 | DMList, DMConversation, NewDMModal |
| Shared | 6 | Loading, Avatar, Timestamp, RelativeTime |

**State Management (30 Stores):**

| Category | Stores |
|----------|--------|
| Auth | authStore, signerStore, userProfileStore |
| Content | messagesStore, channelsStore, pinnedStore |
| Navigation | currentChannel, currentSection, breadcrumbs |
| UI | theme, sidebarOpen, modalStack, toasts |
| System | ndkStore, relayStatus, isOnline |

### 2.3 Backend Architecture

**Nostr Relay (v2.3.0):**

| Component | Implementation |
|-----------|----------------|
| WebSocket Server | `ws` v8.14.2 |
| Database | PostgreSQL with JSONB |
| Rate Limiter | Sliding window (10 events/sec/IP) |
| Connection Pool | Max 20, 30s idle timeout |

**Database Schema:**

```sql
-- Events table (NIP-01 compliant)
CREATE TABLE events (
  id TEXT PRIMARY KEY,           -- 32-byte hex event ID
  pubkey TEXT NOT NULL,          -- 32-byte hex public key
  created_at BIGINT NOT NULL,    -- Unix timestamp
  kind INTEGER NOT NULL,         -- Event kind number
  tags JSONB NOT NULL,           -- Array of tag arrays
  content TEXT NOT NULL,         -- Event content
  sig TEXT NOT NULL,             -- 64-byte hex Schnorr signature
  received_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Optimized indexes
CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_tags ON events USING GIN(tags);

-- Whitelist table (access control)
CREATE TABLE whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_at BIGINT,
  added_by TEXT,
  expires_at BIGINT,
  notes TEXT
);

CREATE INDEX idx_whitelist_cohorts ON whitelist USING GIN(cohorts);
```

---

## 3. Nostr Protocol Implementation

### 3.1 NIP Compliance Matrix

| NIP | Name | Status | Implementation |
|-----|------|--------|----------------|
| **NIP-01** | Basic Protocol | Full | EVENT, REQ, CLOSE, OK, NOTICE, EOSE |
| **NIP-09** | Event Deletion | Full | Kind 5 deletion requests |
| **NIP-11** | Relay Information | Full | `/.well-known/nostr.json` |
| **NIP-16** | Event Treatment | Full | Regular, replaceable, ephemeral |
| **NIP-17** | Private DMs | Full | Sealed rumors with gift wrap |
| **NIP-19** | Bech32 Encoding | Full | npub, nsec, note, nevent |
| **NIP-25** | Reactions | Full | Kind 7 with emoji content |
| **NIP-28** | Channels (Legacy) | Partial | Kind 40/41/42 (deprecated) |
| **NIP-29** | Groups | Full | Kind 9 + h-tag, admin kinds 9000-9005 |
| **NIP-33** | Parameterized Replaceable | Full | d-tag deduplication |
| **NIP-42** | Authentication | Full | Kind 22242 AUTH challenges |
| **NIP-44** | Encryption | Full | ChaCha20-Poly1305 for channels |
| **NIP-51** | Lists | Full | Kind 30001 pin lists |
| **NIP-52** | Calendar | Full | Kind 31923/31925 events + RSVP |
| **NIP-59** | Gift Wrap | Full | Kind 1059 privacy wrapper |
| **NIP-98** | HTTP Auth | Full | Kind 27235 signed requests |

### 3.2 Event Kinds Used

**Standard Kinds:**

| Kind | Name | Replaceability | Purpose |
|------|------|----------------|---------|
| 0 | User Metadata | Replaceable | Profile (name, picture, about, NIP-05) |
| 1 | Text Note | Regular | Short-form posts |
| 5 | Deletion | Regular | Request event deletion |
| 7 | Reaction | Regular | Emoji reactions |
| 9 | Group Chat | Regular | NIP-29 channel messages |
| 13 | Seal | Regular | Encrypted DM container |
| 14 | Sealed Rumor | Regular | Inner DM content |
| 1059 | Gift Wrap | Regular | Privacy wrapper |
| 22242 | AUTH | Ephemeral | Relay authentication |
| 30001 | Pin List | Parameterized | Admin pinned messages |
| 31923 | Calendar Event | Parameterized | Time-based events |
| 31925 | RSVP | Parameterized | Event attendance |

**NIP-29 Admin Kinds:**

| Kind | Name | Purpose |
|------|------|---------|
| 9000 | Add User | Approve join request |
| 9001 | Remove User | Kick/ban from channel |
| 9005 | Delete Event | Admin message deletion |
| 39000 | Group Metadata | Channel settings |
| 39002 | Group Members | Member list |

**Custom Application Kinds:**

| Kind | Name | Purpose |
|------|------|---------|
| 9021 | Join Request | User requests channel membership |
| 9024 | User Registration | New user requests system access |

### 3.3 Tag Conventions

| Tag | Format | Purpose |
|-----|--------|---------|
| `e` | `['e', eventId, relay?, marker?]` | Event reference (root, reply, mention) |
| `p` | `['p', pubkey, relay?, petname?]` | User reference |
| `h` | `['h', channelId]` | NIP-29 group identifier |
| `d` | `['d', uniqueId]` | Replaceable event identifier |
| `t` | `['t', topic]` | Hashtags/topics |
| `cohort` | `['cohort', name]` | Access control group |
| `visibility` | `['visibility', level]` | listed, unlisted, preview |
| `encrypted` | `['encrypted', 'nip44']` | E2E encrypted marker |
| `event_start` | `['event_start', timestamp]` | Calendar event start |
| `event_end` | `['event_end', timestamp]` | Calendar event end |

---

## 4. Authentication & Identity

### 4.1 Keypair Management

**Generation:**
- Method: `crypto.getRandomValues()` (32 bytes)
- Library: `@noble/curves/secp256k1`
- Output: 64-character hex strings

**Storage Security (OWASP 2023 Compliant):**

| Parameter | Value |
|-----------|-------|
| Encryption | AES-256-GCM |
| Key Derivation | PBKDF2-SHA256 |
| Iterations | 600,000 |
| Salt | 16 bytes random |
| IV | 12 bytes random |

**Session Types:**

| Type | Storage | Lifecycle |
|------|---------|-----------|
| Browser | sessionStorage | Tab close |
| Persistent | localStorage + cookie | 30 days |
| PWA | localStorage | No expiry |

### 4.2 DID:nostr Integration

**Format:** `did:nostr:<64-character-hex-pubkey>`

**DID Document Structure:**
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:nostr:<pubkey>",
  "verificationMethod": [{
    "id": "did:nostr:<pubkey>#key-0",
    "type": "Multikey",
    "controller": "did:nostr:<pubkey>",
    "publicKeyMultibase": "z..."
  }],
  "authentication": ["did:nostr:<pubkey>#key-0"],
  "assertionMethod": ["did:nostr:<pubkey>#key-0"]
}
```

### 4.3 NIP-98 HTTP Authentication

| Property | Value |
|----------|-------|
| Event Kind | 27235 |
| Header Format | `Authorization: Nostr <base64-event>` |
| Required Tags | `u` (URL), `method` (HTTP method) |
| Timestamp Tolerance | 60 seconds |
| Signature | Schnorr (secp256k1) |

---

## 5. User Flows

### 5.1 Registration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Generate   │────▶│   Backup    │────▶│    Set      │
│   Keypair   │     │    nsec     │     │  Nickname   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Access    │◀────│    Admin    │◀────│   Publish   │
│   Granted   │     │  Approval   │     │  Kind 9024  │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Steps:**
1. **Generate Keypair**: Random 32-byte private key via Web Crypto
2. **Backup nsec** (Mandatory): User must acknowledge backup
3. **Set Nickname**: Publish Kind 0 profile event
4. **Publish Registration**: Kind 9024 with registration tag
5. **Await Approval**: Poll whitelist status every 10 seconds
6. **Access Granted**: Redirect to chat interface

### 5.2 Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Enter     │────▶│  Validate   │────▶│   Check     │
│    nsec     │     │   Format    │     │  Whitelist  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                          ┌────────────────────┴────────────────────┐
                          ▼                                         ▼
                   ┌─────────────┐                           ┌─────────────┐
                   │  Approved   │                           │   Pending   │
                   │   → /chat   │                           │ → /pending  │
                   └─────────────┘                           └─────────────┘
```

### 5.3 Messaging Flow

**Channel Messages (NIP-29):**
- Kind 9 with `["h", "channelId"]` tag
- Optional E2E: `["encrypted", "nip44"]` tag
- Threading: `["e", "eventId", "", "reply"]` marker

**Direct Messages (NIP-17/59):**
```
Kind 14 (Rumor)  ──encrypt──▶  Kind 13 (Seal)  ──wrap──▶  Kind 1059 (Gift Wrap)
   │                              │                            │
   │ unsigned content             │ encrypted to recipient     │ random pubkey
   │                              │                            │ fuzzed timestamp
```

---

## 6. Admin System

### 6.1 Admin Panel Features

| Feature | Description |
|---------|-------------|
| Dashboard | Metrics, pending count, activity graph |
| User Management | Whitelist CRUD, cohort assignment |
| Registration Queue | Approve/reject pending users |
| Channel Management | Create, configure, member control |
| Section Requests | Approve section access |

### 6.2 Authorization Model

**Whitelist Sources:**
1. Environment: `WHITELIST_PUBKEYS` (comma-separated)
2. Database: `whitelist` table with cohorts

**Cohort System:**

| Cohort | Purpose |
|--------|---------|
| `admin` | Full system access |
| `approved` | Standard member access |
| `business` | Business zone access |
| `moomaa-tribe` | Tribe zone access |
| `cross-access` | Cross-zone permissions |

**Special Bypass (Registration Flow):**
- Kind 0 (profile): Allowed from any pubkey
- Kind 9024 (registration): Allowed from any pubkey

### 6.3 Rate Limiting

| Action | Capacity | Window | Backoff |
|--------|----------|--------|---------|
| Login | 5 | 15 min | Linear |
| Signup | 3 | 1 hour | Exponential |
| Admin Action | 10 | 1 min | 1.5x |
| Section Request | 5 | 1 min | 2x |

---

## 7. Security

### 7.1 Event Validation Pipeline

```
1. JSON Parse ──▶ 2. Type Check ──▶ 3. Size Limits ──▶ 4. Whitelist
       │                │                 │                 │
       ▼                ▼                 ▼                 ▼
   Format OK      Fields valid     Content ≤64KB     Authorized
                                   Tags ≤2000
                                                          │
                                                          ▼
5. Event ID ──▶ 6. Signature ──▶ 7. Rate Limit ──▶ 8. Store
       │              │                │                │
       ▼              ▼                ▼                ▼
  SHA-256 match  Schnorr valid    Under limit      PostgreSQL
```

### 7.2 Security Limits

| Limit | Value |
|-------|-------|
| Max content size | 64KB (8KB for registration) |
| Max tag count | 2000 |
| Max tag value | 1KB |
| Timestamp drift | ±7 days |
| Events/second/IP | 10 |
| Connections/IP | 20 |

### 7.3 Cryptographic Standards

| Purpose | Algorithm |
|---------|-----------|
| Key Storage | AES-256-GCM |
| Key Derivation | PBKDF2-SHA256 (600k iterations) |
| Event Signatures | Schnorr (secp256k1) |
| Channel Encryption | NIP-44 (ChaCha20-Poly1305) |
| DM Encryption | NIP-44 + Gift Wrap |

---

## 8. Multi-Tenant Architecture

### 8.1 Zone Configuration

| Zone | Isolation | Default Cohorts |
|------|-----------|-----------------|
| fairfield-family | Strict | family, cross-access |
| minimoonoir | Partial | minimoonoir, minimoonoir-business |
| dreamlab | Strict | business, trainers, trainees |

### 8.2 Role Hierarchy

```
guest (0) → member (1) → moderator (2) → section-admin (3) → admin (4)
```

### 8.3 Calendar Access Levels

| Level | Capabilities |
|-------|--------------|
| full | See all event details |
| availability | See only time blocks |
| cohort | Cohort-filtered access |
| none | No calendar access |

---

## 9. Deployment

### 9.1 Service Matrix

| Service | Platform | Resources | Scaling |
|---------|----------|-----------|---------|
| Frontend | GitHub Pages | Static | CDN |
| nostr-relay | Cloud Run | 512Mi/1CPU | 1-3 instances |
| embedding-api | Cloud Run | 2Gi/1CPU | 0-3 instances |
| image-api | Cloud Run | 512Mi/1CPU | 1-10 instances |
| Database | Cloud SQL | PostgreSQL 14 | Auto |

### 9.2 CI/CD Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| deploy-pages | Push to main | Build + deploy frontend |
| deploy-nostr-relay | services/nostr-relay/** | Build + deploy relay |
| deploy-image-api | services/image-api/** | Build + deploy |
| generate-embeddings | Nightly 3 AM UTC | Update HNSW index |

### 9.3 Environment Variables

**Frontend (VITE_):**
- `RELAY_URL`, `EMBEDDING_API_URL`, `IMAGE_API_URL`
- `ADMIN_PUBKEY`, `APP_NAME`

**Backend:**
- `DATABASE_URL`, `WHITELIST_PUBKEYS`
- `RATE_LIMIT_EVENTS_PER_SECOND` (default: 10)

---

## 10. Accessibility (WCAG 2.1 AA)

### 10.1 Implemented Features

| Feature | Implementation |
|---------|----------------|
| Skip Links | "Skip to main content" |
| Screen Reader | aria-live announcements |
| Focus Visible | 2px custom outline |
| Focus Trap | Modal tab containment |
| Keyboard | Cmd+K search, Escape close |
| Reduced Motion | prefers-reduced-motion |

### 10.2 ARIA Implementation

- Landmarks: main, nav, aside
- Roles: dialog, alert, status, menubar
- Live Regions: Polite announcements for state changes

---

## 11. Testing

### 11.1 Test Infrastructure

| Type | Framework | Coverage |
|------|-----------|----------|
| Unit | Vitest 2.1.9 | Components, utils |
| E2E | Playwright 1.57.0 | User flows |
| Integration | Jest 29.7.0 | Relay protocol |

### 11.2 Test Counts

| Suite | Tests | Status |
|-------|-------|--------|
| handlers.registration.test.ts | 46 | Pass |
| nip01-protocol.test.ts | 15 | Pass |
| websocket-connection.test.ts | 7 | Pass |
| did-nostr.test.ts | 19 | Pass |
| nip98.test.ts | 13 | Pass |
| nip16.test.ts | 16 | Pass |
| **Total** | **116** | **All Pass** |

---

## 12. Future Roadmap

### 12.1 Immediate (P0)

- [ ] NIP-07 browser extension support
- [ ] Per-pubkey rate limiting
- [ ] Admin NIP-98 authentication
- [ ] WebSocket message size limits

### 12.2 Short-term (P1)

- [ ] NIP-46 Nostr Connect (remote signing)
- [ ] Hardware wallet integration
- [ ] Batch user approval
- [ ] Admin audit log viewer

### 12.3 Future (P2)

- [ ] Federation (multi-relay)
- [ ] Social recovery for keys
- [ ] Encrypted cloud backup
- [ ] Mobile native apps

---

## Appendix A: API Reference

### Relay WebSocket (NIP-01)

```
Client → Relay:
  ["EVENT", <event>]              # Publish event
  ["REQ", <sub_id>, <filter>...]  # Subscribe
  ["CLOSE", <sub_id>]             # Unsubscribe

Relay → Client:
  ["EVENT", <sub_id>, <event>]    # Matching event
  ["OK", <event_id>, <bool>, <msg>]  # Publish result
  ["EOSE", <sub_id>]              # End of stored events
  ["NOTICE", <message>]           # Human-readable notice
```

### HTTP Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check with stats |
| `/.well-known/nostr.json` | GET | None | NIP-11 relay info |
| `/api/check-whitelist` | GET | None | Check pubkey status |
| `/api/whitelist/list` | GET | Admin | List whitelisted users |
| `/api/whitelist/add` | POST | Admin | Add user to whitelist |
| `/api/whitelist/update-cohorts` | POST | Admin | Update user cohorts |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Cohort** | Named group for access control (e.g., admin, business) |
| **DID** | Decentralized Identifier (W3C standard) |
| **Gift Wrap** | NIP-59 privacy wrapper hiding sender identity |
| **Kind** | Nostr event type number |
| **NIP** | Nostr Implementation Possibility (protocol spec) |
| **npub/nsec** | Bech32-encoded public/private keys |
| **Relay** | Nostr message broker/storage server |
| **Schnorr** | Digital signature scheme used by Nostr |
| **Zone** | Top-level multi-tenant partition |

---

*Document generated via mesh topology swarm analysis with AgentDB storage.*
