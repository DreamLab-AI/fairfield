<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, scale, fly } from 'svelte/transition';
  import { spring } from 'svelte/motion';

  export let icon = '';
  export let title = 'Nothing here yet';
  export let description = '';
  export let actionLabel = '';
  export let secondaryActionLabel = '';
  export let illustration: 'empty-inbox' | 'no-results' | 'error' | 'offline' | 'custom' | 'none' = 'none';

  const dispatch = createEventDispatcher<{ action: void; secondaryAction: void }>();

  // Spring animation for floating effect
  const floatY = spring(0, { stiffness: 0.02, damping: 0.3 });

  // Subtle floating animation
  let floatInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    floatInterval = setInterval(() => {
      floatY.set(Math.sin(Date.now() / 1000) * 4);
    }, 50);
  });

  onDestroy(() => {
    if (floatInterval) clearInterval(floatInterval);
  });

  // SVG illustrations for different states
  const illustrations = {
    'empty-inbox': `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-32 h-32 text-base-content/20">
      <rect x="40" y="60" width="120" height="100" rx="8" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M40 80 L100 120 L160 80" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="100" cy="50" r="20" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
    </svg>`,
    'no-results': `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-32 h-32 text-base-content/20">
      <circle cx="85" cy="85" r="45" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="120" y1="120" x2="160" y2="160" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="70" y1="85" x2="100" y2="85" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    'error': `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-32 h-32 text-error/40">
      <circle cx="100" cy="100" r="60" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="75" y1="75" x2="125" y2="125" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="125" y1="75" x2="75" y2="125" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    'offline': `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-32 h-32 text-warning/40">
      <path d="M50 120 Q100 80 150 120" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M65 135 Q100 105 135 135" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M80 150 Q100 130 120 150" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="60" y1="60" x2="140" y2="140" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    'custom': '',
    'none': ''
  };
</script>

<div
  class="flex flex-col items-center justify-center py-16 px-6 text-center"
  in:fade={{ duration: 300 }}
  role="status"
  aria-live="polite"
>
  <!-- Illustration or Icon -->
  {#if illustration !== 'none' && illustration !== 'custom'}
    <div
      class="mb-6 opacity-80"
      style="transform: translateY({$floatY}px)"
      in:scale={{ duration: 400, delay: 100, start: 0.8 }}
    >
      {@html illustrations[illustration]}
    </div>
  {:else if icon}
    <div
      class="text-6xl mb-6 opacity-60"
      style="transform: translateY({$floatY}px)"
      in:scale={{ duration: 400, delay: 100, start: 0.8 }}
      aria-hidden="true"
    >
      {icon}
    </div>
  {:else}
    <slot name="illustration" />
  {/if}

  <!-- Title -->
  <h3
    class="text-xl font-semibold text-base-content mb-3"
    in:fly={{ y: 10, duration: 300, delay: 150 }}
  >
    {title}
  </h3>

  <!-- Description -->
  {#if description}
    <p
      class="text-base-content/60 mb-8 max-w-md leading-relaxed"
      in:fly={{ y: 10, duration: 300, delay: 200 }}
    >
      {description}
    </p>
  {/if}

  <!-- Actions -->
  {#if actionLabel || secondaryActionLabel}
    <div
      class="flex flex-wrap gap-3 justify-center"
      in:fly={{ y: 10, duration: 300, delay: 250 }}
    >
      {#if actionLabel}
        <button
          class="btn btn-primary gap-2 focus-ring"
          on:click={() => dispatch('action')}
        >
          <slot name="action-icon" />
          {actionLabel}
        </button>
      {/if}

      {#if secondaryActionLabel}
        <button
          class="btn btn-ghost gap-2 focus-ring"
          on:click={() => dispatch('secondaryAction')}
        >
          <slot name="secondary-icon" />
          {secondaryActionLabel}
        </button>
      {/if}
    </div>
  {/if}

  <!-- Additional slot for custom content -->
  <slot />
</div>

<style>
  /* Subtle hover effect on illustration */
  div:has(svg):hover svg {
    transform: scale(1.05);
    transition: transform 0.3s var(--md-sys-motion-easing-standard);
  }
</style>
