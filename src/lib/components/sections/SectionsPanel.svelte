<script lang="ts">
  /**
   * SectionsPanel - Hierarchical sidebar navigation
   * Shows Categories (zones) with their Sections nested underneath
   * Provides clear navigation hierarchy: Category > Section
   * Locked zones show scrambled ASCII cypherpunk style
   */
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getCategories, getSectionsByCategory, type CategoryConfig, type SectionConfig } from '$lib/config';
  import { sectionStore, accessibleSections, pendingSections } from '$lib/stores/sections';
  import { isAuthenticated } from '$lib/stores/auth';
  import { whitelistStatusStore } from '$lib/stores/user';
  import type { SectionAccessStatus } from '$lib/types/channel';

  export let isExpanded = true;
  export let isVisible = true;
  export let activeSection: string | null = null;
  export let activeCategory: string | null = null;

  let categories: CategoryConfig[] = [];
  let expandedCategories: Set<string> = new Set();
  let loading = false;

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

  // Check if user has access to a zone based on cohorts
  function hasZoneAccess(category: CategoryConfig): boolean {
    const userCohorts = $whitelistStatusStore?.cohorts ?? [];
    const isAdmin = $whitelistStatusStore?.isAdmin ?? false;

    // Admins see everything
    if (isAdmin) return true;

    // If no access config, zone is public
    const visibleTo = (category as any).access?.visibleToCohorts;
    if (!visibleTo || visibleTo.length === 0) return true;

    // Check if user has any required cohort
    return userCohorts.some(c => visibleTo.includes(c));
  }

  function getAccessStatus(sectionId: string): SectionAccessStatus {
    if ($accessibleSections.includes(sectionId as never)) return 'approved';
    if ($pendingSections.includes(sectionId as never)) return 'pending';
    return 'none';
  }

  function getStatusBadge(status: SectionAccessStatus): { text: string; class: string } {
    switch (status) {
      case 'approved':
        return { text: '✓', class: 'badge-success' };
      case 'pending':
        return { text: '⏳', class: 'badge-warning' };
      default:
        return { text: '', class: '' };
    }
  }

  function toggleCategory(categoryId: string) {
    if (expandedCategories.has(categoryId)) {
      expandedCategories.delete(categoryId);
    } else {
      expandedCategories.add(categoryId);
    }
    expandedCategories = expandedCategories; // Trigger reactivity
  }

  async function handleSectionClick(section: SectionConfig, categoryId: string) {
    const status = getAccessStatus(section.id);

    if (status === 'approved' || !section.access?.requiresApproval) {
      // Navigate using hierarchical route: /{category}/{section}
      goto(`${base}/${categoryId}/${section.id}`);
    } else if (status === 'none') {
      await requestAccess(section.id);
    }
  }

  function handleCategoryClick(category: CategoryConfig) {
    // Navigate to category page
    goto(`${base}/${category.id}`);
  }

  async function requestAccess(sectionId: string) {
    if (!$isAuthenticated) {
      goto(`${base}/login`);
      return;
    }

    loading = true;
    try {
      const result = await sectionStore.requestSectionAccess(sectionId as never);
      if (!result.success && result.error) {
        console.error('Failed to request access:', result.error);
      }
    } finally {
      loading = false;
    }
  }

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  // Check if category has any accessible sections
  function categoryHasAccess(category: CategoryConfig): boolean {
    const sections = getSectionsByCategory(category.id);
    return sections.some(s => {
      const status = getAccessStatus(s.id);
      return status === 'approved' || !s.access?.requiresApproval;
    });
  }

  onMount(() => {
    // Load categories from config
    categories = getCategories();

    // Auto-expand categories that contain the active section
    if (activeSection) {
      for (const cat of categories) {
        const sections = getSectionsByCategory(cat.id);
        if (sections.some(s => s.id === activeSection)) {
          expandedCategories.add(cat.id);
        }
      }
    }

    // Auto-expand active category
    if (activeCategory) {
      expandedCategories.add(activeCategory);
    }

    // Expand all categories by default for better discoverability
    if (expandedCategories.size === 0) {
      categories.forEach(c => expandedCategories.add(c.id));
    }

    expandedCategories = expandedCategories;

    // Refresh section access status
    if ($isAuthenticated) {
      sectionStore.refresh();
    }

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

{#if isVisible}
  <aside
    class="sections-panel bg-base-200 border-r border-base-300 flex flex-col transition-all duration-300"
    class:w-72={isExpanded}
    class:w-16={!isExpanded}
    aria-label="Sections navigation"
  >
    <!-- Header -->
    <div class="p-3 border-b border-base-300 flex items-center justify-between">
      {#if isExpanded}
        <h2 class="font-semibold text-base-content">Zones</h2>
      {/if}
      <button
        class="btn btn-ghost btn-sm btn-square"
        on:click={toggleExpanded}
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 transition-transform"
          class:rotate-180={!isExpanded}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Categories & Sections List -->
    <nav class="flex-1 overflow-y-auto py-2">
      {#each categories as category, catIndex (category.id)}
        {@const sections = getSectionsByCategory(category.id)}
        {@const isOpen = expandedCategories.has(category.id)}
        {@const hasAccess = categoryHasAccess(category)}
        {@const zoneAccess = hasZoneAccess(category)}
        {@const isCategoryActive = activeCategory === category.id}
        {@const displayName = category.branding?.displayName || category.name}
        {@const isLocked = !zoneAccess}

        <div class="category-group mb-1">
          <!-- Category Header -->
          <button
            class="category-header flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
            class:hover:bg-base-300={!isLocked}
            class:bg-primary={isCategoryActive && !isLocked}
            class:bg-opacity-10={isCategoryActive && !isLocked}
            class:locked-zone={isLocked}
            class:cursor-not-allowed={isLocked}
            on:click={() => !isLocked && (isExpanded ? toggleCategory(category.id) : handleCategoryClick(category))}
            aria-expanded={isOpen}
            aria-controls="sections-{category.id}"
            disabled={isLocked}
          >
            <!-- Category Icon/Logo - show glitchy lock for locked -->
            {#if isLocked}
              <span class="text-lg flex-shrink-0 locked-icon">🔐</span>
            {:else if category.branding?.logoUrl && isExpanded}
              <img
                src="{base}{category.branding.logoUrl}"
                alt=""
                class="w-6 h-6 rounded object-cover flex-shrink-0"
              />
            {:else}
              <span class="text-lg flex-shrink-0">{category.icon}</span>
            {/if}

            {#if isExpanded}
              {#if isLocked}
                <!-- Scrambled cypherpunk text for locked zones -->
                <span class="flex-1 font-mono text-sm truncate scrambled-text" data-locked="true">
                  {scrambleText(displayName.length, catIndex * 13)}
                </span>
              {:else}
                <span class="flex-1 font-medium text-sm truncate">{displayName}</span>
              {/if}

              <!-- Expand/Collapse Arrow - or lock indicator -->
              {#if isLocked}
                <span class="text-xs opacity-40 font-mono">▓▒░</span>
              {:else}
                <svg
                  class="w-4 h-4 transition-transform flex-shrink-0"
                  class:rotate-90={isOpen}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              {/if}
            {/if}
          </button>

          <!-- Sections under this Category -->
          {#if isExpanded && isOpen && !isLocked}
            <ul id="sections-{category.id}" class="menu menu-sm pl-4 pr-2 gap-0.5">
              <!-- Category Page Link -->
              <li>
                <button
                  class="flex items-center gap-2 w-full px-3 py-1.5 rounded text-xs transition-colors hover:bg-base-300"
                  class:bg-primary={isCategoryActive && !activeSection}
                  class:text-primary-content={isCategoryActive && !activeSection}
                  on:click={() => handleCategoryClick(category)}
                >
                  <span class="opacity-60">📋</span>
                  <span class="truncate">Overview</span>
                </button>
              </li>

              {#each sections as section, secIndex (section.id)}
                {@const status = getAccessStatus(section.id)}
                {@const badge = getStatusBadge(status)}
                {@const isActive = activeSection === section.id}
                {@const canAccess = status === 'approved' || !section.access?.requiresApproval}

                <li>
                  <button
                    class="flex items-center gap-2 w-full px-3 py-1.5 rounded text-xs transition-colors"
                    class:bg-primary={isActive}
                    class:text-primary-content={isActive}
                    class:hover:bg-base-300={!isActive}
                    class:opacity-50={!canAccess && status !== 'pending'}
                    on:click={() => handleSectionClick(section, category.id)}
                    disabled={loading}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <!-- Section Icon -->
                    <span class="flex-shrink-0" style="color: {section.ui?.color || '#6b7280'}">
                      {section.icon}
                    </span>

                    <!-- Section Info -->
                    <span class="flex-1 truncate">{section.name}</span>

                    {#if badge.text}
                      <span class="badge badge-xs {badge.class}">{badge.text}</span>
                    {/if}

                    {#if status === 'none' && section.access?.requiresApproval}
                      <span class="text-xs text-primary/80">🔒</span>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </nav>

    <!-- Footer -->
    {#if isExpanded}
      <div class="p-3 border-t border-base-300 text-xs text-base-content/60">
        <p>🔒 = Request access needed</p>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .sections-panel {
    min-height: 100%;
    flex-shrink: 0;
  }

  .category-group {
    border-bottom: 1px solid oklch(var(--b3) / 0.3);
  }

  .category-group:last-child {
    border-bottom: none;
  }

  .category-header {
    position: relative;
    overflow: hidden;
  }

  .category-header:focus-visible {
    outline: 2px solid oklch(var(--p));
    outline-offset: -2px;
  }

  /* Tooltip for collapsed state */
  .sections-panel:not(.w-72) .category-header {
    justify-content: center;
    padding: 0.75rem;
  }

  .sections-panel:not(.w-72) .category-header:hover::after {
    content: attr(aria-label);
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: oklch(var(--b1));
    padding: 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    opacity: 1;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    margin-left: 0.5rem;
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
</style>
