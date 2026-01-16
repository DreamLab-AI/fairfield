---
title: "Code Style Guide"
description: "Coding standards and conventions for the project."
category: tutorial
tags: ['developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Code Style Guide

Coding standards and conventions for the project.

---

## Overview

Consistent code style improves readability and maintainability. We use automated tools where possible.

---

## Automated Formatting

### Prettier

All code is formatted with Prettier. Configuration in `.prettierrc`:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100
}
```

**Run formatting:**

```bash
npm run format
```

### ESLint

Code quality is checked with ESLint. Configuration in `.eslintrc.cjs`.

**Run linting:**

```bash
npm run lint
```

---

## TypeScript

### Strict Mode

We use strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Type Annotations

```typescript
// ✅ Good: Explicit types for function signatures
function formatMessage(content: string, maxLength: number): string {
  return content.slice(0, maxLength);
}

// ✅ Good: Interface for complex objects
interface Message {
  id: string;
  content: string;
  pubkey: string;
  created_at: number;
}

// ❌ Bad: Using `any`
function processData(data: any): any {
  return data;
}

// ✅ Good: Use `unknown` when type is truly unknown
function parseJSON(json: string): unknown {
  return JSON.parse(json);
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `messageCount` |
| Functions | camelCase | `sendMessage()` |
| Classes | PascalCase | `MessageService` |
| Interfaces | PascalCase | `Message` |
| Types | PascalCase | `MessageStatus` |
| Constants | SCREAMING_SNAKE | `MAX_MESSAGE_LENGTH` |
| Files | kebab-case | `message-service.ts` |
| Components | PascalCase | `MessageBubble.svelte` |

---

## Svelte Components

### Component Structure

Order sections consistently:

```svelte
<script lang="ts">
  // 1. Imports
  import { onMount } from 'svelte';
  import Button from '$components/ui/Button.svelte';

  // 2. Props
  export let message: Message;
  export let compact = false;

  // 3. Local state
  let isExpanded = false;

  // 4. Derived values
  $: displayName = message.author?.name || 'Anonymous';

  // 5. Functions
  function handleClick() {
    isExpanded = !isExpanded;
  }

  // 6. Lifecycle
  onMount(() => {
    // ...
  });
</script>

<!-- Template -->
<div class="message" class:compact>
  <span>{displayName}</span>
  <p>{message.content}</p>
</div>

<style>
  /* Scoped styles */
  .message {
    padding: 1rem;
  }
</style>
```

### Props

```svelte
<script lang="ts">
  // ✅ Good: Typed props with defaults
  export let message: Message;
  export let showAvatar = true;
  export let onDelete: ((id: string) => void) | undefined = undefined;

  // ❌ Bad: Untyped props
  export let data;
</script>
```

### Events

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // ✅ Good: Typed event dispatcher
  const dispatch = createEventDispatcher<{
    select: { id: string };
    delete: { id: string };
  }>();

  function handleSelect() {
    dispatch('select', { id: message.id });
  }
</script>

<button on:click={handleSelect}>Select</button>
```

### Reactive Statements

```svelte
<script lang="ts">
  // ✅ Good: Clear reactive dependencies
  $: fullName = `${firstName} ${lastName}`;
  $: isValid = email.includes('@') && password.length >= 8;

  // ✅ Good: Reactive blocks for side effects
  $: {
    if (isValid) {
      validateForm();
    }
  }

  // ❌ Bad: Complex logic in reactive statement
  $: result = data.filter(x => x.active).map(x => x.value).reduce((a, b) => a + b, 0);

  // ✅ Good: Extract to function
  $: result = calculateTotal(data);

  function calculateTotal(items: Item[]): number {
    return items
      .filter(x => x.active)
      .map(x => x.value)
      .reduce((a, b) => a + b, 0);
  }
</script>
```

---

## CSS/Styling

### Tailwind Classes

Prefer Tailwind utility classes:

```svelte
<!-- ✅ Good: Tailwind utilities -->
<button class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
  Submit
</button>

<!-- ❌ Avoid: Custom CSS for basic styling -->
<style>
  .custom-button {
    padding: 0.5rem 1rem;
    background: purple;
    /* ... */
  }
</style>
```

### When to Use `<style>`

Use scoped styles for:
- Complex animations
- Dynamic styles not covered by Tailwind
- Component-specific overrides

```svelte
<style>
  /* Scoped to this component */
  .message {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateY(10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
```

### Class Organisation

Order Tailwind classes logically:

```html
<!-- Layout → Spacing → Size → Typography → Colours → Effects -->
<div class="flex items-center gap-4 p-4 w-full text-sm text-gray-600 bg-white rounded-lg shadow-md">
```

---

## Functions

### Function Length

Keep functions short and focused:

```typescript
// ✅ Good: Single responsibility
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 8;
}

function validateForm(email: string, password: string): boolean {
  return validateEmail(email) && validatePassword(password);
}

// ❌ Bad: Too many responsibilities
function validateAndSubmitForm(email, password, name, ...) {
  // 50+ lines of mixed validation and submission logic
}
```

### Error Handling

```typescript
// ✅ Good: Explicit error handling
async function fetchMessages(channelId: string): Promise<Message[]> {
  try {
    const events = await ndk.fetchEvents({ kinds: [9], '#h': [channelId] });
    return Array.from(events).map(parseMessage);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    throw new Error(`Failed to load messages for channel ${channelId}`);
  }
}

// ✅ Good: Return type includes error state
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function sendMessage(content: string): Promise<Result<Message>> {
  try {
    const message = await publishMessage(content);
    return { success: true, data: message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Async/Await

```typescript
// ✅ Good: async/await
async function loadData(): Promise<void> {
  const users = await fetchUsers();
  const messages = await fetchMessages();
  // ...
}

// ✅ Good: Parallel when independent
async function loadData(): Promise<void> {
  const [users, messages] = await Promise.all([
    fetchUsers(),
    fetchMessages()
  ]);
}

// ❌ Bad: Unnecessary .then()
function loadData() {
  return fetchUsers().then(users => {
    return fetchMessages().then(messages => {
      // ...
    });
  });
}
```

---

## Imports

### Import Order

1. External packages
2. Internal aliases (`$lib`, `$components`, etc.)
3. Relative imports
4. Types (at the end)

```typescript
// 1. External
import { onMount } from 'svelte';
import { get } from 'svelte/store';

// 2. Internal aliases
import Button from '$components/ui/Button.svelte';
import { messages } from '$stores/messages';
import { sendMessage } from '$services/messaging';

// 3. Relative
import './styles.css';

// 4. Types
import type { Message, Channel } from '$types';
```

### Named vs Default Exports

```typescript
// ✅ Prefer named exports
export function sendMessage() { }
export const MESSAGE_LIMIT = 50;

// ✅ Default for components
export default MessageBubble;

// ❌ Avoid: Multiple defaults
export default { sendMessage, MESSAGE_LIMIT };
```

---

## Comments

### When to Comment

```typescript
// ✅ Good: Explain "why", not "what"
// NIP-44 requires converting Unix timestamp to milliseconds
const date = new Date(event.created_at * 1000);

// ✅ Good: Document complex algorithms
// Using binary search for O(log n) lookup in sorted array
function findMessage(id: string): Message | undefined {
  // ...
}

// ❌ Bad: Stating the obvious
// Increment counter by 1
count++;

// ❌ Bad: Outdated comments
// FIXME: Legacy workaround from v1.0
```

### JSDoc

Use for public APIs:

```typescript
/**
 * Send a message to a channel.
 *
 * @param channelId - The channel identifier
 * @param content - Message content (max 10000 chars)
 * @param options - Optional settings
 * @returns The published event
 * @throws {Error} If not authenticated
 *
 * @example
 * ```ts
 * const event = await sendMessage('channel-123', 'Hello!');
 * ```
 */
export async function sendMessage(
  channelId: string,
  content: string,
  options?: SendOptions
): Promise<NDKEvent> {
  // ...
}
```

---

## Related Documentation

- [Testing](testing.md) — Testing guidelines
- [Pull Requests](pull-requests.md) — PR process
- [Project Structure](../getting-started/project-structure.md) — File organisation

---

[← Back to Developer Documentation](../index.md)
