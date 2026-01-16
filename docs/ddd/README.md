---
title: "Domain-Driven Design Documentation"
description: "Domain-driven design artifacts including domain model, bounded contexts, aggregates, and ubiquitous language"
category: reference
tags: [ddd, architecture, developer, domain, design]
difficulty: advanced
related-docs:
  - ./01-domain-model.md
  - ./02-bounded-contexts.md
  - ../adr/README.md
last-updated: 2026-01-16
---

# Domain-Driven Design Documentation

This directory contains Domain-Driven Design artifacts for the Nostr BBS project.

## Document Index

| Document | Description |
|----------|-------------|
| [Domain Model](01-domain-model.md) | Core domain entities and relationships |
| [Bounded Contexts](02-bounded-contexts.md) | Context boundaries and integration |
| [Aggregates](03-aggregates.md) | Aggregate roots and invariants |
| [Domain Events](04-domain-events.md) | Event catalog and flows |
| [Value Objects](05-value-objects.md) | Immutable domain primitives |
| [Ubiquitous Language](06-ubiquitous-language.md) | Domain terminology glossary |

## Domain Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Nostr BBS Domain                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Identity Context          Messaging Context            │
│  ├── Member                ├── Message                  │
│  ├── Keypair               ├── Thread                   │
│  ├── Profile               ├── Reaction                 │
│  └── Session               └── DirectMessage            │
│                                                         │
│  Organisation Context      Access Context               │
│  ├── Category              ├── Cohort                   │
│  ├── Section               ├── Role                     │
│  ├── Forum                 ├── Permission               │
│  └── Channel               └── Whitelist                │
│                                                         │
│  Search Context            Calendar Context             │
│  ├── Index                 ├── Event                    │
│  ├── Query                 ├── RSVP                     │
│  └── Result                └── Reminder                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Strategic Design

### Core Domain
- **Messaging**: The primary value - community communication
- **Organisation**: BBS structure (Category → Section → Forum)

### Supporting Domains
- **Identity**: Nostr keypair management
- **Access Control**: Zone-based permissions

### Generic Domains
- **Search**: Semantic search capability
- **Calendar**: Event scheduling (NIP-52)

## Tactical Patterns Used

| Pattern | Usage |
|---------|-------|
| Aggregate | Message thread, Forum channel |
| Entity | Member, Message, Section |
| Value Object | Pubkey, EventId, Signature |
| Domain Event | MessagePosted, MemberJoined |
| Repository | EventRepository, MemberRepository |
| Domain Service | EncryptionService, SearchService |

## Context Map

```
┌────────────┐     ┌────────────┐     ┌──────────────┐
│  Identity  │────>│  Access    │────>│Organisation  │
│  Context   │ ACL │  Context   │ OHS │  Context     │
└────────────┘     └────────────┘     └──────────────┘
      │                  │                  │
      │                  │                  │
      ▼                  ▼                  ▼
┌────────────────────────────────────────────────┐
│              Messaging Context                  │
│            (Core Domain)                       │
└────────────────────────────────────────────────┘
      │                  │
      ▼                  ▼
┌────────────┐     ┌────────────┐
│   Search   │     │  Calendar  │
│  Context   │     │  Context   │
└────────────┘     └────────────┘

Legend:
  ───> ACL: Anticorruption Layer
  ───> OHS: Open Host Service
```

## Quick Reference

### Key Aggregates
- `MessageThread` - Root for threaded conversations
- `Forum` - NIP-28 channel with messages
- `Member` - User with profile and permissions

### Key Domain Events
- `MessagePosted` - New message in forum
- `MemberWhitelisted` - User granted access
- `ThreadCreated` - New discussion started

### Key Services
- `EncryptionService` - NIP-44/04 handling
- `RelayService` - Event publishing/subscription
- `PermissionService` - Access control checks
