<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getCohorts, getCategories } from '$lib/config';
  import type { UserRegistrationRequest } from '$lib/nostr/groups';
  import type { CategoryConfig } from '$lib/config/types';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  export let pendingUserRegistrations: UserRegistrationRequest[];
  export let isLoading: boolean;

  const dispatch = createEventDispatcher<{
    approve: { registration: UserRegistrationRequest; cohorts: string[]; approved: boolean };
    reject: UserRegistrationRequest;
    refresh: void;
  }>();

  // Track selected cohorts and expanded state for each registration
  let selectedCohorts: Record<string, string[]> = {};
  let expandedUsers: Set<string> = new Set();

  $: cohorts = getCohorts();
  $: categories = getCategories();

  // Group cohorts by type
  $: adminCohorts = cohorts.filter(c => c.id === 'admin' || c.id === 'cross-access');
  $: zoneCohorts = cohorts.filter(c =>
    !adminCohorts.some(ac => ac.id === c.id) &&
    (c.id.includes('family') || c.id.includes('minimoonoir') || c.id.includes('business') || c.id.includes('trainer') || c.id.includes('trainee'))
  );

  // Map cohorts to zones they grant access to
  $: zoneCohortsMap = categories.reduce((acc, cat) => {
    const zoneCohorts = cat.access?.visibleToCohorts || [];
    zoneCohorts.forEach(cohortId => {
      if (!acc[cohortId]) acc[cohortId] = [];
      acc[cohortId].push(cat);
    });
    return acc;
  }, {} as Record<string, CategoryConfig[]>);

  function getZonesForCohort(cohortId: string): string[] {
    return (zoneCohortsMap[cohortId] || []).map(cat => cat.branding?.displayName || cat.name);
  }

  function toggleExpanded(registrationId: string) {
    if (expandedUsers.has(registrationId)) {
      expandedUsers.delete(registrationId);
    } else {
      expandedUsers.add(registrationId);
      // Initialize cohorts selection if not already set
      if (!selectedCohorts[registrationId]) {
        selectedCohorts[registrationId] = [];
      }
    }
    expandedUsers = new Set(expandedUsers);
  }

  function toggleCohort(registrationId: string, cohortId: string) {
    if (!selectedCohorts[registrationId]) {
      selectedCohorts[registrationId] = [];
    }
    if (selectedCohorts[registrationId].includes(cohortId)) {
      selectedCohorts[registrationId] = selectedCohorts[registrationId].filter(c => c !== cohortId);
    } else {
      selectedCohorts[registrationId] = [...selectedCohorts[registrationId], cohortId];
    }
  }

  function selectPreset(registrationId: string, preset: 'family' | 'minimoonoir' | 'business' | 'admin') {
    switch (preset) {
      case 'family':
        selectedCohorts[registrationId] = ['family'];
        break;
      case 'minimoonoir':
        selectedCohorts[registrationId] = ['minimoonoir'];
        break;
      case 'business':
        selectedCohorts[registrationId] = ['business', 'trainees'];
        break;
      case 'admin':
        selectedCohorts[registrationId] = ['admin', 'cross-access'];
        break;
    }
  }

  function handleApprove(registration: UserRegistrationRequest) {
    dispatch('approve', {
      registration,
      cohorts: selectedCohorts[registration.id] || [],
      approved: true
    });
  }

  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
</script>

<div class="card bg-base-200 mb-6">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <h2 class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Pending User Registrations
        {#if pendingUserRegistrations.length > 0}
          <span class="badge badge-error">{pendingUserRegistrations.length}</span>
        {/if}
      </h2>
      <button
        class="btn btn-ghost btn-sm"
        on:click={() => dispatch('refresh')}
        disabled={isLoading}
        aria-label="Refresh registrations"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>

    <p class="text-sm text-base-content/70 mt-2">
      Assign zone access when approving new users. Click a user to configure their cohort membership.
    </p>

    {#if isLoading && pendingUserRegistrations.length === 0}
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 text-base-content/70">Loading user registrations...</p>
      </div>
    {:else if pendingUserRegistrations.length === 0}
      <div class="text-center py-8 text-base-content/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No pending user registrations</p>
        <p class="text-sm mt-1">New users signing up will appear here for approval</p>
      </div>
    {:else}
      <div class="space-y-4 mt-4">
        {#each pendingUserRegistrations as registration (registration.id)}
          {@const isExpanded = expandedUsers.has(registration.id)}
          {@const userCohorts = selectedCohorts[registration.id] || []}

          <div class="card bg-base-100 shadow-sm">
            <!-- Collapsed header -->
            <div
              class="card-body p-4 cursor-pointer hover:bg-base-200/50 transition-colors"
              on:click={() => toggleExpanded(registration.id)}
              on:keydown={(e) => e.key === 'Enter' && toggleExpanded(registration.id)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <UserDisplay
                    pubkey={registration.pubkey}
                    showAvatar={true}
                    showName={true}
                    showFullName={true}
                    avatarSize="md"
                    clickable={false}
                  />
                  <div class="text-sm text-base-content/60">
                    {formatRelativeTime(registration.createdAt)}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  {#if userCohorts.length > 0}
                    <div class="flex gap-1">
                      {#each userCohorts.slice(0, 3) as cohort}
                        <span class="badge badge-sm badge-primary">{cohort}</span>
                      {/each}
                      {#if userCohorts.length > 3}
                        <span class="badge badge-sm badge-ghost">+{userCohorts.length - 3}</span>
                      {/if}
                    </div>
                  {/if}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 transition-transform {isExpanded ? 'rotate-180' : ''}"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {#if registration.message}
                <p class="text-sm text-base-content/70 mt-2 line-clamp-1">"{registration.message}"</p>
              {/if}
            </div>

            <!-- Expanded cohort selection -->
            {#if isExpanded}
              <div class="border-t border-base-300 p-4 bg-base-200/30">
                <!-- Quick Presets -->
                <div class="mb-4">
                  <label class="label py-1">
                    <span class="label-text font-medium text-sm">Quick Zone Assignment</span>
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="btn btn-xs btn-outline"
                      style="border-color: #4a7c59; color: #4a7c59;"
                      on:click|stopPropagation={() => selectPreset(registration.id, 'family')}
                    >
                      Family
                    </button>
                    <button
                      class="btn btn-xs btn-outline"
                      style="border-color: #8b5cf6; color: #8b5cf6;"
                      on:click|stopPropagation={() => selectPreset(registration.id, 'minimoonoir')}
                    >
                      Minimoonoir
                    </button>
                    <button
                      class="btn btn-xs btn-outline"
                      style="border-color: #ec4899; color: #ec4899;"
                      on:click|stopPropagation={() => selectPreset(registration.id, 'business')}
                    >
                      Business
                    </button>
                    <button
                      class="btn btn-xs btn-outline btn-error"
                      on:click|stopPropagation={() => selectPreset(registration.id, 'admin')}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                <!-- Zone Cohorts -->
                {#if zoneCohorts.length > 0}
                  <div class="mb-4">
                    <label class="label py-1">
                      <span class="label-text font-medium text-sm">Zone Access</span>
                    </label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {#each zoneCohorts as cohort (cohort.id)}
                        {@const zones = getZonesForCohort(cohort.id)}
                        {@const isSelected = userCohorts.includes(cohort.id)}
                        <label
                          class="flex items-start gap-2 p-2 rounded-lg bg-base-100 cursor-pointer hover:bg-base-300 transition-colors {isSelected ? 'ring-2 ring-primary' : ''}"
                          on:click|stopPropagation
                        >
                          <input
                            type="checkbox"
                            class="checkbox checkbox-primary checkbox-sm mt-0.5"
                            checked={isSelected}
                            on:change|stopPropagation={() => toggleCohort(registration.id, cohort.id)}
                          />
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm">{cohort.name}</div>
                            {#if zones.length > 0}
                              <div class="text-xs text-primary/80">{zones.join(', ')}</div>
                            {/if}
                          </div>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Admin Cohorts -->
                {#if adminCohorts.length > 0}
                  <div class="mb-4">
                    <label class="label py-1">
                      <span class="label-text font-medium text-sm text-error">Administrative</span>
                    </label>
                    <div class="flex flex-wrap gap-2">
                      {#each adminCohorts as cohort (cohort.id)}
                        {@const isSelected = userCohorts.includes(cohort.id)}
                        <button
                          class="btn btn-sm {isSelected ? 'btn-error' : 'btn-outline btn-error'}"
                          on:click|stopPropagation={() => toggleCohort(registration.id, cohort.id)}
                        >
                          {cohort.name}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Summary & Actions -->
                <div class="flex items-center justify-between pt-4 border-t border-base-300">
                  <div class="text-sm text-base-content/70">
                    {#if userCohorts.length > 0}
                      <span class="font-medium">Selected:</span> {userCohorts.join(', ')}
                    {:else}
                      <span class="text-warning">No cohorts selected - user will have minimal access</span>
                    {/if}
                  </div>

                  <div class="flex gap-2">
                    <button
                      class="btn btn-error btn-sm btn-outline"
                      on:click|stopPropagation={() => dispatch('reject', registration)}
                      disabled={isLoading}
                    >
                      Reject
                    </button>
                    <button
                      class="btn btn-success btn-sm"
                      on:click|stopPropagation={() => handleApprove(registration)}
                      disabled={isLoading}
                    >
                      {#if isLoading}
                        <span class="loading loading-spinner loading-xs"></span>
                      {/if}
                      Approve with {userCohorts.length} cohort{userCohorts.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
