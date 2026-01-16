---
title: "Contributing to Documentation"
description: "Guidelines for contributing to documentation ensuring consistency and quality with Diataxis framework"
category: howto
tags: [documentation, contributing, guide, diataxis]
difficulty: beginner
related-docs:
  - ./MAINTENANCE.md
  - ./developer/contributing/index.md
last-updated: 2026-01-16
---

# Contributing to Documentation

Thank you for contributing to our documentation. This guide ensures consistency and quality across all documentation.

## Quick Start

1. **Choose the right category** (see [Diátaxis Framework](#diataxis-framework))
2. **Create file with kebab-case name** (`my-guide.md`)
3. **Add required front matter** (see [Front Matter](#front-matter))
4. **Write content** following principles
5. **Run validators** before committing
6. **Submit pull request**

## Diátaxis Framework

All documentation follows the [Diátaxis framework](https://diataxis.fr/), which organises content into four categories:

### 📚 Tutorials (`docs/tutorials/`)

**Purpose:** Learning-oriented, step-by-step lessons for beginners

**Characteristics:**
- Assumes no prior knowledge
- Provides complete, working examples
- Focuses on learning, not production use
- Has clear learning outcomes

**Example topics:**
- "Your First API Integration"
- "Building a Simple Authentication System"
- "Getting Started with Testing"

**Template:**
```markdown
---
title: Tutorial Title
description: What the learner will build
category: main-topic
difficulty: beginner
duration: "30 minutes"
prerequisites:
  - Basic JavaScript knowledge
  - Node.js installed
---

# Tutorial Title

## What You'll Build

Brief description of the end result.

## Prerequisites

- Prerequisite 1
- Prerequisite 2

## Step 1: Setup

Clear instructions...

## Step 2: Implementation

Clear instructions...

## What You Learned

Summary of key concepts.

## Next Steps

- [Related Tutorial](../related.md)
```

### 🔧 How-To Guides (`docs/how-to/`)

**Purpose:** Task-oriented, problem-solving guides for specific goals

**Characteristics:**
- Assumes reader has context
- Focuses on solving a specific problem
- Practical and action-oriented
- Flexible (reader adapts to their needs)

**Example topics:**
- "How to Deploy with Docker"
- "How to Configure Authentication"
- "How to Debug Performance Issues"

**Template:**
```markdown
---
title: How to [Achieve Goal]
description: Brief description of what this achieves
category: main-topic
applies_to:
  - Component/system this applies to
prerequisites:
  - Optional prerequisite
---

# How to [Achieve Goal]

## Overview

Brief context: when would someone need this?

## Prerequisites

- What you need before starting

## Steps

### 1. First Action

Clear instructions...

### 2. Second Action

Clear instructions...

## Verification

How to verify it worked.

## Troubleshooting

Common issues and solutions.

## Related Guides

- [Related How-To](../related.md)
```

### 📖 Reference (`docs/reference/`)

**Purpose:** Information-oriented, technical descriptions

**Characteristics:**
- Factual and precise
- Comprehensive coverage
- Neutral tone
- Structured for lookup

**Example topics:**
- "API Reference"
- "CLI Command Reference"
- "Architecture Overview"
- "Glossary of Terms"

**Template:**
```markdown
---
title: Reference Title
description: What this reference covers
category: main-topic
type: api  # or cli, architecture, glossary
---

# Reference Title

## Overview

Brief description of scope.

## [Item 1]

### Description
What it is/does.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Description |

### Example
\`\`\`javascript
// Code example
\`\`\`

## [Item 2]

...
```

### 💡 Explanation (`docs/explanation/`)

**Purpose:** Understanding-oriented, conceptual discussions

**Characteristics:**
- Explains why things are the way they are
- Provides context and background
- Discusses alternatives and trade-offs
- Deepens understanding

**Example topics:**
- "Understanding Authentication Strategies"
- "Security Architecture Explained"
- "Why We Chose This Approach"

**Template:**
```markdown
---
title: Understanding [Concept]
description: What this explains
category: main-topic
concepts:
  - concept-1
  - concept-2
related_topics:
  - related-topic
---

# Understanding [Concept]

## Introduction

Why this concept matters.

## Background

Historical context or motivation.

## Key Concepts

### Concept 1

Explanation...

### Concept 2

Explanation...

## How It Works

Deeper dive into mechanisms.

## Trade-offs

What are the advantages and disadvantages?

## Alternatives

Other approaches and when to use them.

## Further Reading

- [Related Explanation](../related.md)
- [External Resource](https://example.com)
```

## Front Matter

Every document must include YAML front matter. See [MAINTENANCE.md](MAINTENANCE.md#2-front-matter-validation) for complete requirements.

## Writing Guidelines

### UK English

Use British English spelling throughout:

✅ **Correct:**
- behaviour, colour, favour
- optimise, organise, recognise
- centre, defence, licence (noun)

❌ **Incorrect:**
- behavior, color, favor
- optimize, organize, recognize
- center, defense, license (noun)

**Exception:** Code identifiers, API names, and library names may use US spelling.

### Tone and Voice

- **Tutorials:** Encouraging and supportive ("Let's build...", "You'll learn...")
- **How-To:** Direct and imperative ("Configure the service", "Run the command")
- **Reference:** Neutral and factual ("The API returns...", "The parameter accepts...")
- **Explanation:** Thoughtful and exploratory ("This approach offers...", "Consider the trade-offs...")

### Code Examples

**Always provide:**
- Complete, runnable examples
- Expected output
- Explanation of what's happening

**Example:**
```markdown
\`\`\`javascript
// Authenticate user with email and password
const user = await authenticateUser({
  email: 'user@example.com',
  password: 'secure-password'
});

console.log(user.id); // Output: 'usr_1234567890'
\`\`\`

This creates an authenticated session and returns the user object.
```

### Links

**Internal links:**
```markdown
[Link Text](../category/document.md)
[Same Category](./document.md)
```

**External links:**
```markdown
[External Resource](https://example.com)
```

**Anchors:**
```markdown
[Section in Same Document](#section-heading)
[Section in Other Document](../other.md#section-heading)
```

## Validation

Before submitting:

```bash
# Make scripts executable (first time only)
chmod +x docs/scripts/*.sh

# Run all validators
./docs/scripts/validate-all.sh
```

Fix any errors before committing.

## Pull Request Process

1. **Create feature branch:** `git checkout -b docs/your-topic`
2. **Write documentation** following guidelines
3. **Run validators:** `./docs/scripts/validate-all.sh`
4. **Commit changes:** `git commit -m "docs: add guide for X"`
5. **Push branch:** `git push origin docs/your-topic`
6. **Open pull request** on GitHub
7. **Wait for validation** (GitHub Actions runs automatically)
8. **Address feedback** from reviewers
9. **Merge** when approved and validated

## Commit Message Format

Use conventional commits:

```
docs(category): brief description

Longer explanation if needed.

- Detail 1
- Detail 2
```

**Examples:**
```
docs(tutorials): add getting started guide
docs(reference): update API documentation for v2
docs(how-to): add deployment with Docker guide
docs(explanation): explain authentication architecture
```

## Review Checklist

Before submitting, verify:

- [ ] Correct category (tutorials/how-to/reference/explanation)
- [ ] Kebab-case filename (`my-guide.md`)
- [ ] Complete front matter with required fields
- [ ] UK English spelling
- [ ] Working code examples
- [ ] Valid internal links
- [ ] Added to relevant `INDEX.md`
- [ ] All validators pass
- [ ] Clear, concise writing
- [ ] Follows Diátaxis principles

## Getting Help

- **Framework questions:** [Diátaxis documentation](https://diataxis.fr/)
- **Validation errors:** See [MAINTENANCE.md](MAINTENANCE.md#troubleshooting)
- **Writing questions:** Check existing docs in the category
- **Technical questions:** Open an issue with `documentation` label

## File Locations

| Type | Location | INDEX Required |
|------|----------|----------------|
| Tutorials | `docs/tutorials/` | ✅ |
| How-To | `docs/how-to/` | ✅ |
| Reference | `docs/reference/` | ✅ |
| Explanation | `docs/explanation/` | ✅ |
| Scripts | `docs/scripts/` | ❌ |
| Assets | `docs/assets/` | ❌ |

## Quality Standards

All documentation must:

1. **Be accurate** - Test all code examples
2. **Be clear** - Use simple language, avoid jargon
3. **Be complete** - Cover the topic thoroughly
4. **Be consistent** - Follow framework and style
5. **Be maintained** - Update `last_updated` field when changed

Thank you for helping improve our documentation.
