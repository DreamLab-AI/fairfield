<script lang="ts">
  import { base } from '$app/paths';
  import type { CategoryConfig, SectionConfig } from '$lib/config/types';

  export let category: CategoryConfig;
  export let sectionStats: Record<string, { channelCount: number; memberCount: number }> = {};

  $: totalSections = category.sections?.length ?? 0;
  $: totalChannels = category.sections?.reduce((sum, sec) => sum + (sectionStats[sec.id]?.channelCount ?? 0), 0) ?? 0;
  $: heroUrl = category.branding?.heroImageUrl;
  $: logoUrl = category.branding?.logoUrl;
  $: displayName = category.branding?.displayName || category.name;
</script>

<a
  href="{base}/{category.id}"
  class="card bg-base-100 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer overflow-hidden"
>
  {#if heroUrl}
    <figure class="relative h-32">
      <img
        src="{base}{heroUrl}"
        alt="{displayName}"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-base-100 to-transparent" />
    </figure>
  {/if}

  <div class="card-body {heroUrl ? 'pt-2' : ''}">
    <div class="flex items-start gap-4">
      {#if logoUrl}
        <img
          src="{base}{logoUrl}"
          alt="{displayName} logo"
          class="w-12 h-12 rounded-lg object-cover bg-base-200 {heroUrl ? '-mt-8 shadow-lg border-2 border-base-100' : ''}"
        />
      {:else}
        <div class="text-5xl {heroUrl ? '-mt-8 bg-base-100 rounded-lg p-1 shadow-lg' : ''}">{category.icon}</div>
      {/if}
      <div class="flex-1">
        <h2 class="card-title text-xl">{displayName}</h2>
        <p class="text-sm text-base-content/70 mt-1">{category.description}</p>
      </div>
    </div>

    <div class="divider my-2"></div>

    <div class="grid grid-cols-2 gap-4 text-center">
      <div>
        <div class="text-2xl font-bold text-primary">{totalSections}</div>
        <div class="text-xs text-base-content/60">Sections</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-secondary">{totalChannels}</div>
        <div class="text-xs text-base-content/60">Forums</div>
      </div>
    </div>

    {#if category.sections && category.sections.length > 0}
      <div class="mt-3 space-y-1">
        <div class="text-xs text-base-content/60 uppercase font-semibold">Sections:</div>
        <div class="flex flex-wrap gap-1">
          {#each category.sections.slice(0, 4) as section}
            <span class="badge badge-outline badge-sm">
              {section.icon} {section.name}
            </span>
          {/each}
          {#if category.sections.length > 4}
            <span class="badge badge-ghost badge-sm">+{category.sections.length - 4} more</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</a>
