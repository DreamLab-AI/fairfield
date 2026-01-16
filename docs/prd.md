---
title: "Fairfield Nostr BBS - Product Requirements Document"
description: "**Version:** 2.1.0 **Last Updated:** 2026-01-16 **Status:** Living Document"
category: tutorial
tags: ['developer', 'nostr', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Fairfield Nostr BBS - Product Requirements Document

**Version:** 2.1.0
**Last Updated:** 2026-01-16
**Status:** Living Document

---

## Executive Summary

**Fairfield Nostr BBS** is a private community platform designed for the unique reality of households where family life and business operations overlap. It serves people who share physical spaces, family bonds, professional relationships, and social circles that don't fit neatly into separate boxes.

The platform uses the Nostr protocol to give users true ownership of their identity and communications, while providing the familiar structure of a BBS (Bulletin Board System) for organized discussions across family, business, and social contexts.

### The Core Challenge We Solve

In a large household with an embedded business, the same person might be:
- A parent coordinating family dinner
- A business trainer scheduling client sessions
- A host welcoming guests to a shared retreat space
- A family member discussing private matters

Traditional platforms force these contexts into separate silos, fragmenting communication and requiring people to maintain multiple identities. Fairfield BBS allows natural overlap while maintaining appropriate boundaries.

### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **You own your identity** | Nostr keypairs mean no platform can lock you out of your own account |
| **Natural boundaries** | Zones separate contexts; cohorts allow appropriate overlap |
| **Small-group trust** | Whitelist model keeps out strangers while enabling self-governance |
| **Appropriate privacy** | E2E encryption for sensitive channels; signed messages for accountability |
| **Simple for everyone** | From tech-savvy to tech-cautious, the flows accommodate different comfort levels |

---

## 1. Philosophy and Values

### 1.1 Why Decentralization Matters Here

This isn't decentralization for ideology's sake. For a household with overlapping personal and business contexts, centralized platforms create real problems:

**Platform Risk**: When your family coordination, business scheduling, and guest communications all depend on Discord or Slack, a platform ban or outage disrupts everything. With Nostr, your identity travels with you.

**Data Ownership**: Family conversations shouldn't live on corporate servers. Business client information shouldn't be training someone else's AI. Your keys, your data.

**Longevity**: Family systems need to last decades. Platforms come and go. A protocol-based system can outlive any single service provider.

### 1.2 Trust Model

Fairfield BBS operates on a **small-group trust model**, distinct from both internet-scale platforms and private family-only spaces:

| Model | Scale | Trust | Example |
|-------|-------|-------|---------|
| Public Platform | Millions | Zero (moderation-based) | Twitter, Reddit |
| Private Family | 5-20 | Complete | Family group chat |
| **Fairfield BBS** | 20-200 | Earned (whitelist) | Extended household + business |

Members are added by invitation and admin approval. This isn't about exclusion—it's about creating a space where you know everyone or know someone who vouches for them.

### 1.3 Accessibility as a Value

A household spans generations and tech comfort levels. The platform must work for:
- Teenagers who expect modern UX
- Adults comfortable with technology
- Older family members who may struggle with complex interfaces
- Business clients who just need things to work

This drives design decisions like the Quick Start flow (2 taps to join) alongside the Secure flow (4 steps for those who want full key custody).

---

## 2. User Personas and Scenarios

### 2.1 Core Personas

#### Maya - The Family Coordinator
**Context**: Parent managing household logistics while running a wellness retreat business.

**Needs**:
- See family calendar events alongside business blocks
- Post in family-only spaces without clients seeing
- Schedule business sessions without family members interrupting
- Switch contexts naturally without logging into different apps

**Typical Day**:
1. Check family zone for kids' school updates
2. Review business zone for today's training schedule
3. Post in MiniMoonoir (social zone) about upcoming gathering
4. DM a family member about private matter
5. Respond to business client question in trainee channel

**Cohorts**: `family`, `business`, `minimoonoir`, `cross-access`

#### Jordan - The Business Trainee
**Context**: Client taking training sessions, may become more involved over time.

**Needs**:
- Access training materials and schedule sessions
- Communicate with trainers without accessing family content
- Join social events if invited to MiniMoonoir gatherings
- Simple onboarding—not everyone understands cryptographic keys

**Journey**:
1. Receives invite link from trainer
2. Quick Start signup (hex password saved in password manager)
3. Waits for admin approval
4. Accesses DreamLab (business) zone only
5. Later, if relationship deepens, may get MiniMoonoir access

**Cohorts**: `trainees` → potentially `minimoonoir` later

#### Sam - The Family Member
**Context**: Adult child who helps with business training occasionally.

**Needs**:
- Full family zone access for family matters
- Business zone access for training work
- Clear separation so family discussions stay family-only
- Ability to see when parents are blocked for business vs family time

**Overlapping Access**:
- Fairfield Family zone: Full access
- DreamLab zone: Access as occasional trainer
- Calendar: Sees family events + business availability blocks

**Cohorts**: `family`, `trainers`, `cross-access`

#### Alex - The Occasional Guest
**Context**: Friend of family who attends MiniMoonoir social gatherings.

**Needs**:
- Access social zone (MiniMoonoir) for event planning
- Cannot see family-private discussions
- Cannot see business operations
- May attend gatherings without becoming a business client

**Boundary**:
- MiniMoonoir zone: Full access
- Fairfield Family zone: Hidden (doesn't appear in navigation)
- DreamLab zone: Hidden

**Cohorts**: `minimoonoir-only`

### 2.2 Cross-Zone Scenarios

#### Scenario: Scheduling Around Family and Business

Maya needs to schedule a family dinner that works around:
- Business training sessions (hers and Sam's)
- Kids' activities
- Guest availability for MiniMoonoir social event

**How the system helps**:
1. Calendar shows Maya's own events from all zones
2. `showBlocksFrom` configuration reveals availability blocks from other zones
3. Maya sees Sam is blocked for "training" (not the client details)
4. Maya can propose times that work for everyone

#### Scenario: Guest Becomes Trainee

Alex has been attending MiniMoonoir gatherings and wants to take training sessions.

**Journey**:
1. Alex already has an account (cohort: `minimoonoir-only`)
2. Maya adds `trainees` cohort via admin panel
3. DreamLab zone appears in Alex's navigation
4. Alex can now access training materials
5. Family zone remains hidden

**No new account needed. Same identity, expanded access.**

#### Scenario: Private Family Discussion

Sam wants to discuss a sensitive family matter that shouldn't involve business trainees or social guests.

**How boundaries work**:
1. Sam posts in "Family Private" section (requires `family` cohort)
2. Jordan (trainee) and Alex (guest) cannot see this section
3. Maya (cross-access) sees it in her feed
4. The conversation stays within family

---

## 3. Zone Architecture

### 3.1 Three-Zone Model

The system organizes content into three zones reflecting real-world boundaries:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FAIRFIELD FAMILY (Zone 1)                         │
│                                                                      │
│   Cohorts: family, fairfield-only, cross-access                     │
│   Isolation: STRICT (invisible to non-members)                      │
│                                                                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│   │ Family Hub   │ │ Household    │ │ Family       │               │
│   │ (General)    │ │ (Logistics)  │ │ Calendar     │               │
│   └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     MINIMOONOIR (Zone 2)                             │
│                                                                      │
│   Cohorts: minimoonoir, minimoonoir-only, cross-access              │
│   Isolation: SOFT (visible to invited guests)                       │
│                                                                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│   │ Moon Lounge  │ │ Events &     │ │ Guest        │               │
│   │ (Social)     │ │ Gatherings   │ │ Welcome      │               │
│   └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      DREAMLAB (Zone 3)                               │
│                                                                      │
│   Cohorts: business, trainers, trainees, dreamlab-only              │
│   Isolation: STRICT (invisible to non-business)                     │
│                                                                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│   │ Training     │ │ Resources &  │ │ Session      │               │
│   │ Discussions  │ │ Materials    │ │ Calendar     │               │
│   └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cohort System Design

Cohorts enable overlapping membership without forcing artificial separation:

#### Core Cohorts

| Cohort | Purpose | Zone Access |
|--------|---------|-------------|
| `family` | Core family members | Fairfield Family |
| `minimoonoir` | Social community members | MiniMoonoir |
| `business` | Business operations access | DreamLab |
| `trainers` | Can lead training sessions | DreamLab (elevated) |
| `trainees` | Training program participants | DreamLab (limited) |
| `cross-access` | Can see all zones | All zones |

#### Exclusion Cohorts (*-only Pattern)

Some members should have access to ONE zone only:

| Cohort | Purpose | Grants | Excludes |
|--------|---------|--------|----------|
| `fairfield-only` | Family members not in business | Fairfield | DreamLab |
| `minimoonoir-only` | Social guests not in family/business | MiniMoonoir | Fairfield, DreamLab |
| `dreamlab-only` | Business clients not in social | DreamLab | Fairfield, MiniMoonoir |

**Why this matters**: Alex (guest) has `minimoonoir-only`. Even if someone accidentally tries to add them to a family-visible cohort, the exclusion cohort prevents access leakage.

### 3.3 Calendar Cross-Visibility

The `showBlocksFrom` configuration solves a real coordination problem: knowing when family members are available without exposing private details.

```yaml
# Fairfield Family calendar configuration
calendar:
  access: cohort
  accessCohorts: [family, cross-access]
  showBlocksFrom:
    - zone: dreamlab
      visibility: hard  # Shows "Blocked" - no details
    - zone: minimoonoir
      visibility: soft  # Shows "Tentative" - might be flexible
```

**Example**: Maya checks the family calendar to plan dinner:
- Sees "Family Dinner Planning" event (full details - same zone)
- Sees "Blocked" on Sam's calendar 2-4pm (business training, details hidden)
- Sees "Tentative" on guest Alex's availability (MiniMoonoir event, might move)

---

## 4. User Flows

### 4.1 Dual-Path Signup

The signup flow accommodates different user comfort levels:

#### Path A: Quick Start (2 Steps)
For users who want simplicity and trust the platform:

```
┌─────────────────┐     ┌─────────────────┐
│  Tap "Quick     │────▶│   Set Nickname  │────▶ Pending Approval
│  Start"         │     │   (Optional)    │
│                 │     │                 │
│ System generates│     │ Hex password    │
│ keypair + saves │     │ auto-saved to   │
│ as hex password │     │ password mgr    │
└─────────────────┘     └─────────────────┘
```

**Trade-off**: Less friction, but relies on browser/device password manager for key backup.

#### Path B: Secure (4 Steps)
For users who want full key custody:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Generate       │────▶│  Backup nsec    │────▶│  Set Nickname   │
│  Keypair        │     │  (MANDATORY)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │ Pending Approval│
                                                │ (Poll every 10s)│
                                                └─────────────────┘
```

**Trade-off**: More friction, but user has independent backup of private key.

### 4.2 Approval Flow

All new users require admin approval (whitelist model):

1. User completes signup → Kind 9024 (registration request) published
2. Admin sees pending registration in admin panel
3. Admin reviews and assigns cohorts
4. User's status changes to approved
5. User's client polls whitelist status every 10 seconds
6. On approval, redirect to appropriate zone based on cohorts

### 4.3 Login Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Enter nsec or  │────▶│  Validate       │────▶│  Check          │
│  hex password   │     │  Format         │     │  Whitelist      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌──────────────────────────┴────────┐
                              ▼                                   ▼
                       ┌─────────────┐                    ┌─────────────┐
                       │  Approved   │                    │   Pending   │
                       │  → /chat    │                    │ → /pending  │
                       └─────────────┘                    └─────────────┘
```

### 4.4 Navigation Model

The interface follows a 3-tier hierarchy:

```
Zone (Category) ──▶ Section ──▶ Forum (NIP-28 Channel)
     │                │              │
     │                │              └── Individual discussion thread
     │                └── Topical grouping within zone
     └── Top-level context boundary (Family/Social/Business)
```

**Example navigation path**:
```
DreamLab (Zone) → Training Programs (Section) → Q1 Cohort Discussion (Forum)
```

---

## 5. Technical Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                          │
│                     GitHub Pages (Free)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   Auth   │ │   Chat   │ │  Admin   │ │     Calendar     │   │
│  │ 7 comps  │ │ 18 comps │ │ 9 comps  │ │     7 comps      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                    30 Svelte Stores                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ WebSocket (NIP-01)
┌─────────────────────────────▼───────────────────────────────────┐
│                   Nostr Relay (Node.js)                          │
│                    Cloud Run (Free Tier)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NIP-01   NIP-11   NIP-16   NIP-29   NIP-98   DID:nostr  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              PostgreSQL (Cloud SQL)                       │   │
│  │         events (JSONB) + whitelist (cohorts)             │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Technology Choices

| Layer | Technology | Why This Choice |
|-------|------------|-----------------|
| Frontend | SvelteKit + Svelte 4 | Fast, accessible, good mobile support |
| Styling | TailwindCSS + DaisyUI | Consistent design system, accessibility built-in |
| Relay | Node.js WebSocket | Simple, well-understood, easy to deploy |
| Database | PostgreSQL + JSONB | Flexible schema for Nostr events, reliable |
| Hosting | GitHub Pages + Cloud Run | Free tier covers expected usage |
| Identity | Nostr keypairs | User-owned, portable, standard |

### 5.3 Free Infrastructure Stack

A key project goal is **sustainable free-tier operation**:

| Service | Provider | Free Tier Limit | Expected Usage |
|---------|----------|-----------------|----------------|
| Frontend | GitHub Pages | 100GB bandwidth/mo | ~1GB |
| Relay | Cloud Run | 2M requests/mo | ~500K |
| Database | Cloud SQL | Postgres 14, shared | Sufficient |
| Image Processing | Cloud Run | Separate instance | Minimal |

### 5.4 Database Schema

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

-- Whitelist table (cohort-based access control)
CREATE TABLE whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of cohort strings
  added_at BIGINT,
  added_by TEXT,
  expires_at BIGINT,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_tags ON events USING GIN(tags);
CREATE INDEX idx_whitelist_cohorts ON whitelist USING GIN(cohorts);
```

---

## 6. Nostr Protocol Implementation

### 6.1 NIP Compliance Matrix

| NIP | Name | Status | Purpose in Fairfield BBS |
|-----|------|--------|--------------------------|
| **NIP-01** | Basic Protocol | Full | Core event pub/sub |
| **NIP-04** | Encrypted DMs (Legacy) | Full | Backward compatibility |
| **NIP-06** | Key Derivation | Full | Mnemonic support |
| **NIP-09** | Event Deletion | Full | User-controlled deletion |
| **NIP-10** | Threading | Full | Reply structure in forums |
| **NIP-11** | Relay Information | Partial | Relay metadata (needs completion) |
| **NIP-16** | Event Treatment | Full | Regular, replaceable, ephemeral |
| **NIP-17** | Private DMs | Full | Modern encrypted messaging |
| **NIP-19** | Bech32 Encoding | Full | npub/nsec display |
| **NIP-25** | Reactions | Full | Emoji reactions on messages |
| **NIP-28** | Channels | Full | Forum structure |
| **NIP-29** | Groups | Full | Admin operations |
| **NIP-33** | Parameterized Replaceable | Full | Editable content |
| **NIP-42** | Authentication | Full | Relay auth challenges |
| **NIP-44** | Encryption v2 | Full | Channel E2E encryption |
| **NIP-51** | Lists | Planned | Curated content lists |
| **NIP-52** | Calendar | Full | Event scheduling |
| **NIP-59** | Gift Wrap | Full | DM privacy wrapper |
| **NIP-98** | HTTP Auth | Full | API authentication |

### 6.2 Custom Event Kinds

Beyond standard NIPs, Fairfield BBS uses custom kinds for specific features:

| Kind | Name | Purpose |
|------|------|---------|
| 9021 | Join Request | User requests to join a channel |
| 9022 | Section Access Request | User requests section access |
| 9023 | Section Access Response | Admin approves/denies section access |
| 9024 | User Registration | New user registration request |
| 30079 | Section Statistics | Section metadata and stats |

### 6.3 W3C DID:nostr Implementation

Fairfield BBS implements full W3C DID (Decentralized Identifier) compliance:

**DID Format**: `did:nostr:<64-character-hex-pubkey>`

**DID Document Structure**:
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
    "publicKeyMultibase": "z6Mk..."
  }],
  "authentication": ["did:nostr:<pubkey>#key-0"],
  "assertionMethod": ["did:nostr:<pubkey>#key-0"]
}
```

**Multikey Encoding**: Uses `0xe7, 0x01` prefix with base58btc for secp256k1 keys.

---

## 7. Authentication and Security

### 7.1 Keypair Management

**Generation**:
- Method: `crypto.getRandomValues()` (32 bytes)
- Library: `@noble/curves/secp256k1`
- Output: 64-character hex strings

**Storage Security (OWASP 2023 Compliant)**:

| Parameter | Value |
|-----------|-------|
| Encryption | AES-256-GCM |
| Key Derivation | PBKDF2-SHA256 |
| Iterations | 600,000 |
| Salt | 16 bytes random |
| IV | 12 bytes random |

### 7.2 Session Types

| Type | Storage | Lifecycle | Use Case |
|------|---------|-----------|----------|
| Browser | sessionStorage | Tab close | Quick sessions |
| Persistent | localStorage + cookie | 30 days | Regular users |
| PWA | localStorage | No expiry | Mobile app users |

### 7.3 NIP-98 HTTP Authentication

API endpoints requiring authentication use NIP-98:

| Property | Value |
|----------|-------|
| Event Kind | 27235 |
| Header Format | `Authorization: Nostr <base64-event>` |
| Required Tags | `u` (URL), `method` (HTTP method) |
| Timestamp Tolerance | 60 seconds |

### 7.4 Event Validation Pipeline

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

### 7.5 Security Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max content size | 64KB (8KB for registration) | Prevent abuse |
| Max tag count | 2000 | Query performance |
| Max tag value | 1KB | Storage efficiency |
| Timestamp drift | ±7 days | Clock skew tolerance |
| Events/second/IP | 10 | Rate limiting |
| Connections/IP | 20 | Resource protection |

---

## 8. Admin System

### 8.1 Admin Panel Features

| Feature | Description | Used For |
|---------|-------------|----------|
| Dashboard | Metrics, pending count, activity graph | System health |
| User Management | Whitelist CRUD, cohort assignment | Access control |
| Registration Queue | Approve/reject pending users | New member onboarding |
| Channel Management | Create, configure, member control | Forum structure |
| Section Requests | Approve section access | Cross-zone access |

### 8.2 Authorization Model

**Whitelist Sources**:
1. Environment: `WHITELIST_PUBKEYS` (comma-separated)
2. Database: `whitelist` table with cohorts

**Role Hierarchy**:
```
guest (0) → member (1) → moderator (2) → section-admin (3) → admin (4)
```

**Special Registration Bypass**:
- Kind 0 (profile): Allowed from any pubkey (needed for registration)
- Kind 9024 (registration): Allowed from any pubkey (registration request)

### 8.3 Rate Limiting

| Action | Capacity | Window | Backoff |
|--------|----------|--------|---------|
| Login | 5 | 15 min | Linear |
| Signup | 3 | 1 hour | Exponential |
| Admin Action | 10 | 1 min | 1.5x |
| Section Request | 5 | 1 min | 2x |

---

## 9. Accessibility

### 9.1 Design Principles

Accessibility is a core requirement, not an afterthought. The platform must work for:
- Users with visual impairments (screen readers)
- Users with motor impairments (keyboard navigation)
- Users with cognitive differences (clear hierarchy, consistent patterns)
- Users with varying tech comfort (multiple paths to same goal)

### 9.2 WCAG 2.1 AA Implementation

| Feature | Implementation |
|---------|----------------|
| Skip Links | "Skip to main content" link |
| Screen Reader | aria-live announcements for state changes |
| Focus Visible | 2px custom outline (visible in all themes) |
| Focus Trap | Modal tab containment |
| Keyboard Navigation | Cmd+K search, Escape to close |
| Reduced Motion | Respects `prefers-reduced-motion` |

### 9.3 ARIA Landmarks

- `main` - Primary content area
- `nav` - Navigation regions
- `aside` - Sidebar content
- `dialog` - Modal windows
- `alert` - Important notifications
- `status` - Non-critical updates

---

## 10. Testing

### 10.1 Test Infrastructure

| Type | Framework | Coverage |
|------|-----------|----------|
| Unit | Vitest 2.1.9 | Components, utilities |
| E2E | Playwright 1.57.0 | User flows |
| Integration | Jest 29.7.0 | Relay protocol |

### 10.2 Test Coverage

| Suite | Tests | Focus Area |
|-------|-------|------------|
| handlers.registration.test.ts | 46 | Registration flow |
| nip01-protocol.test.ts | 15 | Core Nostr protocol |
| websocket-connection.test.ts | 7 | Connection handling |
| did-nostr.test.ts | 19 | DID implementation |
| nip98.test.ts | 13 | HTTP authentication |
| nip16.test.ts | 16 | Event treatment |
| **Total** | **116** | All passing |

---

## 11. Deployment

### 11.1 Service Matrix

| Service | Platform | Resources | Cost | Code Location |
|---------|----------|-----------|------|---------------|
| Frontend | GitHub Pages | Static CDN | Free | `src/` |
| nostr-relay | Cloud Run | 512Mi/1CPU | Free tier | `services/nostr-relay/` |
| embedding-api | Cloud Run | 2Gi/1CPU | Free tier | `services/embedding-api/` |
| image-api | Cloud Run | 512Mi/1CPU | Free tier | `services/image-api/` |
| link-preview-api | Cloud Run | 256Mi/1CPU | Free tier | `services/link-preview-api/` |
| Database | Cloud SQL | PostgreSQL 14 | Free tier | - |

### 11.2 CI/CD Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| deploy-pages | Push to main | Build + deploy frontend |
| deploy-nostr-relay | services/nostr-relay/** | Build + deploy relay |
| deploy-image-api | services/image-api/** | Build + deploy |
| generate-embeddings | Nightly 3 AM UTC | Update HNSW index |

### 11.3 Environment Variables

**Frontend (VITE_)**:
- `RELAY_URL` - WebSocket relay endpoint
- `EMBEDDING_API_URL` - ML service endpoint
- `IMAGE_API_URL` - Image processing endpoint
- `ADMIN_PUBKEY` - Admin public key
- `APP_NAME` - Application display name

**Backend**:
- `DATABASE_URL` - PostgreSQL connection string
- `WHITELIST_PUBKEYS` - Initial admin pubkeys
- `RATE_LIMIT_EVENTS_PER_SECOND` - Default: 10

---

## 12. Roadmap

### 12.1 Immediate (P0)

- [x] NIP-07 browser extension support (Implemented: src/lib/nostr/nip07.ts, auth.ts, Login.svelte)
- [ ] Per-pubkey rate limiting
- [ ] Admin NIP-98 authentication for all endpoints
- [x] NIP-11 relay information (Implemented: server.ts buildNip11Info() - full spec compliance)

### 12.2 Short-term (P1)

- [ ] NIP-46 Nostr Connect (remote signing)
- [ ] NIP-51 curated lists
- [ ] Batch user approval in admin panel
- [ ] Admin audit log viewer
- [ ] WebID verification for DID documents

### 12.3 Future (P2)

- [ ] Federation (multi-relay support)
- [ ] Social recovery for keys
- [ ] Encrypted cloud backup
- [ ] Mobile native apps (iOS/Android)
- [ ] Hardware wallet integration

---

## 13. Implemented Features (Code Exists)

The following features have complete implementations ready for integration. This section documents what exists and where to find it.

### 13.1 Link Previews

**Purpose**: When users share web URLs in chat, the system displays rich previews with title, description, image, and favicon—enabling informed discussion without leaving the platform.

**Implementation Status**: Complete

**Code Locations**:
| Component | Path | Description |
|-----------|------|-------------|
| Client Store | `src/lib/stores/linkPreviews.ts` | Svelte store with caching, URL detection, Twitter handling |
| Cloud Run Service | `services/link-preview-api/index.js` | Fastify CORS proxy for OpenGraph fetching |
| UI Component | `src/lib/components/chat/LinkPreview.svelte` | Render component for previews |

**Technical Details**:
- **Model**: OpenGraph metadata parsing + Twitter oEmbed API
- **Cache Duration**: 10 days (localStorage), max 100 entries
- **Twitter Support**: Detects twitter.com/x.com URLs, uses `publish.twitter.com/oembed`
- **Fallback**: Google favicon API (`https://www.google.com/s2/favicons?domain=`)
- **CORS Solution**: Cloud Run service fetches on behalf of client

**Data Structure**:
```typescript
interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain: string;
  favicon?: string;
  type?: 'opengraph' | 'twitter';
  html?: string; // Twitter embed HTML
}
```

**Environment Variables**:
- `VITE_LINK_PREVIEW_API_URL`: Cloud Run service URL

---

### 13.2 Image Upload with Compression

**Purpose**: Users can upload images (avatars, message attachments, channel images) which are automatically compressed to WebP format for efficient storage and fast loading.

**Implementation Status**: Complete

**Code Locations**:
| Component | Path | Description |
|-----------|------|-------------|
| Client Utility | `src/lib/utils/imageUpload.ts` | Client-side pre-compression, upload orchestration |
| Cloud Run Service | `services/image-api/src/server.ts` | Express server with Sharp compression, GCS storage |

**Technical Details**:
- **Compression Library**: Sharp (server-side), Canvas API (client-side pre-compression)
- **Output Format**: WebP (with JPEG/PNG fallback)
- **Storage**: Google Cloud Storage bucket `minimoonoir-images` (project: `cumbriadreamlab`)
- **File Naming**: Keybase-style IDs: `{UUID}-{SIZE}-{TIMESTAMP_HEX}`
- **Cache Control**: `public, max-age=31536000` (1 year)
- **Thumbnail Generation**: 200x200 center crop

**Compression Settings by Category**:
| Category | Max Size | Quality | Use Case |
|----------|----------|---------|----------|
| `avatar` | 400x400 | 90% | Profile pictures |
| `message` | 1920x1920 | 85% | Chat attachments |
| `channel` | 1200x630 | 85% | Channel banners |

**Upload Flow**:
```
Client                              Server (Cloud Run)
  │                                       │
  │ 1. Select image                       │
  │ 2. Client pre-compress (Canvas)       │
  │ 3. POST /upload ──────────────────────▶│
  │                                       │ 4. Sharp compress
  │                                       │ 5. Generate Keybase ID
  │                                       │ 6. Upload to GCS
  │◀────────────────────────────────────── │ 7. Return public URL
  │ 8. Store URL in event                 │
```

**API Endpoint**:
```
POST /upload
Content-Type: multipart/form-data

Fields:
  - file: Image file
  - category: avatar | message | channel
  - pubkey: User's public key

Response:
{
  "url": "https://storage.googleapis.com/minimoonoir-images/...",
  "id": "UUID-SIZE-TIMESTAMP",
  "size": 12345,
  "dimensions": { "width": 800, "height": 600 }
}
```

**Environment Variables**:
- `VITE_IMAGE_API_URL`: Cloud Run service URL
- `GCS_BUCKET_NAME`: Storage bucket (default: `minimoonoir-images`)
- `GOOGLE_CLOUD_PROJECT`: GCP project ID

---

### 13.3 Semantic Search (Embedding-Based)

**Purpose**: Enable natural language search across all forum content. Users can search "discussions about training schedules" and find relevant posts regardless of exact keyword matches.

**Implementation Status**: Complete

**Code Locations**:
| Component | Path | Description |
|-----------|------|-------------|
| Client Search | `src/lib/semantic/hnsw-search.ts` | HNSW index loading, query embedding, KNN search |
| Sync Service | `src/lib/semantic/embeddings-sync.ts` | Download and cache index from GCS |
| Embedding API | `services/embedding-api/main.py` | Cloud Run ML service for query embedding |
| Index Builder | `scripts/embeddings/generate_embeddings.py` | Python script for batch embedding |
| GitHub Workflow | `.github/workflows/generate-embeddings.yml` | Nightly index rebuild |

**Technical Details**:
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Index Type**: HNSW (Hierarchical Navigable Small World) via `hnswlib-wasm`
- **Index Parameters**: M=16, ef_construction=200, ef_search=50
- **Quantization**: int8 (reduces storage by ~4x)
- **Storage**: GCS bucket `Nostr-BBS-vectors`
- **Update Schedule**: Nightly at 3 AM UTC via GitHub Actions

**Search Flow**:
```
User Query                     Client                      Cloud Run
    │                            │                            │
    │ "training schedules" ─────▶│                            │
    │                            │ POST /embed ───────────────▶│
    │                            │◀─────────────────────────── │ [384-dim vector]
    │                            │                            │
    │                            │ HNSW searchKnn(k=10)       │
    │                            │ Filter by minScore=0.5     │
    │◀───────────────────────────│                            │
    │ [SearchResult[]]           │                            │
```

**Nightly Pipeline** (GitHub Actions):
```
1. Download previous manifest from GCS
2. Fetch new notes from relay (since last_event_id)
3. Generate embeddings (all-MiniLM-L6-v2)
4. Build/update HNSW index
5. Upload index.bin, embeddings.npz, manifest.json to GCS
6. Client auto-syncs on next load
```

**Client API**:
```typescript
import { searchSimilar, isSearchAvailable, getSearchStats } from '$lib/semantic/hnsw-search';

// Check availability
if (isSearchAvailable()) {
  const results = await searchSimilar("training schedules", 10, 0.5);
  // results: { noteId: string, score: number, distance: number }[]
}

// Get stats
const stats = getSearchStats();
// stats: { vectorCount: number, dimensions: 384 }
```

**Environment Variables**:
- `VITE_EMBEDDING_API_URL`: Cloud Run embedding service URL
- `RELAY_URL`: (GitHub Variable) Nostr relay for fetching notes
- `GCP_PROJECT_ID`: (GitHub Secret) GCP project
- `GCP_SA_KEY`: (GitHub Secret) Service account for GCS access

**GitHub Secrets Required**:
| Secret | Purpose |
|--------|---------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SA_KEY` | Service account JSON with Storage Object Admin |
| `GCP_REGION` | GCP region (default: us-central1) |

**GitHub Variables Required**:
| Variable | Purpose |
|----------|---------|
| `RELAY_URL` | WebSocket URL of Nostr relay |

---

### 13.4 Feature Integration Status

| Feature | Client Code | Server Code | Deployment | Docs |
|---------|-------------|-------------|------------|------|
| Link Previews | Complete | Complete | Ready | This section |
| Image Upload | Complete | Complete | Ready | This section |
| Semantic Search | Complete | Complete | Workflow ready | This section |

**Next Steps for Activation**:
1. **Link Previews**: Deploy `services/link-preview-api`, set `VITE_LINK_PREVIEW_API_URL`
2. **Image Upload**: Deploy `services/image-api`, set `VITE_IMAGE_API_URL`, create GCS bucket
3. **Semantic Search**: Set GitHub secrets/variables, enable workflow, deploy `services/embedding-api`

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
| **Cohort** | Named group for access control enabling overlapping membership |
| **Cross-Access** | Cohort that grants visibility across all zones |
| **DID** | Decentralized Identifier (W3C standard) |
| **Exclusion Cohort** | *-only cohort that restricts access to single zone |
| **Gift Wrap** | NIP-59 privacy wrapper hiding sender identity |
| **Kind** | Nostr event type number |
| **NIP** | Nostr Implementation Possibility (protocol spec) |
| **npub/nsec** | Bech32-encoded public/private keys |
| **Relay** | Nostr message broker/storage server |
| **Schnorr** | Digital signature scheme used by Nostr |
| **Zone** | Top-level context boundary (Family/Social/Business) |

---

## Appendix C: Configuration Reference

### Zone Configuration (sections.yaml)

```yaml
zones:
  - id: fairfield-family
    name: Fairfield Family
    strictIsolation: true
    visibleToCohorts: [family, cross-access]
    hiddenFromCohorts: [minimoonoir-only, dreamlab-only]
    calendar:
      showBlocksFrom:
        - zone: dreamlab
          visibility: hard  # Shows "Blocked"
        - zone: minimoonoir
          visibility: soft  # Shows "Tentative"

  - id: minimoonoir
    name: MiniMoonoir
    strictIsolation: false
    visibleToCohorts: [minimoonoir, cross-access]
    hiddenFromCohorts: [fairfield-only, dreamlab-only]

  - id: dreamlab
    name: DreamLab
    strictIsolation: true
    visibleToCohorts: [business, trainers, trainees, cross-access]
    hiddenFromCohorts: [fairfield-only, minimoonoir-only]
```

---

*This document represents the living specification for Fairfield Nostr BBS, capturing both the technical implementation and the human context it serves. It should evolve as the community's needs evolve.*
