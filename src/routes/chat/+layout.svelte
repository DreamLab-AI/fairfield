<script lang="ts">
  /**
   * Chat Layout
   * Provides the sections sidebar for all chat pages
   */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { SectionsPanel } from '$lib/components/sections';

  let isMobile = false;
  let sidebarExpanded = true;
  let sidebarVisible = true;

  // Get active section from URL query params
  $: activeSection = $page.url.searchParams.get('section');

  // Check screen size on mount and resize
  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 1024;
      // Auto-collapse sidebar on mobile
      if (isMobile) {
        sidebarExpanded = false;
      }
    }
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  function toggleSidebar() {
    if (isMobile) {
      sidebarVisible = !sidebarVisible;
    } else {
      sidebarExpanded = !sidebarExpanded;
    }
  }
</script>

<div class="chat-layout flex min-h-[calc(100vh-4rem)]">
  <!-- Sections Sidebar (desktop) -->
  {#if !isMobile}
    <SectionsPanel
      bind:isExpanded={sidebarExpanded}
      isVisible={sidebarVisible}
      {activeSection}
    />
  {/if}

  <!-- Main Content -->
  <div class="flex-1 overflow-x-hidden">
    <slot />
  </div>

  <!-- Mobile Sidebar Toggle -->
  {#if isMobile}
    <button
      class="fixed left-4 bottom-4 btn btn-circle btn-primary shadow-lg z-40"
      on:click={toggleSidebar}
      aria-label={sidebarVisible ? 'Hide boards' : 'Show boards'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>

    <!-- Mobile Sidebar Drawer -->
    {#if sidebarVisible}
      <!-- Backdrop -->
      <button
        class="fixed inset-0 bg-black/50 z-30"
        on:click={() => sidebarVisible = false}
        aria-label="Close sidebar"
      ></button>

      <!-- Sidebar -->
      <div class="fixed left-0 top-0 bottom-0 z-40 w-64">
        <SectionsPanel
          isExpanded={true}
          isVisible={true}
          {activeSection}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .chat-layout {
    position: relative;
  }
</style>
