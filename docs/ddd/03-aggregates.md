---
title: "Aggregates"
description: "## Overview"
category: explanation
tags: ['ddd', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Aggregates

## Overview

Aggregates are clusters of domain objects treated as a single unit for data changes.

## Aggregate Catalog

### 1. Member Aggregate

**Root**: `Member`

**Boundary**:
```
┌─────────────────────────────────────┐
│          Member Aggregate           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐                        │
│  │ Member  │ ◄── Aggregate Root     │
│  │ (Root)  │                        │
│  └────┬────┘                        │
│       │                             │
│       ├──────┬──────┬──────┐        │
│       ▼      ▼      ▼      ▼        │
│  ┌───────┐┌─────┐┌─────┐┌──────┐   │
│  │Profile││Keys ││Roles││Status│   │
│  └───────┘└─────┘└─────┘└──────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Invariants**:
- Pubkey is immutable after creation
- Profile updates must be signed by member's private key
- At least one cohort required for active status
- Section roles must reference valid sections

**Commands**:
```typescript
class Member {
  // Factory
  static create(keypair: Keypair): Member;
  static restore(mnemonic: string): Member;

  // Commands
  updateProfile(profile: Partial<Profile>): void;
  addToCohort(cohort: CohortId): void;
  removeFromCohort(cohort: CohortId): void;
  assignSectionRole(section: SectionId, role: RoleId): void;
  suspend(reason: string): void;
  activate(): void;

  // Queries
  canAccessSection(section: SectionId): boolean;
  hasCapability(capability: string): boolean;
}
```

**Events Emitted**:
- `MemberCreated`
- `ProfileUpdated`
- `CohortAssigned`
- `RoleAssigned`
- `MemberSuspended`
- `MemberActivated`

---

### 2. Forum Aggregate

**Root**: `Forum`

**Boundary**:
```
┌─────────────────────────────────────┐
│          Forum Aggregate            │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐                        │
│  │  Forum  │ ◄── Aggregate Root     │
│  │ (Root)  │                        │
│  └────┬────┘                        │
│       │                             │
│       ├──────┬──────┬──────┐        │
│       ▼      ▼      ▼      ▼        │
│  ┌──────┐┌──────┐┌─────┐┌──────┐   │
│  │Metadata│Pins ││Mutes││Settings│  │
│  └──────┘└──────┘└─────┘└──────┘   │
│                                     │
│  Note: Messages are NOT part of     │
│  this aggregate (separate lifecycle)│
│                                     │
└─────────────────────────────────────┘
```

**Invariants**:
- Must belong to exactly one section
- Name must be unique within section
- Name must be 3-50 characters
- Only moderators+ can pin/mute

**Commands**:
```typescript
class Forum {
  // Factory
  static create(section: SectionId, name: string, creator: Pubkey): Forum;

  // Commands
  updateMetadata(metadata: ForumMetadata): void;
  pinMessage(messageId: EventId, moderator: Pubkey): void;
  unpinMessage(messageId: EventId): void;
  muteUser(pubkey: Pubkey, moderator: Pubkey): void;
  unmuteUser(pubkey: Pubkey): void;
  archive(): void;

  // Queries
  isUserMuted(pubkey: Pubkey): boolean;
  getPinnedMessages(): EventId[];
}
```

**Events Emitted**:
- `ForumCreated`
- `ForumMetadataUpdated`
- `MessagePinned`
- `MessageUnpinned`
- `UserMuted`
- `UserUnmuted`
- `ForumArchived`

---

### 3. MessageThread Aggregate

**Root**: `Thread`

**Boundary**:
```
┌─────────────────────────────────────┐
│       MessageThread Aggregate       │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐                        │
│  │ Thread  │ ◄── Aggregate Root     │
│  │ (Root)  │                        │
│  └────┬────┘                        │
│       │                             │
│       ├──────────────┐              │
│       ▼              ▼              │
│  ┌──────────┐  ┌──────────┐        │
│  │  Root    │  │ Replies  │        │
│  │ Message  │  │  List    │        │
│  └──────────┘  └────┬─────┘        │
│                     │               │
│                     ▼               │
│               ┌──────────┐         │
│               │ Reactions│         │
│               └──────────┘         │
│                                     │
└─────────────────────────────────────┘
```

**Invariants**:
- Root message cannot be deleted if replies exist
- Replies must reference valid parent
- Reactions must reference valid message in thread
- Maximum thread depth: 10 levels

**Commands**:
```typescript
class Thread {
  // Factory
  static fromRootMessage(message: Message): Thread;

  // Commands
  addReply(content: string, author: Pubkey, parentId?: EventId): Message;
  addReaction(messageId: EventId, emoji: string, author: Pubkey): Reaction;
  removeReaction(reactionId: EventId): void;
  deleteMessage(messageId: EventId, author: Pubkey): void;

  // Queries
  getReplies(messageId: EventId): Message[];
  getReactions(messageId: EventId): Reaction[];
  getParticipants(): Pubkey[];
  getDepth(): number;
}
```

**Events Emitted**:
- `ThreadCreated`
- `ReplyAdded`
- `ReactionAdded`
- `ReactionRemoved`
- `MessageDeleted`

---

### 4. DirectConversation Aggregate

**Root**: `Conversation`

**Boundary**:
```
┌─────────────────────────────────────┐
│    DirectConversation Aggregate     │
├─────────────────────────────────────┤
│                                     │
│  ┌────────────┐                     │
│  │Conversation│ ◄── Aggregate Root  │
│  │  (Root)    │                     │
│  └─────┬──────┘                     │
│        │                            │
│        ├──────────┐                 │
│        ▼          ▼                 │
│  ┌───────────┐ ┌────────┐          │
│  │Participants│ │Messages│          │
│  │  (2 only)  │ │(sealed)│          │
│  └───────────┘ └────────┘          │
│                                     │
└─────────────────────────────────────┘
```

**Invariants**:
- Exactly 2 participants
- All messages encrypted with NIP-44
- Messages wrapped in NIP-59 gift wrap
- Only participants can read messages

**Commands**:
```typescript
class Conversation {
  // Factory
  static start(initiator: Pubkey, recipient: Pubkey): Conversation;
  static fromExisting(participant1: Pubkey, participant2: Pubkey): Conversation;

  // Commands
  sendMessage(content: string, sender: Pubkey): DirectMessage;
  markAsRead(messageId: EventId): void;

  // Queries
  getMessages(limit?: number): DirectMessage[];
  getUnreadCount(forPubkey: Pubkey): number;
  getLastActivity(): Date;
}
```

**Events Emitted**:
- `ConversationStarted`
- `DirectMessageSent`
- `MessageRead`

---

### 5. Section Aggregate

**Root**: `Section`

**Boundary**:
```
┌─────────────────────────────────────┐
│         Section Aggregate           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐                        │
│  │ Section │ ◄── Aggregate Root     │
│  │ (Root)  │                        │
│  └────┬────┘                        │
│       │                             │
│       ├──────┬──────┬──────┐        │
│       ▼      ▼      ▼      ▼        │
│  ┌──────┐┌──────┐┌─────┐┌──────┐   │
│  │Config││Cohorts││Forums││Calendar│ │
│  │      ││Access ││ Refs ││Settings│ │
│  └──────┘└──────┘└─────┘└──────┘   │
│                                     │
│  Note: Forums have their own        │
│  aggregate (reference only here)    │
│                                     │
└─────────────────────────────────────┘
```

**Invariants**:
- At least one cohort must have access
- Category must exist
- Forum names unique within section
- Calendar access level valid for section type

**Commands**:
```typescript
class Section {
  // Factory (typically from config)
  static fromConfig(config: SectionConfig): Section;

  // Commands
  addCohortAccess(cohort: CohortId): void;
  removeCohortAccess(cohort: CohortId): void;
  updateCalendarAccess(level: CalendarAccessLevel): void;
  createForum(name: string, creator: Pubkey): Forum;
  archiveForum(forumId: ChannelId): void;

  // Queries
  getForums(): Forum[];
  canAccess(member: Member): boolean;
  getCalendarAccess(): CalendarAccessLevel;
}
```

**Events Emitted**:
- `SectionCreated`
- `CohortAccessGranted`
- `CohortAccessRevoked`
- `CalendarAccessUpdated`

## Aggregate Design Principles

### Consistency Boundaries

Each aggregate guarantees:
1. All invariants hold after any command
2. Transactions are scoped to single aggregate
3. References to other aggregates by ID only

### Event Sourcing Consideration

While not fully event-sourced, aggregates:
- Emit domain events for cross-aggregate coordination
- Can be reconstructed from Nostr events
- Maintain compatibility with relay event storage

### Repository Pattern

```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Example implementation
class ForumRepository implements Repository<Forum> {
  constructor(private ndk: NDK) {}

  async findById(channelId: string): Promise<Forum | null> {
    const event = await this.ndk.fetchEvent({ ids: [channelId] });
    return event ? Forum.fromEvent(event) : null;
  }

  async save(forum: Forum): Promise<void> {
    const event = forum.toEvent();
    await this.ndk.publish(event);
  }
}
```
