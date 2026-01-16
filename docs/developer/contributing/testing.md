---
title: "Testing Guide"
description: "Testing guidelines and best practices."
category: tutorial
tags: ['developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Testing Guide

Testing guidelines and best practices.

---

## Overview

The project uses:

- **Vitest** — Unit and integration tests
- **Testing Library** — Component testing
- **Playwright** — End-to-end tests (optional)

---

## Running Tests

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific file
npm run test -- MessageBubble

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

---

## Test Structure

```
tests/
├── unit/
│   ├── components/
│   │   ├── MessageBubble.test.ts
│   │   └── Button.test.ts
│   ├── services/
│   │   ├── messaging.test.ts
│   │   └── auth.test.ts
│   ├── stores/
│   │   └── messages.test.ts
│   └── utils/
│       └── formatting.test.ts
├── integration/
│   ├── auth.test.ts
│   ├── messaging.test.ts
│   └── calendar.test.ts
├── e2e/
│   └── flows/
│       ├── login.test.ts
│       └── messaging.test.ts
└── fixtures/
    ├── events.ts
    ├── users.ts
    └── channels.ts
```

---

## Unit Tests

### Component Testing

```typescript
// tests/unit/components/Button.test.ts
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Button from '$components/ui/Button.svelte';

describe('Button', () => {
  it('renders with default props', () => {
    render(Button, { props: { children: 'Click me' } });
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    render(Button, { props: { variant: 'primary' } });
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { component } = render(Button);
    component.$on('click', handleClick);

    await fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when loading', () => {
    render(Button, { props: { loading: true } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows spinner when loading', () => {
    render(Button, { props: { loading: true } });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
```

### Store Testing

```typescript
// tests/unit/stores/messages.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { messages, channelMessages } from '$stores/messages';

describe('messages store', () => {
  beforeEach(() => {
    // Reset store before each test
    messages.reset();
  });

  it('adds a message to a channel', () => {
    const message = {
      id: 'msg-1',
      content: 'Hello',
      pubkey: 'user-1',
      created_at: Date.now()
    };

    messages.addMessage('channel-1', message);

    const $messages = get(messages);
    expect($messages.messages.get('channel-1')).toContainEqual(message);
  });

  it('removes a message', () => {
    messages.addMessage('channel-1', { id: 'msg-1', content: 'Hello' });
    messages.removeMessage('channel-1', 'msg-1');

    const $messages = get(messages);
    expect($messages.messages.get('channel-1')).toHaveLength(0);
  });

  it('sorts messages by timestamp', () => {
    messages.addMessage('channel-1', { id: '2', created_at: 200 });
    messages.addMessage('channel-1', { id: '1', created_at: 100 });
    messages.addMessage('channel-1', { id: '3', created_at: 300 });

    const $channelMsgs = get(channelMessages('channel-1'));
    expect($channelMsgs.map(m => m.id)).toEqual(['1', '2', '3']);
  });

  it('prevents duplicate messages', () => {
    const message = { id: 'msg-1', content: 'Hello' };

    messages.addMessage('channel-1', message);
    messages.addMessage('channel-1', message);

    const $messages = get(messages);
    expect($messages.messages.get('channel-1')).toHaveLength(1);
  });
});
```

### Service Testing

```typescript
// tests/unit/services/messaging.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, deleteMessage } from '$services/messaging';
import { ndk } from '$stores/ndk';
import { auth } from '$stores/auth';

// Mock stores
vi.mock('$stores/ndk', () => ({
  ndk: {
    subscribe: vi.fn()
  }
}));

vi.mock('$stores/auth', () => ({
  auth: {
    subscribe: vi.fn()
  }
}));

describe('messaging service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('creates and publishes an event', async () => {
      const mockPublish = vi.fn().mockResolvedValue(undefined);
      const mockNdk = {
        publish: mockPublish
      };

      // Set up mock state
      vi.mocked(ndk.subscribe).mockImplementation((fn) => {
        fn(mockNdk);
        return () => {};
      });

      await sendMessage('channel-1', 'Hello world');

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 9,
          content: 'Hello world'
        })
      );
    });

    it('throws when not authenticated', async () => {
      vi.mocked(auth.subscribe).mockImplementation((fn) => {
        fn({ isAuthenticated: false, pubkey: null });
        return () => {};
      });

      await expect(sendMessage('channel-1', 'Hello')).rejects.toThrow(
        'Not authenticated'
      );
    });
  });
});
```

### Utility Testing

```typescript
// tests/unit/utils/formatting.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatDisplayName,
  truncate
} from '$utils/formatting';

describe('formatRelativeTime', () => {
  it('formats seconds ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 30)).toBe('30 seconds ago');
  });

  it('formats minutes ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 300)).toBe('5 minutes ago');
  });

  it('formats hours ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 7200)).toBe('2 hours ago');
  });
});

describe('truncate', () => {
  it('returns original if under limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('Hello world', 8)).toBe('Hello...');
  });
});
```

---

## Integration Tests

```typescript
// tests/integration/messaging.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestRelay, teardownTestRelay } from '../helpers/relay';

describe('Messaging Integration', () => {
  beforeAll(async () => {
    await setupTestRelay();
  });

  afterAll(async () => {
    await teardownTestRelay();
  });

  it('sends and receives messages', async () => {
    // Create two users
    const user1 = await createTestUser();
    const user2 = await createTestUser();

    // User 1 sends message
    await sendMessage('test-channel', 'Hello from user 1', user1);

    // User 2 receives message
    const messages = await loadMessages('test-channel', user2);

    expect(messages).toContainEqual(
      expect.objectContaining({
        content: 'Hello from user 1',
        pubkey: user1.pubkey
      })
    );
  });

  it('deletes messages', async () => {
    const user = await createTestUser();

    // Send message
    const event = await sendMessage('test-channel', 'To be deleted', user);

    // Delete message
    await deleteMessage('test-channel', event.id, user);

    // Verify deletion
    const messages = await loadMessages('test-channel', user);
    expect(messages.find(m => m.id === event.id)).toBeUndefined();
  });
});
```

---

## Test Fixtures

```typescript
// tests/fixtures/events.ts
import type { NDKEvent } from '@nostr-dev-kit/ndk';

export const mockMessage: Partial<NDKEvent> = {
  id: 'event-123',
  kind: 9,
  content: 'Test message',
  pubkey: 'pubkey-123',
  created_at: 1704067200,
  tags: [['h', 'channel-123']]
};

export const mockUser = {
  pubkey: 'pubkey-123',
  profile: {
    name: 'Test User',
    picture: 'https://example.com/avatar.png'
  }
};

export function createMockMessage(
  overrides: Partial<NDKEvent> = {}
): NDKEvent {
  return {
    ...mockMessage,
    id: `event-${Date.now()}-${Math.random()}`,
    created_at: Math.floor(Date.now() / 1000),
    ...overrides
  } as NDKEvent;
}
```

---

## Mocking

### Mocking Modules

```typescript
// Mock entire module
vi.mock('$services/messaging', () => ({
  sendMessage: vi.fn(),
  loadMessages: vi.fn().mockResolvedValue([])
}));

// Mock with implementation
vi.mock('$stores/auth', () => ({
  auth: {
    subscribe: vi.fn((fn) => {
      fn({
        isAuthenticated: true,
        pubkey: 'test-pubkey'
      });
      return () => {};
    })
  }
}));
```

### Mocking Timers

```typescript
import { vi } from 'vitest';

describe('timeout handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects after timeout', async () => {
    const reconnect = vi.fn();

    startConnectionWithTimeout(5000, reconnect);

    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);

    expect(reconnect).toHaveBeenCalled();
  });
});
```

---

## Coverage

### Coverage Requirements

- **Statements:** 80%
- **Branches:** 75%
- **Functions:** 80%
- **Lines:** 80%

### View Coverage Report

```bash
npm run test:coverage

# Opens HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    }
  }
});
```

---

## Best Practices

### Test Organisation

```typescript
describe('ComponentName', () => {
  // Group by feature
  describe('rendering', () => {
    it('renders with default props', () => {});
    it('renders with custom props', () => {});
  });

  describe('interactions', () => {
    it('handles click', () => {});
    it('handles keyboard', () => {});
  });

  describe('edge cases', () => {
    it('handles empty data', () => {});
    it('handles error state', () => {});
  });
});
```

### Test Naming

```typescript
// ✅ Good: Describes behaviour
it('displays error message when validation fails', () => {});
it('sorts messages by timestamp ascending', () => {});

// ❌ Bad: Implementation details
it('calls validateForm function', () => {});
it('sets state.error to true', () => {});
```

### Avoid Test Interdependence

```typescript
// ✅ Good: Each test is independent
beforeEach(() => {
  store.reset();
});

// ❌ Bad: Tests depend on order
it('adds item', () => { store.add(item); });
it('removes item', () => { store.remove(item); }); // Depends on previous test
```

---

## Related Documentation

- [Code Style](code-style.md) — Coding standards
- [Pull Requests](pull-requests.md) — PR process
- [Development Setup](../getting-started/development-setup.md) — Environment setup

---

[← Back to Developer Documentation](../index.md)
