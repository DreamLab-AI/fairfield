<script lang="ts">
  import Login from '$lib/components/auth/Login.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';

  async function handleSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;
    // Login with existing key - assume already backed up (complete account)
    await authStore.setKeys(publicKey, privateKey, 'complete', true);
    goto(`${base}/chat`);
  }

  function handleSignup() {
    goto(`${base}/signup`);
  }
</script>

<svelte:head>
  <title>Login - Fairfield</title>
</svelte:head>

<Login on:success={handleSuccess} on:signup={handleSignup} />
