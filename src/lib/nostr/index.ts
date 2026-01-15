/**
 * Nostr Library Entry Point
 * Re-exports all Nostr utilities including DID:NOSTR support
 */

// Core Nostr events and types
export * from './events';
export * from '../../types/nostr';

// Key management
export {
  generateNewIdentity,
  restoreFromMnemonic,
  encodePrivkey,
  encodePubkey,
  restoreFromNsecOrHex,
  type KeyPair
} from './keys';

// DID:NOSTR W3C Implementation
export {
  pubkeyToDID,
  didToPubkey,
  isValidNostrDID,
  encodeMultikey,
  decodeMultikey,
  generateDIDDocument,
  resolveDID,
  npubToDID,
  didToNpub,
  createAuthenticationDIDDocument,
  verifyDIDDocument,
  type DIDDocument,
  type DIDResolutionResult,
  type VerificationMethod,
  type ServiceEndpoint
} from './did';

// Whitelist verification
export {
  checkWhitelistStatus,
  verifyWhitelistStatus
} from './whitelist';
