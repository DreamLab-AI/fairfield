<script lang="ts">
  /**
   * ZoneNav - Hierarchical zone navigation
   * Shows all zones with obfuscation for locked ones (ASCII cypherpunk style)
   */
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getCategories, getSections } from '$lib/config';
  import { userStore, whitelistStatusStore } from '$lib/stores/user';
  import type { CategoryConfig, SectionConfig } from '$lib/config/types';

  export let currentCategoryId: string | null = null;
  export let currentSectionId: string | null = null;
  export let collapsed: boolean = false;
  export let onToggle: (() => void) | undefined = undefined;

  // Scrambled text state for animation
  let scrambleFrame = 0;
  let scrambleInterval: ReturnType<typeof setInterval>;

  // Cypherpunk ASCII character set for scrambling
  const CYPHER_CHARS = '░▒▓█▀▄▌▐│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌';
  const GLITCH_CHARS = '¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇ';

  // Generate scrambled text for locked items
  function scrambleText(length: number, seed: number = 0): string {
    const chars = CYPHER_CHARS + GLITCH_CHARS;
    let result = '';
    for (let i = 0; i < length; i++) {
      const idx = (scrambleFrame + seed + i * 7) % chars.length;
      result += chars[idx];
    }
    return result;
  }

  $: categories = getCategories();

  // Use whitelistStatusStore for authoritative admin/approval check
  $: userCohorts = $whitelistStatusStore?.cohorts ?? $userStore.profile?.cohorts ?? [];
  $: isAdmin = $whitelistStatusStore?.isAdmin ?? $userStore.profile?.isAdmin ?? false;
  $: isApproved = $whitelistStatusStore?.isWhitelisted ?? $userStore.profile?.isApproved ?? false;

  // Check if user has access to a zone
  function hasZoneAccess(cat: CategoryConfig): boolean {
    // Admins see all zones
    if (isAdmin) return true;

    // Unapproved users cannot access any zone
    if (!isApproved) return false;

    const visibleTo = cat.access?.visibleToCohorts || [];
    const hiddenFrom = cat.access?.hiddenFromCohorts || [];

    // If no restrictions, show to all approved users
    if (visibleTo.length === 0 && hiddenFrom.length === 0) return true;

    // Check if user is in hidden cohorts
    const userCohortStrings = userCohorts as string[];
    if (hiddenFrom.some(c => userCohortStrings.includes(c))) return false;

    // Check if user is in visible cohorts (or visibleTo is empty = visible to all approved)
    if (visibleTo.length === 0) return true;
    return visibleTo.some(c => userCohortStrings.includes(c) || c === 'cross-access');
  }

  function getCategoryColor(cat: CategoryConfig): string {
    return cat.branding?.primaryColor || cat.ui?.color || '#6366f1';
  }

  function isCurrentCategory(catId: string): boolean {
    return currentCategoryId === catId;
  }

  function isCurrentSection(secId: string): boolean {
    return currentSectionId === secId;
  }

  onMount(() => {
    // Start scramble animation for locked zones
    scrambleInterval = setInterval(() => {
      scrambleFrame = (scrambleFrame + 1) % 100;
    }, 80);
  });

  onDestroy(() => {
    if (scrambleInterval) {
      clearInterval(scrambleInterval);
    }
  });
</script>

<nav class="zone-nav" class:collapsed>
  <!-- Header with toggle -->
  <div class="zone-nav-header flex items-center justify-between p-3 border-b border-base-300 dark:border-base-content/10">
    {#if !collapsed}
      <span class="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
        Zones
      </span>
    {/if}
    <button
      class="btn btn-ghost btn-sm btn-square {collapsed ? 'mx-auto' : ''}"
      on:click={onToggle}
      aria-label={collapsed ? 'Expand zones' : 'Collapse zones'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {#if collapsed}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
          />
        {:else}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        {/if}
      </svg>
    </button>
  </div>

  <!-- Debug: Show current admin/approval status -->
  {#if false}
  <div class="text-xs p-2 bg-warning/20">Admin: {isAdmin}, Approved: {isApproved}</div>
  {/if}

  <ul class="menu menu-sm gap-1">
    <!-- Key includes isAdmin to force re-render when admin status changes -->
    {#each categories as category, catIndex (`${category.id}-${isAdmin}-${isApproved}`)}
      {@const color = getCategoryColor(category)}
      {@const isActive = isCurrentCategory(category.id)}
      {@const hasAccess = hasZoneAccess(category)}
      {@const displayName = category.branding?.displayName || category.name}
      {@const isLocked = !hasAccess}

      <li>
        <details open={isActive && hasAccess} class:pointer-events-none={isLocked}>
          <summary
            class="flex items-center gap-2 rounded-lg transition-colors"
            class:bg-base-200={isActive && hasAccess}
            class:locked-zone={isLocked}
            class:cursor-not-allowed={isLocked}
            style={isActive && hasAccess ? `border-left: 3px solid ${color};` : ''}
          >
            <!-- Icon: show lock for locked zones -->
            {#if isLocked}
              <span class="text-lg locked-icon">🔐</span>
            {:else}
              <span class="text-lg" style="color: {color};">{category.icon}</span>
            {/if}

            {#if !collapsed}
              {#if isLocked}
                <!-- Scrambled cypherpunk text for locked zones -->
                <span class="flex-1 truncate font-mono text-sm scrambled-text">
                  {scrambleText(displayName.length, catIndex * 13)}
                </span>
                <span class="text-xs opacity-40 font-mono">▓▒░</span>
              {:else}
                <span class="flex-1 truncate font-medium">
                  {displayName}
                </span>
                {#if category.access?.strictIsolation}
                  <span class="badge badge-xs badge-ghost">Private</span>
                {/if}
              {/if}
            {/if}
          </summary>

          {#if !collapsed && hasAccess}
            <ul class="ml-4 border-l-2 border-base-300">
              {#each category.sections as section (section.id)}
                {@const secActive = isCurrentSection(section.id)}
                <li>
                  <a
                    href="{base}/{category.id}/{section.id}"
                    class="flex items-center gap-2 py-2 {secActive ? 'bg-primary/10 text-primary' : ''}"
                    style={secActive ? `color: ${color};` : ''}
                  >
                    <span class="text-base">{section.icon}</span>
                    <span class="truncate">{section.name}</span>
                    {#if section.access.requiresApproval}
                      <span class="badge badge-xs badge-warning">Approval</span>
                    {/if}
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </details>
      </li>
    {/each}
  </ul>

  {#if !collapsed && categories.length === 0}
    <div class="px-4 py-8 text-center text-base-content/50">
      <p class="text-sm">No zones available</p>
      <p class="text-xs mt-1">Contact admin for access</p>
    </div>
  {/if}
</nav>

<style>
  .zone-nav {
    @apply w-full min-w-0;
  }

  /* Let parent container control width - don't set width here */
  .zone-nav.collapsed summary {
    @apply justify-center;
  }

  /* Cypherpunk locked zone styles */
  .locked-zone {
    opacity: 0.6;
    background: linear-gradient(90deg,
      oklch(var(--b2) / 0.3) 0%,
      oklch(var(--b3) / 0.5) 50%,
      oklch(var(--b2) / 0.3) 100%
    );
    border-left: 2px solid oklch(var(--er) / 0.4);
    position: relative;
    overflow: hidden;
  }

  .locked-zone:hover {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .scrambled-text {
    color: oklch(var(--er) / 0.7);
    text-shadow:
      0 0 2px oklch(var(--er) / 0.3),
      0 0 4px oklch(var(--er) / 0.2);
    letter-spacing: 0.05em;
    animation: scramble-glow 2s ease-in-out infinite;
  }

  @keyframes scramble-glow {
    0%, 100% {
      opacity: 0.5;
      text-shadow:
        0 0 2px oklch(var(--er) / 0.3),
        0 0 4px oklch(var(--er) / 0.2);
    }
    50% {
      opacity: 0.8;
      text-shadow:
        0 0 4px oklch(var(--er) / 0.5),
        0 0 8px oklch(var(--er) / 0.3),
        0 0 12px oklch(var(--er) / 0.1);
    }
  }

  .locked-icon {
    animation: lock-pulse 1.5s ease-in-out infinite;
    filter: grayscale(0.3);
  }

  @keyframes lock-pulse {
    0%, 100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  /* Scanline effect for locked zones */
  .locked-zone::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      oklch(var(--b1) / 0.03) 2px,
      oklch(var(--b1) / 0.03) 4px
    );
    pointer-events: none;
    animation: scanline 8s linear infinite;
  }

  @keyframes scanline {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 0 100px;
    }
  }

  .pointer-events-none {
    pointer-events: none;
  }
</style>
