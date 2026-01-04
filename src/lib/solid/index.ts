/**
 * Solid Pod Integration Layer
 * Main exports for Solid pod operations with NIP-98 Nostr authentication
 *
 * This module provides:
 * - NIP-98 HTTP authentication using Nostr keys
 * - Pod provisioning tied to Nostr identity (npub)
 * - File upload/download operations
 * - JSON-LD resource management
 * - Container (folder) operations
 *
 * Usage:
 * ```typescript
 * import {
 *   getOrCreatePod,
 *   uploadFile,
 *   downloadFile,
 *   saveJsonLd,
 *   loadJsonLd
 * } from '$lib/solid';
 *
 * // Get or create pod for user
 * const { identity, pod } = await getOrCreatePod(pubkey, privateKey);
 *
 * // Upload a file
 * const result = await uploadFile(identity, file, { path: '/files/image.png' });
 *
 * // Save JSON-LD data
 * await saveJsonLd(identity, '/data/profile.jsonld', {
 *   '@type': 'Person',
 *   name: 'Alice'
 * });
 * ```
 */

// Types
export * from './types';

// Client
export {
  SolidClient,
  createSolidClient,
  getDefaultClient,
  setDefaultClient,
  getSolidServerUrl,
  createSolidIdentity,
  createNip98AuthEvent,
  encodeNip98Auth,
  createAuthorizationHeader,
} from './client';

// Pod provisioning
export {
  derivePodName,
  derivePodNameFromPubkey,
  buildWebId,
  buildPodUrl,
  checkPodExists,
  provisionPod,
  ensurePod,
  getOrCreatePod,
  deletePod,
  getPodInfo,
  isValidPodName,
} from './pods';

// Storage operations
export {
  MimeTypes,
  detectMimeType,
  buildResourcePath,
  uploadFile,
  uploadText,
  downloadFile,
  downloadText,
  deleteFile,
  ensureContainer,
  listContainer,
  saveJsonLd,
  loadJsonLd,
  resourceExists,
  copyFile,
  moveFile,
  getResourceInfo,
} from './storage';

/**
 * Quick start helper - initialize Solid for a Nostr user
 *
 * @param pubkey - Hex-encoded public key
 * @param privateKey - Hex-encoded private key
 * @returns Object with identity, pod info, and common operations bound to the identity
 */
export async function initializeSolid(pubkey: string, privateKey: string) {
  const { getOrCreatePod: getPod } = await import('./pods');
  const {
    uploadFile: upload,
    downloadFile: download,
    saveJsonLd: saveJson,
    loadJsonLd: loadJson,
    listContainer: list,
    deleteFile: del,
  } = await import('./storage');

  const { identity, pod } = await getPod(pubkey, privateKey);

  return {
    identity,
    pod,

    // Bound operations for convenience
    upload: (file: File | Blob, path: string, overwrite = true) =>
      upload(identity, file, { path, overwrite }),

    download: (path: string) =>
      download(identity, path),

    saveJson: (path: string, data: import('./types').JsonLdResource) =>
      saveJson(identity, path, data),

    loadJson: (path: string) =>
      loadJson(identity, path),

    list: (path: string) =>
      list(identity, path),

    delete: (path: string) =>
      del(identity, path),
  };
}

/**
 * Version info
 */
export const VERSION = '1.0.0';
export const NIP98_KIND = 27235;
