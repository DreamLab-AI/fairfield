<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { hapticSelect, hapticSuccess } from '$lib/utils/haptics';

  export let disabled = false;
  export let threshold = 80;

  const dispatch = createEventDispatcher<{ refresh: void }>();

  let container: HTMLDivElement;
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  let pullDistance = 0;

  $: progress = Math.min(pullDistance / threshold, 1);
  $: canRefresh = progress >= 1;
  $: rotation = progress * 180;

  function handleTouchStart(e: TouchEvent) {
    if (disabled || refreshing) return;
    if (container.scrollTop > 0) return;

    startY = e.touches[0].clientY;
    pulling = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pulling || disabled || refreshing) return;

    currentY = e.touches[0].clientY;
    pullDistance = Math.max(0, (currentY - startY) * 0.5);

    if (pullDistance > 0) {
      e.preventDefault();
    }

    if (canRefresh && pullDistance > threshold) {
      hapticSelect();
    }
  }

  function handleTouchEnd() {
    if (!pulling) return;

    if (canRefresh && !refreshing) {
      refreshing = true;
      hapticSuccess();
      dispatch('refresh');

      // Auto-reset after reasonable timeout
      setTimeout(() => {
        refreshing = false;
        pullDistance = 0;
      }, 3000);
    } else {
      pullDistance = 0;
    }

    pulling = false;
    startY = 0;
    currentY = 0;
  }

  export function complete() {
    refreshing = false;
    pullDistance = 0;
  }

  onMount(() => {
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
  });

  onDestroy(() => {
    if (container) {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    }
  });
</script>

<div
  bind:this={container}
  class="relative overflow-auto h-full"
  style="touch-action: {pulling ? 'none' : 'auto'}"
>
  <!-- Pull indicator -->
  <div
    class="absolute left-0 right-0 flex justify-center transition-transform duration-200 pointer-events-none"
    style="transform: translateY({Math.min(pullDistance, threshold * 1.5) - 60}px)"
  >
    <div
      class="w-10 h-10 rounded-full bg-base-200 shadow-lg flex items-center justify-center transition-all duration-200"
      class:bg-primary={canRefresh}
      class:text-primary-content={canRefresh}
    >
      {#if refreshing}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <svg
          class="w-5 h-5 transition-transform duration-200"
          style="transform: rotate({rotation}deg)"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div
    class="transition-transform duration-200"
    style="transform: translateY({pulling ? pullDistance * 0.3 : 0}px)"
  >
    <slot />
  </div>
</div>

<style>
  div {
    -webkit-overflow-scrolling: touch;
  }
</style>
