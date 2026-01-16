/**
 * Channel Service - Nostr channel operations using NDK
 * Implements NIP-28 (Public Chat) event kinds
 */
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import { ndk, isConnected } from './relay';
import { browser } from '$app/environment';
import type { ChannelSection, ChannelAccessType } from '$lib/types/channel';
import { validateContent, validateChannelName } from '$lib/utils/validation';
import { checkRateLimit, RateLimitError } from '$lib/utils/rateLimit';

// NIP-28 Event Kinds for Public Chat
export const CHANNEL_KINDS = {
	CREATE: 40,      // Channel creation
	METADATA: 41,    // Channel metadata
	MESSAGE: 42,     // Channel message
	HIDE_MESSAGE: 43, // Hide message
	MUTE_USER: 44,   // Mute user in channel
} as const;

export interface ChannelMetadata {
	name: string;
	about?: string;
	picture?: string;
	relays?: string[];
}

export interface ChannelCreateOptions {
	name: string;
	description?: string;
	visibility?: 'public' | 'cohort' | 'private';
	accessType?: ChannelAccessType;  // open = anyone can post, gated = members only
	cohorts?: string[];
	encrypted?: boolean;
	section?: ChannelSection;
}

export interface CreatedChannel {
	id: string;
	name: string;
	description?: string;
	visibility: 'public' | 'cohort' | 'private';
	accessType: ChannelAccessType;  // open = anyone can post, gated = members only
	cohorts: string[];
	encrypted: boolean;
	section: ChannelSection;
	createdAt: number;
	creatorPubkey: string;
}

/**
 * Options for filtering channels based on user permissions
 */
export interface FetchChannelOptions {
	/** User's cohorts from whitelist (for filtering) */
	userCohorts?: string[];
	/** User's public key (for creator access) */
	userPubkey?: string;
	/** If true, bypass cohort filtering (for admin views) */
	isAdmin?: boolean;
	/** Limit number of channels returned */
	limit?: number;
}

/**
 * Create a new channel (NIP-28 kind 40)
 */
export async function createChannel(options: ChannelCreateOptions): Promise<CreatedChannel> {
	if (!browser) {
		throw new Error('Channel creation requires browser environment');
	}

	const ndkInstance = ndk();
	if (!ndkInstance?.signer) {
		throw new Error('No signer configured. Please login first.');
	}

	// Validate channel name
	const nameValidation = validateChannelName(options.name);
	if (!nameValidation.valid) {
		throw new Error(`Invalid channel name: ${nameValidation.errors.join(', ')}`);
	}

	// Check rate limit for channel creation
	const rateLimit = checkRateLimit('channelCreate');
	if (!rateLimit.allowed) {
		throw new RateLimitError(
			`Channel creation rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
			rateLimit.retryAfter
		);
	}

	// Check if connected
	if (!isConnected()) {
		throw new Error('Not connected to relays. Please wait for connection.');
	}

	// Build channel metadata
	const metadata: ChannelMetadata = {
		name: options.name,
		about: options.description,
	};

	// Create the event
	const event = new NDKEvent(ndk()!);
	event.kind = CHANNEL_KINDS.CREATE;
	event.content = JSON.stringify(metadata);

	// Add custom tags for visibility/cohorts
	if (options.visibility && options.visibility !== 'public') {
		event.tags.push(['visibility', options.visibility]);
	}

	if (options.cohorts && options.cohorts.length > 0) {
		event.tags.push(['cohort', options.cohorts.join(',')]);
	}

	if (options.encrypted) {
		event.tags.push(['encrypted', 'true']);
	}

	// Add section tag (default to public-lobby)
	const section = options.section || 'public-lobby';
	event.tags.push(['section', section]);

	// Add access type tag (default to gated for safety)
	const accessType = options.accessType || 'gated';
	event.tags.push(['access-type', accessType]);

	// Sign and publish
	await event.sign();
	await event.publish();

	return {
		id: event.id,
		name: options.name,
		description: options.description,
		visibility: options.visibility || 'public',
		accessType: accessType,
		cohorts: options.cohorts || [],
		encrypted: options.encrypted || false,
		section: section,
		createdAt: event.created_at || Math.floor(Date.now() / 1000),
		creatorPubkey: event.pubkey,
	};
}

/**
 * Update channel metadata (NIP-28 kind 41)
 */
export async function updateChannelMetadata(
	channelId: string,
	metadata: Partial<ChannelMetadata>
): Promise<void> {
	if (!browser) {
		throw new Error('Channel operations require browser environment');
	}

	const ndkInstance = ndk();
	if (!ndkInstance?.signer) {
		throw new Error('No signer configured. Please login first.');
	}

	if (!isConnected()) {
		throw new Error('Not connected to relays. Please wait for connection.');
	}

	const event = new NDKEvent(ndk()!);
	event.kind = CHANNEL_KINDS.METADATA;
	event.content = JSON.stringify(metadata);
	event.tags.push(['e', channelId, '', 'root']);

	await event.sign();
	await event.publish();
}

/**
 * Options for sending channel messages
 */
export interface ChannelMessageOptions {
	/** Reply to a specific message ID */
	replyTo?: string;
	/** Additional tags (e.g., encrypted image tags) */
	additionalTags?: string[][];
}

/**
 * Authorization context for message operations
 */
export interface MessageAuthContext {
	/** User's cohorts from whitelist */
	userCohorts: string[];
	/** User's public key */
	userPubkey: string;
	/** Whether user is admin (bypass restrictions) */
	isAdmin?: boolean;
}

/**
 * Check if user can post to a channel
 * @param channel - Channel to check
 * @param authContext - User's authorization context
 * @returns true if user can post to this channel
 */
function canPostToChannel(
	channel: CreatedChannel,
	authContext: MessageAuthContext
): boolean {
	const { userCohorts, userPubkey, isAdmin = false } = authContext;

	// Admins can post anywhere
	if (isAdmin) {
		return true;
	}

	// Channel creator can always post
	if (channel.creatorPubkey === userPubkey) {
		return true;
	}

	// First check if user can even see the channel
	if (!canAccessChannel(channel, userCohorts, userPubkey, isAdmin)) {
		return false;
	}

	// For open channels, anyone who can see can post
	if (channel.accessType === 'open') {
		return true;
	}

	// For gated channels (default), user must have matching cohorts
	// If channel has no cohorts, it's effectively open
	if (channel.cohorts.length === 0) {
		return true;
	}

	// User must have at least one matching cohort to post
	return channel.cohorts.some(cohort => userCohorts.includes(cohort));
}

/**
 * Fetch a single channel by ID (internal helper)
 */
async function fetchChannelById(channelId: string): Promise<CreatedChannel | null> {
	if (!browser) {
		return null;
	}

	const ndkInstance = ndk();
	if (!ndkInstance || !isConnected()) {
		return null;
	}

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.CREATE],
		ids: [channelId],
		limit: 1,
	};

	const events = await ndkInstance.fetchEvents(filter);

	for (const event of events) {
		try {
			const metadata = JSON.parse(event.content) as ChannelMetadata;
			const visibilityTag = event.tags.find(t => t[0] === 'visibility');
			const accessTypeTag = event.tags.find(t => t[0] === 'access-type');
			const cohortTag = event.tags.find(t => t[0] === 'cohort');
			const encryptedTag = event.tags.find(t => t[0] === 'encrypted');
			const sectionTag = event.tags.find(t => t[0] === 'section');

			return {
				id: event.id,
				name: metadata.name || 'Unnamed Channel',
				description: metadata.about,
				visibility: (visibilityTag?.[1] as any) || 'public',
				accessType: (accessTypeTag?.[1] as ChannelAccessType) || 'gated',
				cohorts: cohortTag?.[1]?.split(',').filter(Boolean) || [],
				encrypted: encryptedTag?.[1] === 'true',
				section: (sectionTag?.[1] as ChannelSection) || 'public-lobby',
				createdAt: event.created_at || 0,
				creatorPubkey: event.pubkey,
			};
		} catch (e) {
			console.error('Failed to parse channel event:', e);
		}
	}

	return null;
}

/**
 * Send a message to a channel (NIP-28 kind 42)
 *
 * SECURITY: This function verifies the user has permission to post to the channel
 * before sending the message. Authorization is based on cohorts and access type.
 *
 * @param channelId - Channel ID
 * @param content - Message content
 * @param options - Optional message options (replyTo, additionalTags for encrypted images)
 * @param authContext - Authorization context (required for security - cohorts, pubkey, isAdmin)
 */
export async function sendChannelMessage(
	channelId: string,
	content: string,
	options?: ChannelMessageOptions | string, // string for backwards compat (replyTo)
	authContext?: MessageAuthContext
): Promise<string> {
	if (!browser) {
		throw new Error('Channel operations require browser environment');
	}

	const ndkInstance = ndk();
	if (!ndkInstance?.signer) {
		throw new Error('No signer configured. Please login first.');
	}

	// Validate message content
	const contentValidation = validateContent(content);
	if (!contentValidation.valid) {
		throw new Error(`Invalid message: ${contentValidation.errors.join(', ')}`);
	}

	// Check rate limit for message sending
	const rateLimit = checkRateLimit('message');
	if (!rateLimit.allowed) {
		throw new RateLimitError(
			`Message rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
			rateLimit.retryAfter
		);
	}

	if (!isConnected()) {
		throw new Error('Not connected to relays. Please wait for connection.');
	}

	// SECURITY: Verify user has permission to post to this channel
	if (authContext) {
		const channel = await fetchChannelById(channelId);
		if (!channel) {
			throw new Error('Channel not found. Cannot verify posting permissions.');
		}

		if (!canPostToChannel(channel, authContext)) {
			throw new Error('You do not have permission to post in this channel.');
		}
	}

	// Handle backwards compatibility: string = replyTo
	const opts: ChannelMessageOptions = typeof options === 'string'
		? { replyTo: options }
		: options || {};

	const event = new NDKEvent(ndk()!);
	event.kind = CHANNEL_KINDS.MESSAGE;
	event.content = content;
	event.tags.push(['e', channelId, '', 'root']);

	if (opts.replyTo) {
		event.tags.push(['e', opts.replyTo, '', 'reply']);
	}

	// Add additional tags (encrypted image tags, etc.)
	if (opts.additionalTags) {
		for (const tag of opts.additionalTags) {
			event.tags.push(tag);
		}
	}

	await event.sign();
	await event.publish();

	return event.id;
}

/**
 * Check if user can access a channel based on cohorts
 * @param channel - Channel to check
 * @param userCohorts - User's cohorts from whitelist
 * @param userPubkey - User's public key
 * @param isAdmin - Whether user is admin (bypass filtering)
 * @returns true if user can see this channel
 */
function canAccessChannel(
	channel: CreatedChannel,
	userCohorts: string[],
	userPubkey: string | undefined,
	isAdmin: boolean
): boolean {
	// Admins can see all channels
	if (isAdmin) {
		return true;
	}

	// Channel creator can always see their own channel
	if (userPubkey && channel.creatorPubkey === userPubkey) {
		return true;
	}

	// Public channels (no cohort restrictions) are visible to all
	if (channel.visibility === 'public' || channel.cohorts.length === 0) {
		return true;
	}

	// Cohort-restricted channels: user must have at least one matching cohort
	if (channel.cohorts.length > 0 && userCohorts.length > 0) {
		const hasMatchingCohort = channel.cohorts.some(cohort =>
			userCohorts.includes(cohort)
		);
		return hasMatchingCohort;
	}

	// No matching cohorts - deny access
	return false;
}

/**
 * Fetch channels from relays with cohort-based access filtering
 *
 * SECURITY: Channels are filtered based on user's cohorts from whitelist.
 * Only channels where user has matching cohorts will be returned.
 *
 * @param options - Filtering options (userCohorts, isAdmin, limit)
 * @returns Promise<CreatedChannel[]> - Filtered channels user can access
 */
export async function fetchChannels(options: FetchChannelOptions = {}): Promise<CreatedChannel[]> {
	const { userCohorts = [], userPubkey, isAdmin = false, limit = 100 } = options;

	if (!browser) {
		return [];
	}

	const ndkInstance = ndk();
	if (!ndkInstance) {
		return [];
	}

	if (!isConnected()) {
		return [];
	}

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.CREATE],
		limit,
	};

	const events = await ndkInstance.fetchEvents(filter);
	const channels: CreatedChannel[] = [];

	for (const event of events) {
		try {
			const metadata = JSON.parse(event.content) as ChannelMetadata;
			const visibilityTag = event.tags.find(t => t[0] === 'visibility');
			const accessTypeTag = event.tags.find(t => t[0] === 'access-type');
			const cohortTag = event.tags.find(t => t[0] === 'cohort');
			const encryptedTag = event.tags.find(t => t[0] === 'encrypted');
			const sectionTag = event.tags.find(t => t[0] === 'section');

			const channel: CreatedChannel = {
				id: event.id,
				name: metadata.name || 'Unnamed Channel',
				description: metadata.about,
				visibility: (visibilityTag?.[1] as any) || 'public',
				accessType: (accessTypeTag?.[1] as ChannelAccessType) || 'gated',
				cohorts: cohortTag?.[1]?.split(',').filter(Boolean) || [],
				encrypted: encryptedTag?.[1] === 'true',
				section: (sectionTag?.[1] as ChannelSection) || 'public-lobby',
				createdAt: event.created_at || 0,
				creatorPubkey: event.pubkey,
			};

			// SECURITY: Filter channels based on user cohorts
			if (canAccessChannel(channel, userCohorts, userPubkey, isAdmin)) {
				channels.push(channel);
			}
		} catch (e) {
			console.error('Failed to parse channel event:', e);
		}
	}

	// Sort by creation time (newest first)
	channels.sort((a, b) => b.createdAt - a.createdAt);

	return channels;
}

/**
 * Channel message with full metadata including tags for encrypted images
 */
export interface ChannelMessage {
	id: string;
	content: string;
	pubkey: string;
	createdAt: number;
	replyTo?: string;
	/** All event tags (for encrypted images, etc.) */
	tags: string[][];
}

/**
 * Fetch messages for a channel
 */
export async function fetchChannelMessages(
	channelId: string,
	limit = 50
): Promise<ChannelMessage[]> {
	if (!browser) {
		return [];
	}

	const ndkInstance = ndk();
	if (!ndkInstance) {
		return [];
	}

	if (!isConnected()) {
		return [];
	}

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.MESSAGE],
		'#e': [channelId],
		limit,
	};

	const events = await ndkInstance.fetchEvents(filter);
	const messages: ChannelMessage[] = [];

	for (const event of events) {
		const replyTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply');

		messages.push({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			createdAt: event.created_at || 0,
			replyTo: replyTag?.[1],
			tags: event.tags.map(t => [...t]), // Clone tags array
		});
	}

	// Sort by creation time (oldest first for messages)
	messages.sort((a, b) => a.createdAt - b.createdAt);

	return messages;
}

/**
 * Subscribe to channel messages in real-time
 */
export function subscribeToChannel(
	channelId: string,
	onMessage: (message: ChannelMessage) => void
): { unsubscribe: () => void } {
	if (!browser) {
		return { unsubscribe: () => {} };
	}

	const ndkInstance = ndk();
	if (!ndkInstance) {
		return { unsubscribe: () => {} };
	}

	const filter: NDKFilter = {
		kinds: [CHANNEL_KINDS.MESSAGE],
		'#e': [channelId],
		since: Math.floor(Date.now() / 1000),
	};

	const sub = ndkInstance.subscribe(filter, { closeOnEose: false });

	sub.on('event', (event: NDKEvent) => {
		const replyTag = event.tags.find(t => t[0] === 'e' && t[3] === 'reply');

		onMessage({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			createdAt: event.created_at || 0,
			replyTo: replyTag?.[1],
			tags: event.tags.map(t => [...t]), // Clone tags array
		});
	});

	return {
		unsubscribe: () => {
			sub.stop();
		},
	};
}
