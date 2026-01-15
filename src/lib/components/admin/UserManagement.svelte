<script lang="ts">
  /**
   * User Management Component
   * Paginated list of all whitelisted users with cohort assignment
   */
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import {
    fetchWhitelistUsers,
    updateUserCohorts,
    type WhitelistUserEntry
  } from '$lib/nostr/whitelist';

  // Available zone cohorts for radio buttons
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

  // Pagination
  let currentPage = 1;
  let pageSize = 20;
  $: totalPages = Math.ceil(total / pageSize);
  $: offset = (currentPage - 1) * pageSize;

  // Search/filter
  let searchQuery = '';
  let filterCohort = '';

  // Track pending updates
  let pendingUpdates = new Map<string, string>();

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

  function getUserPrimaryZone(user: WhitelistUserEntry): string | null {
    for (const zone of ZONE_COHORTS) {
      if (user.cohorts.includes(zone.id)) {
        return zone.id;
      }
    }
    return null;
  }

  async function handleCohortChange(user: WhitelistUserEntry, newCohort: string) {
    const adminPubkey = $authStore.publicKey;
    if (!adminPubkey) {
      error = 'Not authenticated';
      return;
    }

    pendingUpdates.set(user.pubkey, newCohort);
    pendingUpdates = pendingUpdates;

    // Build new cohorts list - replace zone cohorts with selected one
    const nonZoneCohorts = user.cohorts.filter(
      c => !ZONE_COHORTS.some(z => z.id === c)
    );

    const newCohorts = newCohort === 'none'
      ? [...nonZoneCohorts, 'approved']
      : [...nonZoneCohorts, newCohort, 'approved'];

    const uniqueCohorts = [...new Set(newCohorts)];

    try {
      const result = await updateUserCohorts(user.pubkey, uniqueCohorts, adminPubkey);

      if (result.success) {
        const userIndex = users.findIndex(u => u.pubkey === user.pubkey);
        if (userIndex >= 0) {
          users[userIndex] = { ...users[userIndex], cohorts: uniqueCohorts };
          users = users;
        }

        successMessage = `Updated ${user.displayName || truncatePubkey(user.pubkey)} to ${newCohort === 'none' ? 'no zone' : newCohort}`;
        setTimeout(() => { successMessage = null; }, 3000);
      } else {
        error = result.error || 'Failed to update cohorts';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update cohorts';
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

    <!-- Users Table -->
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>User</th>
            <th>Added</th>
            <th class="text-center">Zone Assignment</th>
          </tr>
        </thead>
        <tbody>
          {#if loading && users.length === 0}
            <tr>
              <td colspan="3" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>
          {:else if filteredUsers.length === 0}
            <tr>
              <td colspan="3" class="text-center py-8 text-base-content/50">
                No users found
              </td>
            </tr>
          {:else}
            {#each filteredUsers as user (user.pubkey)}
              {@const currentZone = getUserPrimaryZone(user)}
              {@const isPending = pendingUpdates.has(user.pubkey)}
              <tr class:opacity-50={isPending}>
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
                      <label
                        class="flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg border-2 transition-all"
                        class:border-transparent={currentZone !== zone.id}
                        class:bg-base-100={currentZone !== zone.id}
                        class:opacity-70={currentZone !== zone.id}
                        style={currentZone === zone.id ? `border-color: ${zone.color}; background-color: ${zone.color}20;` : ''}
                      >
                        <input
                          type="radio"
                          name="zone-{user.pubkey}"
                          class="radio radio-sm"
                          style={`--chkbg: ${zone.color}; --bc: ${zone.color};`}
                          checked={currentZone === zone.id}
                          disabled={isPending}
                          on:change={() => handleCohortChange(user, zone.id)}
                        />
                        <span class="text-xs font-medium" style={currentZone === zone.id ? `color: ${zone.color};` : ''}>
                          {zone.label}
                        </span>
                      </label>
                    {/each}
                    <!-- None option -->
                    <label
                      class="flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg border-2 transition-all"
                      class:border-transparent={currentZone !== null}
                      class:bg-base-100={currentZone !== null}
                      class:opacity-70={currentZone !== null}
                      class:border-base-content={currentZone === null}
                    >
                      <input
                        type="radio"
                        name="zone-{user.pubkey}"
                        class="radio radio-sm"
                        checked={currentZone === null}
                        disabled={isPending}
                        on:change={() => handleCohortChange(user, 'none')}
                      />
                      <span class="text-xs font-medium">None</span>
                    </label>
                    {#if isPending}
                      <span class="loading loading-spinner loading-xs"></span>
                    {/if}
                  </div>
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
