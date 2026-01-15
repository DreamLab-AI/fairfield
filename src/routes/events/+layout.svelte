<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import CalendarSidebar from '$lib/components/calendar/CalendarSidebar.svelte';
  import CalendarSheet from '$lib/components/calendar/CalendarSheet.svelte';

  let isMobile = false;
  let sidebarVisible = true;
  let sidebarExpanded = true;

  // Check screen size on mount and resize
  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 1024;
    }
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  function toggleSidebar() {
    sidebarExpanded = !sidebarExpanded;
  }
</script>

<div class="events-layout flex min-h-screen">
  <!-- Main content area -->
  <div class="flex-1 overflow-x-hidden">
    <slot />
  </div>

  <!-- Calendar Sidebar (desktop only, right side) -->
  {#if !isMobile}
    <div class="calendar-sidebar-wrapper order-last">
      <CalendarSidebar
        bind:isExpanded={sidebarExpanded}
        isVisible={sidebarVisible}
      />
    </div>
  {/if}

  <!-- Calendar Sheet (mobile only, bottom sheet) -->
  {#if isMobile}
    <CalendarSheet />
  {/if}
</div>

<!-- Floating toggle button for sidebar when collapsed (desktop) -->
{#if !isMobile && !sidebarExpanded}
  <button
    class="fixed right-4 bottom-4 btn btn-circle btn-primary shadow-lg z-40"
    on:click={toggleSidebar}
    aria-label="Expand calendar sidebar"
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
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  </button>
{/if}

<style>
  .events-layout {
    position: relative;
  }

  .calendar-sidebar-wrapper {
    flex-shrink: 0;
  }

  /* Ensure the main content doesn't overflow when sidebar is visible */
  @media (min-width: 1024px) {
    .events-layout {
      max-width: 100vw;
    }
  }
</style>
