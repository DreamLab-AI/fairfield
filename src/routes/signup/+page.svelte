<script lang="ts">
  import Signup from '$lib/components/auth/Signup.svelte';
  import NsecBackup from '$lib/components/auth/NsecBackup.svelte';
  import NicknameSetup from '$lib/components/auth/NicknameSetup.svelte';
  import PendingApproval from '$lib/components/auth/PendingApproval.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { checkWhitelistStatus, publishRegistrationRequest } from '$lib/nostr/whitelist';
  import { getAppConfig } from '$lib/config/loader';
  import { waitForProfileIndexing } from '$lib/nostr/profile-sync';

  const appConfig = getAppConfig();

  type FlowStep = 'signup' | 'backup' | 'nickname' | 'pending';
  let step: FlowStep = 'signup';
  let publicKey = '';
  let privateKey = '';
  let nickname = '';
  let isApproved = false;

  function handleNext(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const data = event.detail;
    if (data.publicKey && data.privateKey) {
      publicKey = data.publicKey;
      privateKey = data.privateKey;
      step = 'backup';
    } else {
      // User wants to login with existing key
      goto(`${base}/login`);
    }
  }

  async function handleBackupContinue() {
    await authStore.setKeys(publicKey, privateKey, 'incomplete', false);
    authStore.confirmNsecBackup();
    step = 'nickname';
  }

  async function handleNicknameContinue(event: CustomEvent<{ nickname: string }>) {
    nickname = event.detail.nickname;

    // Check if user is pre-approved (admin or on whitelist)
    const whitelistStatus = await checkWhitelistStatus(publicKey);
    isApproved = whitelistStatus.isApproved || whitelistStatus.isAdmin;

    if (isApproved) {
      // Skip pending approval for pre-approved users
      goto(`${base}/chat`);
    } else {
      // Wait for Kind 0 profile event to be indexed before publishing Kind 9024
      // Uses exponential backoff (100ms → 200ms → 400ms → 800ms) with 5s max timeout
      // This prevents race conditions where registration arrives before profile
      const profileIndexed = await waitForProfileIndexing(publicKey, nickname, 5000);
      if (!profileIndexed && import.meta.env.DEV) {
        console.warn('[Signup] Profile may not be fully indexed yet, proceeding anyway');
      }

      // Publish registration request so admin can see this user
      try {
        const result = await publishRegistrationRequest(privateKey, nickname || undefined);
        if (!result.success) {
          console.warn('[Signup] Failed to publish registration request:', result.error);
        }
      } catch (error) {
        console.warn('[Signup] Error publishing registration request:', error);
      }

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
  <title>Sign Up - {appConfig.name}</title>
</svelte:head>

{#if step === 'signup'}
  <Signup on:next={handleNext} />
{:else if step === 'backup'}
  <NsecBackup {publicKey} {privateKey} on:continue={handleBackupContinue} />
{:else if step === 'nickname'}
  <NicknameSetup {publicKey} {privateKey} on:continue={handleNicknameContinue} />
{:else if step === 'pending'}
  <PendingApproval {publicKey} on:approved={handleApproved} />
{/if}
