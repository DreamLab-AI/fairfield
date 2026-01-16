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
 * NIP-04 Legacy Encryption - REMOVED
 *
 * NIP-04 support was removed on 2025-12-01 due to known security issues:
 * - No authentication (malleable ciphertext)
 * - IV reuse vulnerabilities
 * - Metadata leakage
 *
 * All DMs now use NIP-44 via gift wrap (kind 1059).
 * This constant is kept for reference only.
 */
export const NIP04_MIGRATION = {
  /** Historical: Started showing "legacy message" badges */
  WARN_DATE: '2025-01-01',
  /** Historical: Disabled NIP-04 encryption for new messages */
  DISABLE_DATE: '2025-06-01',
  /** NIP-04 support was removed on this date */
  REMOVE_DATE: '2025-12-01',
  /** Current status */
  STATUS: 'REMOVED' as const,
} as const;

/**
 * Legacy Plaintext Key Storage - REMOVED
 *
 * Plaintext key storage was removed on 2025-06-01.
 * All keys now use encrypted storage with session keys.
 * This constant is kept for reference only.
 */
export const PLAINTEXT_KEY_MIGRATION = {
  /** Historical: Started showing warnings */
  WARN_DATE: '2025-01-15',
  /** Historical: Stopped accepting plaintext keys */
  DISABLE_DATE: '2025-03-01',
  /** Plaintext key support was removed on this date */
  REMOVE_DATE: '2025-06-01',
  /** Current status */
  STATUS: 'REMOVED' as const,
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
 * NIP-04 encryption is no longer allowed (removed 2025-12-01)
 * @returns Always false - NIP-04 is removed
 */
export function isNip04EncryptionAllowed(): boolean {
  return false; // NIP-04 removed as of 2025-12-01
}

/**
 * NIP-04 decryption is no longer allowed (removed 2025-12-01)
 * @returns Always false - NIP-04 is removed
 */
export function isNip04DecryptionAllowed(): boolean {
  return false; // NIP-04 removed as of 2025-12-01
}

/**
 * Plaintext key migration is no longer applicable (removed 2025-06-01)
 * @returns Always false - feature removed
 */
export function isPlaintextKeyMigrationRequired(): boolean {
  return false; // Plaintext keys removed as of 2025-06-01
}

/**
 * Plaintext keys are always rejected (removed 2025-06-01)
 * @returns Always true - plaintext keys are rejected
 */
export function shouldRejectPlaintextKeys(): boolean {
  return true; // Plaintext keys removed as of 2025-06-01
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
