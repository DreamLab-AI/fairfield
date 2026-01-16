---
title: "Ubiquitous Language"
description: "## Glossary"
category: explanation
tags: ['ddd', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Ubiquitous Language

## Glossary

This glossary defines the shared vocabulary used across the Nostr BBS domain.

### Identity Terms

| Term | Definition | Example |
|------|------------|---------|
| **Pubkey** | A 64-character hexadecimal string representing a user's public key on the secp256k1 curve. The primary identifier for all users. | `a1b2c3d4...` |
| **Npub** | Bech32-encoded public key with `npub1` prefix. Human-readable format for sharing. | `npub1abc123...` |
| **Nsec** | Bech32-encoded private key with `nsec1` prefix. Must never be shared or stored insecurely. | `nsec1xyz789...` |
| **Keypair** | A matched public/private key pair used for signing and encryption. Generated from entropy or BIP-39 mnemonic. | - |
| **Mnemonic** | 12 or 24 word BIP-39 seed phrase that can deterministically generate a keypair. The recovery mechanism. | "abandon ability able..." |
| **Profile** | NIP-01 kind 0 metadata including name, display name, about, picture, and NIP-05 identifier. | - |
| **NIP-05** | Domain-verified identifier in format `name@domain.com`. Provides human-readable identity. | `alice@example.com` |

### Access Terms

| Term | Definition | Example |
|------|------------|---------|
| **Whitelist** | PostgreSQL table of pubkeys allowed to connect to the relay. Enforced via NIP-42 AUTH. | - |
| **Cohort** | Named group of members sharing access permissions. Members can belong to multiple cohorts. | `admin`, `members`, `guests` |
| **Role** | Permission level within a specific section. Hierarchical: admin > moderator > member > viewer. | `moderator` |
| **Section Role** | A (section, role) pair granting specific permissions in one section. | `(general, admin)` |
| **Permission** | A capability to perform an action. Derived from cohort membership and section roles. | `can_post`, `can_moderate` |
| **Global Admin** | A member with admin cohort membership. Has access to all sections and admin functions. | - |
| **Superuser** | The ADMIN_PUBKEY from environment. Has absolute authority, cannot be removed. | - |

### Organisation Terms

| Term | Definition | Example |
|------|------------|---------|
| **Category** | Top-level UI grouping for sections. Has no Nostr representation. Defined in sections.yaml. | "Community", "Projects" |
| **Section** | Access-controlled container for forums. Maps to NIP-29 relay group concept. | "General Discussion" |
| **Forum** | A NIP-28 public channel within a section. Contains message threads. | "Introductions" |
| **Channel** | Synonym for Forum. NIP-28 terminology. | - |
| **Thread** | A root message and all its replies. Implicit structure via e-tags. | - |
| **Zone** | Informal term for a section's access boundary. "Users in the general zone." | - |

### Messaging Terms

| Term | Definition | Example |
|------|------------|---------|
| **Event** | The fundamental Nostr data unit. Contains id, pubkey, created_at, kind, tags, content, sig. | - |
| **Message** | A text post in a forum (kind 42) or general note (kind 1). | "Hello everyone!" |
| **DM** | Direct Message. Private encrypted communication between two parties. | - |
| **Gift Wrap** | NIP-59 privacy envelope. Hides sender/recipient metadata. Contains sealed rumor. | kind 1059 |
| **Seal** | NIP-59 encrypted container inside gift wrap. Decrypted by recipient. | kind 13 |
| **Rumor** | The actual message content inside a seal. Unsigned to prevent forwarding proof. | kind 1 (unsigned) |
| **Reaction** | NIP-25 emoji response to a message. | kind 7, content: "👍" |
| **Reply** | A message referencing another via e-tag. Forms thread structure. | - |
| **Mention** | Reference to a pubkey via p-tag or nostr:npub in content. | "@alice" |
| **Tag** | Event metadata array. Common: e (event ref), p (pubkey ref), t (hashtag). | `["e", "abc123"]` |

### Encryption Terms

| Term | Definition | Example |
|------|------------|---------|
| **NIP-04** | Legacy encryption using AES-256-CBC. Deprecated. Only used for decryption. | - |
| **NIP-44** | Modern encryption using XChaCha20-Poly1305. Required for all new encryption. | - |
| **Conversation Key** | Derived shared secret between two pubkeys. Used for DM encryption. | - |
| **ECDH** | Elliptic Curve Diffie-Hellman. Key agreement protocol for deriving shared secrets. | - |

### Calendar Terms

| Term | Definition | Example |
|------|------------|---------|
| **Calendar Event** | NIP-52 scheduled happening. Can be date-based (kind 31922) or time-based (kind 31923). | "Team Meeting" |
| **RSVP** | Response to calendar event. Status: accepted, declined, tentative. | kind 31925 |
| **Date Event** | All-day calendar event without specific time. | "Holiday" |
| **Time Event** | Calendar event with specific start/end times. | "3pm-4pm Meeting" |

### Search Terms

| Term | Definition | Example |
|------|------------|---------|
| **Index** | HNSW vector index stored in IndexedDB. Enables semantic search. | - |
| **Embedding** | 384-dimensional vector representation of text. Generated by all-MiniLM-L6-v2. | Float32Array |
| **HNSW** | Hierarchical Navigable Small World. Graph-based ANN algorithm. | - |
| **Semantic Search** | Finding messages by meaning rather than exact keywords. | "authentication issues" finds "login problems" |
| **Sync** | Process of downloading updated search index. WiFi-only to preserve data. | - |

### Technical Terms

| Term | Definition | Example |
|------|------------|---------|
| **Relay** | Nostr server that stores and forwards events. Our private relay runs strfry. | `wss://relay.example.com` |
| **NDK** | Nostr Development Kit. TypeScript library for Nostr client development. | @nostr-dev-kit/ndk |
| **Subscription** | REQ message to relay specifying event filters. Returns matching events. | - |
| **Filter** | Criteria for event subscription: kinds, authors, since, until, #e, #p, etc. | `{kinds: [1], limit: 100}` |
| **EOSE** | End Of Stored Events. Signal that relay has sent all stored matches. | - |
| **AUTH** | NIP-42 authentication challenge/response. Required for whitelist enforcement. | kind 22242 |

### State Terms

| Term | Definition | Example |
|------|------------|---------|
| **Pending** | Member status before whitelist approval. Can view but not post. | - |
| **Active** | Member status after approval. Full access per cohort/roles. | - |
| **Suspended** | Member status when access revoked. Cannot connect. | - |
| **Deleted** | Event marked for deletion via NIP-09. May still exist on some relays. | kind 5 |
| **Pinned** | Message highlighted by moderator in forum. Appears at top. | - |
| **Muted** | User whose messages are hidden. Per-forum or global. | - |

## Usage Guidelines

### Prefer Domain Terms

```typescript
// ✓ Good: Uses domain language
const member = await memberRepository.findByPubkey(pubkey);
if (member.canAccessSection(sectionId)) {
  await forum.postMessage(content);
}

// ✗ Avoid: Generic programming terms
const user = await userDao.getById(id);
if (checkPermissions(user, areaId)) {
  await channel.send(text);
}
```

### Consistent Naming

```typescript
// ✓ Consistent: Same term everywhere
interface Forum { ... }
class ForumRepository { ... }
function createForum() { ... }
const forumId = ...;

// ✗ Inconsistent: Mixed terminology
interface Channel { ... }
class ForumRepository { ... }
function createRoom() { ... }
const channelId = ...;
```

### Documentation Standards

When writing documentation:
- Use **bold** for term definitions
- Use `code` for identifiers and values
- Always use the canonical term from this glossary
- Add new terms here when introducing concepts

## Cross-Reference

| Code Entity | Domain Term | Nostr Concept |
|-------------|-------------|---------------|
| `Member` | Member | Profile (kind 0) |
| `Message` | Message | Event (kind 1, 42) |
| `Forum` | Forum/Channel | Channel (kind 40) |
| `Section` | Section | Group (NIP-29) |
| `DirectMessage` | DM | Gift Wrap (kind 1059) |
| `Reaction` | Reaction | Reaction (kind 7) |
| `CalendarEvent` | Calendar Event | Calendar (kind 31922/31923) |
