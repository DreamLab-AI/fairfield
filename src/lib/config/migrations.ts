/**
 * Migration Configuration
 *
 * Central registry of deprecation dates and migration schedules.
 * These dates define when legacy features are disabled or removed.
 *
 * Format: ISO 8601 dates (YYYY-MM-DD)
 *
 * Lifecycle:
 * 1. WARN_DATE: Show deprecation warnings
 * 2. DISABLE_DATE: Disable writes, allow reads
 * 3. REMOVE_DATE: Remove feature entirely
 */

/**
 * NIP-04 Legacy Encryption Migration
 *
 * NIP-04 has known security issues:
 * - No authentication (malleable ciphertext)
 * - IV reuse vulnerabilities
 * - Metadata leakage
 *
 * Migration path:
 * - New DMs use NIP-44 via gift wrap (kind 1059)
 * - Legacy kind 4 DMs are read-only after DISABLE_DATE
 * - Kind 4 support removed after REMOVE_DATE
 */
export const NIP04_MIGRATION = {
  /** Start showing "legacy message" badges */
  WARN_DATE: '2025-01-01',
  /** Disable NIP-04 encryption for new messages (read-only mode) */
  DISABLE_DATE: '2025-06-01',
  /** Remove NIP-04 decryption support entirely */
  REMOVE_DATE: '2025-12-01',
} as const;

/**
 * Legacy Plaintext Key Storage Migration
 *
 * Older versions stored private keys in plaintext localStorage.
 * Current versions use encrypted storage with session keys.
 *
 * Migration:
 * - Auto-migrate on login (re-encrypt with session key)
 * - Warn users with plaintext keys to re-login
 * - Remove plaintext key support after REMOVE_DATE
 */
export const PLAINTEXT_KEY_MIGRATION = {
  /** Show warning about plaintext key storage */
  WARN_DATE: '2025-01-15',
  /** Stop accepting plaintext keys from storage (force re-login) */
  DISABLE_DATE: '2025-03-01',
  /** Remove legacy plaintext key parsing code */
  REMOVE_DATE: '2025-06-01',
} as const;

/**
 * Legacy Channel Format Migration (NIP-28 → NIP-29)
 *
 * Migrating from kind 40/41/42 channels to NIP-29 groups.
 *
 * Timeline:
 * - New channels use NIP-29 format
 * - Legacy channels readable but deprecated
 * - Full migration to NIP-29 groups
 */
export const CHANNEL_FORMAT_MIGRATION = {
  /** Show legacy channel warnings */
  WARN_DATE: '2025-03-01',
  /** Stop creating new legacy channels */
  DISABLE_DATE: '2025-06-01',
  /** Archive legacy channels, NIP-29 only */
  REMOVE_DATE: '2025-12-01',
} as const;

/**
 * Check if a feature is in warning phase
 */
export function isWarningPhase(migration: { WARN_DATE: string; DISABLE_DATE: string }): boolean {
  const now = new Date();
  const warnDate = new Date(migration.WARN_DATE);
  const disableDate = new Date(migration.DISABLE_DATE);
  return now >= warnDate && now < disableDate;
}

/**
 * Check if a feature is disabled (read-only)
 */
export function isDisabledPhase(migration: { DISABLE_DATE: string; REMOVE_DATE: string }): boolean {
  const now = new Date();
  const disableDate = new Date(migration.DISABLE_DATE);
  const removeDate = new Date(migration.REMOVE_DATE);
  return now >= disableDate && now < removeDate;
}

/**
 * Check if a feature should be completely removed
 */
export function isRemovedPhase(migration: { REMOVE_DATE: string }): boolean {
  const now = new Date();
  const removeDate = new Date(migration.REMOVE_DATE);
  return now >= removeDate;
}

/**
 * Check if NIP-04 encryption should be used (false after disable date)
 */
export function isNip04EncryptionAllowed(): boolean {
  return !isDisabledPhase(NIP04_MIGRATION) && !isRemovedPhase(NIP04_MIGRATION);
}

/**
 * Check if NIP-04 decryption should be attempted
 */
export function isNip04DecryptionAllowed(): boolean {
  return !isRemovedPhase(NIP04_MIGRATION);
}

/**
 * Check if legacy plaintext keys should be migrated
 */
export function isPlaintextKeyMigrationRequired(): boolean {
  return isWarningPhase(PLAINTEXT_KEY_MIGRATION) || isDisabledPhase(PLAINTEXT_KEY_MIGRATION);
}

/**
 * Check if plaintext keys should be rejected entirely
 */
export function shouldRejectPlaintextKeys(): boolean {
  return isDisabledPhase(PLAINTEXT_KEY_MIGRATION) || isRemovedPhase(PLAINTEXT_KEY_MIGRATION);
}

/**
 * Get days until a date
 */
export function daysUntil(dateString: string): number {
  const now = new Date();
  const target = new Date(dateString);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get human-readable migration status
 */
export function getMigrationStatus(migration: {
  WARN_DATE: string;
  DISABLE_DATE: string;
  REMOVE_DATE: string;
}): 'active' | 'warning' | 'disabled' | 'removed' {
  if (isRemovedPhase(migration)) return 'removed';
  if (isDisabledPhase(migration)) return 'disabled';
  if (isWarningPhase(migration)) return 'warning';
  return 'active';
}

export default {
  NIP04_MIGRATION,
  PLAINTEXT_KEY_MIGRATION,
  CHANNEL_FORMAT_MIGRATION,
  isNip04EncryptionAllowed,
  isNip04DecryptionAllowed,
  isPlaintextKeyMigrationRequired,
  shouldRejectPlaintextKeys,
  getMigrationStatus,
  daysUntil,
};
