---
title: "Architecture Decision Records"
description: "Index of architecture decision records documenting key technical decisions for the Nostr BBS project"
category: reference
tags: [architecture, adr, reference, developer, decisions]
difficulty: intermediate
last-updated: 2026-01-16
---

# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for the Nostr BBS project.

## Terminology Note

The codebase uses a **3-tier hierarchy**:
- **Zone** (Category): Top-level context boundary (Fairfield Family / Minimoonoir / DreamLab)
- **Section**: Topical grouping within a zone (e.g., "Family Home", "Training Rooms")
- **Forum**: NIP-28 channel for discussions

In code, "Category" and "Zone" are used interchangeably for the top tier.

## ADR Index

### Architecture ADRs (Numbered)

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](001-nostr-protocol-foundation.md) | Nostr Protocol as Foundation | Accepted | 2024-01 |
| [ADR-002](002-three-tier-hierarchy.md) | Three-Tier BBS Hierarchy | Accepted | 2024-01 |
| [ADR-003](003-gcp-cloud-run-infrastructure.md) | GCP Cloud Run Infrastructure | Accepted | 2024-02 |
| [ADR-004](004-zone-based-access-control.md) | Zone-Based Access Control | Accepted | 2024-02 |
| [ADR-005](005-nip-44-encryption-mandate.md) | NIP-44 Encryption Mandate | Accepted | 2024-03 |
| [ADR-006](006-client-side-wasm-search.md) | Client-Side WASM Search | Accepted | 2024-03 |
| [ADR-007](007-sveltekit-ndk-frontend.md) | SvelteKit + NDK Frontend | Accepted | 2024-01 |
| [ADR-008](008-postgresql-relay-storage.md) | PostgreSQL Relay Storage | Accepted | 2024-02 |

### Implementation ADRs (Bug Fixes / Features)

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001-user-registration-flow](ADR-001-user-registration-flow.md) | User Registration Flow Fix | Resolved | 2026-01 |

## ADR Template

Use [000-template.md](000-template.md) when creating new ADRs.

## Status Definitions

- **Proposed** - Under discussion
- **Accepted** - Decision made and implemented
- **Deprecated** - Superseded by another ADR
- **Rejected** - Considered but not adopted

## Quick Reference

### Core Stack
- **Protocol**: Nostr (NIPs 01, 17, 28, 29, 42, 44, 52, 59)
- **Frontend**: SvelteKit 2.x + NDK
- **Relay**: strfry on Cloud Run
- **Database**: PostgreSQL (relay storage)
- **Search**: HNSW WASM (client-side)

### Key Decisions
1. Nostr for identity and messaging (no traditional auth)
2. Three-tier hierarchy for BBS organisation
3. Zone-based cohort access control
4. NIP-44 mandatory for new encryption
5. Client-side semantic search (WiFi-only sync)
