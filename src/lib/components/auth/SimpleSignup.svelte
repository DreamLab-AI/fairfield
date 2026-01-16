<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { generateNewIdentity } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';
  import { profileCache } from '$lib/stores/profiles';
  import { ndk, connectRelay, isConnected } from '$lib/nostr/relay';
  import { RELAY_URL } from '$lib/config';
  import { NDKEvent } from '@nostr-dev-kit/ndk';

  const dispatch = createEventDispatcher<{
    complete: { publicKey: string; privateKey: string; nickname: string };
    back: void;
  }>();

  type Step = 'nickname' | 'password';
  let currentStep: Step = 'nickname';

  let nickname = '';
  let generatedPassword = '';
  let publicKey = '';
  let privateKey = '';
  let mnemonic = '';
  let isGenerating = false;
  let isPublishing = false;
  let hasCopied = false;
  let error: string | null = null;

  $: isValidNickname = nickname.trim().length >= 2 && nickname.trim().length <= 50;
  $: nicknameError = nickname.length > 0 && !isValidNickname
    ? nickname.trim().length < 2
      ? 'Nickname must be at least 2 characters'
      : 'Nickname must be 50 characters or less'
    : null;

  async function handleNicknameSubmit() {
    if (!isValidNickname) return;

    isGenerating = true;
    error = null;

    try {
      const identity = await generateNewIdentity();
      publicKey = identity.publicKey;
      privateKey = identity.privateKey;
      mnemonic = identity.mnemonic;
      generatedPassword = privateKey; // Hex private key is the "password"
      currentStep = 'password';
    } catch (err) {
      console.error('[SimpleSignup] Failed to generate identity:', err);
      error = err instanceof Error ? err.message : 'Failed to generate account';
    } finally {
      isGenerating = false;
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      hasCopied = true;
    } catch (err) {
      console.error('[SimpleSignup] Failed to copy:', err);
    }
  }

  async function handleComplete() {
    if (!hasCopied) {
      error = 'Please copy your password before continuing';
      return;
    }

    isPublishing = true;
    error = null;

    try {
      // Set keys in auth store first
      await authStore.setKeys(publicKey, privateKey, 'incomplete');

      // Connect to relay if not already connected
      if (!isConnected()) {
        await connectRelay(RELAY_URL, privateKey);
      }

      const ndkInstance = ndk();
      if (!ndkInstance) {
        throw new Error('Failed to initialize NDK');
      }

      // Create kind 0 metadata event (NIP-01)
      const metadataEvent = new NDKEvent(ndkInstance);
      metadataEvent.kind = 0;
      metadataEvent.content = JSON.stringify({
        name: nickname.trim(),
        display_name: nickname.trim(),
      });

      // Sign and publish to relay
      await metadataEvent.sign();
      await metadataEvent.publish();

      // Update local auth store with nickname
      authStore.setProfile(nickname.trim(), null);

      // Update profile cache immediately
      profileCache.updateCurrentUserProfile(publicKey, nickname.trim(), null);

      console.log('[SimpleSignup] Profile published:', metadataEvent.id);

      dispatch('complete', {
        publicKey,
        privateKey,
        nickname: nickname.trim()
      });
    } catch (err) {
      console.error('[SimpleSignup] Failed to publish profile:', err);
      error = err instanceof Error ? err.message : 'Failed to save profile';
    } finally {
      isPublishing = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      {#if currentStep === 'nickname'}
        <h2 class="card-title text-2xl justify-center mb-2">Choose Your Nickname</h2>

        <p class="text-center text-base-content/70 mb-4">
          This is how others will see you in the community.
        </p>

        <div class="form-control mb-4">
          <label class="label" for="nickname-input">
            <span class="label-text font-semibold">Nickname</span>
            <span class="label-text-alt text-base-content/50">{nickname.length}/50</span>
          </label>
          <input
            type="text"
            id="nickname-input"
            placeholder="e.g., CoolUser, Alice123"
            class="input input-bordered input-lg w-full"
            class:input-error={nicknameError}
            bind:value={nickname}
            maxlength="50"
            disabled={isGenerating}
            on:keydown={(e) => e.key === 'Enter' && isValidNickname && handleNicknameSubmit()}
          />
          {#if nicknameError}
            <span class="label-text-alt text-error mt-1">{nicknameError}</span>
          {:else}
            <span class="label-text-alt text-base-content/60 mt-1">2-50 characters</span>
          {/if}
        </div>

        {#if error}
          <div class="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        {/if}

        <div class="card-actions flex-col gap-2 mt-4">
          <button
            class="btn btn-primary btn-lg w-full"
            on:click={handleNicknameSubmit}
            disabled={!isValidNickname || isGenerating}
          >
            {#if isGenerating}
              <span class="loading loading-spinner"></span>
              Creating Account...
            {:else}
              Continue
            {/if}
          </button>

          <button
            class="btn btn-ghost btn-sm"
            on:click={() => dispatch('back')}
            disabled={isGenerating}
          >
            Back to options
          </button>
        </div>

      {:else if currentStep === 'password'}
        <h2 class="card-title text-2xl justify-center mb-2">Your Password</h2>

        <div class="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="text-sm">
            <p class="font-bold">Important: Save this password!</p>
            <p>This is the ONLY way to access your account. Store it somewhere safe.</p>
          </div>
        </div>

        <div class="form-control mb-4">
          <label class="label" for="password-display">
            <span class="label-text font-semibold">Your Password</span>
          </label>
          <div class="relative">
            <input
              type="text"
              id="password-display"
              value={generatedPassword}
              readonly
              class="input input-bordered w-full font-mono text-xs pr-24"
            />
            <button
              class="btn btn-sm absolute right-1 top-1/2 -translate-y-1/2"
              class:btn-success={hasCopied}
              on:click={copyPassword}
            >
              {#if hasCopied}
                Copied!
              {:else}
                Copy
              {/if}
            </button>
          </div>
          <span class="label-text-alt text-base-content/60 mt-1">
            This is your unique password. Use it with your nickname "{nickname}" to login.
          </span>
        </div>

        <div class="bg-base-200 rounded-lg p-3 mb-4">
          <p class="text-sm text-base-content/70">
            <strong>To login later:</strong><br/>
            Username: <span class="font-mono bg-base-300 px-1 rounded">{nickname}</span><br/>
            Password: <span class="font-mono text-xs">your copied password</span>
          </p>
        </div>

        {#if error}
          <div class="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        {/if}

        <div class="card-actions flex-col gap-2 mt-4">
          <button
            class="btn btn-primary btn-lg w-full"
            on:click={handleComplete}
            disabled={!hasCopied || isPublishing}
          >
            {#if isPublishing}
              <span class="loading loading-spinner"></span>
              Setting up...
            {:else}
              I've Saved My Password - Continue
            {/if}
          </button>

          {#if !hasCopied}
            <p class="text-center text-sm text-warning">
              Please copy your password first
            </p>
          {/if}
        </div>

        <div class="divider text-xs">Later upgrade</div>

        <p class="text-xs text-center text-base-content/60">
          You can upgrade to a more secure 12-word recovery phrase anytime in Settings.
        </p>
      {/if}
    </div>
  </div>
</div>
