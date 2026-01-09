/**
 * Nostr Protocol Types
 */

export const NOSTR_KIND = {
  METADATA: 0,
  SHORT_TEXT_NOTE: 1,
  RECOMMEND_RELAY: 2,
  CONTACTS: 3,
  ENCRYPTED_DM: 4,
} as const;

/**
 * Event kinds as enum for type-safe usage
 * NIP-01 + additional NIPs
 */
export const EventKind = {
  METADATA: 0,
  SHORT_TEXT_NOTE: 1,
  TEXT_NOTE: 1,          // Alias for SHORT_TEXT_NOTE
  RECOMMEND_RELAY: 2,
  CONTACTS: 3,
  ENCRYPTED_DM: 4,
  DELETION: 5,
  REPOST: 6,
  REACTION: 7,           // NIP-25
  BADGE_AWARD: 8,
  CHANNEL_CREATE: 40,    // NIP-28
  CHANNEL_METADATA: 41,  // NIP-28
  CHANNEL_MESSAGE: 42,   // NIP-28
  CHANNEL_HIDE: 43,      // NIP-28
  CHANNEL_MUTE: 44,      // NIP-28
  REPORT: 1984,
  ZAP_REQUEST: 9734,     // NIP-57
  ZAP_RECEIPT: 9735,     // NIP-57
  MUTE_LIST: 10000,
  RELAY_LIST: 10002,
  AUTH: 22242,           // NIP-42
  GIFT_WRAP: 1059,       // NIP-59
  SEALED: 13,            // NIP-59
} as const;

export type EventKindType = typeof EventKind[keyof typeof EventKind];

/**
 * User profile data (kind 0 content)
 */
export interface UserProfile {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  display_name?: string;
  [key: string]: string | undefined;
}

/**
 * Parsed channel message data
 */
export interface ChannelMessage {
  content: string;
  channelId: string;
  author: string;
  timestamp: number;
  eventId?: string;
  tags?: Array<string[]>;
}

export interface NostrEvent {
  content: string;
  created_at: number;
  kind: number;
  pubkey: string;
  sig?: string;
  tags?: Array<string[]>;
  id?: string;
}

export interface NostrMetadata {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  display_name?: string;
  [key: string]: string | undefined;
}

export interface PublicKeyFormat {
  hex: string;
  npub: string;
}

export interface PrivateKeyFormat {
  hex: string;
  nsec: string;
}

export interface NostrKeypair {
  publicKey: PublicKeyFormat;
  privateKey: PrivateKeyFormat;
}

export interface NIP07Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
  getRelays?(): Promise<Record<string, RelayPolicy>>;
  nip04?: {
    encrypt?(pubkey: string, plaintext: string): Promise<string>;
    decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt?(pubkey: string, plaintext: string): Promise<string>;
    decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  };
}

export interface RelayPolicy {
  read: boolean;
  write: boolean;
}

export interface NostrFilter {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
}

/**
 * Alias for NostrFilter for compatibility
 */
export type Filter = NostrFilter;

export interface NostrSubscription {
  id: string;
  filters: NostrFilter[];
  onEvent: (event: NostrEvent) => void;
  onEose: () => void;
}

export interface SigningContext {
  kind: number;
  content: string;
  tags?: Array<string[]>;
  createdAt?: number;
}

export interface MnemonicProperties {
  wordCount: 12 | 24;
  language: 'english';
  entropy: string;
  checksum: string;
}

export interface DerivationOptions {
  wordCount?: 12 | 24;
  passphrase?: string;
  path?: string;
}

export interface VerificationResult {
  isValid: boolean;
  publicKey?: string;
  error?: string;
}
