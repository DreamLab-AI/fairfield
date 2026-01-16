---
title: "Documentation Maintenance Guide"
description: "Procedures for maintaining documentation quality, consistency, and Diataxis framework alignment"
category: howto
tags: [documentation, maintenance, validation, quality]
difficulty: intermediate
related-docs:
  - ./CONTRIBUTING.md
  - ./link-validation-report.md
last-updated: 2026-01-16
---

# Documentation Maintenance Guide

## Overview

This guide provides procedures for maintaining the documentation in this repository, ensuring quality, consistency, and alignment with the Diátaxis framework.

## Validation Scripts

All validation scripts are located in `docs/scripts/`:

### Running Validators

```bash
# Run all validators
./docs/scripts/validate-all.sh

# Run individual validators
./docs/scripts/validate-structure.sh    # File naming, nesting, directory structure
./docs/scripts/validate-frontmatter.sh  # YAML front matter
./docs/scripts/validate-links.sh        # Internal links
./docs/scripts/validate-spelling.sh     # UK English spelling
```

### Validation Rules

#### 1. Structure Validation

**Required directories:**
- `docs/tutorials/` - Learning-oriented tutorials
- `docs/how-to/` - Task-oriented guides
- `docs/reference/` - Information-oriented documentation
- `docs/explanation/` - Understanding-oriented explanations

**File naming:**
- Use kebab-case: `getting-started.md` ✅
- No uppercase: `GettingStarted.md` ❌
- No underscores: `getting_started.md` ❌
- No spaces: `getting started.md` ❌

**Nesting:**
- Maximum 2 levels: `category/subcategory/file.md`
- Example: `tutorials/authentication/signup-flow.md` ✅
- Too deep: `tutorials/authentication/flows/signup/basic.md` ❌

**INDEX files:**
- Each category directory must have `INDEX.md`
- All files must be referenced in an INDEX.md

#### 2. Front Matter Validation

**Required fields by document type:**

**Tutorials** (`docs/tutorials/`):
```yaml
---
title: String (required)
description: String (required)
category: String (required)
difficulty: beginner|intermediate|advanced (required)
duration: String (required, e.g., "30 minutes")
prerequisites: Array (required)
last_updated: YYYY-MM-DD (optional)
---
```

**How-To Guides** (`docs/how-to/`):
```yaml
---
title: String (required)
description: String (required)
category: String (required)
applies_to: Array (required)
prerequisites: Array (optional)
last_updated: YYYY-MM-DD (optional)
---
```

**Reference** (`docs/reference/`):
```yaml
---
title: String (required)
description: String (required)
category: String (required)
type: api|cli|architecture|glossary (required)
last_updated: YYYY-MM-DD (optional)
---
```

**Explanation** (`docs/explanation/`):
```yaml
---
title: String (required)
description: String (required)
category: String (required)
concepts: Array (required)
related_topics: Array (optional)
last_updated: YYYY-MM-DD (optional)
---
```

#### 3. Link Validation

**Internal links:**
- Must use relative paths: `[Getting Started](../tutorials/getting-started.md)` ✅
- All targets must exist
- Absolute paths from project root: `[Guide](/docs/how-to/deploy.md)` ✅

**External links:**
- Not validated (https:// URLs are skipped)

**Anchors:**
- Anchor-only links are skipped: `[Section](#my-section)`
- Links with anchors check file existence: `[Guide](deploy.md#setup)` validates `deploy.md` exists

#### 4. UK English Spelling

**Common US → UK conversions:**
- behavior → behaviour
- color → colour
- optimize → optimise
- organize → organise
- recognize → recognise
- analyze → analyse
- center → centre
- defense → defence
- license → licence (noun)
- practice → practise (verb)

**Exceptions:**
Add legitimate US spellings to `docs/scripts/spelling-exceptions.txt`:
```
# Code identifiers
color # CSS property
backgroundColor # JavaScript property
optimize # npm package names
```

## CI/CD Integration

### GitHub Actions Workflow

The workflow runs automatically on:
- Pull requests modifying `docs/**`
- Pushes to `main` branch

**Workflow file:** `.github/workflows/docs-validation.yml`

**What it does:**
1. Runs all validation scripts
2. Posts results as PR comment
3. Fails the build if validation fails
4. Uploads validation report as artifact

### Local Pre-commit Hook (Optional)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Only run if docs changed
if git diff --cached --name-only | grep -q "^docs/"; then
    ./docs/scripts/validate-all.sh
    if [ $? -ne 0 ]; then
        echo "❌ Documentation validation failed. Commit aborted."
        exit 1
    fi
fi
```

Make executable: `chmod +x .git/hooks/pre-commit`

## Maintenance Procedures

### Adding New Documentation

1. Determine correct category (tutorials/how-to/reference/explanation)
2. Create file with kebab-case name
3. Add required front matter
4. Write content following Diátaxis principles
5. Add entry to relevant `INDEX.md`
6. Run validators: `./docs/scripts/validate-all.sh`
7. Fix any errors before committing

### Updating Existing Documentation

1. Update `last_updated` field in front matter
2. Verify all links still valid
3. Check UK English spelling
4. Run validators before committing

### Reorganising Documentation

1. Move/rename files as needed
2. Update all references in `INDEX.md` files
3. Update internal links across all files
4. Run link validator to catch broken links
5. Update front matter categories if changed

### Quarterly Review

Every 3 months:

1. **Content audit:**
   - Check `last_updated` fields
   - Update outdated content
   - Archive deprecated guides

2. **Link health:**
   - Run full link validation
   - Fix broken external links (manual check)

3. **Structure review:**
   - Ensure categories still appropriate
   - Reorganise if new patterns emerge

4. **Spelling exceptions:**
   - Review `spelling-exceptions.txt`
   - Remove obsolete entries

## Troubleshooting

### "MISSING INDEX.md in category/"

Each category directory needs an `INDEX.md` file. Create:

```markdown
---
title: Category Name
description: Overview of this category
---

# Category Name

Description of what this category contains.

## Documents

- [Document 1](document-1.md)
- [Document 2](document-2.md)
```

### "UPPERCASE in filename"

Rename file to kebab-case:
```bash
mv docs/tutorials/Getting-Started.md docs/tutorials/getting-started.md
```

Update references in `INDEX.md` files.

### "BROKEN LINK"

Fix the link path or create the missing target file.

**Example fix:**
```markdown
# Before
[Guide](../guide.md)

# After
[Guide](../how-to/deployment-guide.md)
```

### "US SPELLING"

Replace US spelling with UK English:
```markdown
# Before
We optimize the behavior of the system.

# After
We optimise the behaviour of the system.
```

If US spelling is legitimate (code identifier), add to `spelling-exceptions.txt`.

## Support

- **Validation issues:** Check script output for specific errors
- **Framework questions:** See [Diátaxis documentation](https://diataxis.fr/)
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)

## Automation Summary

| Script | Purpose | Exit Code |
|--------|---------|-----------|
| `validate-structure.sh` | File naming, nesting, INDEX.md | 0 = pass, 1 = fail |
| `validate-frontmatter.sh` | YAML front matter | 0 = pass, 1 = fail |
| `validate-links.sh` | Internal links | 0 = pass, 1 = fail |
| `validate-spelling.sh` | UK English | 0 = pass, 1 = fail |
| `validate-all.sh` | Run all above | 0 = all pass, 1 = any fail |

All scripts are idempotent and safe to run repeatedly.
