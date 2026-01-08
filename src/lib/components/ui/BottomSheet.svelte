<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { spring } from 'svelte/motion';
  import { fade } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let snapPoints: number[] = [0.5, 0.9]; // Percentage of viewport height
  export let initialSnap = 0; // Index of initial snap point
  export let dismissible = true;
  export let showHandle = true;

  const dispatch = createEventDispatcher<{
    close: void;
    snap: { index: number; height: number };
  }>();

  let sheetElement: HTMLElement;
  let contentElement: HTMLElement;
  let isDragging = false;
  let startY = 0;
  let currentY = 0;
  let viewportHeight = 0;

  // Calculate snap heights in pixels
  $: snapHeights = snapPoints.map(p => viewportHeight * p);
  $: currentSnapIndex = initialSnap;
  $: targetHeight = spring(snapHeights[currentSnapIndex] || snapHeights[0] || 300, {
    stiffness: 0.15,
    damping: 0.8
  });

  onMount(() => {
    viewportHeight = window.innerHeight;
    window.addEventListener('resize', handleResize);

    if (open) {
      targetHeight.set(snapHeights[currentSnapIndex] || snapHeights[0]);
    }
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    document.body.style.overflow = '';
  });

  function handleResize() {
    viewportHeight = window.innerHeight;
  }

  $: if (open) {
    document.body.style.overflow = 'hidden';
    targetHeight.set(snapHeights[currentSnapIndex] || snapHeights[0]);
  } else {
    document.body.style.overflow = '';
    targetHeight.set(0);
  }

  function handleTouchStart(e: TouchEvent) {
    if (!dismissible && snapPoints.length <= 1) return;
    isDragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    e.preventDefault();
    currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;
    const newHeight = ($targetHeight || 0) + deltaY;

    // Clamp to valid range with rubber band effect
    const maxHeight = viewportHeight * 0.95;
    const minHeight = dismissible ? -50 : snapHeights[0] || 100;

    if (newHeight > maxHeight) {
      targetHeight.set(maxHeight + (newHeight - maxHeight) * 0.2);
    } else if (newHeight < minHeight) {
      targetHeight.set(minHeight + (newHeight - minHeight) * 0.2);
    } else {
      targetHeight.set(newHeight);
    }

    startY = currentY;
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const currentHeight = $targetHeight || 0;

    // Check if should dismiss
    if (dismissible && currentHeight < (snapHeights[0] || 100) * 0.5) {
      close();
      return;
    }

    // Find nearest snap point
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    snapHeights.forEach((snapHeight, index) => {
      const distance = Math.abs(currentHeight - snapHeight);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    currentSnapIndex = nearestIndex;
    targetHeight.set(snapHeights[nearestIndex]);
    dispatch('snap', { index: nearestIndex, height: snapHeights[nearestIndex] });

    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(10);
  }

  function close() {
    open = false;
    dispatch('close');
  }

  function handleBackdropClick() {
    if (dismissible) close();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && dismissible) {
      close();
    }
  }

  function snapTo(index: number) {
    if (index >= 0 && index < snapHeights.length) {
      currentSnapIndex = index;
      targetHeight.set(snapHeights[index]);
      dispatch('snap', { index, height: snapHeights[index] });
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-modal-backdrop bg-base-100/60 backdrop-blur-sm"
    on:click={handleBackdropClick}
    role="button"
    tabindex="-1"
    aria-label="Close bottom sheet"
    transition:fade={{ duration: 200 }}
  />

  <!-- Sheet -->
  <div
    bind:this={sheetElement}
    class="fixed bottom-0 left-0 right-0 z-modal bg-base-200 rounded-t-3xl shadow-elevation-5 overflow-hidden"
    style="height: {$targetHeight}px; max-height: 95vh;"
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'bottom-sheet-title' : undefined}
  >
    <!-- Drag handle -->
    {#if showHandle}
      <div
        class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend={handleTouchEnd}
        role="slider"
        aria-label="Drag to resize"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((($targetHeight || 0) / viewportHeight) * 100)}
        tabindex="0"
      >
        <div class="w-12 h-1.5 rounded-full bg-base-content/20 transition-all hover:bg-base-content/30 hover:w-16" />
      </div>
    {/if}

    <!-- Header -->
    {#if title}
      <div class="flex items-center justify-between px-4 py-2 border-b border-base-300">
        <h2 id="bottom-sheet-title" class="text-lg font-semibold">{title}</h2>
        {#if dismissible}
          <button
            class="btn btn-ghost btn-sm btn-circle focus-ring"
            on:click={close}
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div
      bind:this={contentElement}
      class="overflow-y-auto overscroll-contain"
      style="height: calc(100% - {showHandle ? '2.5rem' : '0rem'} - {title ? '3.5rem' : '0rem'});"
    >
      <slot {snapTo} {close} />
    </div>

    <!-- Snap indicators -->
    {#if snapPoints.length > 1}
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
        {#each snapPoints as _, index}
          <button
            class="w-1.5 h-1.5 rounded-full transition-all"
            class:bg-primary={currentSnapIndex === index}
            class:w-2={currentSnapIndex === index}
            class:h-2={currentSnapIndex === index}
            class:opacity-20={currentSnapIndex !== index}
            class:bg-base-content={currentSnapIndex !== index}
            on:click={() => snapTo(index)}
            aria-label="Snap to {Math.round(snapPoints[index] * 100)}%"
          />
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Safe area support */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    div[role="dialog"] {
      padding-bottom: env(safe-area-inset-bottom);
    }
  }

  /* Smooth transitions except during drag */
  div[role="dialog"]:not(:active) {
    transition: height 0.1s ease-out;
  }
</style>
