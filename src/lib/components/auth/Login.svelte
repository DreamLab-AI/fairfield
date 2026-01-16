<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { restoreFromNsecOrHex } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';
  import { checkWhitelistStatus } from '$lib/nostr/whitelist';
  import { hasNip07Extension, waitForNip07 } from '$lib/nostr/nip07';
  import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

  const dispatch = createEventDispatcher<{
    success: { publicKey: string; privateKey: string; keepSignedIn: boolean };
    pending: { publicKey: string; privateKey: string; keepSignedIn: boolean };
    successNip07: { publicKey: string };
    pendingNip07: { publicKey: string };
    signup: void;
  }>();

  let privateKeyInput = '';
  let isRestoring = false;
  let validationError = '';
  let isCheckingWhitelist = false;
  let keepSignedIn = true; // Default to yes
  let hasExtension = false;
  let isConnectingExtension = false;

  onMount(async () => {
    // Check if user previously opted out
    if (browser) {
      const savedPref = localStorage.getItem('nostr_bbs_keep_signed_in');
      if (savedPref !== null) {
        keepSignedIn = savedPref === 'true';
      }
      // Check for NIP-07 extension
      hasExtension = await waitForNip07(1000);
    }
  });

  async function handleExtensionLogin() {
    isConnectingExtension = true;
    validationError = '';
    authStore.clearError();

    try {
      const { publicKey } = await authStore.loginWithExtension();

      // Check whitelist status
      isCheckingWhitelist = true;
      const whitelistStatus = await checkWhitelistStatus(publicKey);
      isCheckingWhitelist = false;

      if (whitelistStatus.isApproved || whitelistStatus.isAdmin) {
        dispatch('successNip07', { publicKey });
      } else {
        dispatch('pendingNip07', { publicKey });
      }
    } catch (error) {
      validationError = error instanceof Error ? error.message : 'Failed to connect to extension';
    } finally {
      isConnectingExtension = false;
      isCheckingWhitelist = false;
    }
  }

  async function handleRestore() {
    isRestoring = true;
    validationError = '';
    authStore.clearError();

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!privateKeyInput.trim()) {
        validationError = 'Please enter your private key (nsec or hex format)';
        return;
      }

      const { publicKey, privateKey } = restoreFromNsecOrHex(privateKeyInput);

      // Save preference
      if (browser) {
        localStorage.setItem('nostr_bbs_keep_signed_in', String(keepSignedIn));
      }

      // Check whitelist status before allowing login
      isCheckingWhitelist = true;
      const whitelistStatus = await checkWhitelistStatus(publicKey);
      isCheckingWhitelist = false;

      if (whitelistStatus.isApproved || whitelistStatus.isAdmin) {
        // User is approved - proceed with login
        dispatch('success', { publicKey, privateKey, keepSignedIn });
      } else {
        // User is NOT approved - dispatch pending event
        dispatch('pending', { publicKey, privateKey, keepSignedIn });
      }
    } catch (error) {
      validationError = error instanceof Error ? error.message : 'Invalid private key';
      authStore.setError(validationError);
    } finally {
      isRestoring = false;
      isCheckingWhitelist = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200 gradient-mesh">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-center gap-2 mb-4">
        <h2 class="card-title text-2xl">Log In</h2>
        <InfoTooltip
          text="Restore your Nostr identity using your private key (nsec). Your keys are never sent to any server - everything happens locally in your browser."
          position="bottom"
          maxWidth="400px"
        />
      </div>

      <!-- NIP-07 Extension Login -->
      {#if hasExtension}
        <div class="mb-4">
          <button
            class="btn btn-primary btn-lg w-full gap-2"
            on:click={handleExtensionLogin}
            disabled={isConnectingExtension || isCheckingWhitelist}
            aria-busy={isConnectingExtension || isCheckingWhitelist}
          >
            {#if isConnectingExtension}
              <span class="loading loading-spinner" aria-hidden="true"></span>
              <span>Connecting to extension...</span>
            {:else if isCheckingWhitelist}
              <span class="loading loading-spinner" aria-hidden="true"></span>
              <span>Checking approval status...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Login with Nostr Extension
            {/if}
          </button>
          <p class="text-xs text-center text-base-content/60 mt-2">
            Use your browser extension (Alby, nos2x, etc.) to sign in securely
          </p>
        </div>

        <div class="divider text-xs">OR USE PRIVATE KEY</div>
      {:else}
        <div class="alert alert-info mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm">Enter your private key (nsec or hex) to access your account</span>
        </div>
      {/if}

      <div class="form-control mb-4">
        <label class="label" for="private-key-input">
          <span class="label-text font-medium flex items-center gap-2">
            Private Key
            <InfoTooltip
              text="Your private key (nsec) is the secret credential that proves you own your account. It starts with 'nsec1' or can be 64 hex characters. NEVER share this with anyone."
              position="top"
              maxWidth="350px"
              inline={true}
            />
          </span>
        </label>
        <input
          id="private-key-input"
          type="password"
          class="input input-bordered font-mono"
          placeholder="nsec1... or 64-character hex"
          bind:value={privateKeyInput}
          disabled={isRestoring}
          autocomplete="off"
          aria-describedby="private-key-hint"
          on:keypress={(e) => e.key === 'Enter' && handleRestore()}
        />
        <label class="label">
          <span id="private-key-hint" class="label-text-alt text-base-content/50">
            Supports nsec format (nsec1...) or raw 64-character hex
          </span>
        </label>
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
      <div class="form-control mt-4">
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
              Stay logged in on this browser using a secure cookie
            </span>
          </div>
        </label>
      </div>

      <div class="card-actions justify-center mt-4">
        <button
          class="btn btn-primary btn-lg w-full"
          on:click={handleRestore}
          disabled={isRestoring || isCheckingWhitelist}
          aria-busy={isRestoring || isCheckingWhitelist}
        >
          {#if isRestoring && !isCheckingWhitelist}
            <span class="loading loading-spinner" aria-hidden="true"></span>
            <span>Validating key...</span>
          {:else if isCheckingWhitelist}
            <span class="loading loading-spinner" aria-hidden="true"></span>
            <span>Checking approval status...</span>
          {:else}
            Log In
          {/if}
        </button>
      </div>

      <div class="divider">OR</div>

      <button
        class="btn btn-ghost btn-sm"
        on:click={() => dispatch('signup')}
      >
        Create a new account
      </button>
    </div>
  </div>
</div>
