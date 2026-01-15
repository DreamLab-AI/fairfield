<script lang="ts">
  /**
   * SectionsPanel - Left sidebar navigation for boards/sections
   * Displays Fairfield Guests, MiniMooNoir, and DreamLab sections
   * with access status and navigation
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getSections, type SectionConfig } from '$lib/config';
  import { sectionStore, accessibleSections, pendingSections } from '$lib/stores/sections';
  import { isAuthenticated } from '$lib/stores/auth';
  import type { SectionAccessStatus } from '$lib/types/channel';

  export let isExpanded = true;
  export let isVisible = true;
  export let activeSection: string | null = null;

  let sections: SectionConfig[] = [];
  let loading = false;

  // Icon mapping
  const iconMap: Record<string, string> = {
    wave: '👋',
    moon: '🌙',
    lightbulb: '💡',
    star: '⭐',
    heart: '❤️',
    home: '🏠',
    chat: '💬',
    calendar: '📅'
  };

  function getIcon(iconName: string): string {
    return iconMap[iconName] || '📌';
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

  async function handleSectionClick(section: SectionConfig) {
    const status = getAccessStatus(section.id);

    if (status === 'approved' || !section.access.requiresApproval) {
      // Navigate to section view
      goto(`${base}/chat?section=${section.id}`);
    } else if (status === 'none') {
      // Show request access modal or navigate to request page
      await requestAccess(section.id);
    }
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

  onMount(() => {
    // Load sections from config
    sections = getSections().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Refresh section access status
    if ($isAuthenticated) {
      sectionStore.refresh();
    }
  });
</script>

{#if isVisible}
  <aside
    class="sections-panel bg-base-200 border-r border-base-300 flex flex-col transition-all duration-300"
    class:w-64={isExpanded}
    class:w-16={!isExpanded}
    aria-label="Sections navigation"
  >
    <!-- Header -->
    <div class="p-3 border-b border-base-300 flex items-center justify-between">
      {#if isExpanded}
        <h2 class="font-semibold text-base-content">Boards</h2>
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

    <!-- Sections List -->
    <nav class="flex-1 overflow-y-auto py-2">
      <ul class="menu menu-sm gap-1">
        {#each sections as section (section.id)}
          {@const status = getAccessStatus(section.id)}
          {@const badge = getStatusBadge(status)}
          {@const isActive = activeSection === section.id}
          {@const canAccess = status === 'approved' || !section.access.requiresApproval}

          <li>
            <button
              class="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors"
              class:bg-primary={isActive}
              class:text-primary-content={isActive}
              class:hover:bg-base-300={!isActive}
              class:opacity-60={!canAccess && status !== 'pending'}
              on:click={() => handleSectionClick(section)}
              disabled={loading}
              aria-current={isActive ? 'page' : undefined}
            >
              <!-- Icon -->
              <span class="text-xl flex-shrink-0" style="color: {section.ui?.color || '#6b7280'}">
                {getIcon(section.icon)}
              </span>

              {#if isExpanded}
                <!-- Section Info -->
                <div class="flex-1 text-left min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium truncate">{section.name}</span>
                    {#if badge.text}
                      <span class="badge badge-xs {badge.class}">{badge.text}</span>
                    {/if}
                  </div>
                  <p class="text-xs opacity-70 truncate">{section.description}</p>
                </div>

                <!-- Action indicator -->
                {#if status === 'none' && section.access.requiresApproval}
                  <span class="text-xs text-primary">Request</span>
                {/if}
              {:else}
                <!-- Tooltip for collapsed state -->
                <span class="sr-only">{section.name}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </nav>

    <!-- Footer -->
    {#if isExpanded}
      <div class="p-3 border-t border-base-300 text-xs text-base-content/60">
        <p>Request access to join private boards</p>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .sections-panel {
    min-height: 100%;
    flex-shrink: 0;
  }

  /* Tooltip for collapsed state */
  .sections-panel:not(.w-64) li button {
    position: relative;
  }

  .sections-panel:not(.w-64) li button::after {
    content: attr(aria-label);
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: var(--fallback-b1, oklch(var(--b1)));
    padding: 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .sections-panel:not(.w-64) li button:hover::after {
    opacity: 1;
  }
</style>
