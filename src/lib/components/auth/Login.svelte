<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { restoreFromNsecOrHex } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';
  import { checkWhitelistStatus } from '$lib/nostr/whitelist';
  import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

  const dispatch = createEventDispatcher<{
    success: { publicKey: string; privateKey: string };
    pending: { publicKey: string; privateKey: string };
    signup: void;
  }>();

  let privateKeyInput = '';
  let isRestoring = false;
  let validationError = '';
  let isCheckingWhitelist = false;

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

      // Check whitelist status before allowing login
      isCheckingWhitelist = true;
      const whitelistStatus = await checkWhitelistStatus(publicKey);
      isCheckingWhitelist = false;

      if (whitelistStatus.isApproved || whitelistStatus.isAdmin) {
        // User is approved - proceed with login
        dispatch('success', { publicKey, privateKey });
      } else {
        // User is NOT approved - dispatch pending event
        dispatch('pending', { publicKey, privateKey });
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

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-sm">Enter your private key (nsec or hex) to access your account</span>
      </div>

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

      <div class="card-actions justify-center">
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
