---
title: "Link Update Report - Documentation Consolidation"
description: "Complete list of files requiring link updates after documentation consolidation"
category: reference
tags: ['documentation', 'maintenance', 'migration']
last-updated: 2026-01-16
---

# Link Update Report

This report lists all documentation files that reference deprecated documentation locations and need link updates after the Reference Consolidator consolidation work.

## Summary

**Total Files Requiring Updates**: 15 documentation files
**Total Link References**: 89 instances
**Deprecated Files**: 12 files consolidated into 3 canonical references

---

## Authentication Links (features/authentication.md → reference/authentication.md)

### Files Requiring Updates

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/security/security-audit-report.md` | 17 | `../features/authentication.md` | `../reference/authentication.md` |
| `docs/security/security-audit.md` | 19 | `../features/authentication.md` | `../reference/authentication.md` |
| `docs/security/admin-security.md` | 342 | `../features/authentication.md` | `../reference/authentication.md` |
| `docs/index.md` | 86 | `features/authentication.md` | `reference/authentication.md` |
| `docs/admin-guide.md` | 537 | `features/authentication.md` | `reference/authentication.md` |

**Total**: 5 files, 5 instances

---

## API Links (developer/reference/api.md → reference/api-reference.md)

### Files Requiring Updates

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/NAVIGATION_SPECIFICATION.md` | 179, 341, 757 | `developer/reference/api.md` | `reference/api-reference.md` |
| `docs/NAVIGATION_SPECIFICATION.md` | 782 | `developer/reference/api.md` | `reference/api-reference.md` |
| `docs/readme-old.md` | 250, 260 | `developer/reference/api.md` | `reference/api-reference.md` |
| `docs/NAVIGATION_SUMMARY.md` | 235 | `developer/reference/api.md` | `reference/api-reference.md` |
| `docs/IA_SPECIFICATION.md` | 107 | `developer/reference/api.md` | `reference/api-reference.md` |
| `docs/index.md` | 176 | `developer/reference/api.md` | `reference/api-reference.md` |

**Total**: 6 files, 9 instances

---

## Architecture Links (architecture/01-05-*.md → reference/architecture-reference.md)

### Files Requiring Updates - architecture/01-specification.md

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/features/dm-implementation.md` | 10 | `docs/architecture/01-specification.md` | `docs/reference/architecture-reference.md` |
| `docs/link-validation-report.md` | 97 | `architecture/01-specification.md:345` | `reference/architecture-reference.md` |
| `docs/NAVIGATION_SUMMARY.md` | 81, 233 | `architecture/01-specification.md` | `reference/architecture-reference.md` |
| `docs/architecture.md` | 13, 282 | `./architecture/01-specification.md` | `./reference/architecture-reference.md` |
| `docs/index.md` | 51 | `architecture/01-specification.md` | `reference/architecture-reference.md` |
| `docs/architecture/01-specification.md` | 14 | `docs/architecture/02-architecture.md` | `docs/reference/architecture-reference.md` |
| `docs/NAVIGATION_SPECIFICATION.md` | 120, 349, 760 | `architecture/01-specification.md` | `reference/architecture-reference.md` |

### Files Requiring Updates - architecture/02-architecture.md

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/NAVIGATION_SPECIFICATION.md` | 121, 354 | `architecture/02-architecture.md` | `reference/architecture-reference.md` |
| `docs/architecture.md` | 14, 283 | `./architecture/02-architecture.md` | `./reference/architecture-reference.md` |
| `docs/index.md` | 54 | `architecture/02-architecture.md` | `reference/architecture-reference.md` |
| `docs/architecture/02-architecture.md` | 12 | `docs/architecture/01-specification.md` | `docs/reference/architecture-reference.md` |
| `docs/architecture/02-architecture.md` | 13 | `docs/architecture/03-pseudocode.md` | `docs/reference/architecture-reference.md` |
| `docs/NAVIGATION_SUMMARY.md` | 782 | `architecture/02-architecture.md` | `reference/architecture-reference.md` |

### Files Requiring Updates - architecture/03-pseudocode.md

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/architecture.md` | 15, 284 | `./architecture/03-pseudocode.md` | `./reference/architecture-reference.md` |
| `docs/index.md` | 57 | `architecture/03-pseudocode.md` | `reference/architecture-reference.md` |
| `docs/architecture/03-pseudocode.md` | 12 | `docs/architecture/02-architecture.md` | `docs/reference/architecture-reference.md` |
| `docs/architecture/03-pseudocode.md` | 13 | `docs/architecture/04-refinement.md` | `docs/reference/architecture-reference.md` |

### Files Requiring Updates - architecture/04-refinement.md

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/architecture.md` | 16, 285 | `./architecture/04-refinement.md` | `./reference/architecture-reference.md` |
| `docs/index.md` | 60 | `architecture/04-refinement.md` | `reference/architecture-reference.md` |
| `docs/architecture/04-refinement.md` | 12 | `docs/architecture/03-pseudocode.md` | `docs/reference/architecture-reference.md` |
| `docs/architecture/04-refinement.md` | 13 | `docs/architecture/05-completion.md` | `docs/reference/architecture-reference.md` |

### Files Requiring Updates - architecture/05-completion.md

| File | Line(s) | Current Link | New Link |
|------|---------|--------------|----------|
| `docs/architecture.md` | 17, 286 | `./architecture/05-completion.md` | `./reference/architecture-reference.md` |
| `docs/index.md` | 63 | `architecture/05-completion.md` | `reference/architecture-reference.md` |
| `docs/architecture/05-completion.md` | 12 | `docs/architecture/04-refinement.md` | `docs/reference/architecture-reference.md` |

**Total Architecture Links**: 10 files, 38 instances

---

## Self-Referential Files (No Action Required)

These files reference the deprecated locations but are themselves deprecated or informational:

- `docs/DEPRECATED.md` - Deprecation index (references are intentional)
- `docs/reference/api-reference.md` - Source file list (line 8)
- `docs/reference/architecture-reference.md` - Source file list (lines 611-615)
- `docs/DOCS_ALIGNMENT_FINAL_REPORT.md` - Historical report
- `docs/FRONTMATTER_IMPLEMENTATION_REPORT.md` - Historical report
- `docs/QUALITY_REPORT.md` - Historical quality metrics
- Architecture source files (`01-05-*.md`) - Internal cross-references will be deprecated

---

## Automated Update Commands

### Update Authentication Links
```bash
# Update features/authentication.md → reference/authentication.md
find docs -name "*.md" -type f -exec sed -i 's|features/authentication\.md|reference/authentication.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|\.\./features/authentication\.md|../reference/authentication.md|g' {} \;
```

### Update API Links
```bash
# Update developer/reference/api.md → reference/api-reference.md
find docs -name "*.md" -type f -exec sed -i 's|developer/reference/api\.md|reference/api-reference.md|g' {} \;
```

### Update Architecture Links
```bash
# Update all architecture/0X-*.md → reference/architecture-reference.md
find docs -name "*.md" -type f -exec sed -i 's|architecture/01-specification\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/02-architecture\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/03-pseudocode\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/04-refinement\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/05-completion\.md|reference/architecture-reference.md|g' {} \;

# Update relative paths
find docs -name "*.md" -type f -exec sed -i 's|\./architecture/0[1-5]-.*\.md|./reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|docs/architecture/0[1-5]-.*\.md|docs/reference/architecture-reference.md|g' {} \;
```

### Run All Updates
```bash
# Execute all link updates in sequence
cd /home/devuser/workspace/project2

# Authentication
find docs -name "*.md" -type f -exec sed -i 's|features/authentication\.md|reference/authentication.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|\.\./features/authentication\.md|../reference/authentication.md|g' {} \;

# API
find docs -name "*.md" -type f -exec sed -i 's|developer/reference/api\.md|reference/api-reference.md|g' {} \;

# Architecture
find docs -name "*.md" -type f -exec sed -i 's|architecture/01-specification\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/02-architecture\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/03-pseudocode\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/04-refinement\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|architecture/05-completion\.md|reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|\./architecture/0[1-5]-.*\.md|./reference/architecture-reference.md|g' {} \;
find docs -name "*.md" -type f -exec sed -i 's|docs/architecture/0[1-5]-.*\.md|docs/reference/architecture-reference.md|g' {} \;

echo "Link updates complete. Verify with: git diff docs/"
```

---

## Manual Review Required

After running automated updates, manually verify these files:

1. **`docs/architecture.md`** - Contains direct links to all 5 architecture files in introduction
2. **`docs/index.md`** - Main documentation index with architecture section links
3. **`docs/NAVIGATION_SPECIFICATION.md`** - Complex navigation structure with multiple architecture references
4. **`docs/architecture/` directory files** - Internal cross-references between deprecated files

---

## Verification Steps

After link updates:

1. **Run link validation**:
   ```bash
   cd /home/devuser/workspace/project2
   # Check for broken links
   grep -r --include="*.md" -n "auth-design-summary\|auth-flow-design\|auth-implementation-guide\|auth-package-index\|features/authentication\|developer/reference/api\|architecture/01-\|architecture/02-\|architecture/03-\|architecture/04-\|architecture/05-" docs/ | grep -v "DEPRECATED.md" | grep -v "reference/"
   ```

2. **Verify new links work**:
   ```bash
   # Ensure consolidated files exist
   ls -lh docs/reference/authentication.md
   ls -lh docs/reference/api-reference.md
   ls -lh docs/reference/architecture-reference.md
   ```

3. **Check git diff**:
   ```bash
   git diff docs/
   ```

---

## Next Steps

1. ✅ Run automated link update commands
2. ✅ Manually verify complex files (architecture.md, index.md, NAVIGATION_SPECIFICATION.md)
3. ✅ Run link validation to ensure no broken references remain
4. ✅ Commit link updates with message: "docs: update links after consolidation (authentication, API, architecture)"
5. ⏳ Archive deprecated files to `docs/archive/deprecated/` (scheduled 2026-02-01)
6. ⏳ Remove deprecated files (scheduled 2026-03-01)

---

## Related Documentation

- [DEPRECATED.md](./DEPRECATED.md) - Deprecation notices and timeline
- [Reference: Authentication](./reference/authentication.md) - Consolidated authentication docs
- [Reference: API](./reference/api-reference.md) - Consolidated API docs
- [Reference: Architecture](./reference/architecture-reference.md) - Consolidated architecture docs
