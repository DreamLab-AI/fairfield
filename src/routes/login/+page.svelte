<script lang="ts">
  import SimpleLogin from '$lib/components/auth/SimpleLogin.svelte';
  import Login from '$lib/components/auth/Login.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { getAppConfig } from '$lib/config/loader';

  const appConfig = getAppConfig();

  type LoginMode = 'simple' | 'secure';
  let loginMode: LoginMode = 'simple';

  async function handleSuccess(event: CustomEvent<{ publicKey: string; privateKey: string; keepSignedIn?: boolean }>) {
    const { publicKey, privateKey } = event.detail;
    await authStore.setKeys(publicKey, privateKey);
    goto(`${base}/chat`);
  }

  function switchToSecure() {
    loginMode = 'secure';
  }

  function switchToSimple() {
    loginMode = 'simple';
  }
</script>

<svelte:head>
  <title>Login - {appConfig.name}</title>
</svelte:head>

{#if loginMode === 'simple'}
  <SimpleLogin on:success={handleSuccess} on:switchToSecure={switchToSecure} />
{:else}
  <div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
    <div class="w-full max-w-2xl">
      <div class="mb-4 text-center">
        <button class="btn btn-ghost btn-sm" on:click={switchToSimple}>
          &larr; Back to Quick Login
        </button>
      </div>
      <Login on:success={handleSuccess} />
    </div>
  </div>
{/if}
