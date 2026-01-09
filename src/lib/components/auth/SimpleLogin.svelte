<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { restoreFromNsecOrHex } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';

  const dispatch = createEventDispatcher<{
    success: { publicKey: string; privateKey: string; keepSignedIn: boolean };
    switchToSecure: void;
  }>();

  let password = '';
  let isRestoring = false;
  let validationError = '';
  let keepSignedIn = true;
  let showUpgradePrompt = false;

  onMount(() => {
    if (browser) {
      const savedPref = localStorage.getItem('nostr_bbs_keep_signed_in');
      if (savedPref !== null) {
        keepSignedIn = savedPref === 'true';
      }
    }
  });

  async function handleLogin() {
    isRestoring = true;
    validationError = '';
    authStore.clearError();

    try {
      if (!password.trim()) {
        validationError = 'Please enter your password';
        return;
      }

      // The password IS the hex private key
      const result = restoreFromNsecOrHex(password.trim());

      if (browser) {
        localStorage.setItem('nostr_bbs_keep_signed_in', String(keepSignedIn));
      }

      // Show upgrade prompt after successful login
      showUpgradePrompt = true;

      // Dispatch success after brief delay to show prompt
      setTimeout(() => {
        dispatch('success', {
          publicKey: result.publicKey,
          privateKey: result.privateKey,
          keepSignedIn
        });
      }, 100);

    } catch (error) {
      validationError = error instanceof Error ? error.message : 'Invalid password';
      authStore.setError(validationError);
    } finally {
      isRestoring = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-2">Quick Login</h2>

      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="text-sm">
          <p class="font-bold">Basic Security Mode</p>
          <p>For better account protection, consider upgrading to recovery phrase login.</p>
        </div>
      </div>

      <div class="form-control mb-4">
        <label class="label" for="password-input">
          <span class="label-text font-semibold">Password</span>
        </label>
        <input
          type="password"
          id="password-input"
          placeholder="Enter your password"
          class="input input-bordered w-full font-mono"
          class:input-error={validationError}
          bind:value={password}
          disabled={isRestoring}
          autocomplete="off"
          on:keydown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <span class="label-text-alt text-base-content/60 mt-1">
          The password you received when you created your account
        </span>
      </div>

      {#if validationError || $authStore.error}
        <div class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{validationError || $authStore.error}</span>
        </div>
      {/if}

      <!-- Keep me signed in toggle -->
      <div class="form-control mb-4">
        <label class="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            class="toggle toggle-primary"
            bind:checked={keepSignedIn}
            disabled={isRestoring}
          />
          <div class="flex flex-col">
            <span class="label-text font-medium">Keep me signed in</span>
            <span class="label-text-alt text-base-content/60">
              Stay logged in on this browser
            </span>
          </div>
        </label>
      </div>

      <div class="card-actions flex-col gap-2">
        <button
          class="btn btn-primary btn-lg w-full"
          on:click={handleLogin}
          disabled={isRestoring || !password.trim()}
        >
          {#if isRestoring}
            <span class="loading loading-spinner"></span>
            Logging in...
          {:else}
            Login
          {/if}
        </button>
      </div>

      <div class="divider text-xs">More secure options</div>

      <button
        class="btn btn-ghost btn-sm w-full"
        on:click={() => dispatch('switchToSecure')}
      >
        Login with Recovery Phrase or Browser Extension
      </button>

      <div class="bg-base-200 rounded-lg p-3 mt-4">
        <p class="text-xs text-base-content/70">
          <strong>Upgrade your security:</strong> You can migrate to a more secure login method anytime:
        </p>
        <ul class="text-xs text-base-content/60 mt-2 space-y-1 list-disc list-inside">
          <li>12-word recovery phrase (works on any device)</li>
          <li>Browser extension like Alby or nos2x</li>
        </ul>
      </div>
    </div>
  </div>
</div>
