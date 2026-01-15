<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { encodePrivkey, encodePubkey } from '$lib/nostr/keys';
  import { pubkeyToDID, generateDIDDocument } from '$lib/nostr/did';
  import SecurityTooltip from '$lib/components/ui/SecurityTooltip.svelte';

  export let privateKey: string;
  export let publicKey: string;

  const dispatch = createEventDispatcher<{ continue: void }>();

  let hasBackedUp = false;
  let hasConfirmed = false;
  let copied = false;
  let downloaded = false;
  let showNsec = false;

  $: nsec = encodePrivkey(privateKey);
  $: npub = encodePubkey(publicKey);
  $: did = pubkeyToDID(publicKey);
  $: didDocument = generateDIDDocument(publicKey);
  $: canContinue = hasBackedUp && hasConfirmed;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(nsec);
      copied = true;
      hasBackedUp = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function downloadBackup() {
    const content = `NOSTR PRIVATE KEY BACKUP
========================

DO NOT SHARE THIS FILE WITH ANYONE!
This is your ONLY way to recover your account.

Private Key (nsec format):
${nsec}

Public Key (npub format):
${npub}

Decentralized Identifier (DID):
${did}

========================
DID Document (W3C Compliant):
${JSON.stringify(didDocument, null, 2)}

========================
Generated: ${new Date().toISOString()}
Store this file securely offline.
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nostr-key-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    downloaded = true;
    hasBackedUp = true;
  }

  function revealNsec() {
    showNsec = true;
  }

  function handleContinue() {
    if (canContinue) {
      dispatch('continue');
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-2xl bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-center gap-2 mb-4">
        <h2 class="card-title text-2xl">Backup Your Private Key</h2>
        <SecurityTooltip type="private-key" position="bottom" />
      </div>

      <!-- CRITICAL WARNING -->
      <div class="alert bg-error/10 border-2 border-error mb-6 animate-pulse-slow">
        <div class="flex-1">
          <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-error shrink-0 h-8 w-8 mt-1" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="flex-1">
              <p class="font-bold text-error text-lg mb-2">CRITICAL: Backup Required</p>
              <ul class="text-sm space-y-1 text-base-content">
                <li class="flex items-start gap-2">
                  <span class="text-error font-bold">1.</span>
                  <span>This is your <strong>ONLY way to recover your account</strong></span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-error font-bold">2.</span>
                  <span><strong>Never share this</strong> with anyone - not even support staff</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-error font-bold">3.</span>
                  <span><strong>Store it securely offline</strong> - paper backup recommended</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-error font-bold">4.</span>
                  <span>We <strong>cannot recover</strong> lost private keys</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {#if !showNsec}
        <!-- Reveal Button -->
        <div class="flex justify-center mb-4">
          <button
            class="btn btn-warning btn-lg gap-2"
            on:click={revealNsec}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Reveal Private Key
          </button>
        </div>
        <p class="text-center text-base-content/60 text-sm">
          Click to reveal your private key for backup
        </p>
      {:else}
        <!-- Private Key Display -->
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <div class="badge badge-error badge-lg gap-1 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              PRIVATE - Keep Secret
            </div>
          </div>

          <div class="bg-base-200 rounded-lg p-6 mb-4 border-2 border-error/30">
            <label class="text-sm text-base-content/60 mb-2 block">Your Private Key (nsec)</label>
            <p class="font-mono text-sm break-all bg-base-100 p-3 rounded border border-base-300">
              {nsec}
            </p>
          </div>

          <!-- Backup Actions -->
          <div class="flex flex-col sm:flex-row gap-3 mb-4">
            <button
              class="btn flex-1 gap-2 {copied || (hasBackedUp && !downloaded) ? 'btn-success' : 'btn-outline'}"
              on:click={copyToClipboard}
            >
              {#if copied}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy to Clipboard
              {/if}
            </button>

            <button
              class="btn flex-1 gap-2 {downloaded ? 'btn-success' : 'btn-outline'}"
              on:click={downloadBackup}
            >
              {#if downloaded}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Downloaded!
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Backup File
              {/if}
            </button>
          </div>

          <!-- Backup Status -->
          {#if hasBackedUp}
            <div class="alert alert-success mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Backup action completed. Please store your key securely.</span>
            </div>
          {:else}
            <div class="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>You must copy or download your key before continuing.</span>
            </div>
          {/if}

          <!-- Confirmation Checkbox -->
          <div class="form-control mb-4">
            <label class="label cursor-pointer justify-start gap-3 bg-base-200 rounded-lg p-4 border-2 {hasConfirmed ? 'border-success' : 'border-base-300'}">
              <input
                type="checkbox"
                class="checkbox checkbox-success"
                bind:checked={hasConfirmed}
                disabled={!hasBackedUp}
              />
              <div class="flex flex-col">
                <span class="label-text font-medium">I have securely backed up my private key</span>
                <span class="text-xs text-base-content/60">I understand I cannot recover my account without it</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Continue Button -->
        <div class="card-actions justify-center">
          <button
            class="btn btn-primary btn-lg w-full sm:w-auto px-8"
            on:click={handleContinue}
            disabled={!canContinue}
          >
            {#if !hasBackedUp}
              Backup Required First
            {:else if !hasConfirmed}
              Confirm Backup to Continue
            {:else}
              Continue
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes pulse-slow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.95; }
  }

  .animate-pulse-slow {
    animation: pulse-slow 3s ease-in-out infinite;
  }
</style>
