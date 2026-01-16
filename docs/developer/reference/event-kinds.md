---
title: "Event Kinds Reference"
description: "Nostr event types used in the platform."
category: reference
tags: ['calendar', 'developer', 'reference', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Event Kinds Reference

Nostr event types used in the platform.

---

## Overview

The platform uses standard Nostr event kinds as defined in various NIPs, plus some custom kinds for specific functionality.

---

## Core Events

### Kind 0 — User Metadata

User profile information.

```typescript
interface Kind0Event {
  kind: 0;
  content: JSON.stringify({
    name?: string;
    about?: string;
    picture?: string;
    banner?: string;
    nip05?: string;
    lud16?: string;
  });
  tags: [];
}
```

**NIP:** [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)

**Usage:** User profiles, display names, avatars

---

### Kind 1 — Short Text Note

General text content (not used directly, but supported).

```typescript
interface Kind1Event {
  kind: 1;
  content: string;
  tags: [
    ['e', '<reply-to-event-id>']?,
    ['p', '<mentioned-pubkey>']?
  ];
}
```

**NIP:** [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)

---

### Kind 5 — Deletion Request

Request to delete own events.

```typescript
interface Kind5Event {
  kind: 5;
  content: string;  // Reason (optional)
  tags: [
    ['e', '<event-id-to-delete>'],
    ['e', '<another-event-id>']?  // Can delete multiple
  ];
}
```

**NIP:** [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md)

**Usage:** Users deleting their own messages

---

### Kind 7 — Reaction

Emoji reaction to an event.

```typescript
interface Kind7Event {
  kind: 7;
  content: string;  // Emoji (e.g., "👍", "+", "-")
  tags: [
    ['e', '<event-id>'],        // Event being reacted to
    ['p', '<event-author>']     // Author of original event
  ];
}
```

**NIP:** [NIP-25](https://github.com/nostr-protocol/nips/blob/master/25.md)

**Usage:** Message reactions

---

## Group Messaging (NIP-29)

### Kind 9 — Group Chat Message

Message in a group channel.

```typescript
interface Kind9Event {
  kind: 9;
  content: string;
  tags: [
    ['h', '<channel-id>'],           // Required: channel identifier
    ['previous', '<event-id>']?      // Optional: reply to
  ];
}
```

**NIP:** [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md)

**Usage:** Channel messages

---

### Kind 39000 — Group Metadata

Channel/group configuration.

```typescript
interface Kind39000Event {
  kind: 39000;
  content: JSON.stringify({
    name: string;
    about: string;
    picture?: string;
  });
  tags: [
    ['d', '<channel-id>'],
    ['cohort', '<cohort-tag>']?,
    ['visibility', 'listed' | 'unlisted' | 'preview']?
  ];
}
```

**NIP:** [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md)

**Usage:** Channel settings

---

### Kind 39001 — Group Admins

List of group administrators.

```typescript
interface Kind39001Event {
  kind: 39001;
  content: '';
  tags: [
    ['d', '<channel-id>'],
    ['p', '<admin-pubkey-1>', 'admin'],
    ['p', '<admin-pubkey-2>', 'moderator']
  ];
}
```

**NIP:** [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md)

---

### Kind 39002 — Group Members

List of group members.

```typescript
interface Kind39002Event {
  kind: 39002;
  content: '';
  tags: [
    ['d', '<channel-id>'],
    ['p', '<member-pubkey-1>'],
    ['p', '<member-pubkey-2>']
  ];
}
```

**NIP:** [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md)

---

### Admin Action Events

| Kind | Name | Purpose |
|------|------|---------|
| 9000 | Add User | Add member to group |
| 9001 | Remove User | Remove member from group |
| 9002 | Edit Metadata | Update group info |
| 9005 | Delete Event | Admin delete message |

```typescript
// Kind 9000 - Add User
interface Kind9000Event {
  kind: 9000;
  content: '';
  tags: [
    ['h', '<channel-id>'],
    ['p', '<user-pubkey>']
  ];
}

// Kind 9005 - Admin Delete
interface Kind9005Event {
  kind: 9005;
  content: '';
  tags: [
    ['h', '<channel-id>'],
    ['e', '<event-id-to-delete>']
  ];
}
```

---

## Private Messages (NIP-17/59)

### Kind 14 — Rumor (Unsigned DM)

The actual DM content (never published directly).

```typescript
interface Kind14Rumor {
  kind: 14;
  content: string;  // NIP-44 encrypted message
  tags: [
    ['p', '<recipient-pubkey>']
  ];
  created_at: number;
  pubkey: string;
  // No id or sig
}
```

**NIP:** [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md)

---

### Kind 13 — Seal

Sealed wrapper around rumor (never published directly).

```typescript
interface Kind13Event {
  kind: 13;
  content: string;  // Encrypted rumor JSON
  tags: [];
  created_at: number;  // Randomised
}
```

**NIP:** [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md)

---

### Kind 1059 — Gift Wrap

Published wrapper with random key.

```typescript
interface Kind1059Event {
  kind: 1059;
  content: string;  // Encrypted seal JSON
  tags: [
    ['p', '<recipient-pubkey>']
  ];
  created_at: number;  // Randomised
  pubkey: string;       // Random throwaway key
}
```

**NIP:** [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md)

**Usage:** End-to-end encrypted direct messages

---

## Calendar Events (NIP-52)

### Kind 31922 — Date-Based Event

All-day calendar events.

```typescript
interface Kind31922Event {
  kind: 31922;
  content: string;  // Description (markdown)
  tags: [
    ['d', '<unique-id>'],
    ['title', '<event-title>'],
    ['start', '<YYYY-MM-DD>'],
    ['end', '<YYYY-MM-DD>']?,
    ['location', '<location>']?,
    ['g', '<geohash>']?,
    ['h', '<channel-id>']?,
    ['cohort', '<cohort-tag>']?,
    ['t', '<hashtag>']?
  ];
}
```

**NIP:** [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md)

---

### Kind 31923 — Time-Based Event

Events with specific start/end times.

```typescript
interface Kind31923Event {
  kind: 31923;
  content: string;
  tags: [
    ['d', '<unique-id>'],
    ['title', '<event-title>'],
    ['start', '<unix-timestamp>'],
    ['end', '<unix-timestamp>']?,
    ['start_tzid', '<timezone>']?,
    ['end_tzid', '<timezone>']?,
    ['location', '<location>']?,
    ['g', '<geohash>']?,
    ['h', '<channel-id>']?,
    ['cohort', '<cohort-tag>']?
  ];
}
```

**NIP:** [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md)

---

### Kind 31925 — Calendar RSVP

Attendance response to calendar events.

```typescript
interface Kind31925Event {
  kind: 31925;
  content: string;  // Optional message
  tags: [
    ['d', '<event-d-tag>'],
    ['a', '<kind>:<pubkey>:<d-tag>'],
    ['status', 'accepted' | 'declined' | 'tentative'],
    ['L', 'status'],
    ['l', '<status-value>', 'status']
  ];
}
```

**NIP:** [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md)

---

## Authentication (NIP-42)

### Kind 22242 — Auth Response

Response to relay authentication challenge.

```typescript
interface Kind22242Event {
  kind: 22242;
  content: '';
  tags: [
    ['relay', '<relay-url>'],
    ['challenge', '<challenge-string>']
  ];
}
```

**NIP:** [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md)

**Usage:** Relay authentication

---

## Event Kind Summary

| Kind | Name | NIP | Usage |
|------|------|-----|-------|
| 0 | Metadata | 01 | User profiles |
| 1 | Short Note | 01 | General text |
| 5 | Deletion | 09 | Delete own events |
| 7 | Reaction | 25 | Emoji reactions |
| 9 | Group Message | 29 | Channel messages |
| 13 | Seal | 59 | DM wrapper (internal) |
| 14 | Rumor | 17 | DM content (internal) |
| 1059 | Gift Wrap | 59 | E2E encrypted DMs |
| 9000 | Add User | 29 | Admin: add member |
| 9001 | Remove User | 29 | Admin: remove member |
| 9005 | Delete Event | 29 | Admin: delete message |
| 22242 | Auth | 42 | Relay authentication |
| 31922 | Date Event | 52 | All-day calendar events |
| 31923 | Time Event | 52 | Time-based calendar events |
| 31925 | RSVP | 52 | Calendar RSVP |
| 39000 | Group Metadata | 29 | Channel settings |
| 39001 | Group Admins | 29 | Admin list |
| 39002 | Group Members | 29 | Member list |

---

## Related Documentation

- [NIP Protocol Reference](nip-protocol-reference.md) — Full NIP specifications
- [API Reference](api.md) — Service APIs
- [Messaging System](../features/messaging.md) — Implementation details

---

[← Back to Developer Documentation](../index.md)
