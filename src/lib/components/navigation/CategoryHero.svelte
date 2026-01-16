<script lang="ts">
  import { base } from '$app/paths';
  import type { CategoryConfig } from '$lib/config/types';

  export let category: CategoryConfig;

  $: heroUrl = category.branding?.heroImageUrl;
  $: logoUrl = category.branding?.logoUrl;
  $: displayName = category.branding?.displayName || category.name;
  $: tagline = category.branding?.tagline || category.description;
  $: primaryColor = category.branding?.primaryColor || category.ui?.color || '#6366f1';
</script>

{#if heroUrl}
  <div
    class="relative w-full h-48 sm:h-64 md:h-80 rounded-xl overflow-hidden mb-6"
    style="--hero-color: {primaryColor}"
  >
    <!-- Hero Image -->
    <img
      src="{base}{heroUrl}"
      alt="{displayName} hero"
      class="absolute inset-0 w-full h-full object-cover"
      loading="eager"
    />

    <!-- Gradient Overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-base-300/95 via-base-300/50 to-transparent" />

    <!-- Content -->
    <div class="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
      <div class="flex items-end gap-4">
        {#if logoUrl}
          <img
            src="{base}{logoUrl}"
            alt="{displayName} logo"
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-lg shadow-lg object-cover bg-base-100"
          />
        {:else}
          <div
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-lg shadow-lg flex items-center justify-center text-4xl sm:text-5xl bg-base-100"
          >
            {category.icon}
          </div>
        {/if}

        <div class="flex-1 min-w-0">
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content drop-shadow-lg">
            {displayName}
          </h1>
          {#if tagline}
            <p class="text-sm sm:text-base text-base-content/80 mt-1 line-clamp-2">
              {tagline}
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Fallback: Simple header without hero image -->
  <div class="flex items-center gap-4 mb-6">
    <div class="text-5xl">{category.icon}</div>
    <div>
      <h1 class="text-3xl font-bold">{displayName}</h1>
      <p class="text-base-content/70 mt-1">{tagline}</p>
    </div>
  </div>
{/if}
