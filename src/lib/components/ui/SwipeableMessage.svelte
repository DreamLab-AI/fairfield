<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { spring } from 'svelte/motion';
  import { fade, fly } from 'svelte/transition';

  export let message: string;
  export let timestamp: Date | string;
  export let sender: string = '';
  export let avatar: string = '';
  export let isSent: boolean = false;
  export let status: 'sending' | 'sent' | 'delivered' | 'read' | 'error' = 'sent';
  export let swipeThreshold: number = 80;
  export let enableSwipe: boolean = true;
  export let enableLongPress: boolean = true;

  const dispatch = createEventDispatcher<{
    reply: void;
    react: void;
    delete: void;
    copy: void;
    forward: void;
    longpress: void;
  }>();

  let element: HTMLElement;
  let offsetX = spring(0, { stiffness: 0.15, damping: 0.8 });
  let isDragging = false;
  let startX = 0;
  let currentX = 0;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let showActions = false;
  let isLongPressed = false;

  // Format timestamp
  $: formattedTime = typeof timestamp === 'string'
    ? timestamp
    : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(timestamp);

  // Status icons
  const statusIcons = {
    sending: `<circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5"><animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/></circle>`,
    sent: `<path stroke="currentColor" stroke-width="2" d="M5 12l5 5L20 7" fill="none"/>`,
    delivered: `<path stroke="currentColor" stroke-width="2" d="M2 12l5 5L17 7M7 12l5 5L22 7" fill="none"/>`,
    read: `<path stroke="#38bdf8" stroke-width="2" d="M2 12l5 5L17 7M7 12l5 5L22 7" fill="none"/>`,
    error: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path stroke="currentColor" stroke-width="2" d="M12 8v4M12 16v0" stroke-linecap="round"/>`
  };

  function handleTouchStart(e: TouchEvent) {
    if (!enableSwipe) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    currentX = startX;

    if (enableLongPress) {
      longPressTimer = setTimeout(() => {
        isLongPressed = true;
        dispatch('longpress');
        showActions = true;
        // Haptic feedback
        if ('vibrate' in navigator) navigator.vibrate(50);
      }, 500);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || !enableSwipe) return;

    // Cancel long press if moving
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    currentX = e.touches[0].clientX;
    const deltaX = currentX - startX;

    // Only allow swipe in one direction based on message type
    if (isSent) {
      // Sent messages swipe left
      offsetX.set(Math.min(0, Math.max(-swipeThreshold * 1.5, deltaX)));
    } else {
      // Received messages swipe right
      offsetX.set(Math.max(0, Math.min(swipeThreshold * 1.5, deltaX)));
    }
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (!isDragging) return;
    isDragging = false;

    const deltaX = currentX - startX;
    const threshold = swipeThreshold;

    // Check if swipe threshold reached
    if (isSent && deltaX < -threshold) {
      dispatch('reply');
      if ('vibrate' in navigator) navigator.vibrate(30);
    } else if (!isSent && deltaX > threshold) {
      dispatch('reply');
      if ('vibrate' in navigator) navigator.vibrate(30);
    }

    // Reset position with spring animation
    offsetX.set(0);
  }

  function handleMouseDown(e: MouseEvent) {
    if (!enableSwipe) return;
    isDragging = true;
    startX = e.clientX;
    currentX = startX;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !enableSwipe) return;
    currentX = e.clientX;
    const deltaX = currentX - startX;

    if (isSent) {
      offsetX.set(Math.min(0, Math.max(-swipeThreshold * 1.5, deltaX)));
    } else {
      offsetX.set(Math.max(0, Math.min(swipeThreshold * 1.5, deltaX)));
    }
  }

  function handleMouseUp() {
    handleTouchEnd();
  }

  function closeActions() {
    showActions = false;
    isLongPressed = false;
  }

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
  });
</script>

<svelte:window on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<div
  bind:this={element}
  class="relative select-none"
  class:ml-auto={isSent}
  class:mr-auto={!isSent}
  role="listitem"
  aria-label="Message from {sender || (isSent ? 'you' : 'contact')}"
>
  <!-- Swipe indicator (reply icon) -->
  {#if Math.abs($offsetX) > 20}
    <div
      class="absolute top-1/2 -translate-y-1/2 text-primary transition-opacity"
      class:left-0={!isSent}
      class:right-0={isSent}
      class:opacity-100={Math.abs($offsetX) > swipeThreshold / 2}
      class:opacity-50={Math.abs($offsetX) <= swipeThreshold / 2}
      style="transform: translateY(-50%) scale({Math.min(1, Math.abs($offsetX) / swipeThreshold)})"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    </div>
  {/if}

  <!-- Message bubble -->
  <div
    class="message-bubble max-w-[80%] sm:max-w-md relative"
    class:message-bubble-sent={isSent}
    class:message-bubble-received={!isSent}
    class:ring-2={isLongPressed}
    class:ring-primary={isLongPressed}
    style="transform: translateX({$offsetX}px)"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:mousedown={handleMouseDown}
  >
    <!-- Avatar for received messages -->
    {#if !isSent && avatar}
      <div class="absolute -left-10 top-0">
        <div class="avatar">
          <div class="w-8 h-8 rounded-full">
            <img src={avatar} alt={sender} />
          </div>
        </div>
      </div>
    {/if}

    <!-- Message content -->
    <div class="flex flex-col gap-1">
      {#if !isSent && sender}
        <span class="text-xs font-medium text-primary">{sender}</span>
      {/if}

      <p class="text-sm leading-relaxed break-words">{message}</p>

      <div class="flex items-center gap-1 justify-end">
        <span class="text-xs opacity-60">{formattedTime}</span>
        {#if isSent}
          <svg class="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none">
            {@html statusIcons[status]}
          </svg>
        {/if}
      </div>
    </div>
  </div>

  <!-- Long-press context menu -->
  {#if showActions}
    <div
      class="fixed inset-0 z-modal-backdrop bg-base-100/50 backdrop-blur-sm"
      on:click={closeActions}
      on:keydown={(e) => e.key === 'Escape' && closeActions()}
      role="button"
      tabindex="0"
      aria-label="Close menu"
      transition:fade={{ duration: 150 }}
    />

    <div
      class="absolute z-modal bg-base-200 rounded-xl shadow-elevation-4 p-2 min-w-[180px]"
      class:left-0={!isSent}
      class:right-0={isSent}
      style="top: -4rem;"
      transition:fly={{ y: 10, duration: 200 }}
      role="menu"
    >
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors"
        on:click={() => { dispatch('reply'); closeActions(); }}
        role="menuitem"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Reply
      </button>

      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors"
        on:click={() => { dispatch('react'); closeActions(); }}
        role="menuitem"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        React
      </button>

      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors"
        on:click={() => { dispatch('copy'); closeActions(); }}
        role="menuitem"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy
      </button>

      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors"
        on:click={() => { dispatch('forward'); closeActions(); }}
        role="menuitem"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        Forward
      </button>

      <div class="border-t border-base-300 my-1"></div>

      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-error/10 text-error transition-colors"
        on:click={() => { dispatch('delete'); closeActions(); }}
        role="menuitem"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </div>
  {/if}
</div>

<style>
  .message-bubble {
    transition: transform 0.05s linear;
  }

  /* Prevent text selection during swipe */
  .message-bubble:active {
    user-select: none;
  }
</style>
