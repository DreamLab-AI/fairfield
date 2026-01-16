---
title: "ADR-001: Nostr Protocol as Foundation"
description: "Decision to use Nostr protocol for identity, authentication, and messaging instead of traditional centralized solutions"
category: reference
tags: [adr, nostr, architecture, authentication, protocol]
difficulty: advanced
related-docs:
  - ../architecture.md
  - ./002-three-tier-hierarchy.md
last-updated: 2024-01-15
---

# ADR-001: Nostr Protocol as Foundation

## Status

Accepted

## Date

2024-01-15

## Context

Building a private community BBS requires:
- User identity and authentication
- Message storage and retrieval
- Real-time communication
- Encryption for private messages
- No dependency on centralized identity providers

Traditional approaches (OAuth, email/password) create dependencies on external services and require managing user credentials.

## Decision

Use Nostr protocol as the foundation for identity, messaging, and data storage.

### Implementation
- **Identity**: Nostr keypairs (secp256k1) as user identity
- **Authentication**: NIP-42 AUTH for relay access control
- **Public Messages**: NIP-01 events with NIP-28 channels
- **Private Messages**: NIP-17 (gift wrap) with NIP-44 encryption
- **Metadata**: NIP-01 kind 0 for profiles

### NIPs Implemented
| NIP | Purpose | Usage |
|-----|---------|-------|
| 01 | Basic protocol | Events, subscriptions |
| 09 | Event deletion | Message removal |
| 17 | Private DMs | Gift-wrapped messages |
| 28 | Public channels | Forum threads |
| 29 | Relay-based groups | Section management |
| 42 | Authentication | Whitelist enforcement |
| 44 | Encryption | All new encrypted content |
| 52 | Calendar | Event scheduling |
| 59 | Gift wrap | DM privacy layer |

## Consequences

### Positive
- Self-sovereign identity (users own their keys)
- No email/password management
- Cryptographic authentication
- Interoperable with Nostr ecosystem
- Built-in encryption standards

### Negative
- Key management complexity for users
- No password recovery (seed phrase required)
- Limited mainstream adoption
- Learning curve for new users

### Neutral
- Relay dependency for message storage
- Event-based data model differs from traditional DBs

## Alternatives Considered

### Traditional Auth (OAuth/OIDC)
- Requires external IdP dependency
- Users don't own their identity
- Rejected: Contradicts decentralization goals

### Matrix Protocol
- More complex server requirements
- Heavier client implementation
- Rejected: Overkill for BBS use case

### ActivityPub
- Federation complexity
- No built-in encryption
- Rejected: Poor fit for private communities

## References

- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [NIP Index](https://github.com/nostr-protocol/nips)
- Related: ADR-005 (NIP-44 mandate)
