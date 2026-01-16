---
title: "Domain Model"
description: "## Overview"
category: explanation
tags: ['ddd', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Domain Model

## Overview

The Nostr BBS domain model maps community forum concepts to Nostr protocol primitives.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Model                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ Category │────────<│ Section  │────────<│  Forum   │        │
│  │          │   1:N   │          │   1:N   │(Channel) │        │
│  └──────────┘         └────┬─────┘         └────┬─────┘        │
│                            │                    │               │
│                            │                    │ 1:N           │
│                            │                    ▼               │
│  ┌──────────┐         ┌────┴─────┐         ┌──────────┐        │
│  │  Cohort  │────────<│  Member  │────────<│ Message  │        │
│  │          │   N:M   │          │   1:N   │          │        │
│  └──────────┘         └────┬─────┘         └────┬─────┘        │
│                            │                    │               │
│                            │                    │ 1:N           │
│                            │                    ▼               │
│  ┌──────────┐              │               ┌──────────┐        │
│  │   Role   │──────────────┘               │ Reaction │        │
│  │          │   section_roles              │          │        │
│  └──────────┘                              └──────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Entities

### Member

The central identity in the system.

```typescript
interface Member {
  // Identity (from Nostr)
  pubkey: Pubkey;              // Primary identifier (hex)
  npub: string;                // Bech32 encoded pubkey

  // Profile (NIP-01 kind 0)
  profile: {
    name?: string;
    displayName?: string;
    about?: string;
    picture?: string;
    nip05?: string;
  };

  // Access Control
  cohorts: CohortId[];         // Membership groups
  sectionRoles: Map<SectionId, RoleId>;
  isGlobalAdmin: boolean;

  // State
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
  lastSeen: Date;
}
```

### Message

A forum post or direct message.

```typescript
interface Message {
  // Nostr Event Core
  id: EventId;                 // SHA256 hash
  pubkey: Pubkey;              // Author
  createdAt: number;           // Unix timestamp
  kind: number;                // Event kind
  content: string;             // Message content
  sig: Signature;              // Schnorr signature

  // Threading
  replyTo?: EventId;           // Parent message (e-tag)
  rootId?: EventId;            // Thread root (e-tag)
  mentions: Pubkey[];          // Tagged users (p-tags)

  // Forum Context
  forumId?: ChannelId;         // NIP-28 channel
  sectionId?: SectionId;       // Containing section

  // State
  deleted: boolean;
  reactions: Reaction[];
}
```

### Section

An access-controlled area containing forums.

```typescript
interface Section {
  id: SectionId;               // Unique identifier
  categoryId: CategoryId;      // Parent category

  // Display
  name: string;
  description: string;
  icon: string;
  order: number;

  // Access Control
  cohorts: CohortId[];         // Who can access
  visibility: 'public' | 'members' | 'restricted';

  // Forums
  forums: Forum[];

  // Calendar
  calendarAccess: 'none' | 'view' | 'create';
}
```

### Forum (Channel)

A NIP-28 public channel within a section.

```typescript
interface Forum {
  // NIP-28 Channel
  id: ChannelId;               // Event ID of channel creation
  name: string;
  about: string;
  picture?: string;

  // Hierarchy
  sectionId: SectionId;

  // State
  messageCount: number;
  lastActivity: Date;

  // Moderation
  pinnedMessages: EventId[];
  mutedPubkeys: Pubkey[];
}
```

## Value Objects

### Pubkey

```typescript
class Pubkey {
  private readonly hex: string;  // 64-char hex

  static fromHex(hex: string): Pubkey;
  static fromNpub(npub: string): Pubkey;

  toHex(): string;
  toNpub(): string;

  equals(other: Pubkey): boolean;
}
```

### EventId

```typescript
class EventId {
  private readonly hex: string;  // 64-char hex (SHA256)

  static fromEvent(event: NostrEvent): EventId;
  static fromHex(hex: string): EventId;

  toHex(): string;
  toNevent(): string;

  equals(other: EventId): boolean;
}
```

### Signature

```typescript
class Signature {
  private readonly sig: string;  // Schnorr signature

  static sign(event: UnsignedEvent, privkey: string): Signature;

  verify(event: NostrEvent): boolean;
  toString(): string;
}
```

## Nostr Event Kind Mapping

| Kind | Domain Entity | Description |
|------|---------------|-------------|
| 0 | Member.profile | User metadata |
| 1 | Message | Text note |
| 4 | DirectMessage (legacy) | NIP-04 encrypted DM |
| 5 | Message.deleted | Deletion request |
| 7 | Reaction | NIP-25 reaction |
| 40 | Forum | Channel creation |
| 41 | Forum.metadata | Channel metadata |
| 42 | Message (channel) | Channel message |
| 1059 | DirectMessage | NIP-17 gift wrap |
| 31922 | CalendarEvent | NIP-52 date-based |
| 31923 | CalendarEvent | NIP-52 time-based |

## Invariants

### Member Invariants
- Pubkey must be valid 64-char hex
- At least one cohort required for active status
- Global admin implies all section access

### Message Invariants
- Signature must verify against pubkey
- ReplyTo must exist if set
- Content must not exceed 64KB

### Section Invariants
- At least one cohort must be assigned
- Forums must have unique names within section
- CategoryId must reference valid category

### Forum Invariants
- Must belong to exactly one section
- Channel creation event must exist
- Name must be 3-50 characters
