<script lang="ts">
  /**
   * AuthFlow - Multi-step authentication flow for signup and login
   *
   * Flow steps:
   * 1. Signup - Generate new keys (no mnemonic)
   * 2. NsecBackup - Force user to backup nsec key (copy or download)
   * 3. PendingApproval - Wait for admin whitelist approval
   *
   * Login flow:
   * 1. Login - Enter nsec/hex private key
   * 2. PendingApproval - Wait for admin approval (if not already approved)
   */
  import { authStore } from '$lib/stores/auth';
  import Signup from './Signup.svelte';
  import NsecBackup from './NsecBackup.svelte';
  import Login from './Login.svelte';
  import PendingApproval from './PendingApproval.svelte';

  type FlowStep = 'signup' | 'nsec-backup' | 'login' | 'pending-approval';

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
    }
  }

  function handleSignupLogin() {
    currentStep = 'login';
  }

  async function handleLoginSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;

    if (publicKey && privateKey) {
      tempKeys = { publicKey, privateKey };
      // For login, keys already backed up - mark as complete
      await authStore.setKeys(publicKey, privateKey, 'complete', true);
      authStore.setPending(true);
      currentStep = 'pending-approval';
    }
  }

  function handleLoginSignup() {
    currentStep = 'signup';
  }

  async function handleNsecBackupContinue() {
    if (tempKeys) {
      const { publicKey, privateKey } = tempKeys;
      // Full signup - mark as complete with nsec backed up
      await authStore.setKeys(publicKey, privateKey, 'complete', true);
      authStore.confirmNsecBackup();
      authStore.setPending(true);
      currentStep = 'pending-approval';
    }
  }
</script>

{#if currentStep === 'signup'}
  <Signup on:next={handleSignupNext} on:login={handleSignupLogin} />
{:else if currentStep === 'nsec-backup' && tempKeys}
  <NsecBackup
    publicKey={tempKeys.publicKey}
    privateKey={tempKeys.privateKey}
    on:continue={handleNsecBackupContinue}
  />
{:else if currentStep === 'login'}
  <Login on:success={handleLoginSuccess} on:signup={handleLoginSignup} />
{:else if currentStep === 'pending-approval' && tempKeys}
  <PendingApproval publicKey={tempKeys.publicKey} />
{/if}
