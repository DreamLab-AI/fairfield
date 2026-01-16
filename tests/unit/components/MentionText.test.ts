/**
 * Unit Tests: MentionText Component
 *
 * Tests for @mention parsing and rendering in text content.
 * Tests the underlying utility functions since Svelte component
 * testing requires additional setup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $app/environment before importing
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

// Test the underlying utility functions that power MentionText
import {
  parseMentions,
  formatPubkey,
  isPubkeyFormat,
  formatMentions,
  createMentionTags,
  isMentioned,
  createNicknameResolver,
  extractMentionedPubkeys,
  hasMentions,
  npubToHex,
  hexToNpub,
  getMentionDisplayName
} from '$lib/utils/mentions';

// Valid test pubkeys
const VALID_HEX_PUBKEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const VALID_HEX_PUBKEY_2 = 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3';
// Real valid npub generated from VALID_HEX_PUBKEY using nostr-tools
const VALID_NPUB = 'npub15xev848976sm9s75uhm2rvkr6njldgdjc02wta4pktpafe0k5xeqd3u8ss';

describe('MentionText Utilities', () => {
  describe('isPubkeyFormat', () => {
    it('should return true for valid 64-char hex pubkey', () => {
      expect(isPubkeyFormat(VALID_HEX_PUBKEY)).toBe(true);
    });

    it('should return true for valid npub', () => {
      expect(isPubkeyFormat(VALID_NPUB)).toBe(true);
    });

    it('should return false for regular nickname', () => {
      expect(isPubkeyFormat('testuser')).toBe(false);
    });

    it('should return false for too short hex', () => {
      expect(isPubkeyFormat('a'.repeat(63))).toBe(false);
    });

    it('should return false for too long hex', () => {
      expect(isPubkeyFormat('a'.repeat(65))).toBe(false);
    });

    it('should accept uppercase hex', () => {
      expect(isPubkeyFormat('A'.repeat(64))).toBe(true);
    });

    it('should return false for invalid npub prefix', () => {
      expect(isPubkeyFormat('npub2' + 'a'.repeat(58))).toBe(false);
    });
  });

  describe('formatPubkey', () => {
    it('should truncate hex pubkey to 8...4 format', () => {
      const formatted = formatPubkey(VALID_HEX_PUBKEY);
      expect(formatted).toBe('a1b2c3d4...a1b2');
    });

    it('should truncate npub to 12...4 format', () => {
      const formatted = formatPubkey(VALID_NPUB);
      // Format is first 12 chars + ... + last 4 chars
      expect(formatted).toBe('npub15xev848...u8ss');
    });

    it('should return empty string for empty input', () => {
      expect(formatPubkey('')).toBe('');
    });

    it('should truncate even short strings to 8...4 format', () => {
      // formatPubkey always truncates hex format to first 8 + ... + last 4
      expect(formatPubkey('abcd')).toBe('abcd...abcd');
      expect(formatPubkey('12345678')).toBe('12345678...5678');
    });
  });

  describe('parseMentions', () => {
    it('should parse @hex pubkey mention', () => {
      const content = `Hello @${VALID_HEX_PUBKEY}!`;
      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].pubkey).toBe(VALID_HEX_PUBKEY);
      expect(mentions[0].startIndex).toBe(6);
      expect(mentions[0].endIndex).toBe(6 + 1 + 64); // @+pubkey
    });

    it('should parse @npub mention', () => {
      const content = `Hi @${VALID_NPUB}!`;
      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
      // npub should be converted to hex (VALID_HEX_PUBKEY)
      expect(mentions[0].pubkey).toBe(VALID_HEX_PUBKEY);
      expect(mentions[0].originalText).toBe(VALID_NPUB);
    });

    it('should parse multiple mentions', () => {
      const content = `Hello @${VALID_HEX_PUBKEY} and @${VALID_HEX_PUBKEY_2}!`;
      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].pubkey).toBe(VALID_HEX_PUBKEY);
      expect(mentions[1].pubkey).toBe(VALID_HEX_PUBKEY_2);
    });

    it('should return empty array for no mentions', () => {
      const content = 'Hello world!';
      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should skip unresolved nicknames without resolver', () => {
      const content = 'Hello @testuser!';
      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should resolve nicknames with resolver', () => {
      const content = 'Hello @testuser!';
      const resolver = (name: string) => name === 'testuser' ? VALID_HEX_PUBKEY : null;
      const mentions = parseMentions(content, resolver);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].pubkey).toBe(VALID_HEX_PUBKEY);
      expect(mentions[0].originalText).toBe('testuser');
    });

    it('should handle mixed pubkey and nickname mentions', () => {
      const content = `Hi @testuser and @${VALID_HEX_PUBKEY}!`;
      const resolver = (name: string) => name === 'testuser' ? VALID_HEX_PUBKEY_2 : null;
      const mentions = parseMentions(content, resolver);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].pubkey).toBe(VALID_HEX_PUBKEY_2);
      expect(mentions[1].pubkey).toBe(VALID_HEX_PUBKEY);
    });

    it('should preserve mention indices correctly', () => {
      const content = 'Hey @alice how are you?';
      const resolver = () => VALID_HEX_PUBKEY;
      const mentions = parseMentions(content, resolver);

      expect(mentions[0].startIndex).toBe(4);
      expect(mentions[0].endIndex).toBe(10);
      expect(content.slice(mentions[0].startIndex, mentions[0].endIndex)).toBe('@alice');
    });

    it('should handle nicknames with underscores and hyphens', () => {
      const content = 'Hello @test_user-123!';
      const resolver = (name: string) => name === 'test_user-123' ? VALID_HEX_PUBKEY : null;
      const mentions = parseMentions(content, resolver);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].originalText).toBe('test_user-123');
    });

    it('should match alphanumeric nicknames', () => {
      const nickname = 'test_user_123';
      const content = `Hello @${nickname}!`;
      const resolver = (name: string) => name === nickname ? VALID_HEX_PUBKEY : null;
      const mentions = parseMentions(content, resolver);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].originalText).toBe(nickname);
    });

    it('should handle nicknames with numbers', () => {
      const nickname = 'user2024';
      const content = `Hello @${nickname}!`;
      const resolver = (name: string) => name === nickname ? VALID_HEX_PUBKEY : null;
      const mentions = parseMentions(content, resolver);

      expect(mentions).toHaveLength(1);
    });
  });

  describe('createNicknameResolver', () => {
    it('should create resolver from user array', () => {
      const users = [
        { pubkey: VALID_HEX_PUBKEY, displayName: 'Alice', name: null },
        { pubkey: VALID_HEX_PUBKEY_2, displayName: null, name: 'Bob' }
      ];
      const resolver = createNicknameResolver(users);

      expect(resolver('Alice')).toBe(VALID_HEX_PUBKEY);
      expect(resolver('Bob')).toBe(VALID_HEX_PUBKEY_2);
    });

    it('should be case-insensitive', () => {
      const users = [
        { pubkey: VALID_HEX_PUBKEY, displayName: 'Alice', name: null }
      ];
      const resolver = createNicknameResolver(users);

      expect(resolver('alice')).toBe(VALID_HEX_PUBKEY);
      expect(resolver('ALICE')).toBe(VALID_HEX_PUBKEY);
      expect(resolver('AlIcE')).toBe(VALID_HEX_PUBKEY);
    });

    it('should return null for unknown nicknames', () => {
      const users = [
        { pubkey: VALID_HEX_PUBKEY, displayName: 'Alice', name: null }
      ];
      const resolver = createNicknameResolver(users);

      expect(resolver('unknown')).toBeNull();
    });

    it('should prefer displayName over name', () => {
      const users = [
        { pubkey: VALID_HEX_PUBKEY, displayName: 'DisplayName', name: 'Name' }
      ];
      const resolver = createNicknameResolver(users);

      expect(resolver('DisplayName')).toBe(VALID_HEX_PUBKEY);
      // Name is not indexed because displayName took priority
      expect(resolver('Name')).toBeNull();
    });

    it('should handle users without any name', () => {
      const users = [
        { pubkey: VALID_HEX_PUBKEY, displayName: null, name: null }
      ];
      const resolver = createNicknameResolver(users);

      expect(resolver('anything')).toBeNull();
    });
  });

  describe('formatMentions', () => {
    it('should replace pubkey mentions with display names', () => {
      const content = `Hello @${VALID_HEX_PUBKEY}!`;
      const userMap = {
        [VALID_HEX_PUBKEY]: { displayName: 'Alice' }
      };

      const formatted = formatMentions(content, userMap);
      expect(formatted).toBe('Hello @Alice!');
    });

    it('should use name when displayName is not available', () => {
      const content = `Hello @${VALID_HEX_PUBKEY}!`;
      const userMap = {
        [VALID_HEX_PUBKEY]: { name: 'Alice' }
      };

      const formatted = formatMentions(content, userMap);
      expect(formatted).toBe('Hello @Alice!');
    });

    it('should use truncated pubkey when no name available', () => {
      const content = `Hello @${VALID_HEX_PUBKEY}!`;
      const userMap = {};

      const formatted = formatMentions(content, userMap);
      expect(formatted).toContain('a1b2c3d4...a1b2');
    });

    it('should handle multiple mentions', () => {
      const content = `Hello @${VALID_HEX_PUBKEY} and @${VALID_HEX_PUBKEY_2}!`;
      const userMap = {
        [VALID_HEX_PUBKEY]: { displayName: 'Alice' },
        [VALID_HEX_PUBKEY_2]: { displayName: 'Bob' }
      };

      const formatted = formatMentions(content, userMap);
      expect(formatted).toBe('Hello @Alice and @Bob!');
    });

    it('should return original content when no mentions', () => {
      const content = 'Hello world!';
      const userMap = {};

      const formatted = formatMentions(content, userMap);
      expect(formatted).toBe(content);
    });
  });

  describe('createMentionTags', () => {
    it('should create p-tags for mentions', () => {
      const content = `Hello @${VALID_HEX_PUBKEY}!`;
      const tags = createMentionTags(content);

      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual(['p', VALID_HEX_PUBKEY]);
    });

    it('should deduplicate multiple mentions of same pubkey', () => {
      const content = `@${VALID_HEX_PUBKEY} said hi to @${VALID_HEX_PUBKEY}`;
      const tags = createMentionTags(content);

      expect(tags).toHaveLength(1);
    });

    it('should create tags for multiple different mentions', () => {
      const content = `@${VALID_HEX_PUBKEY} and @${VALID_HEX_PUBKEY_2}`;
      const tags = createMentionTags(content);

      expect(tags).toHaveLength(2);
      expect(tags.map(t => t[1])).toContain(VALID_HEX_PUBKEY);
      expect(tags.map(t => t[1])).toContain(VALID_HEX_PUBKEY_2);
    });

    it('should return empty array when no mentions', () => {
      const content = 'No mentions here';
      const tags = createMentionTags(content);

      expect(tags).toHaveLength(0);
    });

    it('should work with resolver for nicknames', () => {
      const content = 'Hello @alice!';
      const resolver = (name: string) => name === 'alice' ? VALID_HEX_PUBKEY : null;
      const tags = createMentionTags(content, resolver);

      expect(tags).toHaveLength(1);
      expect(tags[0]).toEqual(['p', VALID_HEX_PUBKEY]);
    });
  });

  describe('isMentioned', () => {
    it('should return true if pubkey is in p-tags', () => {
      const event = {
        tags: [['p', VALID_HEX_PUBKEY]],
        content: 'Hello world'
      };

      expect(isMentioned(event, VALID_HEX_PUBKEY)).toBe(true);
    });

    it('should return true if pubkey is in content', () => {
      const event = {
        tags: [],
        content: `Hello @${VALID_HEX_PUBKEY}!`
      };

      expect(isMentioned(event, VALID_HEX_PUBKEY)).toBe(true);
    });

    it('should return false if pubkey is not mentioned', () => {
      const event = {
        tags: [['p', VALID_HEX_PUBKEY_2]],
        content: 'Hello world'
      };

      expect(isMentioned(event, VALID_HEX_PUBKEY)).toBe(false);
    });

    it('should handle event without tags', () => {
      const event = {
        content: `Hi @${VALID_HEX_PUBKEY}`
      };

      expect(isMentioned(event, VALID_HEX_PUBKEY)).toBe(true);
    });

    it('should prioritize p-tags over content', () => {
      const event = {
        tags: [['p', VALID_HEX_PUBKEY]],
        content: 'No mention in content'
      };

      expect(isMentioned(event, VALID_HEX_PUBKEY)).toBe(true);
    });
  });

  describe('extractMentionedPubkeys', () => {
    it('should extract unique pubkeys from content', () => {
      const content = `@${VALID_HEX_PUBKEY} and @${VALID_HEX_PUBKEY_2}`;
      const pubkeys = extractMentionedPubkeys(content);

      expect(pubkeys).toHaveLength(2);
      expect(pubkeys).toContain(VALID_HEX_PUBKEY);
      expect(pubkeys).toContain(VALID_HEX_PUBKEY_2);
    });

    it('should deduplicate pubkeys', () => {
      const content = `@${VALID_HEX_PUBKEY} and again @${VALID_HEX_PUBKEY}`;
      const pubkeys = extractMentionedPubkeys(content);

      expect(pubkeys).toHaveLength(1);
    });

    it('should return empty array when no mentions', () => {
      const pubkeys = extractMentionedPubkeys('No mentions');
      expect(pubkeys).toHaveLength(0);
    });
  });

  describe('hasMentions', () => {
    it('should return true when content has pubkey mention', () => {
      expect(hasMentions(`Hello @${VALID_HEX_PUBKEY}!`)).toBe(true);
    });

    it('should return false when content has no mentions', () => {
      expect(hasMentions('Hello world!')).toBe(false);
    });

    it('should return false for unresolved nicknames', () => {
      // Without resolver, nicknames are not recognized
      expect(hasMentions('Hello @testuser!')).toBe(false);
    });
  });

  describe('npubToHex', () => {
    it('should convert valid npub to hex', () => {
      // Use the valid npub that corresponds to VALID_HEX_PUBKEY
      const hex = npubToHex(VALID_NPUB);

      expect(hex).toHaveLength(64);
      expect(hex).toBe(VALID_HEX_PUBKEY);
      expect(/^[0-9a-f]+$/i.test(hex)).toBe(true);
    });

    it('should return input unchanged if not npub', () => {
      const hex = VALID_HEX_PUBKEY;
      expect(npubToHex(hex)).toBe(hex);
    });

    it('should handle invalid npub gracefully', () => {
      const invalid = 'npub1invalid';
      // Should return the input or handle error gracefully
      const result = npubToHex(invalid);
      expect(typeof result).toBe('string');
    });
  });

  describe('hexToNpub', () => {
    it('should convert hex to npub format', () => {
      const npub = hexToNpub(VALID_HEX_PUBKEY);
      expect(npub).toMatch(/^npub1[a-z0-9]+$/);
    });

    it('should create valid npub that can roundtrip', () => {
      const npub = hexToNpub(VALID_HEX_PUBKEY);
      const backToHex = npubToHex(npub);
      expect(backToHex).toBe(VALID_HEX_PUBKEY);
    });

    it('should handle invalid hex gracefully', () => {
      const result = hexToNpub('invalid');
      // Should return the input on error
      expect(typeof result).toBe('string');
    });
  });

  describe('getMentionDisplayName', () => {
    it('should return displayName when available', () => {
      const user = {
        pubkey: VALID_HEX_PUBKEY,
        displayName: 'Alice',
        name: 'alice_account'
      };
      expect(getMentionDisplayName(user)).toBe('Alice');
    });

    it('should return name when displayName not available', () => {
      const user = {
        pubkey: VALID_HEX_PUBKEY,
        displayName: null,
        name: 'alice_account'
      };
      expect(getMentionDisplayName(user)).toBe('alice_account');
    });

    it('should sanitize @ symbol in nickname', () => {
      const user = {
        pubkey: VALID_HEX_PUBKEY,
        displayName: '@alice',
        name: null
      };
      expect(getMentionDisplayName(user)).toBe('_alice');
    });

    it('should sanitize spaces in nickname', () => {
      const user = {
        pubkey: VALID_HEX_PUBKEY,
        displayName: 'Alice Smith',
        name: null
      };
      expect(getMentionDisplayName(user)).toBe('Alice_Smith');
    });

    it('should return truncated pubkey when no name available', () => {
      const user = {
        pubkey: VALID_HEX_PUBKEY,
        displayName: null,
        name: null
      };
      const result = getMentionDisplayName(user);
      // Should be based on formatPubkey but without ...
      expect(result.length).toBeLessThan(VALID_HEX_PUBKEY.length);
    });
  });
});
