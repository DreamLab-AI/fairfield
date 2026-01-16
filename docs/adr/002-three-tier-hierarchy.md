---
title: "ADR-002: Three-Tier BBS Hierarchy"
description: "Decision to use three-tier hierarchy (Zone/Section/Forum) for BBS organization"
category: reference
tags: ['adr', 'architecture', 'nostr', 'channels', 'design']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-002: Three-Tier BBS Hierarchy

## Status

Accepted

## Date

2024-01-20

## Context

Community forums need organisational structure for:
- Topic categorisation
- Access control boundaries
- Navigation and discovery
- Content moderation scope

Traditional BBS systems use Category → Forum → Thread hierarchy. Need to map this to Nostr primitives.

## Decision

Implement three-tier hierarchy: **Zone (Category) → Section → Forum**

> **Terminology Note:** In the PRD and user-facing docs, "Zone" is the preferred term for Tier 1
> (e.g., Fairfield Family Zone, Minimoonoir Zone, DreamLab Zone). In code and config files,
> "Category" is used interchangeably. Both terms refer to the same concept.

### Tier Definitions

```
Zone/Category (Tier 1)
├── Top-level context boundary (Family/Social/Business)
├── Navigation/UI grouping
├── No Nostr event representation
└── Defined in config/sections.yaml as "categories"

Section (Tier 2)
├── Access control boundary
├── Maps to NIP-29 relay group
├── Defines cohort permissions
└── Contains multiple forums

Forum (Tier 3)
├── NIP-28 public channel
├── Contains message threads
├── Inherits section access
└── Created dynamically
```

### Configuration Structure

```yaml
# config/sections.yaml
categories:
  community:
    name: "Community"
    icon: "users"
    sections:
      - general
      - announcements

sections:
  general:
    name: "General Discussion"
    cohorts: [members, guests]
    access: read-write
    forums:
      - welcome
      - introductions
```

### Nostr Mapping

| Tier | Nostr Primitive | Event Kind |
|------|-----------------|------------|
| Category | None (UI only) | - |
| Section | NIP-29 Group | 39000-39003 |
| Forum | NIP-28 Channel | 40, 41, 42 |
| Thread | Reply chain | 1 (with e-tags) |

## Consequences

### Positive
- Clear organisational structure
- Granular access control at section level
- Familiar BBS mental model
- Efficient permission checking

### Negative
- Additional abstraction over Nostr
- Config file management required
- Category changes need deployment

### Neutral
- Forums created dynamically vs configured
- Threads are implicit (reply chains)

## Alternatives Considered

### Two-Tier (Section → Forum only)
- Simpler but less organisation
- Rejected: Insufficient for large communities

### Four-Tier (add Sub-forums)
- More granular but complex
- Rejected: Overengineering for current needs

### Pure NIP-29 Groups
- Native Nostr but limited UI control
- Rejected: Need custom navigation

## References

- NIP-28: Public Chat Channels
- NIP-29: Relay-based Groups
- Related: ADR-004 (Zone-based access)
- Config: `config/sections.yaml`
