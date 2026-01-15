<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore, isAuthenticated } from '$lib/stores/auth';
  import { userStore, isApproved } from '$lib/stores/user';
  import { getAppConfig } from '$lib/config/loader';

  const appConfig = getAppConfig();
  const appName = appConfig.name.split(' - ')[0];

  let checkInterval: ReturnType<typeof setInterval>;

  // Periodically check if user has been approved
  onMount(() => {
    if (browser) {
      // Check every 30 seconds if user has been approved
      checkInterval = setInterval(() => {
        // The userStore automatically re-fetches whitelist status
        // If approved, redirect to chat
        if ($isApproved) {
          goto(`${base}/chat`);
        }
      }, 30000);
    }
  });

  onDestroy(() => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
  });

  // Reactive redirect when approved
  $: if (browser && $isAuthenticated && !$userStore.isLoading && $isApproved) {
    goto(`${base}/chat`);
  }
</script>

<svelte:head>
  <title>Welcome - {appConfig.name}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200">
  <!-- Header -->
  <header class="navbar bg-base-100/80 backdrop-blur-sm border-b border-base-300">
    <div class="navbar-start">
      <span class="text-xl font-bold ml-4">{appName}</span>
    </div>
    <div class="navbar-end">
      <button class="btn btn-ghost btn-sm" on:click={() => authStore.logout()}>
        Logout
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
    <div class="max-w-2xl w-full space-y-6">
      <!-- Welcome Card -->
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body items-center text-center">
          <div class="text-6xl mb-4">👋</div>

          <h1 class="card-title text-3xl mb-2">Welcome to {appName}!</h1>

          <p class="text-base-content/70 text-lg mb-4">
            Your account has been created successfully.
            You're just one step away from joining our community.
          </p>

          <div class="divider"></div>

          <!-- Status Badge -->
          <div class="flex items-center gap-3 bg-warning/10 text-warning border border-warning/30 rounded-xl px-6 py-4">
            <span class="loading loading-ring loading-md"></span>
            <div class="text-left">
              <p class="font-semibold">Awaiting Admin Approval</p>
              <p class="text-sm opacity-80">An administrator will review your access shortly</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What happens next?
            </h3>
            <ul class="list-disc list-inside space-y-2 text-base-content/70">
              <li>Admin reviews your request</li>
              <li>You'll be assigned to community zones</li>
              <li>Page auto-refreshes when approved</li>
            </ul>
          </div>
        </div>

        <div class="card bg-base-100 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Community Zones
            </h3>
            <ul class="list-disc list-inside space-y-2 text-base-content/70">
              <li>Family - Family events & activities</li>
              <li>DreamLab - Creative projects</li>
              <li>Minimoonoir - Special interest group</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Footer Note -->
      <div class="text-center text-sm text-base-content/50">
        <p>This page will automatically redirect once you're approved.</p>
        <p class="mt-1">Questions? Contact an administrator.</p>
      </div>
    </div>
  </div>
</div>
