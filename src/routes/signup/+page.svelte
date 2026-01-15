<script lang="ts">
  import Signup from '$lib/components/auth/Signup.svelte';
  import NsecBackup from '$lib/components/auth/NsecBackup.svelte';
  import PendingApproval from '$lib/components/auth/PendingApproval.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { checkWhitelistStatus } from '$lib/nostr/whitelist';

  type FlowStep = 'signup' | 'nsec-backup' | 'pending';
  let step: FlowStep = 'signup';
  let publicKey = '';
  let privateKey = '';
  let isApproved = false;

  function handleNext(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const data = event.detail;
    if (data.publicKey && data.privateKey) {
      publicKey = data.publicKey;
      privateKey = data.privateKey;
      step = 'nsec-backup';
    }
  }

  function handleLogin() {
    goto(`${base}/login`);
  }

  async function handleNsecBackupContinue() {
    // Full signup - mark as complete with nsec backed up
    await authStore.setKeys(publicKey, privateKey, 'complete', true);
    authStore.confirmNsecBackup();

    // Check if user is pre-approved (admin or on whitelist)
    const whitelistStatus = await checkWhitelistStatus(publicKey);
    isApproved = whitelistStatus.isApproved || whitelistStatus.isAdmin;

    if (isApproved) {
      // Skip pending approval for pre-approved users
      goto(`${base}/chat`);
    } else {
      // Show pending approval screen
      authStore.setPending(true);
      step = 'pending';
    }
  }

  async function handleApproved() {
    authStore.setPending(false);
    goto(`${base}/chat`);
  }
</script>

<svelte:head>
  <title>Sign Up - Fairfield</title>
</svelte:head>

{#if step === 'signup'}
  <Signup on:next={handleNext} on:login={handleLogin} />
{:else if step === 'nsec-backup'}
  <NsecBackup {publicKey} {privateKey} on:continue={handleNsecBackupContinue} />
{:else if step === 'pending'}
  <PendingApproval {publicKey} on:approved={handleApproved} />
{/if}
