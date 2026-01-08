<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let text = '';
  export let variant: 'spinner' | 'dots' | 'ring' | 'skeleton' | 'pulse' = 'spinner';
  export let fullscreen = false;
  export let overlay = false;

  $: sizeClasses = {
    xs: 'loading-xs',
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg',
    xl: 'w-16 h-16'
  };

  $: variantClasses = {
    spinner: 'loading-spinner',
    dots: 'loading-dots',
    ring: 'loading-ring',
    skeleton: '',
    pulse: ''
  };

  $: skeletonSizes = {
    xs: 'h-4 w-20',
    sm: 'h-6 w-32',
    md: 'h-8 w-48',
    lg: 'h-12 w-64',
    xl: 'h-16 w-80'
  };
</script>

{#if fullscreen || overlay}
  <div
    class="fixed inset-0 flex items-center justify-center z-modal {overlay ? 'bg-base-100/80 backdrop-blur-sm' : ''}"
    class:bg-base-100={fullscreen}
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
    role="status"
    aria-live="polite"
    aria-label={text || 'Loading'}
  >
    <div
      class="flex flex-col items-center gap-4"
      in:scale={{ duration: 300, start: 0.9, delay: 50 }}
    >
      {#if variant === 'skeleton'}
        <div class="flex flex-col gap-3 items-center">
          <div class="skeleton-shimmer rounded-full w-16 h-16"></div>
          <div class="skeleton-shimmer rounded h-4 w-32"></div>
          <div class="skeleton-shimmer rounded h-3 w-24"></div>
        </div>
      {:else if variant === 'pulse'}
        <div class="relative">
          <div class="w-16 h-16 rounded-full bg-primary/20 animate-ping absolute"></div>
          <div class="w-16 h-16 rounded-full bg-primary/40 relative"></div>
        </div>
      {:else}
        <span
          class="loading {variantClasses[variant]} {sizeClasses[size]} text-primary"
          aria-hidden="true"
        ></span>
      {/if}

      {#if text}
        <p class="text-base-content/70 text-sm font-medium animate-pulse">{text}</p>
      {:else}
        <span class="sr-only">Loading...</span>
      {/if}
    </div>
  </div>
{:else}
  <div
    class="flex flex-col items-center justify-center gap-3"
    class:min-h-[200px]={size === 'lg' || size === 'xl'}
    role="status"
    aria-live="polite"
    in:fade={{ duration: 200 }}
  >
    {#if variant === 'skeleton'}
      <div class="flex flex-col gap-2 w-full">
        <div class="skeleton-shimmer rounded {skeletonSizes[size]}"></div>
        <div class="skeleton-shimmer rounded h-3 w-3/4"></div>
        <div class="skeleton-shimmer rounded h-3 w-1/2"></div>
      </div>
    {:else if variant === 'pulse'}
      <div class="relative inline-flex">
        <div class="w-8 h-8 rounded-full bg-primary/20 animate-ping absolute"></div>
        <div class="w-8 h-8 rounded-full bg-primary/40 relative"></div>
      </div>
    {:else}
      <span
        class="loading {variantClasses[variant]} {sizeClasses[size]} text-primary"
        aria-hidden="true"
      ></span>
    {/if}

    {#if text}
      <p class="text-sm text-base-content/70">{text}</p>
    {:else}
      <span class="sr-only">Loading...</span>
    {/if}
  </div>
{/if}

<style>
  /* Enhanced skeleton shimmer */
  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      oklch(var(--b3)) 0%,
      oklch(var(--b2)) 20%,
      oklch(var(--b3)) 40%,
      oklch(var(--b3)) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Ensure spinner doesn't cause layout shift */
  .loading {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
