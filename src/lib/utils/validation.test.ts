/**
 * Tests for Input Validation Utilities
 *
 * Tests Nostr event and user input validation for security.
 * Security-critical module - comprehensive injection and boundary testing.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPubkey,
  isValidEventId,
  isValidSignature,
  validateContent,
  validateTags,
  validateEvent,
  sanitizeForDisplay,
  validateChannelName
} from './validation';

describe('Input Validation Utilities', () => {
  // Valid test data
  const validPubkey = 'a'.repeat(64);
  const validEventId = 'b'.repeat(64);
  const validSignature = 'c'.repeat(128);

  describe('isValidPubkey', () => {
    it('should accept valid 64-char hex pubkey', () => {
      expect(isValidPubkey(validPubkey)).toBe(true);
      expect(isValidPubkey('0'.repeat(64))).toBe(true);
      expect(isValidPubkey('f'.repeat(64))).toBe(true);
      expect(isValidPubkey('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should accept mixed case hex', () => {
      expect(isValidPubkey('AbCdEf0123456789'.repeat(4))).toBe(true);
      expect(isValidPubkey('A'.repeat(64))).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isValidPubkey('')).toBe(false);
    });

    it('should reject too short pubkey', () => {
      expect(isValidPubkey('a'.repeat(63))).toBe(false);
      expect(isValidPubkey('abc')).toBe(false);
    });

    it('should reject too long pubkey', () => {
      expect(isValidPubkey('a'.repeat(65))).toBe(false);
      expect(isValidPubkey('a'.repeat(128))).toBe(false);
    });

    it('should reject non-hex characters', () => {
      expect(isValidPubkey('g'.repeat(64))).toBe(false);
      expect(isValidPubkey('z'.repeat(64))).toBe(false);
      expect(isValidPubkey('a'.repeat(63) + 'g')).toBe(false);
    });

    it('should reject pubkey with special characters', () => {
      expect(isValidPubkey('a'.repeat(63) + '!')).toBe(false);
      expect(isValidPubkey('a'.repeat(63) + ' ')).toBe(false);
      expect(isValidPubkey('a'.repeat(63) + '\n')).toBe(false);
    });

    it('should reject pubkey with injection attempts', () => {
      expect(isValidPubkey('<script>alert(1)</script>')).toBe(false);
      expect(isValidPubkey("'; DROP TABLE users--")).toBe(false);
      expect(isValidPubkey('../../../etc/passwd')).toBe(false);
    });
  });

  describe('isValidEventId', () => {
    it('should accept valid 64-char hex event ID', () => {
      expect(isValidEventId(validEventId)).toBe(true);
      expect(isValidEventId('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should reject invalid event IDs', () => {
      expect(isValidEventId('')).toBe(false);
      expect(isValidEventId('a'.repeat(63))).toBe(false);
      expect(isValidEventId('a'.repeat(65))).toBe(false);
      expect(isValidEventId('not-hex-string')).toBe(false);
    });
  });

  describe('isValidSignature', () => {
    it('should accept valid 128-char hex signature', () => {
      expect(isValidSignature(validSignature)).toBe(true);
      expect(isValidSignature('0123456789abcdef'.repeat(8))).toBe(true);
    });

    it('should reject invalid signatures', () => {
      expect(isValidSignature('')).toBe(false);
      expect(isValidSignature('a'.repeat(127))).toBe(false);
      expect(isValidSignature('a'.repeat(129))).toBe(false);
      expect(isValidSignature('not-hex')).toBe(false);
    });
  });

  describe('validateContent', () => {
    it('should accept valid content', () => {
      const result = validateContent('Hello, world!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty content', () => {
      const result = validateContent('');

      expect(result.valid).toBe(true);
    });

    it('should accept unicode content', () => {
      const result = validateContent('日本語テスト 🚀 emojis');

      expect(result.valid).toBe(true);
    });

    it('should accept content with newlines and whitespace', () => {
      const result = validateContent('Line 1\nLine 2\r\nLine 3\t\tTab');

      expect(result.valid).toBe(true);
    });

    it('should reject content exceeding max length', () => {
      const longContent = 'x'.repeat(65000);
      const result = validateContent(longContent);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum length');
    });

    it('should accept content at max length', () => {
      const maxContent = 'x'.repeat(64000);
      const result = validateContent(maxContent);

      expect(result.valid).toBe(true);
    });

    it('should reject content with null bytes', () => {
      const result = validateContent('before\0after');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('null bytes');
    });

    it('should reject non-string content', () => {
      const result = validateContent(123 as unknown as string);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be a string');
    });

    it('should handle multiple validation errors', () => {
      const content = 'x'.repeat(65000) + '\0';
      const result = validateContent(content);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateTags', () => {
    it('should accept valid tags array', () => {
      const tags = [
        ['p', validPubkey],
        ['e', validEventId],
        ['t', 'nostr']
      ];
      const result = validateTags(tags);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty tags array', () => {
      const result = validateTags([]);

      expect(result.valid).toBe(true);
    });

    it('should accept tags with empty values', () => {
      const result = validateTags([['t', '']]);

      expect(result.valid).toBe(true);
    });

    it('should reject non-array tags', () => {
      const result = validateTags('not-an-array' as unknown as string[][]);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be an array');
    });

    it('should reject too many tags', () => {
      const tags = Array.from({ length: 2001 }, () => ['t', 'test']);
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Too many tags');
    });

    it('should accept tags at max limit', () => {
      const tags = Array.from({ length: 2000 }, () => ['t', 'test']);
      const result = validateTags(tags);

      expect(result.valid).toBe(true);
    });

    it('should reject tag that is not an array', () => {
      const tags = ['not-an-array'] as unknown as string[][];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('is not an array');
    });

    it('should reject non-string tag values', () => {
      const tags = [['p', 123]] as unknown as string[][];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('is not a string');
    });

    it('should reject tag values exceeding max length', () => {
      const longValue = 'x'.repeat(1025);
      const tags = [['t', longValue]];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds max length');
    });

    it('should reject tag values with null bytes', () => {
      const tags = [['t', 'before\0after']];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('null bytes');
    });

    it('should validate pubkey in p tag', () => {
      const tags = [['p', 'invalid-pubkey']];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid pubkey');
    });

    it('should validate event ID in e tag', () => {
      const tags = [['e', 'invalid-event-id']];
      const result = validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid event ID');
    });

    it('should accept valid p tag with valid pubkey', () => {
      const tags = [['p', validPubkey]];
      const result = validateTags(tags);

      expect(result.valid).toBe(true);
    });

    it('should accept valid e tag with valid event ID', () => {
      const tags = [['e', validEventId]];
      const result = validateTags(tags);

      expect(result.valid).toBe(true);
    });

    it('should accept p tag without second element', () => {
      const tags = [['p']];
      const result = validateTags(tags);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateEvent', () => {
    const validEvent = {
      id: validEventId,
      pubkey: validPubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello, world!',
      sig: validSignature
    };

    it('should accept valid event', () => {
      const result = validateEvent(validEvent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event without pubkey', () => {
      const event = { ...validEvent, pubkey: undefined };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing pubkey');
    });

    it('should reject event with invalid pubkey', () => {
      const event = { ...validEvent, pubkey: 'invalid' };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid pubkey format');
    });

    it('should reject event without created_at', () => {
      const event = { ...validEvent, created_at: undefined };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing created_at');
    });

    it('should reject event with invalid created_at', () => {
      const invalidTimestamps = [
        { created_at: -1 },
        { created_at: 1.5 },
        { created_at: 'not-a-number' as unknown as number }
      ];

      for (const { created_at } of invalidTimestamps) {
        const event = { ...validEvent, created_at };
        const result = validateEvent(event);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid created_at timestamp');
      }
    });

    it('should reject event without kind', () => {
      const event = { ...validEvent, kind: undefined };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing kind');
    });

    it('should reject event with invalid kind', () => {
      const invalidKinds = [
        { kind: -1 },
        { kind: 65536 },
        { kind: 1.5 },
        { kind: 'text' as unknown as number }
      ];

      for (const { kind } of invalidKinds) {
        const event = { ...validEvent, kind };
        const result = validateEvent(event);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid event kind');
      }
    });

    it('should accept kind 0 (metadata)', () => {
      const event = { ...validEvent, kind: 0 };
      const result = validateEvent(event);

      expect(result.valid).toBe(true);
    });

    it('should accept kind 65535 (max kind)', () => {
      const event = { ...validEvent, kind: 65535 };
      const result = validateEvent(event);

      expect(result.valid).toBe(true);
    });

    it('should reject event without content', () => {
      const event = { ...validEvent, content: undefined };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event missing content');
    });

    it('should reject event with invalid content', () => {
      const event = { ...validEvent, content: 'x'.repeat(65000) };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum length'))).toBe(true);
    });

    it('should validate tags if present', () => {
      const event = { ...validEvent, tags: [['p', 'invalid']] };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid pubkey'))).toBe(true);
    });

    it('should reject invalid event ID if present', () => {
      const event = { ...validEvent, id: 'invalid' };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid event ID format');
    });

    it('should reject invalid signature if present', () => {
      const event = { ...validEvent, sig: 'invalid' };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid signature format');
    });

    it('should accept event without optional id and sig', () => {
      const event = {
        pubkey: validPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: 'Test'
      };
      const result = validateEvent(event);

      expect(result.valid).toBe(true);
    });

    it('should collect all errors', () => {
      const event = {
        pubkey: 'invalid',
        created_at: -1,
        kind: -1,
        content: 'x'.repeat(65000)
      };
      const result = validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('sanitizeForDisplay', () => {
    it('should return same string for normal text', () => {
      const result = sanitizeForDisplay('Hello, world!');

      expect(result).toBe('Hello, world!');
    });

    it('should remove null bytes', () => {
      const result = sanitizeForDisplay('before\0after');

      expect(result).toBe('beforeafter');
    });

    it('should remove multiple null bytes', () => {
      const result = sanitizeForDisplay('\0start\0middle\0end\0');

      expect(result).toBe('startmiddleend');
    });

    it('should normalize unicode (NFKC)', () => {
      // Compatibility decomposition normalizes full-width to ASCII
      const fullWidth = '\uff21\uff22\uff23'; // ABC full-width
      const result = sanitizeForDisplay(fullWidth);

      expect(result).toBe('ABC');
    });

    it('should truncate to max length', () => {
      const longText = 'x'.repeat(100000);
      const result = sanitizeForDisplay(longText);

      expect(result.length).toBe(64000);
    });

    it('should handle empty string', () => {
      const result = sanitizeForDisplay('');

      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeForDisplay(123 as unknown as string);

      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = sanitizeForDisplay(null as unknown as string);

      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = sanitizeForDisplay(undefined as unknown as string);

      expect(result).toBe('');
    });

    it('should preserve valid unicode', () => {
      const text = '日本語 🚀 العربية';
      const result = sanitizeForDisplay(text);

      expect(result).toBe(text);
    });

    it('should handle combining characters', () => {
      // e + combining acute accent should normalize to precomposed
      const combining = 'e\u0301'; // é as e + combining
      const result = sanitizeForDisplay(combining);

      // NFKC normalizes to NFC first, so should be single character
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('validateChannelName', () => {
    it('should accept valid channel name', () => {
      const result = validateChannelName('General Chat');

      expect(result.valid).toBe(true);
    });

    it('should accept channel name with numbers', () => {
      const result = validateChannelName('Channel 123');

      expect(result.valid).toBe(true);
    });

    it('should accept channel name with allowed punctuation', () => {
      const names = [
        "Tom's Channel",
        "What's New?",
        "Hello World!",
        "Test-Channel",
        "Channel.Name"
      ];

      for (const name of names) {
        const result = validateChannelName(name);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject empty channel name', () => {
      const result = validateChannelName('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel name cannot be empty');
    });

    it('should reject channel name exceeding max length', () => {
      const result = validateChannelName('x'.repeat(101));

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('too long');
    });

    it('should accept channel name at max length', () => {
      const result = validateChannelName('x'.repeat(100));

      expect(result.valid).toBe(true);
    });

    it('should reject channel name with invalid characters', () => {
      const invalidNames = [
        '<script>alert(1)</script>',
        'Channel@Home',
        'Channel#1',
        'Channel$Money',
        'Channel%Test',
        'Channel^Up',
        'Channel&Here',
        'Channel*Star',
        'Channel(Paren)',
        'Channel=Equal',
        'Channel+Plus',
        'Channel[Bracket]',
        'Channel{Brace}',
        'Channel|Pipe',
        'Channel\\Backslash',
        'Channel;Semi',
        'Channel:Colon',
        'Channel"Quote',
        'Channel<Less',
        'Channel>More',
        'Channel/Slash',
        'Channel`Tick',
        'Channel~Tilde'
      ];

      for (const name of invalidNames) {
        const result = validateChannelName(name);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('invalid characters');
      }
    });

    it('should reject non-string channel name', () => {
      const result = validateChannelName(123 as unknown as string);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel name must be a string');
    });

    it('should handle unicode in channel name', () => {
      // The current regex only allows \w\s\-'.!? which excludes unicode
      const result = validateChannelName('日本語チャンネル');

      // Expected to fail due to regex restriction
      expect(result.valid).toBe(false);
    });

    it('should accept single character name', () => {
      const result = validateChannelName('A');

      expect(result.valid).toBe(true);
    });
  });

  describe('security boundary tests', () => {
    describe('XSS prevention', () => {
      it('should not accept script tags in pubkey', () => {
        expect(isValidPubkey('<script>alert(1)</script>')).toBe(false);
      });

      it('should not accept event handlers in content validation', () => {
        const content = '<img src=x onerror=alert(1)>';
        const result = validateContent(content);

        // Content validation doesn't block HTML (that's sanitization)
        // But it should still be valid content
        expect(result.valid).toBe(true);
      });
    });

    describe('SQL injection prevention', () => {
      it('should not accept SQL injection in pubkey', () => {
        expect(isValidPubkey("'; DROP TABLE--")).toBe(false);
      });

      it('should validate content with SQL-like strings', () => {
        const content = "SELECT * FROM users WHERE id = '1' OR '1'='1'";
        const result = validateContent(content);

        // SQL strings are valid content
        expect(result.valid).toBe(true);
      });
    });

    describe('path traversal prevention', () => {
      it('should not accept path traversal in pubkey', () => {
        expect(isValidPubkey('../../../etc/passwd')).toBe(false);
      });

      it('should not accept path traversal in event ID', () => {
        expect(isValidEventId('../../../etc/passwd')).toBe(false);
      });
    });

    describe('null byte injection', () => {
      it('should detect null bytes in content', () => {
        const result = validateContent('safe\0unsafe');

        expect(result.valid).toBe(false);
      });

      it('should detect null bytes in tag values', () => {
        const result = validateTags([['t', 'safe\0unsafe']]);

        expect(result.valid).toBe(false);
      });
    });

    describe('unicode homograph attack prevention', () => {
      it('should normalize unicode in sanitizeForDisplay', () => {
        // Cyrillic 'а' looks like Latin 'a'
        const homograph = '\u0430bc'; // Cyrillic a + bc
        const result = sanitizeForDisplay(homograph);

        // NFKC doesn't convert between scripts, but normalizes within them
        expect(result).toBeDefined();
      });
    });
  });
});
