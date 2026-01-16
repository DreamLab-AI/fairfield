/**
 * Section Access Nostr Service
 *
 * Handles Nostr events for section (area) access control:
 * - kind 9022: Section access request (user -> admin)
 * - kind 9023: Section access approval (admin -> user)
 * - kind 30079: Section statistics (replaceable)
 *
 * When admin approves a request, this service:
 * 1. Publishes kind 9023 approval event
 * 2. Sends encrypted DM (NIP-17) to user notifying them
 */

import { ndk, isConnected } from './relay';
import { NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import type {
  ChannelSection,
  SectionAccessRequest,
  SectionStats,
  UserSectionAccess
} from '$lib/types/channel';
import { sectionStore } from '$lib/stores/sections';
import { SECTION_CONFIG } from '$lib/types/channel';

// NIP event kinds
const KIND_SECTION_REQUEST = 9022;
const KIND_SECTION_APPROVAL = 9023;
const KIND_SECTION_STATS = 30079;
const KIND_GIFT_WRAP = 1059;  // NIP-17/NIP-59 gift-wrapped DM (required since 2025-12-01)
// NOTE: KIND_DM (4) removed - NIP-04 no longer supported as of 2025-12-01

/**
 * Request access to a section
 *
 * Publishes kind 9022 event:
 * {
 *   kind: 9022,
 *   content: optional message,
 *   tags: [
 *     ['section', 'community-rooms'],
 *     ['p', adminPubkey]  // Notify admin(s)
 *   ]
 * }
 */
export async function requestSectionAccess(
  section: ChannelSection,
  message?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!browser) {
    return { success: false, error: 'Not in browser' };
  }

  // Don't allow requests for public-lobby (auto-approved)
  if (section === 'public-lobby') {
    return { success: false, error: 'This section does not require approval' };
  }

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) {
      return { success: false, error: 'NDK not initialized' };
    }

    const signer = ndkInstance.signer;
    if (!signer) {
      return { success: false, error: 'No signer available' };
    }

    const user = await signer.user();
    if (!user?.pubkey) {
      return { success: false, error: 'Unable to get user pubkey' };
    }

    // Get admin pubkeys from environment
    const adminPubkeys = (import.meta.env.VITE_ADMIN_PUBKEY || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);

    if (adminPubkeys.length === 0) {
      return { success: false, error: 'No admin configured' };
    }

    // Create request event
    const event = new NDKEvent(ndkInstance);
    event.kind = KIND_SECTION_REQUEST;
    event.content = message || '';
    event.tags = [
      ['section', section],
      ...adminPubkeys.map((pk: string) => ['p', pk])
    ];

    await event.sign(signer);
    await event.publish();

    if (import.meta.env.DEV) {
      console.log('[Sections] Access request published:', {
        section,
        eventId: event.id
      });
    }

    return { success: true, eventId: event.id };

  } catch (error) {
    console.error('[Sections] Failed to request access:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish request'
    };
  }
}

/**
 * Approve a section access request (admin only)
 *
 * Publishes kind 9023 approval event and sends DM to user
 */
export async function approveSectionAccess(
  request: SectionAccessRequest
): Promise<{ success: boolean; error?: string }> {
  if (!browser) {
    return { success: false, error: 'Not in browser' };
  }

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) {
      return { success: false, error: 'NDK not initialized' };
    }

    const signer = ndkInstance.signer;
    if (!signer) {
      return { success: false, error: 'No signer available' };
    }

    const admin = await signer.user();
    if (!admin?.pubkey) {
      return { success: false, error: 'Unable to get admin pubkey' };
    }

    // Create approval event
    const approvalEvent = new NDKEvent(ndkInstance);
    approvalEvent.kind = KIND_SECTION_APPROVAL;
    approvalEvent.content = JSON.stringify({
      section: request.section,
      approvedAt: Date.now()
    });
    approvalEvent.tags = [
      ['section', request.section],
      ['p', request.requesterPubkey],
      ['e', request.id]  // Reference to original request
    ];

    await approvalEvent.sign(signer);
    await approvalEvent.publish();

    // Send DM to user notifying them
    const sectionConfig = SECTION_CONFIG[request.section];
    const dmContent = `Welcome to ${sectionConfig.name}! Your access request has been approved. You can now join public channels in this area.`;

    await sendAccessApprovalDM(request.requesterPubkey, dmContent);

    if (import.meta.env.DEV) {
      console.log('[Sections] Access approved:', {
        section: request.section,
        user: request.requesterPubkey.slice(0, 8) + '...'
      });
    }

    return { success: true };

  } catch (error) {
    console.error('[Sections] Failed to approve access:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve'
    };
  }
}

/**
 * Send DM to user notifying them of section access approval
 *
 * Uses NIP-44/NIP-59 gift wrap (kind 1059) for encrypted DMs.
 * NIP-04 was removed on 2025-12-01.
 */
async function sendAccessApprovalDM(
  recipientPubkey: string,
  message: string
): Promise<void> {
  try {
    const ndkInstance = ndk();
    if (!ndkInstance) {
      console.warn('[Sections] Cannot send DM: NDK not initialized');
      return;
    }

    const signer = ndkInstance.signer;
    if (!signer) {
      console.warn('[Sections] Cannot send DM: no signer');
      return;
    }

    // Use NIP-44/NIP-59 gift wrap for encrypted DM
    // NOTE: NIP-04 was removed on 2025-12-01
    const user = await signer.user();
    if (user) {
      // Create the inner sealed event (kind 13)
      const sealedEvent = new NDKEvent(ndkInstance);
      sealedEvent.kind = 13; // Sealed (NIP-59)
      sealedEvent.tags = [['p', recipientPubkey]];
      sealedEvent.content = message;
      sealedEvent.created_at = Math.floor(Date.now() / 1000);
      await sealedEvent.sign(signer);

      // Create the gift wrap (kind 1059)
      const giftWrapEvent = new NDKEvent(ndkInstance);
      giftWrapEvent.kind = KIND_GIFT_WRAP;
      giftWrapEvent.tags = [['p', recipientPubkey]];

      // Encrypt the sealed event using NIP-44
      giftWrapEvent.content = await signer.encrypt(
        { pubkey: recipientPubkey } as any,
        JSON.stringify(sealedEvent.rawEvent())
      );
      giftWrapEvent.created_at = Math.floor(Date.now() / 1000);
      await giftWrapEvent.sign(signer);
      await giftWrapEvent.publish();

      if (import.meta.env.DEV) {
        console.log('[Sections] Approval DM (NIP-59 gift wrap) sent to:', recipientPubkey.slice(0, 8) + '...');
      }
    }
  } catch (error) {
    console.error('[Sections] Failed to send approval DM:', error);
    // Don't throw - DM is not critical to approval
  }
}

/**
 * Fetch pending section access requests (for admin)
 */
export async function fetchPendingRequests(): Promise<SectionAccessRequest[]> {
  if (!browser) return [];

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) return [];

    // Fetch kind 9022 requests addressed to admin
    const adminPubkeys = (import.meta.env.VITE_ADMIN_PUBKEY || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);

    if (adminPubkeys.length === 0) return [];

    const filter: NDKFilter = {
      kinds: [KIND_SECTION_REQUEST as number],
      '#p': adminPubkeys,
      limit: 100
    };

    const events = await ndkInstance.fetchEvents(filter);
    const requests: SectionAccessRequest[] = [];

    // Also fetch approvals to filter out already-approved requests
    const approvalFilter: NDKFilter = {
      kinds: [KIND_SECTION_APPROVAL as number],
      limit: 500
    };
    const approvalEvents = await ndkInstance.fetchEvents(approvalFilter);
    const approvedRequestIds = new Set(
      Array.from(approvalEvents)
        .flatMap(e => e.tags.filter(t => t[0] === 'e').map(t => t[1]))
    );

    for (const event of events) {
      // Skip if already approved
      if (approvedRequestIds.has(event.id)) continue;

      const sectionTag = event.tags.find(t => t[0] === 'section')?.[1];
      if (!sectionTag) continue;

      requests.push({
        id: event.id,
        section: sectionTag as ChannelSection,
        requesterPubkey: event.pubkey,
        requestedAt: (event.created_at || 0) * 1000,
        message: event.content || undefined,
        status: 'pending'
      });
    }

    return requests;

  } catch (error) {
    console.error('[Sections] Failed to fetch requests:', error);
    return [];
  }
}

/**
 * Fetch user's section access status from relay
 */
export async function fetchUserAccess(
  userPubkey: string
): Promise<UserSectionAccess[]> {
  if (!browser || !userPubkey) return [];

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) return [];

    // Fetch approval events for this user
    const filter: NDKFilter = {
      kinds: [KIND_SECTION_APPROVAL as number],
      '#p': [userPubkey],
      limit: 50
    };

    const events = await ndkInstance.fetchEvents(filter);
    const access: UserSectionAccess[] = [];

    // public-lobby is always approved
    access.push({ section: 'public-lobby', status: 'approved' });

    for (const event of events) {
      const sectionTag = event.tags.find(t => t[0] === 'section')?.[1];
      if (!sectionTag) continue;

      let content: { approvedAt?: number } = {};
      try {
        content = JSON.parse(event.content);
      } catch { /* ignore */ }

      access.push({
        section: sectionTag as ChannelSection,
        status: 'approved',
        approvedAt: content.approvedAt || (event.created_at || 0) * 1000,
        approvedBy: event.pubkey
      });
    }

    // Also check for pending requests
    const requestFilter: NDKFilter = {
      kinds: [KIND_SECTION_REQUEST as number],
      authors: [userPubkey],
      limit: 10
    };

    const requestEvents = await ndkInstance.fetchEvents(requestFilter);
    const approvedSections = new Set(access.map(a => a.section));

    for (const event of requestEvents) {
      const sectionTag = event.tags.find(t => t[0] === 'section')?.[1];
      if (!sectionTag || approvedSections.has(sectionTag as ChannelSection)) continue;

      access.push({
        section: sectionTag as ChannelSection,
        status: 'pending',
        requestedAt: (event.created_at || 0) * 1000
      });
    }

    return access;

  } catch (error) {
    console.error('[Sections] Failed to fetch user access:', error);
    return [];
  }
}

/**
 * Fetch section statistics
 */
export async function fetchSectionStats(): Promise<SectionStats[]> {
  if (!browser) return [];

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) return [];

    const filter: NDKFilter = {
      kinds: [KIND_SECTION_STATS as number],
      limit: 10
    };

    const events = await ndkInstance.fetchEvents(filter);
    const stats: SectionStats[] = [];

    for (const event of events) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;

      let content: Partial<SectionStats> = {};
      try {
        content = JSON.parse(event.content);
      } catch { /* ignore */ }

      stats.push({
        section: dTag as ChannelSection,
        channelCount: content.channelCount || 0,
        memberCount: content.memberCount || 0,
        messageCount: content.messageCount || 0,
        lastActivity: content.lastActivity || (event.created_at || 0) * 1000
      });
    }

    return stats;

  } catch (error) {
    console.error('[Sections] Failed to fetch stats:', error);
    return [];
  }
}

/**
 * Subscribe to section access events for current user
 */
export function subscribeSectionEvents(
  userPubkey: string,
  onApproval: (access: UserSectionAccess) => void
): NDKSubscription | null {
  if (!browser || !userPubkey) return null;

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) return null;

    const filter: NDKFilter = {
      kinds: [KIND_SECTION_APPROVAL as number],
      '#p': [userPubkey],
      since: Math.floor(Date.now() / 1000)
    };

    const sub = ndkInstance.subscribe(filter, { closeOnEose: false });

    sub.on('event', (event: NDKEvent) => {
      const sectionTag = event.tags.find(t => t[0] === 'section')?.[1];
      if (!sectionTag) return;

      let content: { approvedAt?: number } = {};
      try {
        content = JSON.parse(event.content);
      } catch { /* ignore */ }

      onApproval({
        section: sectionTag as ChannelSection,
        status: 'approved',
        approvedAt: content.approvedAt || (event.created_at || 0) * 1000,
        approvedBy: event.pubkey
      });
    });

    return sub;

  } catch (error) {
    console.error('[Sections] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Admin: Subscribe to incoming section access requests
 */
export function subscribeAccessRequests(
  onRequest: (request: SectionAccessRequest) => void
): NDKSubscription | null {
  if (!browser) return null;

  try {
    const ndkInstance = ndk();
    if (!ndkInstance) return null;

    const adminPubkeys = (import.meta.env.VITE_ADMIN_PUBKEY || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);

    if (adminPubkeys.length === 0) return null;

    const filter: NDKFilter = {
      kinds: [KIND_SECTION_REQUEST as number],
      '#p': adminPubkeys,
      since: Math.floor(Date.now() / 1000)
    };

    const sub = ndkInstance.subscribe(filter, { closeOnEose: false });

    sub.on('event', (event: NDKEvent) => {
      const sectionTag = event.tags.find(t => t[0] === 'section')?.[1];
      if (!sectionTag) return;

      onRequest({
        id: event.id,
        section: sectionTag as ChannelSection,
        requesterPubkey: event.pubkey,
        requestedAt: (event.created_at || 0) * 1000,
        message: event.content || undefined,
        status: 'pending'
      });
    });

    return sub;

  } catch (error) {
    console.error('[Sections] Failed to subscribe to requests:', error);
    return null;
  }
}
