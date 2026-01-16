---
title: Secure Clipboard and Memory
description: Security utilities for handling sensitive data with automatic clipboard clearing and memory-safe string handling
category: features
tags: [security, clipboard, memory, privacy, sensitive-data]
last_updated: 2025-01-15
---

# Secure Clipboard and Memory

This document describes the security utilities for handling sensitive data like private keys and mnemonics.

## Table of Contents

1. [Overview](#overview)
2. [SecureString](#securestring)
3. [SecureClipboard](#secureclipboard)
4. [Usage Examples](#usage-examples)
5. [Security Considerations](#security-considerations)

---

## Overview

The security module (`src/lib/security/secureMemory.ts`) provides two key utilities:

| Utility | Purpose |
|---------|---------|
| `SecureString` | Memory-safe handling of sensitive strings |
| `SecureClipboard` | Automatic clipboard clearing after timeout |

These utilities help prevent sensitive data from persisting in memory or clipboard longer than necessary.

---

## SecureString

A wrapper for sensitive string data that provides controlled access and secure clearing.

### Location

`src/lib/security/secureMemory.ts`

### API

```typescript
class SecureString {
  constructor(value: string);
  use<T>(fn: (value: string) => T): T;
  clear(): void;
  isCleared(): boolean;
  get length(): number;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `constructor(value)` | Create a SecureString from a plain string |
| `use(fn)` | Execute a function with access to the value |
| `clear()` | Securely wipe the buffer |
| `isCleared()` | Check if already cleared |
| `length` | Get byte length (without exposing value) |

### How It Works

1. **Encoding**: The string is immediately encoded to a `Uint8Array`
2. **Immutability**: The object is frozen to prevent modification
3. **Controlled Access**: Only accessible via the `use()` callback
4. **Secure Clearing**: Overwritten with random data before zeroing

### Example

```typescript
import { SecureString } from '$lib/security/secureMemory';

// Create secure string from nsec
const secureNsec = new SecureString(nsec);

// Use the value (callback pattern limits exposure)
const signature = secureNsec.use(key => {
  return signEvent(event, key);
});

// Clear when no longer needed
secureNsec.clear();

// Attempting to use after clear throws
try {
  secureNsec.use(k => k); // Throws Error
} catch (e) {
  console.log('SecureString already cleared');
}
```

---

## SecureClipboard

A utility for copying sensitive data to clipboard with automatic clearing.

### API

```typescript
class SecureClipboard {
  static async copyWithAutoClear(
    data: string,
    clearDelay?: number,
    onWarning?: () => void,
    onCleared?: () => void
  ): Promise<{ clearIn: number; cancel: () => void }>;

  static async clearClipboard(): Promise<void>;
  static cancelAllClears(): void;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `copyWithAutoClear(data, delay, onWarning, onCleared)` | Copy with auto-clear |
| `clearClipboard()` | Immediately clear clipboard |
| `cancelAllClears()` | Cancel all pending clear timers |

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `string` | required | Sensitive data to copy |
| `clearDelay` | `number` | `60000` | Milliseconds before clearing (60s) |
| `onWarning` | `() => void` | `undefined` | Called 10 seconds before clear |
| `onCleared` | `() => void` | `undefined` | Called when clipboard cleared |

### Return Value

```typescript
{
  clearIn: number;      // Milliseconds until clear
  cancel: () => void;   // Function to cancel auto-clear
}
```

### Example

```typescript
import { SecureClipboard } from '$lib/security/secureMemory';

// Copy nsec with 60-second auto-clear
const { clearIn, cancel } = await SecureClipboard.copyWithAutoClear(
  nsec,
  60000,
  () => toast.warning('Clipboard clearing in 10 seconds'),
  () => toast.info('Clipboard cleared for security')
);

// User can manually cancel if needed
// cancel();

// Or immediately clear
// await SecureClipboard.clearClipboard();
```

---

## Usage Examples

### Signup Flow - Key Backup

```svelte
<script>
  import { SecureClipboard } from '$lib/security/secureMemory';

  let nsec: string;
  let copyStatus = '';
  let clearTimer: { cancel: () => void } | null = null;

  async function copyNsec() {
    clearTimer = await SecureClipboard.copyWithAutoClear(
      nsec,
      60000,
      () => { copyStatus = 'Clearing in 10s...'; },
      () => { copyStatus = 'Cleared'; clearTimer = null; }
    );
    copyStatus = 'Copied! Auto-clears in 60s';
  }

  function cancelClear() {
    clearTimer?.cancel();
    clearTimer = null;
    copyStatus = 'Auto-clear cancelled';
  }
</script>

<button on:click={copyNsec}>Copy Key</button>
<span>{copyStatus}</span>
{#if clearTimer}
  <button on:click={cancelClear}>Keep in clipboard</button>
{/if}
```

### Key Derivation - Temporary Access

```typescript
import { SecureString } from '$lib/security/secureMemory';

async function deriveKeys(mnemonic: string) {
  const secureMnemonic = new SecureString(mnemonic);

  try {
    const keys = secureMnemonic.use(m => {
      const seed = mnemonicToSeed(m);
      return deriveNostrKeys(seed);
    });

    return keys;
  } finally {
    // Always clear, even if derivation throws
    secureMnemonic.clear();
  }
}
```

### Component Cleanup

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { SecureClipboard } from '$lib/security/secureMemory';

  // Cancel any pending clipboard clears when component unmounts
  onDestroy(() => {
    SecureClipboard.cancelAllClears();
  });
</script>
```

---

## Security Considerations

### What This Protects Against

| Threat | Protection |
|--------|------------|
| Clipboard sniffing | Auto-clear after 60 seconds |
| Memory inspection | Random overwrite before zero |
| Accidental logging | Callback pattern prevents `.toString()` |
| Persistent exposure | Explicit clear required |

### Limitations

| Limitation | Explanation |
|------------|-------------|
| JavaScript GC | Cannot guarantee immediate string cleanup |
| Browser clipboard | Clear may fail if page loses focus |
| Process memory | OS may cache clipboard contents |
| Hardware attacks | Cannot protect against physical access |

### Best Practices

1. **Clear ASAP**: Call `clear()` as soon as the value is no longer needed
2. **Use callbacks**: Prefer `use()` over extracting the value
3. **Handle focus loss**: Clipboard clear may fail if user switches tabs
4. **Warn users**: Display countdown before auto-clear
5. **Test edge cases**: Verify behaviour on mobile browsers

### Implementation Notes

The `SecureString` implementation:

```typescript
clear(): void {
  if (this.cleared) return;

  // Overwrite with random data first
  crypto.getRandomValues(this.buffer);

  // Then replace with empty buffer
  this.buffer = new Uint8Array(0);
  this.cleared = true;
}
```

The random overwrite ensures the original data is not simply dereferenced but actively replaced before the buffer is released.

---

## Related Documentation

- [Authentication](./authentication.md)
- [Admin Security Hardening](../security/admin-security.md)
- [User Guide - Understanding Your Keys](../user-guide.md#understanding-your-keys)

---

*Last updated: January 2025*
