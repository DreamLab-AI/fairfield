<script lang="ts">
  import type { CategoryConfig, BrandingConfig } from '$lib/config/types';
  import { base } from '$app/paths';

  export let category: CategoryConfig;
  export let compact: boolean = false;

  $: branding = category.branding;
  $: heroUrl = branding?.heroImageUrl ? `${base}${branding.heroImageUrl}` : null;
  $: logoUrl = branding?.logoUrl ? `${base}${branding.logoUrl}` : null;
  $: displayName = branding?.displayName || category.name;
  $: tagline = branding?.tagline || category.description;
  $: primaryColor = branding?.primaryColor || category.ui?.color || '#6366f1';
  $: accentColor = branding?.accentColor || primaryColor;
</script>

{#if compact}
  <!-- Compact header for section pages -->
  <div
    class="relative overflow-hidden rounded-xl mb-6"
    style="--zone-primary: {primaryColor}; --zone-accent: {accentColor};"
  >
    <div class="absolute inset-0 bg-gradient-to-r from-[var(--zone-primary)] to-[var(--zone-accent)] opacity-20"></div>
    <div class="relative flex items-center gap-4 p-4">
      {#if logoUrl}
        <img
          src={logoUrl}
          alt="{displayName} logo"
          class="h-12 w-auto object-contain"
        />
      {:else}
        <span class="text-4xl">{category.icon}</span>
      {/if}
      <div>
        <h2 class="text-xl font-bold" style="color: {primaryColor};">{displayName}</h2>
        {#if tagline}
          <p class="text-sm text-base-content/70">{tagline}</p>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- Full hero for category landing pages -->
  <div
    class="relative overflow-hidden rounded-2xl mb-8 shadow-xl"
    style="--zone-primary: {primaryColor}; --zone-accent: {accentColor};"
  >
    <!-- Hero Image or Gradient Background -->
    {#if heroUrl}
      <div class="relative h-48 md:h-64">
        <img
          src={heroUrl}
          alt="{displayName} hero"
          class="w-full h-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/50 to-transparent"></div>
      </div>
    {:else}
      <div class="h-32 md:h-40 bg-gradient-to-r from-[var(--zone-primary)] to-[var(--zone-accent)]"></div>
    {/if}

    <!-- Content Overlay - Only show logo/icon when no hero image -->
    {#if !heroUrl}
      <div class="relative px-6 pb-4 -mt-8">
        <div class="flex items-end gap-4">
          {#if logoUrl}
            <div class="bg-base-100 rounded-xl p-2 shadow-lg">
              <img
                src={logoUrl}
                alt="{displayName} logo"
                class="h-16 md:h-20 w-auto object-contain"
              />
            </div>
          {:else}
            <div
              class="bg-base-100 rounded-xl p-4 shadow-lg text-5xl md:text-6xl"
              style="color: {primaryColor};"
            >
              {category.icon}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
