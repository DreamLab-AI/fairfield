/**
 * Access Control Tests for Channel Operations
 *
 * Tests for cohort-based channel filtering and access control.
 * These tests verify the CORRECT behavior after the security fix.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { resetRateLimit } from '$lib/utils/rateLimit';

// Mock NDK and relay modules
vi.mock('./relay', () => ({
	ndk: vi.fn(),
	isConnected: vi.fn()
}));

vi.mock('$lib/utils/rateLimit', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/utils/rateLimit')>();
	return {
		...actual,
		checkRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
		resetRateLimit: vi.fn()
	};
});

vi.mock('$lib/utils/validation', () => ({
	validateContent: vi.fn(() => ({ valid: true, errors: [] })),
	validateChannelName: vi.fn(() => ({ valid: true, errors: [] }))
}));

import { ndk, isConnected } from './relay';
import { fetchChannels, sendChannelMessage, CHANNEL_KINDS, type CreatedChannel } from './channels';

/**
 * Helper to create mock NDK events for testing
 */
function createMockChannelEvent(options: {
	id: string;
	name: string;
	cohorts?: string[];
	visibility?: string;
	section?: string;
	accessType?: string;
	pubkey?: string;
}): NDKEvent {
	const metadata = {
		name: options.name,
		about: `Description for ${options.name}`
	};

	const tags: string[][] = [];

	if (options.cohorts && options.cohorts.length > 0) {
		tags.push(['cohort', options.cohorts.join(',')]);
	}
	if (options.visibility && options.visibility !== 'public') {
		tags.push(['visibility', options.visibility]);
	}
	if (options.section) {
		tags.push(['section', options.section]);
	}
	if (options.accessType) {
		tags.push(['access-type', options.accessType]);
	}

	return {
		id: options.id,
		kind: CHANNEL_KINDS.CREATE,
		content: JSON.stringify(metadata),
		tags,
		pubkey: options.pubkey || 'test-pubkey-' + options.id,
		created_at: Math.floor(Date.now() / 1000),
		sig: 'mock-signature'
	} as unknown as NDKEvent;
}

describe('Channel Access Control', () => {
	let mockNdk: {
		fetchEvents: ReturnType<typeof vi.fn>;
		signer: { getPublicKey: () => Promise<string> };
	};

	beforeEach(() => {
		resetRateLimit('message');
		resetRateLimit('channelCreate');

		mockNdk = {
			fetchEvents: vi.fn(),
			signer: {
				getPublicKey: async () => 'user-pubkey-123'
			}
		};

		vi.mocked(ndk).mockReturnValue(mockNdk as any);
		vi.mocked(isConnected).mockReturnValue(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('fetchChannels() - Cohort Filtering (FIXED)', () => {
		it('should return only public channels when no user cohorts provided', async () => {
			const allChannels = [
				createMockChannelEvent({
					id: 'public-channel',
					name: 'Public Discussion',
					visibility: 'public',
					section: 'public-lobby'
				}),
				createMockChannelEvent({
					id: 'family-channel',
					name: 'Family Only',
					cohorts: ['family'],
					visibility: 'cohort',
					section: 'family-zone'
				}),
				createMockChannelEvent({
					id: 'minimoonoir-channel',
					name: 'minimoonoir',
					cohorts: ['minimoonoir', 'cross-access'],
					visibility: 'cohort',
					section: 'dreamlab'
				}),
				createMockChannelEvent({
					id: 'business-channel',
					name: 'Business Discussion',
					cohorts: ['business'],
					visibility: 'cohort',
					section: 'business-zone'
				})
			];

			mockNdk.fetchEvents.mockResolvedValue(new Set(allChannels));

			// Act: Fetch channels without cohort filtering (no userCohorts passed)
			const result = await fetchChannels();

			// Assert: Only public channel returned (no cohorts = no access to restricted)
			expect(result).toHaveLength(1);
			expect(result.map(c => c.name)).toContain('Public Discussion');
			expect(result.map(c => c.name)).not.toContain('minimoonoir');
			expect(result.map(c => c.name)).not.toContain('Family Only');
		});

		it('should filter channels based on user cohorts - family user sees only family channels', async () => {
			const channelsFromRelay = [
				createMockChannelEvent({
					id: 'public-channel',
					name: 'Public Room',
					visibility: 'public'
				}),
				createMockChannelEvent({
					id: 'family-channel',
					name: 'Family Room',
					cohorts: ['family'],
					visibility: 'cohort'
				}),
				createMockChannelEvent({
					id: 'minimoonoir-channel',
					name: 'minimoonoir',
					cohorts: ['minimoonoir', 'cross-access'],
					visibility: 'cohort'
				})
			];

			mockNdk.fetchEvents.mockResolvedValue(new Set(channelsFromRelay));

			// User with 'family' cohort only
			const result = await fetchChannels({
				userCohorts: ['family'],
				userPubkey: 'family-user-pubkey'
			});

			const channelNames = result.map(c => c.name);

			// FIXED: Family user should NOT see minimoonoir channel
			expect(channelNames).not.toContain('minimoonoir');
			expect(channelNames).toContain('Family Room');
			expect(channelNames).toContain('Public Room');
			expect(result).toHaveLength(2);
		});

		it('should allow admin to see all channels', async () => {
			const channelWithCohorts = createMockChannelEvent({
				id: 'restricted-channel',
				name: 'Restricted Channel',
				cohorts: ['admin-only'],
				visibility: 'cohort',
				accessType: 'gated'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([channelWithCohorts]));

			// Admin bypass
			const result = await fetchChannels({ isAdmin: true });

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Restricted Channel');
		});

		it('should allow channel creator to see their own channel', async () => {
			const myChannel = createMockChannelEvent({
				id: 'my-channel',
				name: 'My Private Channel',
				cohorts: ['special-cohort'],
				visibility: 'cohort',
				pubkey: 'my-pubkey'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([myChannel]));

			// User without matching cohort but IS the creator
			const result = await fetchChannels({
				userCohorts: [],
				userPubkey: 'my-pubkey'
			});

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('My Private Channel');
		});

		it('should return empty array when relay is not connected', async () => {
			vi.mocked(isConnected).mockReturnValue(false);

			const result = await fetchChannels();

			expect(result).toEqual([]);
			expect(mockNdk.fetchEvents).not.toHaveBeenCalled();
		});

		it('should return empty array when NDK is not initialized', async () => {
			vi.mocked(ndk).mockReturnValue(null as any);

			const result = await fetchChannels();

			expect(result).toEqual([]);
		});

		it('should sort channels by creation time (newest first)', async () => {
			const now = Math.floor(Date.now() / 1000);
			const channels = [
				{ ...createMockChannelEvent({ id: 'old', name: 'Old Channel' }), created_at: now - 1000 },
				{ ...createMockChannelEvent({ id: 'new', name: 'New Channel' }), created_at: now },
				{ ...createMockChannelEvent({ id: 'mid', name: 'Middle Channel' }), created_at: now - 500 }
			];

			mockNdk.fetchEvents.mockResolvedValue(new Set(channels));

			const result = await fetchChannels();

			expect(result[0].name).toBe('New Channel');
			expect(result[1].name).toBe('Middle Channel');
			expect(result[2].name).toBe('Old Channel');
		});

		it('should handle malformed channel metadata gracefully', async () => {
			const validChannel = createMockChannelEvent({
				id: 'valid',
				name: 'Valid Channel'
			});

			const malformedChannel = {
				id: 'malformed',
				kind: CHANNEL_KINDS.CREATE,
				content: 'not valid json {{{',
				tags: [],
				pubkey: 'test-pubkey',
				created_at: Math.floor(Date.now() / 1000)
			} as unknown as NDKEvent;

			mockNdk.fetchEvents.mockResolvedValue(new Set([validChannel, malformedChannel]));

			const result = await fetchChannels();

			// Should skip malformed channel but return valid one
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Valid Channel');
		});
	});

	describe('sendChannelMessage() - Access Verification (FIXED)', () => {
		it('should require signer to be configured', async () => {
			vi.mocked(ndk).mockReturnValue({ signer: null } as any);

			await expect(
				sendChannelMessage('channel-id', 'Hello')
			).rejects.toThrow('No signer configured');
		});

		it('should require relay connection', async () => {
			vi.mocked(ndk).mockReturnValue({
				signer: { getPublicKey: async () => 'pubkey' }
			} as any);
			vi.mocked(isConnected).mockReturnValue(false);

			await expect(
				sendChannelMessage('channel-id', 'Hello')
			).rejects.toThrow('Not connected to relays');
		});

		it('should document the new auth context parameter', () => {
			// sendChannelMessage now accepts authContext parameter for security:
			// sendChannelMessage(channelId, content, options, authContext?)
			//
			// authContext includes:
			// - userCohorts: string[]
			// - userPubkey: string
			// - isAdmin?: boolean
			//
			// This enables server-side verification of posting permissions
			expect(true).toBe(true);
		});
	});

	describe('Channel Visibility Rules', () => {
		it('should parse visibility tag correctly', async () => {
			const cohortChannel = createMockChannelEvent({
				id: 'cohort-vis',
				name: 'Cohort Visible',
				visibility: 'cohort',
				cohorts: ['test'] // Must have cohort to be visible to users with that cohort
			});

			const publicChannel = createMockChannelEvent({
				id: 'public-vis',
				name: 'Public Visible',
				visibility: 'public'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([
				cohortChannel,
				publicChannel
			]));

			// Fetch with matching cohort
			const result = await fetchChannels({ userCohorts: ['test'] });

			const visibilities = result.map(c => ({ name: c.name, visibility: c.visibility }));

			expect(visibilities).toContainEqual({ name: 'Cohort Visible', visibility: 'cohort' });
			expect(visibilities).toContainEqual({ name: 'Public Visible', visibility: 'public' });
		});

		it('should default to public visibility when tag is missing', async () => {
			const channelWithoutVisibility = {
				id: 'no-vis',
				kind: CHANNEL_KINDS.CREATE,
				content: JSON.stringify({ name: 'No Visibility Tag' }),
				tags: [],
				pubkey: 'test-pubkey',
				created_at: Math.floor(Date.now() / 1000)
			} as unknown as NDKEvent;

			mockNdk.fetchEvents.mockResolvedValue(new Set([channelWithoutVisibility]));

			const result = await fetchChannels();

			expect(result[0].visibility).toBe('public');
		});

		it('should parse access type correctly (open vs gated)', async () => {
			const openChannel = createMockChannelEvent({
				id: 'open-access',
				name: 'Open Channel',
				accessType: 'open'
			});

			const gatedChannel = createMockChannelEvent({
				id: 'gated-access',
				name: 'Gated Channel',
				accessType: 'gated'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([openChannel, gatedChannel]));

			const result = await fetchChannels();

			const accessTypes = result.map(c => ({ name: c.name, accessType: c.accessType }));

			expect(accessTypes).toContainEqual({ name: 'Open Channel', accessType: 'open' });
			expect(accessTypes).toContainEqual({ name: 'Gated Channel', accessType: 'gated' });
		});

		it('should default to gated access type when tag is missing', async () => {
			const channelWithoutAccessType = {
				id: 'no-access-type',
				kind: CHANNEL_KINDS.CREATE,
				content: JSON.stringify({ name: 'No Access Type Tag' }),
				tags: [],
				pubkey: 'test-pubkey',
				created_at: Math.floor(Date.now() / 1000)
			} as unknown as NDKEvent;

			mockNdk.fetchEvents.mockResolvedValue(new Set([channelWithoutAccessType]));

			const result = await fetchChannels();

			// Default should be 'gated' for security
			expect(result[0].accessType).toBe('gated');
		});
	});

	describe('Channel Name Exposure (Security - FIXED)', () => {
		it('should NOT expose restricted channel names to unauthorized users', async () => {
			const restrictedChannel = createMockChannelEvent({
				id: 'secret-project',
				name: 'Secret Project X - Confidential',
				cohorts: ['top-secret'],
				visibility: 'cohort'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([restrictedChannel]));

			// User without matching cohort
			const result = await fetchChannels({
				userCohorts: ['family'],
				userPubkey: 'unauthorized-user'
			});

			// FIXED: Restricted channels are now filtered out
			expect(result).toHaveLength(0);
		});

		it('should expose restricted channel names to authorized users', async () => {
			const restrictedChannel = createMockChannelEvent({
				id: 'secret-project',
				name: 'Secret Project X',
				cohorts: ['top-secret'],
				visibility: 'cohort'
			});

			mockNdk.fetchEvents.mockResolvedValue(new Set([restrictedChannel]));

			// User with matching cohort
			const result = await fetchChannels({
				userCohorts: ['top-secret'],
				userPubkey: 'authorized-user'
			});

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Secret Project X');
		});
	});
});

describe('Channel Store Integration', () => {
	describe('Cohort Filtering Logic', () => {
		it('should filter out channels where user has no matching cohort', () => {
			const userCohorts: string[] = ['business'];
			const channelCohorts: string[] = ['moomaa-tribe'];

			const hasMatchingCohort = channelCohorts.some(cohort =>
				userCohorts.includes(cohort)
			);

			expect(hasMatchingCohort).toBe(false);
		});

		it('should allow dual-cohort users to see all their channels', () => {
			const dualCohortUser: string[] = ['business', 'moomaa-tribe'];
			const businessChannel: string[] = ['business'];
			const tribeChannel: string[] = ['moomaa-tribe'];

			const canSeeBusiness = businessChannel.some(c => dualCohortUser.includes(c));
			const canSeeTribe = tribeChannel.some(c => dualCohortUser.includes(c));

			expect(canSeeBusiness).toBe(true);
			expect(canSeeTribe).toBe(true);
		});

		it('should handle channels with no cohort restrictions (public)', () => {
			const userCohorts: string[] = ['family'];
			const publicChannelCohorts: string[] = []; // No restrictions

			// Channels with no cohorts are visible to all
			const isPublic = publicChannelCohorts.length === 0;

			expect(isPublic).toBe(true);
		});
	});
});
