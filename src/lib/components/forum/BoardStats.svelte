<script lang="ts">
  import { onMount } from 'svelte';
  import { ndk, isConnected } from '$lib/nostr/relay';
  import { browser } from '$app/environment';
  import { profileCache } from '$lib/stores/profiles';

  // Board statistics
  export let totalPosts = 0;
  export let totalMembers = 0;
  export let newestMember = '';
  export let activeUsers = 0;

  let loading = true;
  let newestMemberPubkey = '';

  onMount(async () => {
    if (!browser) return;

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        loading = false;
        console.warn('BoardStats: Fetch timeout, showing empty state');
      }
    }, 10000);

    try {
      const ndkInstance = ndk();
      if (!ndkInstance || !isConnected()) {
        loading = false;
        console.warn('BoardStats: NDK not available or not connected');
        return;
      }

      // Fetch message count (kind 42 = channel messages)
      const messageEvents = await ndkInstance.fetchEvents({
        kinds: [42],
        limit: 1000,
      });
      totalPosts = messageEvents.size;

      // Fetch unique authors (members who have posted)
      const authors = new Set<string>();
      for (const event of messageEvents) {
        authors.add(event.pubkey);
      }
      totalMembers = authors.size;

      // Get newest member (most recent first-time poster)
      const sortedEvents = Array.from(messageEvents).sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0)
      );

      // Find the most recently active unique author
      const seenAuthors = new Set<string>();
      for (const event of sortedEvents) {
        if (!seenAuthors.has(event.pubkey)) {
          seenAuthors.add(event.pubkey);
          if (seenAuthors.size === authors.size) {
            // This is the newest member
            newestMemberPubkey = event.pubkey;
            // Fetch profile and display name
            profileCache.getProfile(event.pubkey).then(() => {
              const cached = profileCache.getCachedSync(event.pubkey);
              newestMember = cached?.displayName || event.pubkey.substring(0, 8) + '...';
            });
            newestMember = event.pubkey.substring(0, 8) + '...'; // Initial fallback
            break;
          }
        }
      }

      // Calculate active users (posted in last 15 minutes)
      const fifteenMinutesAgo = Math.floor(Date.now() / 1000) - 15 * 60;
      const recentAuthors = new Set<string>();
      for (const event of messageEvents) {
        if ((event.created_at || 0) > fifteenMinutesAgo) {
          recentAuthors.add(event.pubkey);
        }
      }
      activeUsers = recentAuthors.size;

    } catch (e) {
      console.error('Failed to fetch board stats:', e);
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  });

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <h3 class="card-title text-lg text-primary mb-3">Board Statistics</h3>

    {#if loading}
      <div class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="stat-item">
          <div class="text-base-content/60">Total Posts</div>
          <div class="text-xl font-bold text-primary">{formatNumber(totalPosts)}</div>
        </div>

        <div class="stat-item">
          <div class="text-base-content/60">Members</div>
          <div class="text-xl font-bold text-secondary">{formatNumber(totalMembers)}</div>
        </div>

        <div class="stat-item col-span-2">
          <div class="text-base-content/60">Newest Member</div>
          <div class="font-mono text-sm text-accent">{newestMember || 'None yet'}</div>
        </div>

        {#if activeUsers > 0}
          <div class="stat-item col-span-2 bg-success/10 rounded-lg p-2 -mx-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
              <span class="text-success font-medium">
                {activeUsers} user{activeUsers !== 1 ? 's' : ''} active now
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .stat-item {
    padding: 0.25rem 0;
  }
</style>
