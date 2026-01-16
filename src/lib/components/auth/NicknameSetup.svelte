<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { profileCache } from '$lib/stores/profiles';
  import { ndk, connectRelay, isConnected } from '$lib/nostr/relay';
  import { RELAY_URL } from '$lib/config';
  import { NDKEvent } from '@nostr-dev-kit/ndk';

  export let publicKey: string;
  export let privateKey: string;

  const dispatch = createEventDispatcher<{ continue: { nickname: string } }>();

  let nickname = '';
  let isPublishing = false;
  let error: string | null = null;

  $: isValidNickname = nickname.trim().length >= 2 && nickname.trim().length <= 50;
  $: nicknameError = nickname.length > 0 && !isValidNickname
    ? nickname.trim().length < 2
      ? 'Nickname must be at least 2 characters'
      : 'Nickname must be 50 characters or less'
    : null;

  async function handleContinue() {
    if (!isValidNickname) return;

    isPublishing = true;
    error = null;

    try {
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

      dispatch('continue', { nickname: nickname.trim() });
    } catch (err) {
      console.error('[NicknameSetup] Failed to publish profile:', err);
      error = err instanceof Error ? err.message : 'Failed to save profile';
    } finally {
      isPublishing = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-2">Choose Your Nickname</h2>

      <p class="text-center text-base-content/70 mb-4">
        Pick a display name that others will see. You can change this later in your profile settings.
      </p>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="text-sm">
          <p class="font-bold">This is how you'll appear to others</p>
          <p>Your nickname will be shown instead of your public key throughout the system.</p>
        </div>
      </div>

      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="text-sm">
          <p class="font-bold">Nickname required for permissions</p>
          <p>You must set a nickname to appear on the admin permissions list. Without a nickname, admins cannot grant you additional access to other areas.</p>
        </div>
      </div>

      <div class="form-control mb-4">
        <label class="label" for="nickname-input">
          <span class="label-text font-semibold">Nickname / Handle</span>
          <span class="label-text-alt text-base-content/50">{nickname.length}/50</span>
        </label>
        <input
          type="text"
          id="nickname-input"
          placeholder="e.g., Alice, Bob123, CoolUser"
          class="input input-bordered input-lg w-full"
          class:input-error={nicknameError}
          bind:value={nickname}
          maxlength="50"
          disabled={isPublishing}
          on:keydown={(e) => e.key === 'Enter' && isValidNickname && handleContinue()}
        />
        {#if nicknameError}
          <span class="label-text-alt text-error mt-1">{nicknameError}</span>
        {:else}
          <span class="label-text-alt text-base-content/60 mt-1">2-50 characters, letters, numbers, and symbols allowed</span>
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
          on:click={handleContinue}
          disabled={!isValidNickname || isPublishing}
        >
          {#if isPublishing}
            <span class="loading loading-spinner"></span>
            Saving...
          {:else}
            Continue
          {/if}
        </button>
      </div>

      <p class="text-xs text-center text-base-content/50 mt-4">
        You can add an avatar and update your profile anytime in Settings.
      </p>
    </div>
  </div>
</div>
