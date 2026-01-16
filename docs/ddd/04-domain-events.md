---
title: "Domain Events"
description: "## Overview"
category: explanation
tags: ['calendar', 'ddd', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Domain Events

## Overview

Domain events represent significant occurrences within the domain. In Nostr BBS, many domain events map directly to Nostr events.

## Event Catalog

### Identity Context Events

```typescript
// Member identified via Nostr keypair
interface MemberIdentified {
  type: 'MemberIdentified';
  pubkey: Pubkey;
  timestamp: Date;
  source: 'generated' | 'restored' | 'extension';
}

// Profile metadata updated (NIP-01 kind 0)
interface ProfileUpdated {
  type: 'ProfileUpdated';
  pubkey: Pubkey;
  profile: Profile;
  eventId: EventId;
  timestamp: Date;
}

// Session started
interface SessionStarted {
  type: 'SessionStarted';
  pubkey: Pubkey;
  sessionId: string;
  timestamp: Date;
}

// Session ended
interface SessionEnded {
  type: 'SessionEnded';
  pubkey: Pubkey;
  sessionId: string;
  reason: 'logout' | 'timeout' | 'error';
  timestamp: Date;
}
```

### Access Context Events

```typescript
// Member added to whitelist
interface MemberWhitelisted {
  type: 'MemberWhitelisted';
  pubkey: Pubkey;
  cohorts: CohortId[];
  addedBy: Pubkey;
  timestamp: Date;
}

// Member removed from whitelist
interface MemberRemoved {
  type: 'MemberRemoved';
  pubkey: Pubkey;
  removedBy: Pubkey;
  reason: string;
  timestamp: Date;
}

// Cohort assigned to member
interface CohortAssigned {
  type: 'CohortAssigned';
  pubkey: Pubkey;
  cohort: CohortId;
  assignedBy: Pubkey;
  timestamp: Date;
}

// Section role assigned
interface SectionRoleAssigned {
  type: 'SectionRoleAssigned';
  pubkey: Pubkey;
  sectionId: SectionId;
  role: RoleId;
  assignedBy: Pubkey;
  timestamp: Date;
}
```

### Organisation Context Events

```typescript
// Forum (channel) created (NIP-28 kind 40)
interface ForumCreated {
  type: 'ForumCreated';
  forumId: ChannelId;
  sectionId: SectionId;
  name: string;
  createdBy: Pubkey;
  eventId: EventId;
  timestamp: Date;
}

// Forum metadata updated (NIP-28 kind 41)
interface ForumMetadataUpdated {
  type: 'ForumMetadataUpdated';
  forumId: ChannelId;
  metadata: ForumMetadata;
  updatedBy: Pubkey;
  eventId: EventId;
  timestamp: Date;
}

// Forum archived
interface ForumArchived {
  type: 'ForumArchived';
  forumId: ChannelId;
  archivedBy: Pubkey;
  timestamp: Date;
}
```

### Messaging Context Events

```typescript
// Message posted (NIP-28 kind 42 or NIP-01 kind 1)
interface MessagePosted {
  type: 'MessagePosted';
  messageId: EventId;
  forumId?: ChannelId;
  author: Pubkey;
  content: string;  // May be truncated
  replyTo?: EventId;
  timestamp: Date;
}

// Thread created (first message with no parent)
interface ThreadCreated {
  type: 'ThreadCreated';
  threadId: EventId;
  forumId: ChannelId;
  author: Pubkey;
  title: string;  // First line of content
  timestamp: Date;
}

// Reply added to thread
interface ReplyAdded {
  type: 'ReplyAdded';
  replyId: EventId;
  threadId: EventId;
  parentId: EventId;
  author: Pubkey;
  timestamp: Date;
}

// Reaction added (NIP-25 kind 7)
interface ReactionAdded {
  type: 'ReactionAdded';
  reactionId: EventId;
  targetId: EventId;
  author: Pubkey;
  emoji: string;
  timestamp: Date;
}

// Reaction removed
interface ReactionRemoved {
  type: 'ReactionRemoved';
  reactionId: EventId;
  targetId: EventId;
  author: Pubkey;
  timestamp: Date;
}

// Message deleted (NIP-09 kind 5)
interface MessageDeleted {
  type: 'MessageDeleted';
  messageId: EventId;
  deletedBy: Pubkey;
  eventId: EventId;  // Deletion event
  timestamp: Date;
}

// Direct message sent (NIP-17 kind 1059)
interface DirectMessageSent {
  type: 'DirectMessageSent';
  conversationKey: string;  // Derived from participants
  sender: Pubkey;
  recipient: Pubkey;
  eventId: EventId;
  timestamp: Date;
}

// Message pinned
interface MessagePinned {
  type: 'MessagePinned';
  messageId: EventId;
  forumId: ChannelId;
  pinnedBy: Pubkey;
  timestamp: Date;
}

// User muted in forum
interface UserMutedInForum {
  type: 'UserMutedInForum';
  pubkey: Pubkey;
  forumId: ChannelId;
  mutedBy: Pubkey;
  timestamp: Date;
}
```

### Calendar Context Events

```typescript
// Calendar event created (NIP-52)
interface CalendarEventCreated {
  type: 'CalendarEventCreated';
  calendarEventId: EventId;
  sectionId: SectionId;
  title: string;
  startDate: Date;
  endDate?: Date;
  createdBy: Pubkey;
  timestamp: Date;
}

// RSVP submitted (NIP-52)
interface RSVPSubmitted {
  type: 'RSVPSubmitted';
  calendarEventId: EventId;
  pubkey: Pubkey;
  status: 'accepted' | 'declined' | 'tentative';
  eventId: EventId;
  timestamp: Date;
}
```

### Search Context Events

```typescript
// Search index updated
interface SearchIndexUpdated {
  type: 'SearchIndexUpdated';
  version: string;
  documentCount: number;
  timestamp: Date;
}

// Search query executed
interface SearchQueryExecuted {
  type: 'SearchQueryExecuted';
  query: string;
  resultCount: number;
  latencyMs: number;
  timestamp: Date;
}
```

## Event Flow Diagrams

### Message Posting Flow

```
User                    Messaging              Relay               Search
  │                     Context                  │                   │
  │──── Post Message ────>│                      │                   │
  │                       │                      │                   │
  │                       │── Sign Event ────────│                   │
  │                       │                      │                   │
  │                       │<─── OK ──────────────│                   │
  │                       │                      │                   │
  │                       │─── Emit: MessagePosted ─────────────────>│
  │                       │                      │                   │
  │<── Confirmation ──────│                      │                   │
  │                       │                      │                   │
                                                          │
                                                          ▼
                                                   Queue for indexing
```

### Member Onboarding Flow

```
New User              Identity          Access            Organization
   │                  Context           Context             Context
   │                     │                 │                   │
   │── Generate Keys ───>│                 │                   │
   │                     │                 │                   │
   │                     │─ MemberIdentified ─>│               │
   │                     │                 │                   │
   │                     │                 │── Check Whitelist │
   │                     │                 │                   │
   │                     │<── Pending ─────│                   │
   │                     │                 │                   │
   │<─ Show Pending ─────│                 │                   │

   ... Admin approves ...

Admin                    │              Access            Organization
   │                     │              Context             Context
   │                     │                 │                   │
   │── Approve Member ───────────────────>│                   │
   │                     │                 │                   │
   │                     │                 │─ MemberWhitelisted ─>│
   │                     │                 │                   │
   │                     │                 │                   │── Load Sections
   │                     │                 │                   │
   │                     │<─────────────── AccessGranted ──────│
```

## Event Handlers

### Example: Message Posted Handler

```typescript
class MessagePostedHandler {
  constructor(
    private searchService: SearchService,
    private notificationService: NotificationService
  ) {}

  async handle(event: MessagePosted): Promise<void> {
    // 1. Queue for search indexing
    await this.searchService.queueForIndexing({
      id: event.messageId,
      content: event.content,
      author: event.author,
      timestamp: event.timestamp
    });

    // 2. Notify mentioned users
    const mentions = this.extractMentions(event.content);
    for (const pubkey of mentions) {
      await this.notificationService.notify(pubkey, {
        type: 'mention',
        messageId: event.messageId,
        author: event.author
      });
    }

    // 3. Update forum activity
    if (event.forumId) {
      await this.updateForumActivity(event.forumId);
    }
  }
}
```

### Example: Member Whitelisted Handler

```typescript
class MemberWhitelistedHandler {
  constructor(
    private profileService: ProfileService,
    private welcomeService: WelcomeService
  ) {}

  async handle(event: MemberWhitelisted): Promise<void> {
    // 1. Fetch profile if exists
    const profile = await this.profileService.fetch(event.pubkey);

    // 2. Send welcome DM
    await this.welcomeService.sendWelcome(event.pubkey, {
      cohorts: event.cohorts,
      hasProfile: !!profile
    });

    // 3. Log for admin dashboard
    console.log(`Member ${event.pubkey} whitelisted with cohorts: ${event.cohorts}`);
  }
}
```

## Nostr Event Mapping

| Domain Event | Nostr Kind | Direction |
|--------------|------------|-----------|
| ProfileUpdated | 0 | Outbound |
| MessagePosted | 1, 42 | Outbound |
| MessageDeleted | 5 | Outbound |
| ReactionAdded | 7 | Outbound |
| ForumCreated | 40 | Outbound |
| ForumMetadataUpdated | 41 | Outbound |
| DirectMessageSent | 1059 | Outbound |
| CalendarEventCreated | 31922, 31923 | Outbound |
| RSVPSubmitted | 31925 | Outbound |
