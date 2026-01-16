<script lang="ts">
  /**
   * MentionText - Renders text with @mentions styled as links
   * Supports @nickname, @npub, and @hex formats
   * Displays nicknames/display names instead of pubkeys
   */
  import { parseMentions, formatPubkey, type NicknameResolver } from '$lib/utils/mentions';
  import { profileCache } from '$lib/stores/profiles';

  export let content: string;
  export let resolver: NicknameResolver | undefined = undefined;

  interface TextSegment {
    type: 'text' | 'mention';
    content: string;
    pubkey?: string;
    displayName?: string;
  }

  // Parse content into segments (text and mentions)
  function parseContent(text: string): TextSegment[] {
    const mentions = parseMentions(text, resolver);

    if (mentions.length === 0) {
      return [{ type: 'text', content: text }];
    }

    const segments: TextSegment[] = [];
    let lastIndex = 0;

    for (const mention of mentions) {
      // Add text before this mention
      if (mention.startIndex > lastIndex) {
        segments.push({
          type: 'text',
          content: text.slice(lastIndex, mention.startIndex)
        });
      }

      // Get display name for this mention
      let displayName = mention.originalText || formatPubkey(mention.pubkey);

      // Try to get nickname from profile cache
      const cached = profileCache.getCachedSync(mention.pubkey);
      if (cached) {
        displayName = cached.displayName || displayName;
      }

      segments.push({
        type: 'mention',
        content: text.slice(mention.startIndex, mention.endIndex),
        pubkey: mention.pubkey,
        displayName
      });

      lastIndex = mention.endIndex;
    }

    // Add remaining text after last mention
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return segments;
  }

  $: segments = parseContent(content);
</script>

{#each segments as segment}
  {#if segment.type === 'mention'}
    <span
      class="mention-tag"
      title={segment.pubkey ? `Pubkey: ${formatPubkey(segment.pubkey)}` : ''}
    >@{segment.displayName}</span>
  {:else}
    {segment.content}
  {/if}
{/each}

<style>
  .mention-tag {
    color: oklch(var(--p));
    font-weight: 500;
    cursor: default;
    padding: 0 0.125rem;
    border-radius: 0.25rem;
    background-color: oklch(var(--p) / 0.1);
  }

  .mention-tag:hover {
    background-color: oklch(var(--p) / 0.2);
  }
</style>
