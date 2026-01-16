---
title: "Value Objects"
description: "## Overview"
category: explanation
tags: ['ddd', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Value Objects

## Overview

Value Objects are immutable domain primitives identified by their attributes rather than identity.

## Cryptographic Value Objects

### Pubkey

Represents a Nostr public key.

```typescript
class Pubkey {
  private readonly hex: string;

  private constructor(hex: string) {
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error('Invalid pubkey: must be 64-char hex');
    }
    this.hex = hex.toLowerCase();
  }

  // Factories
  static fromHex(hex: string): Pubkey {
    return new Pubkey(hex);
  }

  static fromNpub(npub: string): Pubkey {
    const { type, data } = nip19.decode(npub);
    if (type !== 'npub') throw new Error('Not an npub');
    return new Pubkey(bytesToHex(data));
  }

  static fromPrivkey(privkey: string): Pubkey {
    const pubkey = getPublicKey(privkey);
    return new Pubkey(pubkey);
  }

  // Conversions
  toHex(): string {
    return this.hex;
  }

  toNpub(): string {
    return nip19.npubEncode(this.hex);
  }

  toBytes(): Uint8Array {
    return hexToBytes(this.hex);
  }

  // Display
  toShort(): string {
    return `${this.hex.slice(0, 8)}...${this.hex.slice(-8)}`;
  }

  // Equality
  equals(other: Pubkey): boolean {
    return this.hex === other.hex;
  }

  toString(): string {
    return this.toNpub();
  }
}
```

### EventId

Represents a Nostr event identifier (SHA256 hash).

```typescript
class EventId {
  private readonly hex: string;

  private constructor(hex: string) {
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error('Invalid event ID: must be 64-char hex');
    }
    this.hex = hex.toLowerCase();
  }

  // Factories
  static fromHex(hex: string): EventId {
    return new EventId(hex);
  }

  static fromNevent(nevent: string): EventId {
    const { type, data } = nip19.decode(nevent);
    if (type !== 'nevent') throw new Error('Not an nevent');
    return new EventId(data.id);
  }

  static fromEvent(event: NostrEvent): EventId {
    return new EventId(event.id);
  }

  static compute(event: UnsignedEvent): EventId {
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ]);
    const hash = sha256(new TextEncoder().encode(serialized));
    return new EventId(bytesToHex(hash));
  }

  // Conversions
  toHex(): string {
    return this.hex;
  }

  toNevent(relays?: string[]): string {
    return nip19.neventEncode({ id: this.hex, relays });
  }

  // Equality
  equals(other: EventId): boolean {
    return this.hex === other.hex;
  }

  toString(): string {
    return this.hex;
  }
}
```

### Signature

Represents a Schnorr signature.

```typescript
class Signature {
  private readonly sig: string;

  private constructor(sig: string) {
    if (!/^[0-9a-f]{128}$/i.test(sig)) {
      throw new Error('Invalid signature: must be 128-char hex');
    }
    this.sig = sig.toLowerCase();
  }

  // Factories
  static fromHex(hex: string): Signature {
    return new Signature(hex);
  }

  static sign(event: UnsignedEvent, privkey: string): Signature {
    const eventId = EventId.compute(event);
    const sig = schnorr.sign(eventId.toHex(), privkey);
    return new Signature(bytesToHex(sig));
  }

  // Verification
  verify(event: NostrEvent): boolean {
    try {
      return schnorr.verify(
        this.sig,
        event.id,
        event.pubkey
      );
    } catch {
      return false;
    }
  }

  // Conversions
  toHex(): string {
    return this.sig;
  }

  toString(): string {
    return this.sig;
  }
}
```

## Identifier Value Objects

### CohortId

```typescript
class CohortId {
  private readonly value: string;

  private constructor(value: string) {
    if (!/^[a-z][a-z0-9-]*$/.test(value)) {
      throw new Error('Invalid cohort ID: lowercase alphanumeric with dashes');
    }
    if (value.length > 32) {
      throw new Error('Cohort ID too long: max 32 chars');
    }
    this.value = value;
  }

  static fromString(value: string): CohortId {
    return new CohortId(value);
  }

  // Predefined cohorts
  static readonly ADMIN = new CohortId('admin');
  static readonly MEMBERS = new CohortId('members');
  static readonly GUESTS = new CohortId('guests');

  toString(): string {
    return this.value;
  }

  equals(other: CohortId): boolean {
    return this.value === other.value;
  }
}
```

### SectionId

```typescript
class SectionId {
  private readonly value: string;

  private constructor(value: string) {
    if (!/^[a-z][a-z0-9-]*$/.test(value)) {
      throw new Error('Invalid section ID');
    }
    this.value = value;
  }

  static fromString(value: string): SectionId {
    return new SectionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SectionId): boolean {
    return this.value === other.value;
  }
}
```

### RoleId

```typescript
class RoleId {
  private readonly value: string;
  private readonly priority: number;

  private constructor(value: string, priority: number) {
    this.value = value;
    this.priority = priority;
  }

  // Predefined roles (ordered by priority)
  static readonly ADMIN = new RoleId('admin', 100);
  static readonly MODERATOR = new RoleId('moderator', 75);
  static readonly MEMBER = new RoleId('member', 50);
  static readonly VIEWER = new RoleId('viewer', 25);

  static fromString(value: string): RoleId {
    const roles: Record<string, RoleId> = {
      admin: RoleId.ADMIN,
      moderator: RoleId.MODERATOR,
      member: RoleId.MEMBER,
      viewer: RoleId.VIEWER
    };
    if (!roles[value]) throw new Error(`Unknown role: ${value}`);
    return roles[value];
  }

  isHigherThan(other: RoleId): boolean {
    return this.priority > other.priority;
  }

  isAtLeast(other: RoleId): boolean {
    return this.priority >= other.priority;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RoleId): boolean {
    return this.value === other.value;
  }
}
```

## Content Value Objects

### MessageContent

```typescript
class MessageContent {
  private readonly value: string;
  private readonly mentions: Pubkey[];
  private readonly tags: EventId[];

  private constructor(value: string) {
    if (value.length > 64000) {
      throw new Error('Content too long: max 64KB');
    }
    this.value = value;
    this.mentions = this.extractMentions();
    this.tags = this.extractTags();
  }

  static fromString(value: string): MessageContent {
    return new MessageContent(value);
  }

  private extractMentions(): Pubkey[] {
    const npubPattern = /nostr:npub1[a-z0-9]{58}/g;
    const matches = this.value.match(npubPattern) || [];
    return matches.map(m => Pubkey.fromNpub(m.replace('nostr:', '')));
  }

  private extractTags(): EventId[] {
    const neventPattern = /nostr:nevent1[a-z0-9]+/g;
    const matches = this.value.match(neventPattern) || [];
    return matches.map(m => EventId.fromNevent(m.replace('nostr:', '')));
  }

  getText(): string {
    return this.value;
  }

  getMentions(): Pubkey[] {
    return [...this.mentions];
  }

  getEventTags(): EventId[] {
    return [...this.tags];
  }

  getPreview(maxLength: number = 100): string {
    if (this.value.length <= maxLength) return this.value;
    return this.value.slice(0, maxLength - 3) + '...';
  }

  toString(): string {
    return this.value;
  }
}
```

### Timestamp

```typescript
class Timestamp {
  private readonly unixSeconds: number;

  private constructor(unixSeconds: number) {
    if (unixSeconds < 0) {
      throw new Error('Timestamp cannot be negative');
    }
    this.unixSeconds = Math.floor(unixSeconds);
  }

  // Factories
  static now(): Timestamp {
    return new Timestamp(Math.floor(Date.now() / 1000));
  }

  static fromUnix(seconds: number): Timestamp {
    return new Timestamp(seconds);
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(Math.floor(date.getTime() / 1000));
  }

  // Conversions
  toUnix(): number {
    return this.unixSeconds;
  }

  toDate(): Date {
    return new Date(this.unixSeconds * 1000);
  }

  toISO(): string {
    return this.toDate().toISOString();
  }

  // Comparisons
  isBefore(other: Timestamp): boolean {
    return this.unixSeconds < other.unixSeconds;
  }

  isAfter(other: Timestamp): boolean {
    return this.unixSeconds > other.unixSeconds;
  }

  // Display
  toRelative(): string {
    const now = Timestamp.now().unixSeconds;
    const diff = now - this.unixSeconds;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return this.toDate().toLocaleDateString();
  }

  equals(other: Timestamp): boolean {
    return this.unixSeconds === other.unixSeconds;
  }
}
```

## Encryption Value Objects

### EncryptedPayload

```typescript
class EncryptedPayload {
  private readonly ciphertext: string;
  private readonly version: 'nip04' | 'nip44';

  private constructor(ciphertext: string, version: 'nip04' | 'nip44') {
    this.ciphertext = ciphertext;
    this.version = version;
  }

  static fromNip04(ciphertext: string): EncryptedPayload {
    // NIP-04 format: base64?iv=base64
    if (!ciphertext.includes('?iv=')) {
      throw new Error('Invalid NIP-04 ciphertext');
    }
    return new EncryptedPayload(ciphertext, 'nip04');
  }

  static fromNip44(ciphertext: string): EncryptedPayload {
    // NIP-44 format: version byte + nonce + ciphertext
    return new EncryptedPayload(ciphertext, 'nip44');
  }

  static detect(ciphertext: string): EncryptedPayload {
    if (ciphertext.includes('?iv=')) {
      return EncryptedPayload.fromNip04(ciphertext);
    }
    return EncryptedPayload.fromNip44(ciphertext);
  }

  isLegacy(): boolean {
    return this.version === 'nip04';
  }

  getCiphertext(): string {
    return this.ciphertext;
  }

  getVersion(): 'nip04' | 'nip44' {
    return this.version;
  }
}
```

## Search Value Objects

### Embedding

```typescript
class Embedding {
  private readonly vector: Float32Array;
  private readonly dimensions: number;

  private constructor(vector: Float32Array) {
    this.vector = vector;
    this.dimensions = vector.length;
  }

  static fromArray(values: number[]): Embedding {
    return new Embedding(new Float32Array(values));
  }

  static fromFloat32Array(array: Float32Array): Embedding {
    return new Embedding(array);
  }

  getVector(): Float32Array {
    return this.vector;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  // Cosine similarity
  similarity(other: Embedding): number {
    if (this.dimensions !== other.dimensions) {
      throw new Error('Dimension mismatch');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this.dimensions; i++) {
      dotProduct += this.vector[i] * other.vector[i];
      normA += this.vector[i] * this.vector[i];
      normB += other.vector[i] * other.vector[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```
