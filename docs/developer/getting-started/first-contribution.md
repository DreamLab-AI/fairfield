---
title: "First Contribution"
description: "Make your first code change to the platform."
category: tutorial
tags: ['developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# First Contribution

Make your first code change to the platform.

---

## Overview

This guide walks you through making your first contribution, from finding an issue to submitting a pull request.

---

## Step 1: Find an Issue

### Good First Issues

Look for issues labelled `good first issue` or `help wanted`:

```bash
# List good first issues (if using GitHub CLI)
gh issue list --label "good first issue"
```

**Ideal first contributions:**
- Documentation improvements
- Bug fixes with clear reproduction steps
- Small UI enhancements
- Test coverage improvements

### Claim the Issue

Comment on the issue to indicate you're working on it:

> "I'd like to work on this issue. I'll have a PR ready within [timeframe]."

---

## Step 2: Set Up Your Branch

### Create a Feature Branch

```bash
# Ensure you're on main and up-to-date
git checkout main
git pull origin main

# Create a descriptive branch name
git checkout -b fix/message-timestamp-display

# Or for features
git checkout -b feature/emoji-reactions
```

**Branch naming conventions:**
- `fix/` — Bug fixes
- `feature/` — New features
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions

---

## Step 3: Make Your Changes

### Example: Fix a Bug

Let's fix a hypothetical bug where message timestamps display incorrectly.

**1. Locate the relevant code:**

```bash
# Search for timestamp-related code
grep -r "timestamp" src/lib/components/chat/
```

**2. Understand the existing code:**

```typescript
// src/lib/components/chat/MessageBubble.svelte
<script lang="ts">
  import { formatDistanceToNow } from 'date-fns';

  export let message: Message;

  // Bug: Using wrong property
  $: timestamp = formatDistanceToNow(message.timestamp);
</script>

<span class="text-xs text-gray-500">{timestamp}</span>
```

**3. Make the fix:**

```typescript
// src/lib/components/chat/MessageBubble.svelte
<script lang="ts">
  import { formatDistanceToNow } from 'date-fns';

  export let message: Message;

  // Fix: Use created_at (Nostr standard) and convert from Unix timestamp
  $: timestamp = formatDistanceToNow(new Date(message.created_at * 1000), {
    addSuffix: true
  });
</script>

<span class="text-xs text-gray-500">{timestamp}</span>
```

**4. Test your change:**

```bash
# Run the development server
npm run dev

# Run type checking
npm run check

# Run tests
npm run test
```

---

## Step 4: Write Tests

### Add a Test for Your Fix

```typescript
// tests/unit/components/MessageBubble.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MessageBubble from '$components/chat/MessageBubble.svelte';

describe('MessageBubble', () => {
  it('displays relative timestamp correctly', () => {
    const message = {
      id: 'test-id',
      content: 'Hello world',
      created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      pubkey: 'test-pubkey'
    };

    render(MessageBubble, { props: { message } });

    expect(screen.getByText(/hour ago/)).toBeInTheDocument();
  });
});
```

### Run Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- MessageBubble

# Run with coverage
npm run test -- --coverage
```

---

## Step 5: Commit Your Changes

### Write a Good Commit Message

Follow the conventional commits format:

```bash
git add .
git commit -m "fix(chat): correct message timestamp display

- Use created_at instead of timestamp property
- Convert Unix timestamp to JavaScript Date
- Add relative time formatting with suffix

Fixes #123"
```

**Commit message format:**
```
type(scope): short description

Longer description if needed.

Fixes #issue-number
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting (no code change)
- `refactor` — Code restructuring
- `test` — Adding tests
- `chore` — Maintenance tasks

---

## Step 6: Push and Create PR

### Push Your Branch

```bash
git push -u origin fix/message-timestamp-display
```

### Create a Pull Request

**Using GitHub CLI:**

```bash
gh pr create --title "fix(chat): correct message timestamp display" --body "
## Summary

Fixes incorrect timestamp display in chat messages.

## Changes

- Use \`created_at\` property (Nostr standard) instead of \`timestamp\`
- Convert Unix timestamp to JavaScript Date object
- Add relative time formatting with 'ago' suffix

## Testing

- [x] Added unit test for timestamp formatting
- [x] Manually tested in development
- [x] Type checking passes

## Related Issues

Fixes #123
"
```

**Or via GitHub web interface:**

1. Go to the repository on GitHub
2. Click "Compare & pull request" for your branch
3. Fill in the PR template
4. Request reviewers

---

## Step 7: Address Review Feedback

### Respond to Comments

- Address all reviewer comments
- Ask clarifying questions if needed
- Make requested changes promptly

### Update Your PR

```bash
# Make additional changes
git add .
git commit -m "address review feedback: improve error handling"

# Push to update the PR
git push
```

### Squash Commits (if requested)

```bash
# Interactive rebase to squash commits
git rebase -i HEAD~3

# Force push (only to your feature branch)
git push --force-with-lease
```

---

## Code Style Checklist

Before submitting, ensure:

- [ ] Code follows project style guide
- [ ] TypeScript types are properly defined
- [ ] No `any` types without justification
- [ ] Components are properly documented
- [ ] Tests cover the change
- [ ] No console.log statements left in
- [ ] Imports are organised
- [ ] No unused variables or imports

### Run All Checks

```bash
# Run the full check suite
npm run check && npm run lint && npm run test
```

---

## Example Contributions

### Documentation Fix

```bash
# Create branch
git checkout -b docs/fix-typo-in-readme

# Make changes to documentation
# ...

# Commit
git commit -m "docs: fix typo in installation instructions"

# Push and create PR
git push -u origin docs/fix-typo-in-readme
gh pr create --title "docs: fix typo in installation instructions"
```

### Add a New Component

```bash
# Create branch
git checkout -b feature/loading-spinner

# Create component file
# src/lib/components/ui/LoadingSpinner.svelte

# Add tests
# tests/unit/components/LoadingSpinner.test.ts

# Commit
git commit -m "feat(ui): add LoadingSpinner component"

# Push and create PR
```

---

## Getting Help

### Stuck on Something?

- Check existing documentation
- Search closed issues for similar problems
- Ask in the `#development` channel
- Open a draft PR for early feedback

### Code Review Taking Long?

- Ensure CI checks pass
- Ping reviewers politely after 2-3 days
- Keep PRs small and focused for faster reviews

---

## Related Documentation

- [Development Setup](development-setup.md) — Environment setup
- [Code Style](../contributing/code-style.md) — Coding standards
- [Pull Requests](../contributing/pull-requests.md) — PR guidelines
- [Testing](../contributing/testing.md) — Testing guide

---

[← Back to Developer Documentation](../index.md)
