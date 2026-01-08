<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getCategories, getSections } from '$lib/config';
  import { userStore } from '$lib/stores/user';
  import type { CategoryConfig, SectionConfig } from '$lib/config/types';

  export let currentCategoryId: string | null = null;
  export let currentSectionId: string | null = null;
  export let collapsed: boolean = false;
  export let onToggle: (() => void) | undefined = undefined;

  $: categories = getCategories();
  $: userCohorts = $userStore.profile?.cohorts || [];
  $: isAdmin = $userStore.profile?.isAdmin || false;

  // Filter categories based on user cohorts and zone access
  $: visibleCategories = categories.filter(cat => {
    if (isAdmin) return true; // Admins see all
    const visibleTo = cat.access?.visibleToCohorts || [];
    const hiddenFrom = cat.access?.hiddenFromCohorts || [];

    // If no restrictions, show to all
    if (visibleTo.length === 0 && hiddenFrom.length === 0) return true;

    // Check if user is in hidden cohorts
    const userCohortStrings = userCohorts as string[];
    if (hiddenFrom.some(c => userCohortStrings.includes(c))) return false;

    // Check if user is in visible cohorts (or visibleTo is empty = visible to all)
    if (visibleTo.length === 0) return true;
    return visibleTo.some(c => userCohortStrings.includes(c) || c === 'cross-access');
  });

  function getCategoryColor(cat: CategoryConfig): string {
    return cat.branding?.primaryColor || cat.ui?.color || '#6366f1';
  }

  function isCurrentCategory(catId: string): boolean {
    return currentCategoryId === catId;
  }

  function isCurrentSection(secId: string): boolean {
    return currentSectionId === secId;
  }
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

  <ul class="menu menu-sm gap-1">
    {#each visibleCategories as category (category.id)}
      {@const color = getCategoryColor(category)}
      {@const isActive = isCurrentCategory(category.id)}

      <li>
        <details open={isActive}>
          <summary
            class="flex items-center gap-2 rounded-lg transition-colors"
            class:bg-base-200={isActive}
            style={isActive ? `border-left: 3px solid ${color};` : ''}
          >
            <span class="text-lg" style="color: {color};">{category.icon}</span>
            {#if !collapsed}
              <span class="flex-1 truncate font-medium">
                {category.branding?.displayName || category.name}
              </span>
              {#if category.access?.strictIsolation}
                <span class="badge badge-xs badge-ghost">Private</span>
              {/if}
            {/if}
          </summary>

          {#if !collapsed}
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

  {#if !collapsed && visibleCategories.length === 0}
    <div class="px-4 py-8 text-center text-base-content/50">
      <p class="text-sm">No zones available</p>
      <p class="text-xs mt-1">Contact admin for access</p>
    </div>
  {/if}
</nav>

<style>
  .zone-nav {
    @apply w-full;
  }

  .zone-nav.collapsed {
    @apply w-16;
  }

  .zone-nav.collapsed summary {
    @apply justify-center;
  }
</style>
