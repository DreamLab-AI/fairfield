<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { generateNewIdentity } from '$lib/nostr/keys';

  const dispatch = createEventDispatcher<{
    complete: { publicKey: string; privateKey: string; accountStatus: 'incomplete' };
    fullSignup: void;
  }>();

  let isGenerating = false;
  let error = '';

  async function handleQuickBrowse() {
    isGenerating = true;
    error = '';

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const { publicKey, privateKey } = await generateNewIdentity();

      dispatch('complete', {
        publicKey,
        privateKey,
        accountStatus: 'incomplete'
      });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to generate keys';
    } finally {
      isGenerating = false;
    }
  }

  function handleFullSignup() {
    dispatch('fullSignup');
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200 gradient-mesh">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-2">Quick Access</h2>
      <p class="text-center text-base-content/70 mb-4">
        Browse without creating a full account
      </p>

      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h3 class="font-bold">Limited Access</h3>
          <p class="text-sm">This creates a temporary read-only account.</p>
        </div>
      </div>

      <div class="bg-base-200 rounded-lg p-4 mb-4">
        <h4 class="font-semibold mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          What you CAN do:
        </h4>
        <ul class="list-disc list-inside text-sm text-base-content/80 space-y-1 ml-2">
          <li>Browse all public content</li>
          <li>View posts and discussions</li>
          <li>Explore the community</li>
        </ul>
      </div>

      <div class="bg-error/10 rounded-lg p-4 mb-4">
        <h4 class="font-semibold mb-2 flex items-center gap-2 text-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          What you CANNOT do:
        </h4>
        <ul class="list-disc list-inside text-sm text-base-content/80 space-y-1 ml-2">
          <li>Post new content</li>
          <li>React to posts</li>
          <li>Reply or comment</li>
          <li>Follow other users</li>
        </ul>
      </div>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-sm">Complete signup in Profile to get full access</span>
      </div>

      {#if error}
        <div class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      <div class="card-actions flex-col gap-3 mt-2">
        <button
          class="btn btn-primary btn-lg w-full"
          on:click={handleQuickBrowse}
          disabled={isGenerating}
        >
          {#if isGenerating}
            <span class="loading loading-spinner"></span>
            Setting up...
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Quick Browse (Read Only)
          {/if}
        </button>
      </div>

      <div class="divider">OR</div>

      <button
        class="btn btn-ghost btn-sm"
        on:click={handleFullSignup}
      >
        Want full access? Sign up properly
      </button>
    </div>
  </div>
</div>
