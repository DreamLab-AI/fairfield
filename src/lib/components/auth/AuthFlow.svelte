<script lang="ts">
  /**
   * AuthFlow - Multi-step authentication flow for signup and login
   *
   * Flow steps:
   * 1. Signup - Generate new keys
   * 2. NsecBackup - Show private key with copy/download options
   * 3. NicknameSetup - Set display name
   * 4. PendingApproval - Wait for admin whitelist approval
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import Signup from './Signup.svelte';
  import NsecBackup from './NsecBackup.svelte';
  import NicknameSetup from './NicknameSetup.svelte';
  import Login from './Login.svelte';
  import PendingApproval from './PendingApproval.svelte';

  type FlowStep = 'signup' | 'nsec-backup' | 'nickname' | 'login' | 'pending-approval';

  let currentStep: FlowStep = 'signup';
  let tempKeys: {
    publicKey: string;
    privateKey: string;
  } | null = null;

  function handleSignupNext(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;

    if (publicKey && privateKey) {
      tempKeys = { publicKey, privateKey };
      currentStep = 'nsec-backup';
    } else {
      currentStep = 'login';
    }
  }

  async function handleBackupContinue() {
    if (tempKeys) {
      await authStore.setKeys(tempKeys.publicKey, tempKeys.privateKey, 'incomplete', false);
      authStore.confirmNsecBackup();
      currentStep = 'nickname';
    }
  }

  async function handleNicknameContinue() {
    if (tempKeys) {
      const { publicKey, privateKey } = tempKeys;

      // Check if user is already approved or admin - skip pending approval
      try {
        const { checkWhitelistStatus } = await import('$lib/nostr/whitelist');
        const status = await checkWhitelistStatus(publicKey);
        if (status.isApproved || status.isAdmin) {
          await goto(`${base}/chat`);
          return;
        }
      } catch (e) {
        console.warn('[AuthFlow] Failed to check whitelist status:', e);
      }

      authStore.setPending(true);
      currentStep = 'pending-approval';
    }
  }

  async function handleLoginSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;

    if (publicKey && privateKey) {
      tempKeys = { publicKey, privateKey };
      await authStore.setKeys(publicKey, privateKey);

      // Check if user is already approved or admin - skip pending approval
      try {
        const { checkWhitelistStatus } = await import('$lib/nostr/whitelist');
        const status = await checkWhitelistStatus(publicKey);
        if (status.isApproved || status.isAdmin) {
          await goto(`${base}/chat`);
          return;
        }
      } catch (e) {
        console.warn('[AuthFlow] Failed to check whitelist status:', e);
      }

      currentStep = 'pending-approval';
    } else {
      currentStep = 'signup';
    }
  }

  async function handleApproved() {
    authStore.setPending(false);
    await goto(`${base}/chat`);
  }
</script>

{#if currentStep === 'signup'}
  <Signup on:next={handleSignupNext} />
{:else if currentStep === 'nsec-backup' && tempKeys}
  <NsecBackup
    publicKey={tempKeys.publicKey}
    privateKey={tempKeys.privateKey}
    on:continue={handleBackupContinue}
  />
{:else if currentStep === 'nickname' && tempKeys}
  <NicknameSetup
    publicKey={tempKeys.publicKey}
    privateKey={tempKeys.privateKey}
    on:continue={handleNicknameContinue}
  />
{:else if currentStep === 'login'}
  <Login on:success={handleLoginSuccess} />
{:else if currentStep === 'pending-approval' && tempKeys}
  <PendingApproval publicKey={tempKeys.publicKey} on:approved={handleApproved} />
{/if}
