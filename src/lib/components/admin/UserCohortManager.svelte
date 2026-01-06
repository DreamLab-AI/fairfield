<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getCohorts, getCategories } from '$lib/config';
  import type { CohortConfig, CategoryConfig } from '$lib/config/types';

  export let userPubkey: string;
  export let userName: string = 'User';
  export let currentCohorts: string[] = [];
  export let isApproved: boolean = false;

  const dispatch = createEventDispatcher<{
    save: { pubkey: string; cohorts: string[]; approved: boolean };
    cancel: void;
  }>();

  let selectedCohorts: string[] = [...currentCohorts];
  let approvalStatus: boolean = isApproved;
  let saving: boolean = false;

  $: cohorts = getCohorts();
  $: categories = getCategories();

  // Group cohorts by zone association
  $: zoneCohortsMap = categories.reduce((acc, cat) => {
    const zoneCohorts = cat.access?.visibleToCohorts || [];
    zoneCohorts.forEach(cohortId => {
      if (!acc[cohortId]) acc[cohortId] = [];
      acc[cohortId].push(cat);
    });
    return acc;
  }, {} as Record<string, CategoryConfig[]>);

  // Categorize cohorts
  $: adminCohorts = cohorts.filter(c => c.id === 'admin' || c.id === 'cross-access');
  $: zoneCohorts = cohorts.filter(c =>
    !adminCohorts.some(ac => ac.id === c.id) &&
    (c.id.includes('family') || c.id.includes('minimoonoir') || c.id.includes('business') || c.id.includes('trainer') || c.id.includes('trainee'))
  );
  $: otherCohorts = cohorts.filter(c =>
    !adminCohorts.some(ac => ac.id === c.id) &&
    !zoneCohorts.some(zc => zc.id === c.id)
  );

  function toggleCohort(cohortId: string) {
    if (selectedCohorts.includes(cohortId)) {
      selectedCohorts = selectedCohorts.filter(c => c !== cohortId);
    } else {
      selectedCohorts = [...selectedCohorts, cohortId];
    }
  }

  function getZonesForCohort(cohortId: string): string[] {
    return (zoneCohortsMap[cohortId] || []).map(cat => cat.branding?.displayName || cat.name);
  }

  async function handleSave() {
    saving = true;
    dispatch('save', {
      pubkey: userPubkey,
      cohorts: selectedCohorts,
      approved: approvalStatus
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function selectPreset(preset: 'family' | 'minimoonoir' | 'business' | 'admin') {
    switch (preset) {
      case 'family':
        selectedCohorts = ['family'];
        break;
      case 'minimoonoir':
        selectedCohorts = ['minimoonoir'];
        break;
      case 'business':
        selectedCohorts = ['business', 'trainees'];
        break;
      case 'admin':
        selectedCohorts = ['admin', 'cross-access'];
        break;
    }
    approvalStatus = true;
  }
</script>

<div class="card bg-base-200 shadow-xl">
  <div class="card-body">
    <h2 class="card-title flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      Manage User Access
    </h2>

    <div class="text-sm text-base-content/70 mb-4">
      <span class="font-mono bg-base-300 px-2 py-1 rounded">{userPubkey.slice(0, 8)}...{userPubkey.slice(-8)}</span>
      {#if userName}
        <span class="ml-2">({userName})</span>
      {/if}
    </div>

    <!-- Approval Status -->
    <div class="form-control mb-4">
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="toggle toggle-success"
          bind:checked={approvalStatus}
        />
        <span class="label-text font-medium">
          {approvalStatus ? 'Approved' : 'Pending Approval'}
        </span>
      </label>
    </div>

    <!-- Quick Presets -->
    <div class="mb-4">
      <label class="label">
        <span class="label-text font-medium">Quick Presets</span>
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          class="btn btn-sm btn-outline"
          style="border-color: #4a7c59; color: #4a7c59;"
          on:click={() => selectPreset('family')}
        >
          Family Member
        </button>
        <button
          class="btn btn-sm btn-outline"
          style="border-color: #8b5cf6; color: #8b5cf6;"
          on:click={() => selectPreset('minimoonoir')}
        >
          Minimoonoir Guest
        </button>
        <button
          class="btn btn-sm btn-outline"
          style="border-color: #ec4899; color: #ec4899;"
          on:click={() => selectPreset('business')}
        >
          Business/Trainee
        </button>
        <button
          class="btn btn-sm btn-outline btn-error"
          on:click={() => selectPreset('admin')}
        >
          Full Admin
        </button>
      </div>
    </div>

    <div class="divider">Detailed Cohort Selection</div>

    <!-- Admin Cohorts -->
    {#if adminCohorts.length > 0}
      <div class="mb-4">
        <label class="label">
          <span class="label-text font-medium text-error">Administrative</span>
        </label>
        <div class="flex flex-wrap gap-2">
          {#each adminCohorts as cohort (cohort.id)}
            <button
              class="btn btn-sm"
              class:btn-error={selectedCohorts.includes(cohort.id)}
              class:btn-outline={!selectedCohorts.includes(cohort.id)}
              on:click={() => toggleCohort(cohort.id)}
            >
              {cohort.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Zone Cohorts -->
    {#if zoneCohorts.length > 0}
      <div class="mb-4">
        <label class="label">
          <span class="label-text font-medium">Zone Access</span>
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          {#each zoneCohorts as cohort (cohort.id)}
            {@const zones = getZonesForCohort(cohort.id)}
            <label class="flex items-start gap-3 p-3 rounded-lg bg-base-100 cursor-pointer hover:bg-base-300 transition-colors">
              <input
                type="checkbox"
                class="checkbox checkbox-primary mt-0.5"
                checked={selectedCohorts.includes(cohort.id)}
                on:change={() => toggleCohort(cohort.id)}
              />
              <div class="flex-1">
                <div class="font-medium">{cohort.name}</div>
                <div class="text-xs text-base-content/60">{cohort.description}</div>
                {#if zones.length > 0}
                  <div class="text-xs text-primary mt-1">
                    Zones: {zones.join(', ')}
                  </div>
                {/if}
              </div>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Other Cohorts -->
    {#if otherCohorts.length > 0}
      <div class="mb-4">
        <label class="label">
          <span class="label-text font-medium">Other</span>
        </label>
        <div class="flex flex-wrap gap-2">
          {#each otherCohorts as cohort (cohort.id)}
            <button
              class="btn btn-sm"
              class:btn-primary={selectedCohorts.includes(cohort.id)}
              class:btn-outline={!selectedCohorts.includes(cohort.id)}
              on:click={() => toggleCohort(cohort.id)}
            >
              {cohort.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Selected Summary -->
    <div class="alert alert-info mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div>
        <div class="font-medium">Selected Cohorts ({selectedCohorts.length})</div>
        <div class="text-sm">
          {#if selectedCohorts.length > 0}
            {selectedCohorts.join(', ')}
          {:else}
            No cohorts selected - user will have minimal access
          {/if}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="card-actions justify-end mt-6">
      <button class="btn btn-ghost" on:click={handleCancel}>Cancel</button>
      <button
        class="btn btn-primary"
        on:click={handleSave}
        disabled={saving}
      >
        {#if saving}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Save Changes
      </button>
    </div>
  </div>
</div>
