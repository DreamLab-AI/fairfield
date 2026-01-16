---
title: "ADR-005: NIP-44 Encryption Mandate"
description: "Decision to mandate NIP-44 encryption for all new encrypted content"
category: reference
tags: ['adr', 'security', 'encryption', 'nostr', 'nip-44']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-005: NIP-44 Encryption Mandate

## Status

Accepted

## Date

2024-03-01

## Context

Nostr has two encryption standards:
- **NIP-04**: Legacy AES-256-CBC (deprecated)
- **NIP-44**: Modern XChaCha20-Poly1305

NIP-04 has known weaknesses:
- No authentication (malleable ciphertext)
- IV reuse vulnerabilities
- Metadata leakage

Need to balance security with backward compatibility.

## Decision

Mandate NIP-44 for all new encryption while maintaining NIP-04 decrypt-only for legacy messages.

### Implementation

```typescript
// src/lib/nostr/encryption.ts

// ENCRYPT: Always use NIP-44
export async function encryptMessage(
  content: string,
  recipientPubkey: string,
  senderPrivkey: string
): Promise<string> {
  // NIP-44 XChaCha20-Poly1305
  return nip44.encrypt(content, conversationKey);
}

// DECRYPT: Detect and handle both
export async function decryptMessage(
  ciphertext: string,
  senderPubkey: string,
  recipientPrivkey: string
): Promise<string> {
  // Try NIP-44 first (preferred)
  if (isNip44Format(ciphertext)) {
    return nip44.decrypt(ciphertext, conversationKey);
  }

  // Fallback to NIP-04 for legacy (decrypt only)
  console.warn('Decrypting legacy NIP-04 message');
  return nip04.decrypt(recipientPrivkey, senderPubkey, ciphertext);
}
```

### Migration Strategy

**Concrete Dates (Set 2025-01-16):**

```
Phase 1 (2025-01-01 → 2025-05-31): Warning Phase
├── New DMs use NIP-44 (kind 1059 gift wrap)
├── Old DMs decrypted with NIP-04
├── UI shows "legacy" badge for NIP-04 messages
└── Warning: "This message uses legacy encryption"

Phase 2 (2025-06-01 → 2025-11-30): Read-Only Phase
├── NIP-04 ENCRYPTION DISABLED - all new messages use NIP-44
├── NIP-04 decryption still works for old messages
├── Prompt to export/archive legacy conversations
└── Error if attempting to send NIP-04 encrypted message

Phase 3 (2025-12-01+): Removal Phase
├── NIP-04 decrypt capability removed
├── Old kind 4 messages display "Archive required" notice
└── Migration code can be safely removed
```

**Configuration:** `src/lib/config/migrations.ts`

```typescript
export const NIP04_MIGRATION = {
  WARN_DATE: '2025-01-01',     // Show deprecation warnings
  DISABLE_DATE: '2025-06-01', // Read-only mode
  REMOVE_DATE: '2025-12-01',  // Complete removal
} as const;
```

### Event Kind Mapping

| Use Case | Kind | Encryption |
|----------|------|------------|
| Legacy DM | 4 | NIP-04 (decrypt only) |
| Gift Wrap | 1059 | NIP-44 |
| Seal | 13 | NIP-44 |
| Rumor | 1 | Plaintext (inside seal) |

## Consequences

### Positive
- Modern authenticated encryption
- Forward secrecy preparation
- No new NIP-04 vulnerabilities
- Clear migration path

### Negative
- Legacy message handling complexity
- Older clients may not support NIP-44
- Key derivation differences

### Neutral
- Dual decryption overhead
- UI complexity for legacy badges

## Alternatives Considered

### Immediate NIP-04 Removal
- Cleanest approach
- Rejected: Breaks existing messages

### NIP-04 for All (Status Quo)
- Simplest implementation
- Rejected: Known security issues

### Custom Encryption
- Full control
- Rejected: Not interoperable

## References

- [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) (deprecated)
- [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) (Private DMs)
- Related: ADR-001 (Nostr foundation)
