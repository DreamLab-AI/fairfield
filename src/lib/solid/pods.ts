/**
 * Solid Pod Provisioning
 * Pod creation and management using Nostr identity
 */

import { nip19 } from 'nostr-tools';
import { SolidClient, createSolidIdentity, getDefaultClient } from './client';
import type { SolidIdentity, PodInfo, PodProvisionResult } from './types';
import { SolidError, SolidErrorType } from './types';

/** Maximum length for pod name (derived from npub) */
const POD_NAME_MAX_LENGTH = 32;

/** Characters allowed in pod names */
const POD_NAME_PATTERN = /^[a-z0-9-]+$/;

/**
 * Derive a pod name from an npub
 * Takes the first N characters of the npub (after 'npub1') and lowercases
 */
export function derivePodName(npub: string): string {
  // Remove 'npub1' prefix
  const base = npub.replace(/^npub1/, '');

  // Take first 24 characters for a reasonable length
  // This gives us a human-readable but unique identifier
  const truncated = base.slice(0, 24).toLowerCase();

  // Ensure it matches allowed pattern (bech32 should already be lowercase alphanumeric)
  if (!POD_NAME_PATTERN.test(truncated)) {
    // Fallback: hex encode pubkey prefix
    throw new SolidError(
      'Invalid npub format for pod name derivation',
      SolidErrorType.INVALID_REQUEST
    );
  }

  return truncated;
}

/**
 * Derive pod name from hex pubkey
 */
export function derivePodNameFromPubkey(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return derivePodName(npub);
}

/**
 * Build WebID URL from pod name
 */
export function buildWebId(serverUrl: string, podName: string): string {
  const base = serverUrl.replace(/\/$/, '');
  return `${base}/${podName}/profile/card#me`;
}

/**
 * Build pod root URL from pod name
 */
export function buildPodUrl(serverUrl: string, podName: string): string {
  const base = serverUrl.replace(/\/$/, '');
  return `${base}/${podName}/`;
}

/**
 * Check if a pod exists for the given identity
 */
export async function checkPodExists(
  identity: SolidIdentity,
  client?: SolidClient
): Promise<PodInfo | null> {
  const solidClient = client || getDefaultClient();
  const podName = derivePodName(identity.npub);
  const podUrl = buildPodUrl(solidClient.serverUrl, podName);
  const webId = buildWebId(solidClient.serverUrl, podName);

  try {
    const response = await solidClient.get(`/${podName}/`, identity, {
      Accept: 'text/turtle, application/ld+json',
    });

    if (response.ok) {
      return {
        name: podName,
        webId,
        podUrl,
        exists: true,
      };
    }

    if (response.status === 404) {
      return null;
    }

    // Other errors - pod might exist but we can't access it
    return {
      name: podName,
      webId,
      podUrl,
      exists: false,
    };
  } catch (error) {
    if (error instanceof SolidError && error.type === SolidErrorType.NOT_FOUND) {
      return null;
    }
    throw error;
  }
}

/**
 * Provision a new pod for the given identity
 *
 * This creates:
 * 1. Pod root container
 * 2. Profile container with WebID document
 * 3. Standard containers (inbox, files, public, private)
 */
export async function provisionPod(
  identity: SolidIdentity,
  client?: SolidClient
): Promise<PodProvisionResult> {
  const solidClient = client || getDefaultClient();
  const podName = derivePodName(identity.npub);
  const podUrl = buildPodUrl(solidClient.serverUrl, podName);
  const webId = buildWebId(solidClient.serverUrl, podName);

  try {
    // Check if pod already exists
    const existing = await checkPodExists(identity, solidClient);
    if (existing?.exists) {
      return {
        success: true,
        podInfo: existing,
        alreadyExists: true,
      };
    }

    // Create pod root container
    const rootResponse = await solidClient.put(
      `/${podName}/`,
      identity,
      undefined,
      {
        'Content-Type': 'text/turtle',
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
      }
    );

    if (!rootResponse.ok && rootResponse.status !== 201 && rootResponse.status !== 204) {
      return {
        success: false,
        error: `Failed to create pod root: ${rootResponse.statusText}`,
      };
    }

    // Create standard containers
    const containers = ['profile', 'inbox', 'files', 'public', 'private'];

    for (const container of containers) {
      const containerResponse = await solidClient.put(
        `/${podName}/${container}/`,
        identity,
        undefined,
        {
          'Content-Type': 'text/turtle',
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
        }
      );

      if (!containerResponse.ok && containerResponse.status !== 201 && containerResponse.status !== 204) {
        console.warn(`Failed to create container ${container}: ${containerResponse.statusText}`);
      }
    }

    // Create WebID profile document
    const profileTurtle = createProfileDocument(identity, webId, podUrl);

    const profileResponse = await solidClient.put(
      `/${podName}/profile/card`,
      identity,
      profileTurtle,
      {
        'Content-Type': 'text/turtle',
      }
    );

    if (!profileResponse.ok && profileResponse.status !== 201 && profileResponse.status !== 204) {
      console.warn(`Failed to create profile: ${profileResponse.statusText}`);
    }

    return {
      success: true,
      podInfo: {
        name: podName,
        webId,
        podUrl,
        exists: true,
        createdAt: Math.floor(Date.now() / 1000),
      },
    };
  } catch (error) {
    if (error instanceof SolidError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during pod provisioning',
    };
  }
}

/**
 * Create a Turtle profile document
 */
function createProfileDocument(
  identity: SolidIdentity,
  webId: string,
  podUrl: string
): string {
  return `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix space: <http://www.w3.org/ns/pim/space#> .
@prefix ldp: <http://www.w3.org/ns/ldp#> .
@prefix schema: <http://schema.org/> .

<${webId}>
    a foaf:Person, schema:Person ;
    foaf:name "${identity.npub}" ;
    schema:identifier "${identity.pubkey}" ;
    solid:account <${podUrl}> ;
    space:storage <${podUrl}> ;
    solid:inbox <${podUrl}inbox/> ;
    solid:publicKey "${identity.pubkey}" .
`.trim();
}

/**
 * Ensure a pod exists for the identity, creating if necessary
 */
export async function ensurePod(
  identity: SolidIdentity,
  client?: SolidClient
): Promise<PodInfo> {
  const result = await provisionPod(identity, client);

  if (!result.success || !result.podInfo) {
    throw new SolidError(
      result.error || 'Failed to ensure pod exists',
      SolidErrorType.SERVER_ERROR
    );
  }

  return result.podInfo;
}

/**
 * Get or create identity and pod from Nostr keys
 */
export async function getOrCreatePod(
  pubkey: string,
  privateKey: string,
  client?: SolidClient
): Promise<{ identity: SolidIdentity; pod: PodInfo }> {
  const identity = createSolidIdentity(pubkey, privateKey);
  const pod = await ensurePod(identity, client);

  return { identity, pod };
}

/**
 * Delete a pod (if server supports it)
 * Note: Most Solid servers don't allow complete pod deletion
 */
export async function deletePod(
  identity: SolidIdentity,
  client?: SolidClient
): Promise<{ success: boolean; error?: string }> {
  const solidClient = client || getDefaultClient();
  const podName = derivePodName(identity.npub);

  try {
    // First, list all resources
    const listResponse = await solidClient.get(`/${podName}/`, identity, {
      Accept: 'text/turtle',
    });

    if (!listResponse.ok) {
      if (listResponse.status === 404) {
        return { success: true }; // Already deleted
      }
      return {
        success: false,
        error: `Failed to list pod contents: ${listResponse.statusText}`,
      };
    }

    // Delete the pod root (this may fail depending on server)
    const deleteResponse = await solidClient.delete(`/${podName}/`, identity);

    if (deleteResponse.ok || deleteResponse.status === 204) {
      return { success: true };
    }

    return {
      success: false,
      error: `Failed to delete pod: ${deleteResponse.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pod info for identity
 */
export async function getPodInfo(
  identity: SolidIdentity,
  client?: SolidClient
): Promise<PodInfo | null> {
  return checkPodExists(identity, client);
}

/**
 * Validate a pod name
 */
export function isValidPodName(name: string): boolean {
  if (!name || name.length > POD_NAME_MAX_LENGTH) {
    return false;
  }
  return POD_NAME_PATTERN.test(name);
}
