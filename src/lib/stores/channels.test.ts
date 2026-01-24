/**
 * Channel Store Access Control Tests
 *
 * Tests for cohort-based filtering logic in the channel store.
 * The store's fetchChannels() function should filter channels based on user cohorts.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import type { ChannelSection, ChannelVisibility, ChannelAccessType } from '$lib/types/channel';

// Import store functions and types
import {
	channelStore,
	fetchChannels,
	setCurrentChannel,
	getCurrentChannel,
	getChannelsByCohort,
	getChannelsBySection,
	clearChannels,
	updateChannel,
	removeChannel,
	type Channel
} from './channels';

/**
 * Create mock NDK instance for testing
 */
function createMockNDK(events: NDKEvent[]): NDK {
	return {
		fetchEvents: vi.fn().mockResolvedValue(new Set(events))
	} as unknown as NDK;
}

/**
 * Create mock channel metadata event (kind 39000)
 * Note: The store expects cohort tags as separate ['cohort', value] entries
 */
function createMockMetadataEvent(options: {
	groupId: string;
	name: string;
	about?: string;
	cohorts?: ('business' | 'moomaa-tribe')[];
	section?: ChannelSection;
	visibility?: ChannelVisibility;
	accessType?: ChannelAccessType;
	encrypted?: boolean;
}): NDKEvent {
	const tags: string[][] = [
		['d', options.groupId]
	];

	// Add each cohort as a separate tag (matching implementation expectation)
	if (options.cohorts) {
		options.cohorts.forEach(cohort => {
			tags.push(['cohort', cohort]);
		});
	}

	if (options.section) {
		tags.push(['section', options.section]);
	}

	if (options.visibility) {
		tags.push(['visibility', options.visibility]);
	}

	if (options.accessType) {
		tags.push(['access-type', options.accessType]);
	}

	if (options.encrypted) {
		tags.push(['encrypted', 'true']);
	}

	return {
		id: 'event-' + options.groupId,
		kind: 39000,
		content: JSON.stringify({
			name: options.name,
			about: options.about || `Description for ${options.name}`
		}),
		tags,
		pubkey: 'creator-pubkey',
		created_at: Math.floor(Date.now() / 1000)
	} as unknown as NDKEvent;
}

/**
 * Create mock member list event (kind 39002)
 */
function createMockMemberEvent(options: {
	groupId: string;
	members: string[];
}): NDKEvent {
	const tags: string[][] = [
		['d', options.groupId]
	];

	options.members.forEach(pubkey => {
		tags.push(['p', pubkey]);
	});

	return {
		id: 'members-' + options.groupId,
		kind: 39002,
		content: '',
		tags,
		pubkey: 'admin-pubkey',
		created_at: Math.floor(Date.now() / 1000)
	} as unknown as NDKEvent;
}

/**
 * Create mock join request event (kind 9021)
 */
function createMockJoinRequestEvent(options: {
	groupId: string;
	userPubkey: string;
}): NDKEvent {
	return {
		id: 'request-' + options.groupId,
		kind: 9021,
		content: '',
		tags: [['h', options.groupId]],
		pubkey: options.userPubkey,
		created_at: Math.floor(Date.now() / 1000)
	} as unknown as NDKEvent;
}

describe('Channel Store - Cohort Filtering', () => {
	const USER_PUBKEY = 'test-user-pubkey';

	beforeEach(() => {
		clearChannels();
	});

	afterEach(() => {
		vi.clearAllMocks();
		clearChannels();
	});

	describe('fetchChannels() with User Cohorts', () => {
		it('should filter out channels that do not match user cohorts', async () => {
			// Setup: User has only 'business' cohort
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			// Create channels with different cohort requirements
			// Note: visibility='cohort' channels require BOTH cohort match AND membership to be visible
			// visibility='public' channels with cohort restrictions still filter by cohort
			const metadataEvents = [
				createMockMetadataEvent({
					groupId: 'business-chat',
					name: 'Business Discussion',
					cohorts: ['business'],
					visibility: 'public' // Public visibility so cohort match alone is enough
				}),
				createMockMetadataEvent({
					groupId: 'tribe-chat',
					name: 'Tribe Only',
					cohorts: ['moomaa-tribe'],
					visibility: 'public'
				}),
				createMockMetadataEvent({
					groupId: 'public-chat',
					name: 'Public Lobby',
					// No cohorts = visible to all
					visibility: 'public'
				})
			];

			const memberEvents: NDKEvent[] = [];
			const requestEvents: NDKEvent[] = [];

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set(metadataEvents))  // First call: metadata
					.mockResolvedValueOnce(new Set(memberEvents))    // Second call: members
					.mockResolvedValueOnce(new Set(requestEvents))   // Third call: requests
			} as unknown as NDK;

			// Act
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Assert: Should only include business and public channels
			// moomaa-tribe channel should be filtered out due to cohort mismatch
			expect(channels).toHaveLength(2);
			expect(channels.map(c => c.name)).toContain('Business Discussion');
			expect(channels.map(c => c.name)).toContain('Public Lobby');
			expect(channels.map(c => c.name)).not.toContain('Tribe Only');
		});

		it('should show all channels to dual-cohort users', async () => {
			// Setup: User has both cohorts (cross-access)
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business', 'moomaa-tribe'];

			// Using public visibility so cohort match is sufficient
			const metadataEvents = [
				createMockMetadataEvent({
					groupId: 'business-chat',
					name: 'Business Discussion',
					cohorts: ['business'],
					visibility: 'public'
				}),
				createMockMetadataEvent({
					groupId: 'tribe-chat',
					name: 'Tribe Only',
					cohorts: ['moomaa-tribe'],
					visibility: 'public'
				})
			];

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set(metadataEvents))
					.mockResolvedValueOnce(new Set([]))
					.mockResolvedValueOnce(new Set([]))
			} as unknown as NDK;

			// Act
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Assert: Dual-cohort user sees all channels
			expect(channels).toHaveLength(2);
			expect(channels.map(c => c.name)).toContain('Business Discussion');
			expect(channels.map(c => c.name)).toContain('Tribe Only');
		});

		it('should hide cohort-visibility channels from non-members', async () => {
			// Setup: User has business cohort but is not a member of the tribe channel
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const metadataEvents = [
				createMockMetadataEvent({
					groupId: 'tribe-secret',
					name: 'Tribe Secret Room',
					cohorts: ['moomaa-tribe'],
					visibility: 'cohort'
				})
			];

			// User is not in the member list
			const memberEvents = [
				createMockMemberEvent({
					groupId: 'tribe-secret',
					members: ['other-user-1', 'other-user-2']
				})
			];

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set(metadataEvents))
					.mockResolvedValueOnce(new Set(memberEvents))
					.mockResolvedValueOnce(new Set([]))
			} as unknown as NDK;

			// Act
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Assert: Cohort channel hidden from non-matching cohort user
			expect(channels).toHaveLength(0);
		});

		it('should correctly set isMember flag based on member list', async () => {
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const metadataEvents = [
				createMockMetadataEvent({
					groupId: 'business-members',
					name: 'Business Members',
					cohorts: ['business'],
					visibility: 'public'
				})
			];

			// User IS in the member list
			const memberEvents = [
				createMockMemberEvent({
					groupId: 'business-members',
					members: [USER_PUBKEY, 'other-user']
				})
			];

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set(metadataEvents))
					.mockResolvedValueOnce(new Set(memberEvents))
					.mockResolvedValueOnce(new Set([]))
			} as unknown as NDK;

			// Act
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Assert
			expect(channels).toHaveLength(1);
			expect(channels[0].isMember).toBe(true);
		});

		it('should correctly set hasRequestPending flag', async () => {
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const metadataEvents = [
				createMockMetadataEvent({
					groupId: 'pending-channel',
					name: 'Pending Access',
					cohorts: ['business'],
					visibility: 'public'
				})
			];

			// User has a pending join request
			const requestEvents = [
				createMockJoinRequestEvent({
					groupId: 'pending-channel',
					userPubkey: USER_PUBKEY
				})
			];

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set(metadataEvents))
					.mockResolvedValueOnce(new Set([]))
					.mockResolvedValueOnce(new Set(requestEvents))
			} as unknown as NDK;

			// Act
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Assert
			expect(channels).toHaveLength(1);
			expect(channels[0].hasRequestPending).toBe(true);
		});
	});

	describe('Channel Filtering Helpers', () => {
		beforeEach(async () => {
			// Populate store with test channels
			const testChannels: Channel[] = [
				{
					id: 'business-1',
					name: 'Business Room 1',
					description: 'Business discussion',
					cohorts: ['business'],
					section: 'community-rooms',
					visibility: 'cohort',
					accessType: 'gated',
					isEncrypted: false,
					memberCount: 10,
					createdAt: Date.now(),
					isMember: true,
					hasRequestPending: false
				},
				{
					id: 'tribe-1',
					name: 'Tribe Room 1',
					description: 'Tribe discussion',
					cohorts: ['moomaa-tribe'],
					section: 'dreamlab',
					visibility: 'cohort',
					accessType: 'gated',
					isEncrypted: false,
					memberCount: 5,
					createdAt: Date.now(),
					isMember: false,
					hasRequestPending: false
				},
				{
					id: 'public-1',
					name: 'Public Lobby',
					description: 'Public discussion',
					cohorts: [],
					section: 'public-lobby',
					visibility: 'public',
					accessType: 'open',
					isEncrypted: false,
					memberCount: 100,
					createdAt: Date.now(),
					isMember: true,
					hasRequestPending: false
				}
			];

			channelStore.update(state => ({
				...state,
				channels: testChannels
			}));
		});

		it('should filter channels by cohort', () => {
			const businessChannels = getChannelsByCohort('business');
			const tribeChannels = getChannelsByCohort('moomaa-tribe');

			expect(businessChannels).toHaveLength(1);
			expect(businessChannels[0].name).toBe('Business Room 1');

			expect(tribeChannels).toHaveLength(1);
			expect(tribeChannels[0].name).toBe('Tribe Room 1');
		});

		it('should filter channels by section', () => {
			const publicLobbyChannels = getChannelsBySection('public-lobby');
			const communityChannels = getChannelsBySection('community-rooms');
			const dreamlabChannels = getChannelsBySection('dreamlab');

			expect(publicLobbyChannels).toHaveLength(1);
			expect(publicLobbyChannels[0].name).toBe('Public Lobby');

			expect(communityChannels).toHaveLength(1);
			expect(communityChannels[0].name).toBe('Business Room 1');

			expect(dreamlabChannels).toHaveLength(1);
			expect(dreamlabChannels[0].name).toBe('Tribe Room 1');
		});
	});

	describe('Store State Management', () => {
		it('should set current channel', () => {
			const testChannel: Channel = {
				id: 'test-channel',
				name: 'Test Channel',
				description: 'Test',
				cohorts: ['business'],
				section: 'public-lobby',
				visibility: 'public',
				accessType: 'open',
				isEncrypted: false,
				memberCount: 1,
				createdAt: Date.now(),
				isMember: true,
				hasRequestPending: false
			};

			setCurrentChannel(testChannel);

			const current = getCurrentChannel();
			expect(current).toEqual(testChannel);
		});

		it('should clear current channel when set to null', () => {
			const testChannel: Channel = {
				id: 'test-channel',
				name: 'Test',
				description: '',
				cohorts: [],
				section: 'public-lobby',
				visibility: 'public',
				accessType: 'open',
				isEncrypted: false,
				memberCount: 0,
				createdAt: Date.now(),
				isMember: false,
				hasRequestPending: false
			};

			setCurrentChannel(testChannel);
			expect(getCurrentChannel()).not.toBeNull();

			setCurrentChannel(null);
			expect(getCurrentChannel()).toBeNull();
		});

		it('should update individual channel properties', () => {
			const channel: Channel = {
				id: 'update-test',
				name: 'Original Name',
				description: 'Original',
				cohorts: [],
				section: 'public-lobby',
				visibility: 'public',
				accessType: 'open',
				isEncrypted: false,
				memberCount: 5,
				createdAt: Date.now(),
				isMember: false,
				hasRequestPending: false
			};

			channelStore.update(state => ({
				...state,
				channels: [channel]
			}));

			updateChannel('update-test', { name: 'Updated Name', memberCount: 10 });

			const state = get(channelStore);
			expect(state.channels[0].name).toBe('Updated Name');
			expect(state.channels[0].memberCount).toBe(10);
		});

		it('should remove channel from store', () => {
			const channels: Channel[] = [
				{
					id: 'keep-this',
					name: 'Keep',
					description: '',
					cohorts: [],
					section: 'public-lobby',
					visibility: 'public',
					accessType: 'open',
					isEncrypted: false,
					memberCount: 0,
					createdAt: Date.now(),
					isMember: false,
					hasRequestPending: false
				},
				{
					id: 'remove-this',
					name: 'Remove',
					description: '',
					cohorts: [],
					section: 'public-lobby',
					visibility: 'public',
					accessType: 'open',
					isEncrypted: false,
					memberCount: 0,
					createdAt: Date.now(),
					isMember: false,
					hasRequestPending: false
				}
			];

			channelStore.update(state => ({
				...state,
				channels
			}));

			removeChannel('remove-this');

			const state = get(channelStore);
			expect(state.channels).toHaveLength(1);
			expect(state.channels[0].id).toBe('keep-this');
		});

		it('should clear current channel when removed channel was current', () => {
			const channel: Channel = {
				id: 'current-channel',
				name: 'Current',
				description: '',
				cohorts: [],
				section: 'public-lobby',
				visibility: 'public',
				accessType: 'open',
				isEncrypted: false,
				memberCount: 0,
				createdAt: Date.now(),
				isMember: false,
				hasRequestPending: false
			};

			channelStore.update(state => ({
				...state,
				channels: [channel],
				currentChannel: channel
			}));

			expect(getCurrentChannel()).not.toBeNull();

			removeChannel('current-channel');

			expect(getCurrentChannel()).toBeNull();
		});

		it('should clear all channels on clearChannels()', () => {
			const channel: Channel = {
				id: 'test',
				name: 'Test',
				description: '',
				cohorts: [],
				section: 'public-lobby',
				visibility: 'public',
				accessType: 'open',
				isEncrypted: false,
				memberCount: 0,
				createdAt: Date.now(),
				isMember: false,
				hasRequestPending: false
			};

			channelStore.update(state => ({
				...state,
				channels: [channel],
				currentChannel: channel
			}));

			clearChannels();

			const state = get(channelStore);
			expect(state.channels).toHaveLength(0);
			expect(state.currentChannel).toBeNull();
			expect(state.loading).toBe(false);
			expect(state.error).toBeNull();
		});
	});

	describe('Error Handling', () => {
		it('should handle fetch errors gracefully', async () => {
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const mockNdk = {
				fetchEvents: vi.fn().mockRejectedValue(new Error('Network error'))
			} as unknown as NDK;

			await expect(
				fetchChannels(mockNdk, USER_PUBKEY, userCohorts)
			).rejects.toThrow('Network error');

			const state = get(channelStore);
			expect(state.loading).toBe(false);
			expect(state.error).toBe('Network error');
		});

		it('should handle malformed metadata gracefully', async () => {
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const validEvent = createMockMetadataEvent({
				groupId: 'valid',
				name: 'Valid Channel',
				cohorts: ['business'],
				visibility: 'public'
			});

			// Malformed event - content is not valid JSON
			// The implementation uses try/catch and sets metadata = {} on parse failure
			// This means the channel will be created with name='Unnamed Channel'
			const malformedEvent = {
				id: 'malformed',
				kind: 39000,
				content: 'not json',
				tags: [['d', 'malformed'], ['cohort', 'business']],
				pubkey: 'test',
				created_at: Date.now()
			} as unknown as NDKEvent;

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set([validEvent, malformedEvent]))
					.mockResolvedValueOnce(new Set([]))
					.mockResolvedValueOnce(new Set([]))
			} as unknown as NDK;

			// The implementation doesn't skip malformed events - it uses default values
			// This is actually the correct behavior per the implementation
			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Both channels should be included - one with real name, one with default
			expect(channels).toHaveLength(2);
			expect(channels.map(c => c.name)).toContain('Valid Channel');
			expect(channels.map(c => c.name)).toContain('Unnamed Channel');
		});

		it('should handle missing group ID gracefully', async () => {
			const userCohorts: ('business' | 'moomaa-tribe')[] = ['business'];

			const eventWithoutGroupId = {
				id: 'no-group-id',
				kind: 39000,
				content: JSON.stringify({ name: 'No Group ID' }),
				tags: [], // Missing 'd' tag
				pubkey: 'test',
				created_at: Date.now()
			} as unknown as NDKEvent;

			const mockNdk = {
				fetchEvents: vi.fn()
					.mockResolvedValueOnce(new Set([eventWithoutGroupId]))
					.mockResolvedValueOnce(new Set([]))
					.mockResolvedValueOnce(new Set([]))
			} as unknown as NDK;

			const channels = await fetchChannels(mockNdk, USER_PUBKEY, userCohorts);

			// Channel without group ID should be skipped
			expect(channels).toHaveLength(0);
		});
	});
});

describe('Access Type Validation for Message Posting', () => {
	// These tests document expected behavior for validating message posting access

	interface ChannelAccessCheck {
		channelId: string;
		accessType: ChannelAccessType;
		channelCohorts: string[];
		userCohorts: string[];
		isMember: boolean;
	}

	function canPostMessage(check: ChannelAccessCheck): {
		allowed: boolean;
		reason?: string;
	} {
		// Open channels allow anyone to post
		if (check.accessType === 'open') {
			return { allowed: true };
		}

		// Gated channels require membership or cohort match
		if (check.isMember) {
			return { allowed: true };
		}

		// Check cohort access for non-members
		const hasCohortAccess = check.channelCohorts.length === 0 ||
			check.channelCohorts.some(c => check.userCohorts.includes(c));

		if (!hasCohortAccess) {
			return {
				allowed: false,
				reason: 'User does not have required cohort access'
			};
		}

		return {
			allowed: false,
			reason: 'Channel is gated and user is not a member'
		};
	}

	it('should allow posting to open channels regardless of cohort', () => {
		const result = canPostMessage({
			channelId: 'open-channel',
			accessType: 'open',
			channelCohorts: ['business'],
			userCohorts: ['moomaa-tribe'], // Different cohort
			isMember: false
		});

		expect(result.allowed).toBe(true);
	});

	it('should allow members to post to gated channels', () => {
		const result = canPostMessage({
			channelId: 'gated-channel',
			accessType: 'gated',
			channelCohorts: ['business'],
			userCohorts: ['moomaa-tribe'],
			isMember: true // Is a member
		});

		expect(result.allowed).toBe(true);
	});

	it('should deny non-members without cohort access to gated channels', () => {
		const result = canPostMessage({
			channelId: 'gated-channel',
			accessType: 'gated',
			channelCohorts: ['business'],
			userCohorts: ['moomaa-tribe'], // Wrong cohort
			isMember: false
		});

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('cohort');
	});

	it('should deny non-members with cohort access to gated channels', () => {
		const result = canPostMessage({
			channelId: 'gated-channel',
			accessType: 'gated',
			channelCohorts: ['business'],
			userCohorts: ['business'], // Correct cohort
			isMember: false // But not a member
		});

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('gated');
	});
});
