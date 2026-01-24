---
title: "Deprecated Documentation Files"
description: "Index of deprecated documentation files and their consolidated replacements"
category: reference
tags: ['documentation', 'deprecation', 'migration']
last-updated: 2026-01-16
---

# Deprecated Documentation Files

This document lists all deprecated documentation files that have been consolidated into unified reference documents. **Do not use these deprecated files for current implementation** - they are retained for historical reference only.

---

## Authentication Documentation

**Status**: ⚠️ DEPRECATED - Use `docs/reference/authentication.md` instead

The following authentication-related files have been consolidated into a single canonical reference:

| Deprecated File | Lines | Content Summary |
|-----------------|-------|-----------------|
| `docs/auth-design-summary.md` | 695 | High-level design overview with user flows |
| `docs/auth-flow-design.md` | 1,241 | Complete screen-by-screen authentication flows |
| `docs/auth-implementation-guide.md` | 1,173 | Developer implementation guide with code examples |
| `docs/auth-package-index.md` | 532 | Package overview and deliverables |
| `docs/features/authentication.md` | 481 | Production authentication system documentation |

**New Location**: [`docs/reference/authentication.md`](./reference/authentication.md) (463 lines)

**What Changed:**
- Merged all 5 files into single canonical reference
- Prioritized production implementation (features/authentication.md)
- Preserved design history and migration notes
- Added comprehensive cross-references

---

## API Documentation

**Status**: ⚠️ DEPRECATED - Use `docs/reference/api-reference.md` instead

The following API documentation files have been consolidated:

| Deprecated File | Lines | Content Summary |
|-----------------|-------|-----------------|
| `docs/developer/reference/api.md` | 580 | Client-side APIs (stores, services, utilities) |
| `services/nostr-relay/docs/API.md` | 325 | Relay WebSocket/HTTP APIs |

**New Location**: [`docs/reference/api-reference.md`](./reference/api-reference.md) (750 lines)

**What Changed:**
- Merged client-side and relay-side API documentation
- Unified format with consistent examples
- Added comprehensive event kinds, rate limits, error codes
- Included NIP-98 authentication details

---

## Architecture Documentation

**Status**: ⚠️ DEPRECATED - Use `docs/reference/architecture-reference.md` instead

The following SPARC methodology architecture files have been consolidated:

| Deprecated File | Lines | Content Summary |
|-----------------|-------|-----------------|
| `docs/architecture/01-specification.md` | 354 | Original requirements specification (superseded by PRD.md) |
| `docs/architecture/02-architecture.md` | 684 | System architecture design with diagrams |
| `docs/architecture/03-pseudocode.md` | 879 | Algorithm design and detailed flows |
| `docs/architecture/04-refinement.md` | 772 | Technology selection and testing strategy |
| `docs/architecture/05-completion.md` | 927 | Deployment, verification, and handoff |

**New Location**: [`docs/reference/architecture-reference.md`](./reference/architecture-reference.md)

**What Changed:**
- Consolidated all 5 SPARC phase documents into single reference
- Removed outdated terminology (Moomaa-tribe → Minimoonoir, Business → DreamLab)
- Updated deployment architecture (Cloudflare Workers instead of Caddy)
- Added current technology stack and deployment procedures
- Preserved key diagrams and design decisions
- Referenced PRD.md v2.1.0 for current requirements

**Note**: Original SPARC files remain in `docs/architecture/` for historical reference only.

---

## Configuration Documentation

**Status**: ✅ ALREADY CONSOLIDATED

The configuration documentation is already consolidated at:
- [`docs/developer/reference/configuration.md`](./developer/reference/configuration.md)

**No action required** - this file is up to date and canonical.

---

## NIP Protocol Documentation

**Status**: ✅ ALREADY CONSOLIDATED

The NIP protocol reference is already consolidated at:
- [`docs/developer/reference/nip-protocol-reference.md`](./developer/reference/nip-protocol-reference.md)

**No action required** - this file is up to date and canonical.

---

## Migration Guide

### For Developers

If you have links or bookmarks to deprecated files, update them according to this mapping:

**Authentication:**
```
OLD: docs/auth-design-summary.md
OLD: docs/auth-flow-design.md
OLD: docs/auth-implementation-guide.md
OLD: docs/auth-package-index.md
OLD: docs/features/authentication.md
NEW: docs/reference/authentication.md
```

**API:**
```
OLD: docs/developer/reference/api.md
OLD: services/nostr-relay/docs/API.md
NEW: docs/reference/api-reference.md
```

**Architecture:**
```
OLD: docs/architecture/01-specification.md
OLD: docs/architecture/02-architecture.md
OLD: docs/architecture/03-pseudocode.md
OLD: docs/architecture/04-refinement.md
OLD: docs/architecture/05-completion.md
NEW: docs/reference/architecture-reference.md
```

### Search and Replace

To update internal documentation links, use these commands:

```bash
# Update authentication references
find docs -name "*.md" -type f -exec sed -i 's|auth-design-summary\.md|reference/authentication.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|auth-flow-design\.md|reference/authentication.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|auth-implementation-guide\.md|reference/authentication.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|features/authentication\.md|reference/authentication.md|g' {} \;

# Update API references
find docs -name "*.md" -type f -exec sed -i 's|developer/reference/api\.md|reference/api-reference.md|g' {} \;

# Update architecture references
find docs -name "*.md" -type f -exec sed -i 's|architecture/0[1-5]-.*\.md|reference/architecture-reference.md|g' {} \;
```

---

## Deprecation Timeline

| Date | Action |
|------|--------|
| 2026-01-16 | Created consolidated reference documents |
| 2026-01-16 | Marked original files as deprecated |
| 2026-02-01 | Archive deprecated files (planned) |
| 2026-03-01 | Remove deprecated files (planned) |

---

## File Removal Schedule

**Phase 1** (Current): Deprecated files remain in repository with this notice

**Phase 2** (2026-02-01): Move deprecated files to `docs/archive/deprecated/`

**Phase 3** (2026-03-01): Remove deprecated files from repository

Files will be preserved in git history indefinitely.

---

## Questions?

If you need information from a deprecated file:

1. **First**, check the new consolidated reference document
2. **If not found**, check this deprecation notice for the mapping
3. **Still missing?** The content may have been moved to PRD.md or another location
4. **Historical reference needed?** Access the deprecated files in `docs/archive/deprecated/` (after 2026-02-01)

For questions, see [CONTRIBUTING.md](../CONTRIBUTING.md) or open an issue.
