<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ select: { method: 'simple' | 'secure' } }>();

  function selectMethod(method: 'simple' | 'secure') {
    dispatch('select', { method });
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-lg bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-2">Create Your Account</h2>

      <p class="text-center text-base-content/70 mb-6">
        Choose how you'd like to set up your account
      </p>

      <div class="space-y-4">
        <!-- Quick Start Option -->
        <button
          class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all w-full text-left"
          on:click={() => selectMethod('simple')}
        >
          <div class="card-body p-4">
            <div class="flex items-start gap-3">
              <div class="text-3xl">&#9889;</div>
              <div class="flex-1">
                <h3 class="font-bold text-lg">Quick Start</h3>
                <p class="text-sm text-base-content/70 mt-1">
                  Get started in seconds. Pick a nickname and we'll generate a password for you.
                </p>
                <div class="badge badge-success badge-sm mt-2">Recommended for new users</div>
              </div>
            </div>
          </div>
        </button>

        <!-- Secure Setup Option -->
        <button
          class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all w-full text-left"
          on:click={() => selectMethod('secure')}
        >
          <div class="card-body p-4">
            <div class="flex items-start gap-3">
              <div class="text-3xl">&#128274;</div>
              <div class="flex-1">
                <h3 class="font-bold text-lg">Secure Setup</h3>
                <p class="text-sm text-base-content/70 mt-1">
                  Full security with a 12-word recovery phrase. Best for long-term use.
                </p>
                <div class="badge badge-info badge-sm mt-2">Advanced</div>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div class="divider text-xs text-base-content/50">What's the difference?</div>

      <div class="text-sm text-base-content/70 space-y-2">
        <p><strong>Quick Start:</strong> Uses a simple password system. Easy to use but less secure if you lose access.</p>
        <p><strong>Secure Setup:</strong> Creates a 12-word recovery phrase you can use to restore your account anywhere.</p>
      </div>

      <div class="text-center mt-4">
        <a href="/login" class="link link-primary text-sm">Already have an account? Login</a>
      </div>
    </div>
  </div>
</div>
