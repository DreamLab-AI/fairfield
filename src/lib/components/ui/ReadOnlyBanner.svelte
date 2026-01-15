<script lang="ts">
  /**
   * ReadOnlyBanner - Warning banner for users with incomplete account status
   *
   * Shows a dismissible warning that re-appears on page load.
   * Links to /signup to complete account setup.
   */
  import { authStore } from '$lib/stores/auth';
  import { base } from '$app/paths';

  let dismissed = false;

  $: showBanner = $authStore.isAuthenticated &&
                  $authStore.accountStatus === 'incomplete' &&
                  !dismissed;

  function handleDismiss() {
    dismissed = true;
  }
</script>

{#if showBanner}
  <div
    class="alert alert-warning shadow-lg mb-4"
    role="alert"
    aria-live="polite"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="stroke-current shrink-0 h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
    <div class="flex-1">
      <span>You're in read-only mode. </span>
      <a href="{base}/signup" class="link link-hover font-semibold underline">
        Complete signup
      </a>
      <span> to post messages.</span>
    </div>
    <button
      class="btn btn-ghost btn-sm btn-circle"
      on:click={handleDismiss}
      aria-label="Dismiss banner"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
{/if}
