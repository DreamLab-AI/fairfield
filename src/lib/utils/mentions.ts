/**
 * Utilities for handling @mentions in messages
 * Supports parsing, formatting, and tag generation for Nostr events
 *
 * Mention Format: @nickname (human-readable, resolved to pubkey)
 * Storage: Nostr p-tags contain hex pubkeys for compatibility
 */

import { nip19 } from 'nostr-tools';

export interface Mention {
  pubkey: string;
  startIndex: number;
  endIndex: number;
  displayName?: string;
  originalText?: string; // The @nickname or @pubkey that was matched
}

export interface UserMap {
  [pubkey: string]: {
    name?: string;
    displayName?: string;
  };
}

/**
 * Nickname to pubkey resolver type
 * Used to look up pubkeys from nicknames
 */
export type NicknameResolver = (nickname: string) => string | null;

/**
 * Regular expression to match @mentions
 * Matches @nickname (alphanumeric + underscore), @npub..., or @hex pubkey
 * Nickname format: 1-30 alphanumeric chars, underscores, or hyphens
 */
const MENTION_REGEX = /@(npub1[a-z0-9]{58}|[a-f0-9]{64}|[\w-]{1,30})/gi;

/**
 * Check if a mention looks like a pubkey (hex or npub)
 */
export function isPubkeyFormat(text: string): boolean {
  return /^(npub1[a-z0-9]{58}|[a-f0-9]{64})$/i.test(text);
}

/**
 * Parse mentions from message content
 * @param content - The message content to parse
 * @param resolver - Optional function to resolve nicknames to pubkeys
 * @returns Array of detected mentions with resolved pubkeys
 */
export function parseMentions(content: string, resolver?: NicknameResolver): Mention[] {
  const mentions: Mention[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const mentionText = match[1];
    let pubkey: string;

    if (isPubkeyFormat(mentionText)) {
      // Direct pubkey format (@npub or @hex)
      pubkey = mentionText.startsWith('npub1') ? npubToHex(mentionText) : mentionText;
    } else if (resolver) {
      // Nickname format - resolve to pubkey
      const resolved = resolver(mentionText);
      if (!resolved) continue; // Skip unresolved nicknames
      pubkey = resolved;
    } else {
      // No resolver and not a pubkey - skip
      continue;
    }

    mentions.push({
      pubkey,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      originalText: mentionText
    });
  }

  return mentions;
}

/**
 * Format mentions in content by replacing pubkeys with display names
 * @param content - The message content
 * @param userMap - Map of pubkey to user info
 * @returns Formatted content with display names
 */
export function formatMentions(content: string, userMap: UserMap): string {
  const mentions = parseMentions(content);

  if (mentions.length === 0) {
    return content;
  }

  // Replace mentions in reverse order to preserve indices
  let formatted = content;

  for (let i = mentions.length - 1; i >= 0; i--) {
    const mention = mentions[i];
    const userInfo = userMap[mention.pubkey];
    const displayName = userInfo?.displayName || userInfo?.name || formatPubkey(mention.pubkey);

    // Replace @pubkey with @displayName
    formatted =
      formatted.slice(0, mention.startIndex) +
      '@' + displayName +
      formatted.slice(mention.endIndex);
  }

  return formatted;
}

/**
 * Create Nostr 'p' tags for mentioned users
 * These tags are included in the event to notify mentioned users
 * @param content - The message content
 * @param resolver - Optional function to resolve nicknames to pubkeys
 * @returns Array of p-tags for Nostr events
 */
export function createMentionTags(content: string, resolver?: NicknameResolver): string[][] {
  const mentions = parseMentions(content, resolver);
  const uniquePubkeys = new Set(mentions.map(m => m.pubkey));

  // Return array of ['p', pubkey] tags
  return Array.from(uniquePubkeys).map(pubkey => ['p', pubkey]);
}

/**
 * Check if a specific user is mentioned in an event
 * @param event - The Nostr event to check
 * @param pubkey - The user's pubkey to look for
 * @returns True if the user is mentioned
 */
export function isMentioned(event: { tags?: string[][]; content: string }, pubkey: string): boolean {
  // Check if pubkey is in p-tags
  if (event.tags) {
    const hasPTag = event.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey);
    if (hasPTag) return true;
  }

  // Fallback: check content for @pubkey pattern
  const mentions = parseMentions(event.content);
  return mentions.some(m => m.pubkey === pubkey);
}

/**
 * Format pubkey for display (shortened version)
 * @param pubkey - The pubkey to format
 * @returns Shortened pubkey string
 */
export function formatPubkey(pubkey: string): string {
  if (!pubkey) return '';

  if (pubkey.startsWith('npub1')) {
    // For npub, show first 12 and last 4 characters
    return pubkey.slice(0, 12) + '...' + pubkey.slice(-4);
  }

  // For hex pubkey, show first 8 and last 4 characters
  return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
}

/**
 * Convert hex pubkey to npub format
 * @param hexPubkey - Hex format pubkey
 * @returns npub format (or hex if conversion fails)
 */
export function hexToNpub(hexPubkey: string): string {
  try {
    return nip19.npubEncode(hexPubkey);
  } catch (error) {
    console.error('Failed to encode hex to npub:', error);
    return hexPubkey;
  }
}

/**
 * Convert npub to hex pubkey
 * @param npub - npub format pubkey
 * @returns hex format pubkey
 */
export function npubToHex(npub: string): string {
  if (!npub.startsWith('npub1')) {
    return npub;
  }

  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      return decoded.data as string;
    }
    return npub;
  } catch (error) {
    console.error('Failed to decode npub to hex:', error);
    return npub;
  }
}

/**
 * Extract all unique mentioned pubkeys from content
 * @param content - The message content
 * @param resolver - Optional function to resolve nicknames to pubkeys
 * @returns Array of unique pubkeys
 */
export function extractMentionedPubkeys(content: string, resolver?: NicknameResolver): string[] {
  const mentions = parseMentions(content, resolver);
  const uniquePubkeys = new Set(mentions.map(m => m.pubkey));
  return Array.from(uniquePubkeys);
}

/**
 * Create a nickname resolver from a user map
 * @param users - Array of users with pubkey and displayName
 * @returns Resolver function
 */
export function createNicknameResolver(users: Array<{ pubkey: string; displayName?: string | null; name?: string | null }>): NicknameResolver {
  // Build lookup maps (case-insensitive)
  const nicknameMap = new Map<string, string>();

  for (const user of users) {
    const nickname = user.displayName || user.name;
    if (nickname) {
      nicknameMap.set(nickname.toLowerCase(), user.pubkey);
    }
  }

  return (nickname: string): string | null => {
    return nicknameMap.get(nickname.toLowerCase()) || null;
  };
}

/**
 * Get the display name for a mention insertion
 * Returns nickname if available, otherwise shortened pubkey
 */
export function getMentionDisplayName(user: { pubkey: string; displayName?: string | null; name?: string | null }): string {
  const nickname = user.displayName || user.name;
  if (nickname) {
    // Sanitize nickname: remove @ and spaces for mention format
    return nickname.replace(/[@\s]/g, '_');
  }
  // Fallback to short pubkey
  return formatPubkey(user.pubkey).replace('...', '');
}

/**
 * Check if content contains any mentions
 * @param content - The message content
 * @returns True if content has mentions
 */
export function hasMentions(content: string): boolean {
  return parseMentions(content).length > 0;
}
