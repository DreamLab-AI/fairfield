<script lang="ts">
  /**
   * User Management Component
   * Paginated list of all whitelisted users with multi-zone cohort assignment
   * Supports batch operations for approving/assigning multiple users at once
   */
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import {
    fetchWhitelistUsers,
    updateUserCohorts,
    type WhitelistUserEntry
  } from '$lib/nostr/whitelist';

  // Available zone cohorts for checkboxes (multi-select)
  const ZONE_COHORTS = [
    { id: 'family', label: 'Family', color: '#4a7c59' },
    { id: 'dreamlab', label: 'DreamLab', color: '#ec4899' },
    { id: 'minimoonoir', label: 'Minimoonoir', color: '#8b5cf6' },
    { id: 'admin', label: 'Admin', color: '#ef4444' }
  ] as const;

  // State
  let users: WhitelistUserEntry[] = [];
  let total = 0;
  let loading = false;
  let error: string | null = null;
  let successMessage: string | null = null;

  // Batch selection state
  let selectedUsers = new Set<string>();
  let batchProcessing = false;
  let batchZonesModal = false;
  let batchSelectedZones: string[] = [];

  // Pagination
  let currentPage = 1;
  let pageSize = 20;
  $: totalPages = Math.ceil(total / pageSize);
  $: offset = (currentPage - 1) * pageSize;

  // Search/filter
  let searchQuery = '';
  let filterCohort = '';

  // Computed: check if all visible users are selected
  $: allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u.pubkey));
  $: someSelected = selectedUsers.size > 0;

  // Svelte action for setting indeterminate state on checkbox
  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(newValue: boolean) {
        node.indeterminate = newValue;
      }
    };
  }

  // Track pending updates
  let pendingUpdates = new Set<string>();

  async function loadUsers() {
    loading = true;
    error = null;

    try {
      const result = await fetchWhitelistUsers({
        limit: pageSize,
        offset,
        cohort: filterCohort || undefined
      });

      users = result.users;
      total = result.total;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load users';
      console.error('[UserManagement] Error loading users:', errorMessage);
      error = errorMessage;
      users = [];
      total = 0;
    } finally {
      loading = false;
    }
  }

  function getUserZones(user: WhitelistUserEntry): string[] {
    return ZONE_COHORTS.filter(zone => user.cohorts.includes(zone.id)).map(z => z.id);
  }

  function hasZone(user: WhitelistUserEntry, zoneId: string): boolean {
    return user.cohorts.includes(zoneId);
  }

  async function handleZoneToggle(user: WhitelistUserEntry, zoneId: string, checked: boolean) {
    const adminPubkey = $authStore.publicKey;
    if (!adminPubkey) {
      error = 'Not authenticated';
      return;
    }

    pendingUpdates.add(user.pubkey);
    pendingUpdates = pendingUpdates;

    // Build new cohorts list - toggle the specified zone
    const nonZoneCohorts = user.cohorts.filter(
      c => !ZONE_COHORTS.some(z => z.id === c)
    );

    // Get current zone cohorts and add/remove the toggled one
    const currentZones = getUserZones(user);
    let newZones: string[];

    if (checked) {
      newZones = [...currentZones, zoneId];
    } else {
      newZones = currentZones.filter(z => z !== zoneId);
    }

    // Build final cohorts: non-zone + zones + approved (if any zones selected)
    const newCohorts = newZones.length > 0
      ? [...nonZoneCohorts, ...newZones, 'approved']
      : [...nonZoneCohorts, 'approved'];

    const uniqueCohorts = [...new Set(newCohorts)];

    try {
      const result = await updateUserCohorts(user.pubkey, uniqueCohorts, adminPubkey);

      if (result.success) {
        const userIndex = users.findIndex(u => u.pubkey === user.pubkey);
        if (userIndex >= 0) {
          users[userIndex] = { ...users[userIndex], cohorts: uniqueCohorts };
          users = users;
        }

        const zoneLabel = ZONE_COHORTS.find(z => z.id === zoneId)?.label || zoneId;
        const action = checked ? 'added to' : 'removed from';
        successMessage = `${user.displayName || truncatePubkey(user.pubkey)} ${action} ${zoneLabel}`;
        setTimeout(() => { successMessage = null; }, 3000);
      } else {
        error = result.error || 'Failed to update zones';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update zones';
    } finally {
      pendingUpdates.delete(user.pubkey);
      pendingUpdates = pendingUpdates;
    }
  }

  function truncatePubkey(pubkey: string): string {
    if (!pubkey) return '';
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-4);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      loadUsers();
    }
  }

  function handleSearch() {
    currentPage = 1;
    loadUsers();
  }

  function handleFilterChange() {
    currentPage = 1;
    loadUsers();
  }

  $: filteredUsers = searchQuery
    ? users.filter(user => {
        const query = searchQuery.toLowerCase();
        const name = (user.displayName || '').toLowerCase();
        const pubkey = user.pubkey.toLowerCase();
        return name.includes(query) || pubkey.includes(query);
      })
    : users;

  // ----- Batch Selection Functions -----

  function toggleSelectAll() {
    if (allSelected) {
      // Deselect all visible
      filteredUsers.forEach(u => selectedUsers.delete(u.pubkey));
    } else {
      // Select all visible
      filteredUsers.forEach(u => selectedUsers.add(u.pubkey));
    }
    selectedUsers = selectedUsers;
  }

  function toggleUserSelection(pubkey: string) {
    if (selectedUsers.has(pubkey)) {
      selectedUsers.delete(pubkey);
    } else {
      selectedUsers.add(pubkey);
    }
    selectedUsers = selectedUsers;
  }

  function clearSelection() {
    selectedUsers.clear();
    selectedUsers = selectedUsers;
  }

  function openBatchZonesModal() {
    batchSelectedZones = [];
    batchZonesModal = true;
  }

  function closeBatchZonesModal() {
    batchZonesModal = false;
    batchSelectedZones = [];
  }

  async function applyBatchZones() {
    const adminPubkey = $authStore.publicKey;
    if (!adminPubkey) {
      error = 'Not authenticated';
      return;
    }

    if (selectedUsers.size === 0) {
      error = 'No users selected';
      return;
    }

    batchProcessing = true;
    error = null;
    let successCount = 0;
    let failCount = 0;

    for (const pubkey of selectedUsers) {
      const user = users.find(u => u.pubkey === pubkey);
      if (!user) continue;

      // Build new cohorts: keep non-zone cohorts + add selected zones + approved
      const nonZoneCohorts = user.cohorts.filter(
        c => !ZONE_COHORTS.some(z => z.id === c)
      );

      const newCohorts = batchSelectedZones.length > 0
        ? [...new Set([...nonZoneCohorts, ...batchSelectedZones, 'approved'])]
        : [...new Set([...nonZoneCohorts, 'approved'])];

      try {
        const result = await updateUserCohorts(pubkey, newCohorts, adminPubkey);
        if (result.success) {
          successCount++;
          // Update local state
          const idx = users.findIndex(u => u.pubkey === pubkey);
          if (idx >= 0) {
            users[idx] = { ...users[idx], cohorts: newCohorts };
          }
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    users = users; // Trigger reactivity
    batchProcessing = false;
    closeBatchZonesModal();
    clearSelection();

    if (successCount > 0) {
      const zonesLabel = batchSelectedZones.length > 0
        ? batchSelectedZones.map(z => ZONE_COHORTS.find(zc => zc.id === z)?.label || z).join(', ')
        : 'approved status';
      successMessage = `Updated ${successCount} user${successCount !== 1 ? 's' : ''} with ${zonesLabel}`;
      setTimeout(() => { successMessage = null; }, 4000);
    }
    if (failCount > 0) {
      error = `Failed to update ${failCount} user${failCount !== 1 ? 's' : ''}`;
    }
  }

  async function batchRemoveZone(zoneId: string) {
    const adminPubkey = $authStore.publicKey;
    if (!adminPubkey) {
      error = 'Not authenticated';
      return;
    }

    batchProcessing = true;
    let successCount = 0;
    let failCount = 0;

    for (const pubkey of selectedUsers) {
      const user = users.find(u => u.pubkey === pubkey);
      if (!user || !user.cohorts.includes(zoneId)) continue;

      const newCohorts = user.cohorts.filter(c => c !== zoneId);

      try {
        const result = await updateUserCohorts(pubkey, newCohorts, adminPubkey);
        if (result.success) {
          successCount++;
          const idx = users.findIndex(u => u.pubkey === pubkey);
          if (idx >= 0) {
            users[idx] = { ...users[idx], cohorts: newCohorts };
          }
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    users = users;
    batchProcessing = false;
    clearSelection();

    const zoneLabel = ZONE_COHORTS.find(z => z.id === zoneId)?.label || zoneId;
    if (successCount > 0) {
      successMessage = `Removed ${zoneLabel} from ${successCount} user${successCount !== 1 ? 's' : ''}`;
      setTimeout(() => { successMessage = null; }, 4000);
    }
    if (failCount > 0) {
      error = `Failed to update ${failCount} user${failCount !== 1 ? 's' : ''}`;
    }
  }

  onMount(() => {
    loadUsers();
  });
</script>

<div class="card bg-base-200 shadow-lg mb-6">
  <div class="card-body">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="card-title flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          User Management
        </h2>
        <p class="text-base-content/60 text-sm mt-1">
          {total} registered user{total !== 1 ? 's' : ''}
        </p>
      </div>

      <button class="btn btn-ghost btn-sm" on:click={loadUsers} disabled={loading}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" class:animate-spin={loading}>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>

    {#if error}
      <div class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
        <button class="btn btn-ghost btn-sm" on:click={() => error = null}>Dismiss</button>
      </div>
    {/if}

    {#if successMessage}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{successMessage}</span>
      </div>
    {/if}

    <!-- Search and Filter -->
    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <div class="flex-1">
        <input
          type="text"
          placeholder="Search by name or pubkey..."
          class="input input-bordered w-full"
          bind:value={searchQuery}
          on:input={handleSearch}
        />
      </div>

      <select
        class="select select-bordered"
        bind:value={filterCohort}
        on:change={handleFilterChange}
      >
        <option value="">All Zones</option>
        {#each ZONE_COHORTS as zone}
          <option value={zone.id}>{zone.label}</option>
        {/each}
      </select>
    </div>

    <!-- Batch Action Bar -->
    {#if someSelected}
      <div class="flex flex-wrap items-center gap-2 p-3 bg-primary/10 rounded-lg mb-4 border border-primary/30">
        <span class="font-medium text-sm">
          {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
        </span>

        <div class="divider divider-horizontal mx-1"></div>

        <button
          class="btn btn-sm btn-primary"
          on:click={openBatchZonesModal}
          disabled={batchProcessing}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Assign Zones
        </button>

        <div class="dropdown dropdown-bottom">
          <button tabindex="0" class="btn btn-sm btn-outline btn-error" disabled={batchProcessing}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Remove Zone
          </button>
          <ul tabindex="0" class="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-52">
            {#each ZONE_COHORTS as zone}
              <li>
                <button on:click={() => batchRemoveZone(zone.id)} class="text-sm">
                  <span class="w-3 h-3 rounded-full" style="background-color: {zone.color}"></span>
                  {zone.label}
                </button>
              </li>
            {/each}
          </ul>
        </div>

        <button
          class="btn btn-sm btn-ghost"
          on:click={clearSelection}
        >
          Clear selection
        </button>

        {#if batchProcessing}
          <span class="loading loading-spinner loading-sm ml-2"></span>
        {/if}
      </div>
    {/if}

    <!-- Users Table -->
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th class="w-10">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={allSelected}
                on:change={toggleSelectAll}
                title="Select all"
                use:setIndeterminate={someSelected && !allSelected}
              />
            </th>
            <th>User</th>
            <th>Added</th>
            <th class="text-center">Zone Access (multi-select)</th>
          </tr>
        </thead>
        <tbody>
          {#if loading && users.length === 0}
            <tr>
              <td colspan="4" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>
          {:else if filteredUsers.length === 0}
            <tr>
              <td colspan="4" class="text-center py-8 text-base-content/50">
                No users found
              </td>
            </tr>
          {:else}
            {#each filteredUsers as user (user.pubkey)}
              {@const userZones = getUserZones(user)}
              {@const isPending = pendingUpdates.has(user.pubkey)}
              {@const isSelected = selectedUsers.has(user.pubkey)}
              <tr class="{isPending ? 'opacity-50' : ''} {isSelected ? 'bg-primary bg-opacity-5' : ''}">
                <td>
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={isSelected}
                    on:change={() => toggleUserSelection(user.pubkey)}
                  />
                </td>
                <td>
                  <div class="flex flex-col">
                    <span class="font-medium">
                      {user.displayName || 'Anonymous'}
                    </span>
                    <span class="text-xs text-base-content/50 font-mono">
                      {truncatePubkey(user.pubkey)}
                    </span>
                    {#if user.cohorts.length > 0}
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each user.cohorts.filter(c => !ZONE_COHORTS.some(z => z.id === c)) as cohort}
                          <span class="badge badge-xs badge-ghost">{cohort}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="text-sm text-base-content/70">
                  {formatDate(user.addedAt)}
                </td>
                <td>
                  <div class="flex flex-wrap justify-center gap-2">
                    {#each ZONE_COHORTS as zone}
                      {@const isSelected = hasZone(user, zone.id)}
                      <label
                        class="flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg border-2 transition-all"
                        class:border-transparent={!isSelected}
                        class:bg-base-100={!isSelected}
                        class:opacity-70={!isSelected}
                        style={isSelected ? `border-color: ${zone.color}; background-color: ${zone.color}20;` : ''}
                      >
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm"
                          style={`--chkbg: ${zone.color}; --bc: ${zone.color};`}
                          checked={isSelected}
                          disabled={isPending}
                          on:change={(e) => handleZoneToggle(user, zone.id, e.currentTarget.checked)}
                        />
                        <span class="text-xs font-medium" style={isSelected ? `color: ${zone.color};` : ''}>
                          {zone.label}
                        </span>
                      </label>
                    {/each}
                    {#if isPending}
                      <span class="loading loading-spinner loading-xs"></span>
                    {/if}
                  </div>
                  {#if userZones.length === 0}
                    <div class="text-xs text-warning text-center mt-1">No zones assigned</div>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex justify-center items-center gap-2 mt-4">
        <button
          class="btn btn-sm btn-ghost"
          disabled={currentPage === 1 || loading}
          on:click={() => goToPage(1)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          class="btn btn-sm btn-ghost"
          disabled={currentPage === 1 || loading}
          on:click={() => goToPage(currentPage - 1)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span class="text-sm text-base-content/70">
          Page {currentPage} of {totalPages}
        </span>

        <button
          class="btn btn-sm btn-ghost"
          disabled={currentPage === totalPages || loading}
          on:click={() => goToPage(currentPage + 1)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          class="btn btn-sm btn-ghost"
          disabled={currentPage === totalPages || loading}
          on:click={() => goToPage(totalPages)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    {/if}

    <!-- Page size selector -->
    <div class="flex justify-end mt-2">
      <select
        class="select select-bordered select-sm"
        bind:value={pageSize}
        on:change={() => { currentPage = 1; loadUsers(); }}
      >
        <option value={10}>10 per page</option>
        <option value={20}>20 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
  </div>
</div>

<!-- Batch Zone Assignment Modal -->
{#if batchZonesModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        Assign Zones to {selectedUsers.size} User{selectedUsers.size !== 1 ? 's' : ''}
      </h3>

      <p class="text-sm text-base-content/70 mb-4">
        Select zones to assign. This will add the selected zones while preserving any existing non-zone cohorts.
      </p>

      <div class="space-y-3">
        {#each ZONE_COHORTS as zone}
          {@const isZoneSelected = batchSelectedZones.includes(zone.id)}
          <label
            class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-base-200 {isZoneSelected ? 'border-primary bg-primary bg-opacity-10' : ''}"
          >
            <input
              type="checkbox"
              class="checkbox"
              style={`--chkbg: ${zone.color}; --bc: ${zone.color};`}
              checked={isZoneSelected}
              on:change={(e) => {
                if (e.currentTarget.checked) {
                  batchSelectedZones = [...batchSelectedZones, zone.id];
                } else {
                  batchSelectedZones = batchSelectedZones.filter(z => z !== zone.id);
                }
              }}
            />
            <span class="w-4 h-4 rounded-full" style="background-color: {zone.color}"></span>
            <span class="font-medium">{zone.label}</span>
          </label>
        {/each}
      </div>

      <div class="modal-action">
        <button
          class="btn btn-ghost"
          on:click={closeBatchZonesModal}
          disabled={batchProcessing}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          on:click={applyBatchZones}
          disabled={batchProcessing}
        >
          {#if batchProcessing}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Apply to {selectedUsers.size} User{selectedUsers.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" on:click={closeBatchZonesModal} on:keydown={(e) => e.key === 'Escape' && closeBatchZonesModal()} role="button" tabindex="0"></div>
  </div>
{/if}
