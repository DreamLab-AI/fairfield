---
title: "NIP-07 Browser Extension Support Analysis"
description: "**Date**: 2026-01-16 **Status**: Incomplete Implementation **Priority**: High (Security & UX Enhancement)"
category: tutorial
tags: ['developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# NIP-07 Browser Extension Support Analysis

**Date**: 2026-01-16
**Status**: Incomplete Implementation
**Priority**: High (Security & UX Enhancement)

---

## Executive Summary

NIP-07 browser extension support is **documented but not implemented** in the codebase. While the architecture includes extension login as a design goal and types are defined, no functional code exists to detect, connect, or use browser extensions like Alby or nos2x for authentication.

---

## Current Implementation Status

### ✅ What Exists

1. **Type Definitions** (`src/types/nostr.ts`)
   - `NIP07Signer` interface with proper method signatures (lines 111-123)
   - Includes `getPublicKey()`, `signEvent()`, `getRelays()`, NIP-04/44 encryption support

2. **Auth Types** (`src/types/auth.ts`)
   - `LoginMethod` includes `'extension'` as valid option (line 36)
   - `ExtensionDetectionResult` interface defined
   - `ExtensionType` = `'alby' | 'nos2x' | 'unknown'`

3. **Documentation**
   - `docs/AUTH_IMPLEMENTATION_GUIDE.md` has full NIP-07 implementation code (lines 526-605)
   - `docs/AUTH_FLOW_DESIGN.md` mentions extension login flow
   - ADR-007 references `NDKNip07Signer` in architecture

4. **UI Hints**
   - SimpleLogin.svelte mentions extensions in UI text (line 149)
   - States "Login with Recovery Phrase or Browser Extension"

### ❌ What's Missing (Critical Gaps)

#### 1. **No Extension Detection**
```bash
# Search results: NO window.nostr usage in source files
grep -r "window\.nostr" src --include="*.ts" --include="*.svelte"
# Returns: NO RESULTS
```

#### 2. **No NDK Integration**
- **File**: `src/lib/nostr/ndk.ts`
- **Line 92**: Only uses `NDKPrivateKeySigner(privateKey)`
- **Missing**: Conditional signer based on auth method
```typescript
// Current (line 88-94):
export function setSigner(privateKey: string): void {
  const instance = getNDK();
  const signer = new NDKPrivateKeySigner(privateKey);
  instance.signer = signer;
}

// Missing: Extension signer support
```

#### 3. **No Auth Store Methods**
- **File**: `src/lib/stores/auth.ts`
- Has: `setKeys()`, `unlock()`, `logout()`
- **Missing**:
  - `loginWithExtension()`
  - `setExtensionKeys(pubkey)`
  - Extension session restoration
  - Signer type tracking

#### 4. **No Utility Functions**
- **Missing file**: `src/lib/utils/nip07.ts`
- Documented but not implemented:
  - `detectExtensions(): Promise<ExtensionType[]>`
  - `getExtensionPublicKey(): Promise<string>`
  - `signWithExtension(event): Promise<NostrEvent>`

#### 5. **No UI Components**
- SimpleLogin.svelte has text but no button logic
- No ExtensionLogin component
- No extension availability indicator
- No permission request handling

---

## Architecture Analysis

### Current Auth Flow (nsec-only)

```
User Input (nsec/hex)
  ↓
authStore.setKeys(pubkey, privkey)
  ↓
ndk.setSigner(new NDKPrivateKeySigner(privkey))
  ↓
Session stored with privkey
  ↓
All events signed with privkey
```

### Desired Extension Flow (not implemented)

```
User clicks "Connect Extension"
  ↓
Detect window.nostr (MISSING)
  ↓
Request pubkey via window.nostr.getPublicKey() (MISSING)
  ↓
authStore.setExtensionKeys(pubkey) (MISSING)
  ↓
ndk.setSigner(new NDKNip07Signer()) (MISSING)
  ↓
Session stored (pubkey only, no privkey)
  ↓
Events signed via window.nostr.signEvent() (MISSING)
```

---

## Detailed Gap Analysis

### 1. NDK Signer Setup (Critical)

**Current**:
- `ndk.ts` only supports `NDKPrivateKeySigner`
- Hardcoded to use private keys
- No conditional logic for signer type

**Needed**:
```typescript
// src/lib/nostr/ndk.ts additions
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';

export function setExtensionSigner(): void {
  const instance = getNDK();
  const signer = new NDKNip07Signer();
  instance.signer = signer;
}

export function clearSigner(): void {
  if (!browser || !ndkInstance) return;
  ndkInstance.signer = undefined;
}

// Conditional signer setup
export function initializeSigner(authType: 'privkey' | 'extension', privkey?: string) {
  if (authType === 'extension') {
    setExtensionSigner();
  } else if (privkey) {
    setSigner(privkey);
  }
}
```

### 2. Auth Store Integration (High Priority)

**Current**:
- Only handles privkey-based auth
- `setKeys()` requires both pubkey AND privkey
- No extension-specific methods

**Needed** (`src/lib/stores/auth.ts`):
```typescript
// Add to AuthState interface
export interface AuthState {
  // ... existing fields
  signerType: 'privkey' | 'extension';
  extensionType?: 'alby' | 'nos2x' | 'unknown';
}

// New methods needed
setExtensionKeys: async (publicKey: string, extensionType?: ExtensionType) => {
  // Store pubkey only, no privkey
  // Mark as extension login
  // Set signer type
}

loginWithExtension: async () => {
  // Detect extension
  // Request pubkey
  // Initialize NDKNip07Signer
  // Save session
}
```

### 3. Extension Detection (High Priority)

**Missing file**: `src/lib/utils/nip07.ts`

**Needed** (based on docs/AUTH_IMPLEMENTATION_GUIDE.md):
```typescript
/**
 * Detect if NIP-07 extension is available
 */
export async function detectExtension(): Promise<boolean> {
  if (!browser) return false;
  return typeof window.nostr !== 'undefined';
}

/**
 * Get extension type (Alby, nos2x, etc.)
 */
export async function getExtensionType(): Promise<ExtensionType> {
  if (!window.nostr) return 'unknown';
  // Check user agent or extension-specific properties
  if (navigator.userAgent.includes('Alby')) return 'alby';
  if (navigator.userAgent.includes('nos2x')) return 'nos2x';
  return 'unknown';
}

/**
 * Get public key from extension
 */
export async function getExtensionPublicKey(): Promise<string> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected');
  }

  try {
    const pubkey = await window.nostr.getPublicKey();
    return pubkey;
  } catch (err) {
    if (err instanceof Error && err.message.includes('denied')) {
      throw new Error('User denied permission');
    }
    throw new Error('Failed to get public key from extension');
  }
}

/**
 * Sign event with extension
 */
export async function signWithExtension(
  event: Omit<NostrEvent, 'sig' | 'id'>
): Promise<NostrEvent> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected');
  }

  try {
    const signed = await window.nostr.signEvent(event as NostrEvent);
    return signed;
  } catch (err) {
    throw new Error('Failed to sign event with extension');
  }
}
```

### 4. UI Components (Medium Priority)

**New Component**: `src/lib/components/auth/ExtensionLogin.svelte`
```svelte
<script lang="ts">
  import { detectExtension, getExtensionPublicKey } from '$lib/utils/nip07';
  import { authStore } from '$lib/stores/auth';

  let extensionAvailable = false;
  let isLoading = false;
  let error = '';

  onMount(async () => {
    extensionAvailable = await detectExtension();
  });

  async function handleExtensionLogin() {
    isLoading = true;
    error = '';

    try {
      const pubkey = await getExtensionPublicKey();
      await authStore.loginWithExtension(pubkey);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Extension login failed';
    } finally {
      isLoading = false;
    }
  }
</script>

{#if extensionAvailable}
  <button
    class="btn btn-primary"
    on:click={handleExtensionLogin}
    disabled={isLoading}
  >
    {#if isLoading}
      <span class="loading loading-spinner"></span>
      Connecting...
    {:else}
      Connect with Browser Extension
    {/if}
  </button>
{:else}
  <p class="text-sm text-base-content/60">
    No browser extension detected. Install <a href="https://getalby.com" class="link">Alby</a> or <a href="https://github.com/fiatjaf/nos2x" class="link">nos2x</a>.
  </p>
{/if}

{#if error}
  <div class="alert alert-error">
    <span>{error}</span>
  </div>
{/if}
```

**Update**: `src/lib/components/auth/SimpleLogin.svelte`
- Import ExtensionLogin component
- Add conditional rendering
- Wire up loginWithExtension event

### 5. Session Management (Medium Priority)

**Current**: Stores both pubkey and privkey in localStorage

**Needed**: Extension sessions should store pubkey only
```typescript
// src/lib/stores/auth.ts - update restoreSession()
async function restoreSession() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  const parsed = JSON.parse(stored);

  // Handle extension sessions
  if (parsed.signerType === 'extension') {
    // No privkey to decrypt
    // Just restore pubkey and set extension signer
    update(state => ({
      ...state,
      publicKey: parsed.publicKey,
      isAuthenticated: true,
      signerType: 'extension',
      extensionType: parsed.extensionType
    }));

    // Reinitialize extension signer
    if (await detectExtension()) {
      setExtensionSigner();
    }
  }
  // ... existing privkey handling
}
```

---

## Security Considerations

### Extension Login Advantages
1. **No Private Key Storage**: Browser extension manages keys, not the app
2. **Permission-Based**: User controls which events can be signed
3. **Reduced Attack Surface**: No localStorage privkey exposure
4. **User Control**: Extension can be locked/unlocked independently

### Implementation Requirements
1. **Graceful Degradation**: App must work if extension becomes unavailable
2. **Permission Errors**: Clear UX for denied permissions
3. **Session Restoration**: Handle extension disconnections smoothly
4. **No Fallback to Privkey**: Extension sessions should not store privkeys

---

## Implementation Plan

### Phase 1: Extension Detection & Utilities (2-3 hours)
**Priority**: Critical
**File**: `src/lib/utils/nip07.ts` (new file)

- [ ] Implement `detectExtension(): Promise<boolean>`
- [ ] Implement `getExtensionType(): Promise<ExtensionType>`
- [ ] Implement `getExtensionPublicKey(): Promise<string>`
- [ ] Implement `signWithExtension(event): Promise<NostrEvent>`
- [ ] Add permission error handling
- [ ] Add unit tests

### Phase 2: Auth Store Integration (2-3 hours)
**Priority**: Critical
**File**: `src/lib/stores/auth.ts`

- [ ] Add `signerType` and `extensionType` to AuthState
- [ ] Implement `setExtensionKeys(publicKey: string, extensionType?: ExtensionType)`
- [ ] Implement `loginWithExtension(): Promise<void>`
- [ ] Update `restoreSession()` to handle extension sessions
- [ ] Update `logout()` to clear extension state
- [ ] Add integration tests

### Phase 3: NDK Signer Configuration (1-2 hours)
**Priority**: High
**File**: `src/lib/nostr/ndk.ts`

- [ ] Import `NDKNip07Signer` from `@nostr-dev-kit/ndk`
- [ ] Implement `setExtensionSigner(): void`
- [ ] Update `setSigner()` to support conditional logic
- [ ] Add `initializeSigner(authType, privkey?)` wrapper
- [ ] Update `clearSigner()` to handle extension disconnect

### Phase 4: UI Components (2-3 hours)
**Priority**: High
**File**: `src/lib/components/auth/ExtensionLogin.svelte` (new)

- [ ] Create ExtensionLogin component
- [ ] Detect extension availability on mount
- [ ] Implement "Connect with Extension" button
- [ ] Handle permission requests and errors
- [ ] Add loading states
- [ ] Display extension type if detected

**File**: `src/lib/components/auth/SimpleLogin.svelte` (update)

- [ ] Import and render ExtensionLogin
- [ ] Add extension login option to UI
- [ ] Wire up `loginWithExtension` event
- [ ] Update UI copy to highlight extension security

### Phase 5: Session Persistence (1-2 hours)
**Priority**: Medium
**File**: `src/lib/stores/auth.ts`

- [ ] Store extension sessions (pubkey only, no privkey)
- [ ] Add extension reconnection logic on page reload
- [ ] Handle extension unavailability gracefully
- [ ] Update logout to clear extension state properly

### Phase 6: Testing & Validation (2-3 hours)
**Priority**: High

- [ ] Unit tests for `nip07.ts` utilities
- [ ] Integration tests for extension auth flow
- [ ] Manual testing with Alby extension
- [ ] Manual testing with nos2x extension
- [ ] Test permission denial scenarios
- [ ] Test extension unavailability
- [ ] Security audit of session storage
- [ ] Test session restoration with extension

### Total Estimated Time: 10-16 hours

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/nip07.test.ts
describe('detectExtension', () => {
  test('returns true when window.nostr exists', async () => {
    window.nostr = { getPublicKey: jest.fn() };
    expect(await detectExtension()).toBe(true);
  });

  test('returns false when window.nostr does not exist', async () => {
    delete window.nostr;
    expect(await detectExtension()).toBe(false);
  });
});

describe('getExtensionPublicKey', () => {
  test('returns pubkey from extension', async () => {
    const mockPubkey = 'abc123...';
    window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue(mockPubkey)
    };
    expect(await getExtensionPublicKey()).toBe(mockPubkey);
  });

  test('throws on permission denial', async () => {
    window.nostr = {
      getPublicKey: jest.fn().mockRejectedValue(new Error('User denied permission'))
    };
    await expect(getExtensionPublicKey()).rejects.toThrow('User denied permission');
  });
});
```

### Integration Tests
```typescript
// tests/integration/extension-login.test.ts
describe('Extension Login Flow', () => {
  test('should login with extension and store pubkey only', async () => {
    // Mock extension
    window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue('test-pubkey-123')
    };

    // Render login component
    const { getByText } = render(<ExtensionLogin />);

    // Click extension login
    fireEvent.click(getByText('Connect with Browser Extension'));

    // Wait for success
    await waitFor(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      const parsed = JSON.parse(stored);
      expect(parsed.publicKey).toBe('test-pubkey-123');
      expect(parsed.privateKey).toBeUndefined();
      expect(parsed.signerType).toBe('extension');
    });
  });
});
```

### Manual Testing Checklist
- [ ] Install Alby extension
- [ ] Test extension detection
- [ ] Test permission grant flow
- [ ] Test permission denial handling
- [ ] Test signing events via extension
- [ ] Test session restoration after reload
- [ ] Test logout clears extension state
- [ ] Test extension becomes unavailable
- [ ] Verify no privkey stored for extension sessions
- [ ] Test with nos2x extension

---

## Success Criteria

1. ✅ Browser extension detected on page load
2. ✅ Extension login button visible when available
3. ✅ Permission request handled gracefully
4. ✅ Pubkey retrieved from extension
5. ✅ Session stored with pubkey only (no privkey)
6. ✅ NDK uses NDKNip07Signer for signing
7. ✅ Events signed via window.nostr.signEvent()
8. ✅ Session restores on page reload
9. ✅ Extension unavailability handled gracefully
10. ✅ All tests passing

---

## Known Limitations

1. **Browser-Only**: Extension login only works in browser contexts (not SSR)
2. **Extension Dependency**: User must install compatible NIP-07 extension
3. **Permission Model**: User can deny signing requests per-event
4. **No Privkey Backup**: Extension users can't export privkey from app (managed by extension)

---

## References

- [NIP-07 Specification](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NDK Nip07Signer Docs](https://ndk.fyi/docs/signers/nip07)
- [Alby Extension](https://getalby.com/)
- [nos2x Extension](https://github.com/fiatjaf/nos2x)
- Project Docs: `docs/AUTH_IMPLEMENTATION_GUIDE.md` (lines 526-605)
- Project Docs: `docs/AUTH_FLOW_DESIGN.md`
- ADR: `docs/adr/007-sveltekit-ndk-frontend.md`

---

## Conclusion

NIP-07 browser extension support is **architecturally planned but completely unimplemented**. The codebase has:
- ✅ Type definitions
- ✅ Comprehensive documentation
- ❌ Zero functional code

**Recommendation**: Implement NIP-07 support as outlined in this plan to provide users with a more secure, first-class authentication option that eliminates private key storage in localStorage.

**Next Steps**: Begin with Phase 1 (Extension Detection) and work through phases sequentially. Each phase can be tested independently before moving to the next.
