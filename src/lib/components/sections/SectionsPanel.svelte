<script lang="ts">
  /**
   * SectionsPanel - Hierarchical sidebar navigation
   * Shows Categories (zones) with their Sections nested underneath
   * Provides clear navigation hierarchy: Category > Section
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getCategories, getSectionsByCategory, type CategoryConfig, type SectionConfig } from '$lib/config';
  import { sectionStore, accessibleSections, pendingSections } from '$lib/stores/sections';
  import { isAuthenticated } from '$lib/stores/auth';
  import type { SectionAccessStatus } from '$lib/types/channel';

  export let isExpanded = true;
  export let isVisible = true;
  export let activeSection: string | null = null;
  export let activeCategory: string | null = null;

  let categories: CategoryConfig[] = [];
  let expandedCategories: Set<string> = new Set();
  let loading = false;

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
      {#each categories as category (category.id)}
        {@const sections = getSectionsByCategory(category.id)}
        {@const isOpen = expandedCategories.has(category.id)}
        {@const hasAccess = categoryHasAccess(category)}
        {@const isCategoryActive = activeCategory === category.id}
        {@const displayName = category.branding?.displayName || category.name}

        <div class="category-group mb-1">
          <!-- Category Header -->
          <button
            class="category-header flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-base-300"
            class:bg-primary={isCategoryActive}
            class:bg-opacity-10={isCategoryActive}
            class:opacity-50={!hasAccess}
            on:click={() => isExpanded ? toggleCategory(category.id) : handleCategoryClick(category)}
            aria-expanded={isOpen}
            aria-controls="sections-{category.id}"
          >
            <!-- Category Icon/Logo -->
            {#if category.branding?.logoUrl && isExpanded}
              <img
                src="{base}{category.branding.logoUrl}"
                alt=""
                class="w-6 h-6 rounded object-cover flex-shrink-0"
              />
            {:else}
              <span class="text-lg flex-shrink-0">{category.icon}</span>
            {/if}

            {#if isExpanded}
              <span class="flex-1 font-medium text-sm truncate">{displayName}</span>

              <!-- Expand/Collapse Arrow -->
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
          </button>

          <!-- Sections under this Category -->
          {#if isExpanded && isOpen}
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

              {#each sections as section (section.id)}
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
</style>
