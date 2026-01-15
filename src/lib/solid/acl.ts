/**
 * Access Control Management for Solid Pods
 *
 * Provides synchronization between Nostr permissions (cohorts/whitelist)
 * and Solid's Web Access Control (WAC) system. Enables seamless permission
 * management across both identity ecosystems.
 */

import type {
  ACLEntry,
  ACLMode,
  ACLSubject,
  CohortACLMapping,
  PermissionSyncRequest,
  PermissionSyncResult,
  ACLSyncError,
  StorageResult,
} from './types';
import { RDF_NAMESPACES } from './types';
import { getSession, getAuthenticatedFetch } from './client';
import { pubkeyToWebID } from './webid';
// Import cohort type - using inline definition to avoid circular dependency
type CohortName = 'admin' | 'approved' | 'business' | 'moomaa-tribe';

/**
 * ACL operation error
 */
export class ACLOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ACLOperationError';
  }
}

/**
 * Default cohort to ACL mode mappings
 */
const DEFAULT_COHORT_MAPPINGS: Record<CohortName, ACLMode[]> = {
  admin: ['Read', 'Write', 'Append', 'Control'],
  approved: ['Read', 'Append'],
  business: ['Read', 'Write', 'Append'],
  'moomaa-tribe': ['Read', 'Append'],
};

/**
 * Cached ACL entries by resource URL
 */
const aclCache = new Map<string, { entries: ACLEntry[]; timestamp: number }>();
const ACL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Get the ACL document URL for a resource
 */
export function getACLUrl(resourceUrl: string): string {
  // ACL is typically at resource.acl or linked via Link header
  const url = new URL(resourceUrl);
  if (url.pathname.endsWith('/')) {
    return `${resourceUrl}.acl`;
  }
  return `${resourceUrl}.acl`;
}

/**
 * Parse ACL document (Turtle format) to ACLEntry array
 */
export function parseACLDocument(acl: string, resourceUrl: string): ACLEntry[] {
  const entries: ACLEntry[] = [];

  // Split into authorization blocks
  const blocks = acl.split(/\.\s*(?=<|@|$)/);

  for (const block of blocks) {
    if (!block.includes('acl:Authorization') && !block.includes('Authorization')) {
      continue;
    }

    const entry: Partial<ACLEntry> = {
      resourceUrl,
      modes: [],
    };

    // Extract modes
    const modeMatches = block.matchAll(/acl:(Read|Write|Append|Control)/g);
    for (const match of modeMatches) {
      entry.modes!.push(match[1] as ACLMode);
    }

    // Extract subject
    const agentMatch = block.match(/acl:agent\s+<([^>]+)>/);
    if (agentMatch) {
      entry.subject = {
        type: 'agent',
        webId: agentMatch[1],
      };
    }

    const agentGroupMatch = block.match(/acl:agentGroup\s+<([^>]+)>/);
    if (agentGroupMatch) {
      entry.subject = {
        type: 'group',
        groupUrl: agentGroupMatch[1],
      };
    }

    const agentClassMatch = block.match(/acl:agentClass\s+<([^>]+)>/);
    if (agentClassMatch) {
      if (agentClassMatch[1].includes('AuthenticatedAgent')) {
        entry.subject = { type: 'authenticated' };
      } else if (agentClassMatch[1].includes('foaf:Agent')) {
        entry.subject = { type: 'public' };
      }
    }

    // Check if default ACL
    entry.isDefault = block.includes('acl:default');

    if (entry.subject && entry.modes!.length > 0) {
      entries.push(entry as ACLEntry);
    }
  }

  return entries;
}

/**
 * Generate ACL document (Turtle format) from ACLEntry array
 */
export function generateACLDocument(entries: ACLEntry[], resourceUrl: string): string {
  const lines: string[] = [
    '@prefix acl: <http://www.w3.org/ns/auth/acl#> .',
    '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
    '',
  ];

  let authIndex = 0;

  for (const entry of entries) {
    authIndex++;
    const authId = `auth${authIndex}`;

    lines.push(`<#${authId}>`);
    lines.push('    a acl:Authorization ;');
    lines.push(`    acl:accessTo <${entry.resourceUrl || resourceUrl}> ;`);

    // Add subject
    switch (entry.subject.type) {
      case 'agent':
        lines.push(`    acl:agent <${entry.subject.webId}> ;`);
        break;
      case 'group':
        lines.push(`    acl:agentGroup <${entry.subject.groupUrl}> ;`);
        break;
      case 'authenticated':
        lines.push('    acl:agentClass acl:AuthenticatedAgent ;');
        break;
      case 'public':
        lines.push('    acl:agentClass foaf:Agent ;');
        break;
    }

    // Add modes
    for (const mode of entry.modes) {
      lines.push(`    acl:mode acl:${mode} ;`);
    }

    // Add default if applicable
    if (entry.isDefault) {
      lines.push(`    acl:default <${resourceUrl}> ;`);
    }

    // Remove trailing semicolon and add period
    const lastLineIndex = lines.length - 1;
    lines[lastLineIndex] = lines[lastLineIndex].replace(/;$/, '.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Fetch ACL entries for a resource
 */
export async function getACL(resourceUrl: string): Promise<StorageResult<ACLEntry[]>> {
  // Check cache
  const cached = aclCache.get(resourceUrl);
  if (cached && Date.now() - cached.timestamp < ACL_CACHE_TTL) {
    return {
      success: true,
      data: cached.entries,
      url: getACLUrl(resourceUrl),
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  try {
    // First try to get ACL URL from Link header
    const headResponse = await fetchFn(resourceUrl, {
      method: 'HEAD',
    });

    let aclUrl: string;
    const linkHeader = headResponse.headers.get('Link');

    if (linkHeader) {
      const aclLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="acl"/);
      aclUrl = aclLinkMatch ? aclLinkMatch[1] : getACLUrl(resourceUrl);
    } else {
      aclUrl = getACLUrl(resourceUrl);
    }

    const response = await fetchFn(aclUrl, {
      headers: {
        Accept: 'text/turtle',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No ACL document exists yet
        return {
          success: true,
          data: [],
          url: aclUrl,
        };
      }

      return {
        success: false,
        error: {
          code: response.status === 403 ? 'FORBIDDEN' : 'UNKNOWN',
          message: `Failed to fetch ACL: ${response.status}`,
          statusCode: response.status,
        },
      };
    }

    const aclContent = await response.text();
    const entries = parseACLDocument(aclContent, resourceUrl);

    // Update cache
    aclCache.set(resourceUrl, {
      entries,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: entries,
      url: aclUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Set ACL entries for a resource
 */
export async function setACL(
  resourceUrl: string,
  entries: ACLEntry[]
): Promise<StorageResult<void>> {
  const session = getSession();

  if (!session.isLoggedIn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to modify ACL',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const aclUrl = getACLUrl(resourceUrl);

  try {
    // Ensure owner always has Control access
    const ownerHasControl = entries.some(
      e =>
        e.subject.type === 'agent' &&
        e.subject.webId === session.webId &&
        e.modes.includes('Control')
    );

    if (!ownerHasControl && session.webId) {
      entries.push({
        subject: {
          type: 'agent',
          webId: session.webId,
        },
        modes: ['Read', 'Write', 'Append', 'Control'],
        resourceUrl,
      });
    }

    const aclContent = generateACLDocument(entries, resourceUrl);

    const response = await fetchFn(aclUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: aclContent,
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: response.status === 403 ? 'FORBIDDEN' : 'UNKNOWN',
          message: `Failed to set ACL: ${response.status}`,
          statusCode: response.status,
        },
      };
    }

    // Update cache
    aclCache.set(resourceUrl, {
      entries,
      timestamp: Date.now(),
    });

    return {
      success: true,
      url: aclUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Grant access to a resource for a WebID
 */
export async function grantAccess(
  resourceUrl: string,
  webId: string,
  modes: ACLMode[]
): Promise<StorageResult<void>> {
  const existingResult = await getACL(resourceUrl);

  if (!existingResult.success) {
    return {
      success: false,
      error: existingResult.error,
    };
  }

  const entries = existingResult.data || [];

  // Check if entry already exists for this WebID
  const existingIndex = entries.findIndex(
    e => e.subject.type === 'agent' && e.subject.webId === webId
  );

  if (existingIndex >= 0) {
    // Merge modes
    const existingModes = new Set(entries[existingIndex].modes);
    for (const mode of modes) {
      existingModes.add(mode);
    }
    entries[existingIndex].modes = Array.from(existingModes);
  } else {
    // Add new entry
    entries.push({
      subject: {
        type: 'agent',
        webId,
      },
      modes,
      resourceUrl,
    });
  }

  return setACL(resourceUrl, entries);
}

/**
 * Revoke access to a resource for a WebID
 */
export async function revokeAccess(
  resourceUrl: string,
  webId: string,
  modes?: ACLMode[]
): Promise<StorageResult<void>> {
  const session = getSession();

  // Prevent revoking own Control access
  if (webId === session.webId && (!modes || modes.includes('Control'))) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Cannot revoke own Control access',
      },
    };
  }

  const existingResult = await getACL(resourceUrl);

  if (!existingResult.success) {
    return {
      success: false,
      error: existingResult.error,
    };
  }

  let entries = existingResult.data || [];

  if (modes) {
    // Remove specific modes
    entries = entries.map(e => {
      if (e.subject.type === 'agent' && e.subject.webId === webId) {
        return {
          ...e,
          modes: e.modes.filter(m => !modes.includes(m)),
        };
      }
      return e;
    }).filter(e => e.modes.length > 0);
  } else {
    // Remove all access for this WebID
    entries = entries.filter(
      e => !(e.subject.type === 'agent' && e.subject.webId === webId)
    );
  }

  return setACL(resourceUrl, entries);
}

/**
 * Map Nostr cohort to Solid ACL modes
 */
export function mapCohortToACLModes(
  cohort: CohortName,
  customMappings?: Partial<Record<CohortName, ACLMode[]>>
): ACLMode[] {
  const mappings = { ...DEFAULT_COHORT_MAPPINGS, ...customMappings };
  return mappings[cohort] || ['Read'];
}

/**
 * Create cohort-based ACL mapping
 */
export function createCohortACLMapping(
  cohort: CohortName,
  webIds: string[],
  customModes?: ACLMode[]
): CohortACLMapping {
  return {
    cohortName: cohort,
    modes: customModes || mapCohortToACLModes(cohort),
    agentWebIds: webIds,
  };
}

/**
 * Sync Nostr permissions (cohorts) to Solid ACL
 *
 * Takes a list of Nostr pubkeys with their cohorts and updates
 * the ACL on a Solid resource to match those permissions.
 */
export async function syncNostrPermissionsToACL(
  request: PermissionSyncRequest
): Promise<PermissionSyncResult> {
  const { resourceUrl, nostrPubkeys, cohorts, modes } = request;
  const errors: ACLSyncError[] = [];
  const appliedEntries: ACLEntry[] = [];

  // Get existing ACL
  const existingResult = await getACL(resourceUrl);
  const existingEntries = existingResult.success ? existingResult.data || [] : [];

  // Keep owner and public entries
  const session = getSession();
  const preservedEntries = existingEntries.filter(
    e =>
      (e.subject.type === 'agent' && e.subject.webId === session.webId) ||
      e.subject.type === 'public' ||
      e.subject.type === 'authenticated'
  );

  // Convert Nostr pubkeys to WebIDs and create entries
  for (const pubkey of nostrPubkeys) {
    try {
      const webId = pubkeyToWebID(pubkey);

      // Determine modes based on cohorts or explicit modes
      const entryModes: ACLMode[] = modes?.length
        ? modes
        : cohorts.flatMap(c => mapCohortToACLModes(c as CohortName));

      const uniqueModes = Array.from(new Set(entryModes));

      const entry: ACLEntry = {
        subject: {
          type: 'agent',
          webId,
        },
        modes: uniqueModes,
        resourceUrl,
      };

      appliedEntries.push(entry);
    } catch (error) {
      errors.push({
        pubkey,
        error: error instanceof Error ? error.message : 'Failed to create WebID',
      });
    }
  }

  // Combine preserved and new entries
  const allEntries = [...preservedEntries, ...appliedEntries];

  // Apply ACL
  const setResult = await setACL(resourceUrl, allEntries);

  if (!setResult.success) {
    return {
      success: false,
      resourceUrl,
      appliedEntries: [],
      errors: [{
        pubkey: '',
        error: setResult.error?.message || 'Failed to set ACL',
      }],
    };
  }

  return {
    success: errors.length === 0,
    resourceUrl,
    appliedEntries,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Check if a WebID has specific access to a resource
 */
export async function checkAccess(
  resourceUrl: string,
  webId: string,
  mode: ACLMode
): Promise<boolean> {
  const result = await getACL(resourceUrl);

  if (!result.success || !result.data) {
    return false;
  }

  for (const entry of result.data) {
    if (!entry.modes.includes(mode)) {
      continue;
    }

    switch (entry.subject.type) {
      case 'public':
        return true;
      case 'authenticated':
        // Any authenticated agent has access
        return true;
      case 'agent':
        if (entry.subject.webId === webId) {
          return true;
        }
        break;
      case 'group':
        // Group membership check would require fetching the group
        // For now, skip group checks
        break;
    }
  }

  return false;
}

/**
 * Get all WebIDs with access to a resource
 */
export async function getAccessList(
  resourceUrl: string
): Promise<StorageResult<Array<{ webId: string; modes: ACLMode[] }>>> {
  const result = await getACL(resourceUrl);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  const accessList: Array<{ webId: string; modes: ACLMode[] }> = [];

  for (const entry of result.data || []) {
    if (entry.subject.type === 'agent' && entry.subject.webId) {
      const existing = accessList.find(a => a.webId === entry.subject.webId);
      if (existing) {
        existing.modes = Array.from(new Set([...existing.modes, ...entry.modes]));
      } else {
        accessList.push({
          webId: entry.subject.webId,
          modes: [...entry.modes],
        });
      }
    }
  }

  return {
    success: true,
    data: accessList,
    url: result.url,
  };
}

/**
 * Create a public read-only ACL for a resource
 */
export async function makePublic(resourceUrl: string): Promise<StorageResult<void>> {
  const existingResult = await getACL(resourceUrl);
  const entries = existingResult.success ? existingResult.data || [] : [];

  // Add or update public access
  const publicIndex = entries.findIndex(e => e.subject.type === 'public');

  if (publicIndex >= 0) {
    if (!entries[publicIndex].modes.includes('Read')) {
      entries[publicIndex].modes.push('Read');
    }
  } else {
    entries.push({
      subject: { type: 'public' },
      modes: ['Read'],
      resourceUrl,
    });
  }

  return setACL(resourceUrl, entries);
}

/**
 * Remove public access from a resource
 */
export async function makePrivate(resourceUrl: string): Promise<StorageResult<void>> {
  const existingResult = await getACL(resourceUrl);

  if (!existingResult.success) {
    return {
      success: false,
      error: existingResult.error,
    };
  }

  const entries = (existingResult.data || []).filter(
    e => e.subject.type !== 'public' && e.subject.type !== 'authenticated'
  );

  return setACL(resourceUrl, entries);
}

/**
 * Clear ACL cache
 */
export function clearACLCache(resourceUrl?: string): void {
  if (resourceUrl) {
    aclCache.delete(resourceUrl);
  } else {
    aclCache.clear();
  }
}

export default {
  getACLUrl,
  parseACLDocument,
  generateACLDocument,
  getACL,
  setACL,
  grantAccess,
  revokeAccess,
  mapCohortToACLModes,
  createCohortACLMapping,
  syncNostrPermissionsToACL,
  checkAccess,
  getAccessList,
  makePublic,
  makePrivate,
  clearACLCache,
  ACLOperationError,
};
