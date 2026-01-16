---
title: "ADR-004: Zone-Based Access Control"
description: "Decision to implement zone-based cohort access control using admin whitelists"
category: reference
tags: ['adr', 'security', 'access-control', 'zones', 'admin']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-004: Zone-Based Access Control

## Status

Accepted

## Date

2024-02-10

## Context

Private community requires:
- Whitelist-only relay access
- Role-based permissions within sections
- Cohort membership for cross-zone access
- Admin/moderator capabilities

Traditional RBAC doesn't map well to Nostr's event-based model.

## Decision

Implement zone-based access control with cohorts and section roles.

> **Terminology:** A "Zone" is the top-level context boundary (Fairfield Family, Minimoonoir, DreamLab).
> Each zone contains multiple "Sections" which contain "Forums" (NIP-28 channels).
> See ADR-002 for the full 3-tier hierarchy.

### Access Model

```
┌─────────────────────────────────────────────────────────┐
│                    Access Hierarchy                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Superuser (ADMIN_PUBKEY)                              │
│      │                                                  │
│      ▼                                                  │
│  Cohorts (membership groups)                           │
│      │ ├── admin                                       │
│      │ ├── members                                     │
│      │ ├── dreamlab                                    │
│      │ └── guests                                      │
│      │                                                  │
│      ▼                                                  │
│  Section Roles (per-section permissions)               │
│      ├── admin (full control)                          │
│      ├── moderator (manage content)                    │
│      ├── member (read/write)                           │
│      └── viewer (read-only)                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// src/lib/config/permissions.ts
interface UserPermissions {
  pubkey: string;
  cohorts: CohortId[];
  sectionRoles: Map<SectionId, RoleId>;
  isGlobalAdmin: boolean;
}

// Permission check flow
function canAccessSection(user: UserPermissions, section: SectionId): boolean {
  // 1. Superuser bypass
  if (user.isGlobalAdmin) return true;

  // 2. Check section role
  if (user.sectionRoles.has(section)) return true;

  // 3. Check cohort membership
  const sectionConfig = getSection(section);
  return user.cohorts.some(c => sectionConfig.cohorts.includes(c));
}
```

### Database Schema

```sql
-- PostgreSQL whitelist table
CREATE TABLE access_control (
  pubkey TEXT PRIMARY KEY,
  cohorts TEXT[] NOT NULL DEFAULT '{}',
  access_level TEXT NOT NULL DEFAULT 'member',
  section_roles JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example entry
INSERT INTO access_control (pubkey, cohorts, access_level) VALUES
  ('abc123...', '{admin,members}', 'admin');
```

### NIP-42 Integration

```
Client                          Relay
   │                              │
   │──── Connect ────────────────>│
   │<─── AUTH challenge ──────────│
   │                              │
   │──── AUTH response ──────────>│
   │          (signed event)      │
   │                              │
   │      [Verify signature]      │
   │      [Check whitelist]       │
   │      [Load permissions]      │
   │                              │
   │<─── OK / CLOSED ─────────────│
```

## Consequences

### Positive
- Granular access control
- Cohorts enable cross-section permissions
- Section roles provide local admin
- Integrates with Nostr AUTH

### Negative
- Permission sync between client/relay
- Config complexity for large communities
- No real-time permission updates

### Neutral
- Whitelist managed in PostgreSQL
- Client caches permissions locally

## Alternatives Considered

### Pure NIP-29 Groups
- Native but limited flexibility
- Rejected: Need cohort concept

### Capability-based Access
- More flexible
- Rejected: Higher complexity

### OAuth Scopes
- Standard approach
- Rejected: Requires external IdP

## References

- NIP-42: Authentication
- NIP-29: Relay-based Groups
- Related: ADR-002 (Three-tier hierarchy)
- Config: `config/sections.yaml`
