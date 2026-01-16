<script lang="ts">
  import Login from '$lib/components/auth/Login.svelte';
  import PendingApproval from '$lib/components/auth/PendingApproval.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { getAppConfig } from '$lib/config/loader';

  const appConfig = getAppConfig();

  type PageState = 'login' | 'pending';
  let pageState: PageState = 'login';
  let pendingPubkey = '';

  async function handleSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;
    // Login with existing key - assume already backed up (complete account)
    await authStore.setKeys(publicKey, privateKey, 'complete', true);
    goto(`${base}/chat`);
  }

  async function handlePending(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;
    // Set keys but mark as pending approval
    await authStore.setKeys(publicKey, privateKey, 'complete', true);
    authStore.setPending(true);
    pendingPubkey = publicKey;
    pageState = 'pending';
  }

  // NIP-07 extension login handlers
  function handleSuccessNip07(event: CustomEvent<{ publicKey: string }>) {
    // Already authenticated via authStore.loginWithExtension()
    goto(`${base}/chat`);
  }

  function handlePendingNip07(event: CustomEvent<{ publicKey: string }>) {
    const { publicKey } = event.detail;
    authStore.setPending(true);
    pendingPubkey = publicKey;
    pageState = 'pending';
  }

  function handleApproved() {
    authStore.setPending(false);
    goto(`${base}/chat`);
  }

  function handleSignup() {
    goto(`${base}/signup`);
  }
</script>

<svelte:head>
  <title>Login - {appConfig.name}</title>
</svelte:head>

{#if pageState === 'login'}
  <Login
    on:success={handleSuccess}
    on:pending={handlePending}
    on:successNip07={handleSuccessNip07}
    on:pendingNip07={handlePendingNip07}
    on:signup={handleSignup}
  />
{:else if pageState === 'pending'}
  <PendingApproval publicKey={pendingPubkey} on:approved={handleApproved} />
{/if}
