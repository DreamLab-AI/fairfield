<script lang="ts">
  import SignupGateway from '$lib/components/auth/SignupGateway.svelte';
  import SimpleSignup from '$lib/components/auth/SimpleSignup.svelte';
  import Signup from '$lib/components/auth/Signup.svelte';
  import MnemonicDisplay from '$lib/components/auth/MnemonicDisplay.svelte';
  import KeyBackup from '$lib/components/auth/KeyBackup.svelte';
  import NicknameSetup from '$lib/components/auth/NicknameSetup.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { publishRegistrationRequest } from '$lib/nostr/whitelist';
  import { getAppConfig } from '$lib/config/loader';

  const appConfig = getAppConfig();

  // Flow steps: gateway -> simple OR secure path
  type FlowStep = 'gateway' | 'simple' | 'secure-signup' | 'mnemonic' | 'backup' | 'nickname';
  let step: FlowStep = 'gateway';
  let mnemonic = '';
  let publicKey = '';
  let privateKey = '';
  let nickname = '';

  // Gateway selection handler
  function handleGatewaySelect(event: CustomEvent<{ method: 'simple' | 'secure' }>) {
    if (event.detail.method === 'simple') {
      step = 'simple';
    } else {
      step = 'secure-signup';
    }
  }

  // Simple signup complete handler
  async function handleSimpleComplete(event: CustomEvent<{ publicKey: string; privateKey: string; nickname: string }>) {
    const { publicKey: pubKey, privateKey: privKey, nickname: nick } = event.detail;

    // Publish registration request so admin can see and manage this user
    try {
      const result = await publishRegistrationRequest(privKey, nick || undefined);
      if (!result.success) {
        console.warn('[Signup] Failed to publish registration request:', result.error);
      }
    } catch (error) {
      console.warn('[Signup] Error publishing registration request:', error);
    }

    // Proceed directly to chat
    goto(`${base}/chat`);
  }

  // Secure signup handlers (existing flow)
  function handleNext(event: CustomEvent<{ mnemonic: string; publicKey: string; privateKey: string }>) {
    const data = event.detail;
    if (data.mnemonic) {
      mnemonic = data.mnemonic;
      publicKey = data.publicKey;
      privateKey = data.privateKey;
      step = 'mnemonic';
    } else {
      goto(`${base}/login`);
    }
  }

  function handleMnemonicContinue() {
    step = 'backup';
  }

  async function handleBackupContinue() {
    await authStore.setKeys(publicKey, privateKey, mnemonic);
    authStore.confirmMnemonicBackup();
    step = 'nickname';
  }

  async function handleNicknameContinue(event: CustomEvent<{ nickname: string }>) {
    nickname = event.detail.nickname;

    // Publish registration request so admin can see and manage this user
    try {
      const result = await publishRegistrationRequest(privateKey, nickname || undefined);
      if (!result.success) {
        console.warn('[Signup] Failed to publish registration request:', result.error);
      }
    } catch (error) {
      console.warn('[Signup] Error publishing registration request:', error);
    }

    // Proceed directly to chat
    goto(`${base}/chat`);
  }
</script>

<svelte:head>
  <title>Sign Up - {appConfig.name}</title>
</svelte:head>

{#if step === 'gateway'}
  <SignupGateway on:select={handleGatewaySelect} />
{:else if step === 'simple'}
  <SimpleSignup on:complete={handleSimpleComplete} on:back={() => step = 'gateway'} />
{:else if step === 'secure-signup'}
  <Signup on:next={handleNext} />
{:else if step === 'mnemonic'}
  <MnemonicDisplay {mnemonic} on:continue={handleMnemonicContinue} />
{:else if step === 'backup'}
  <KeyBackup {publicKey} {mnemonic} on:continue={handleBackupContinue} />
{:else if step === 'nickname'}
  <NicknameSetup {publicKey} {privateKey} on:continue={handleNicknameContinue} />
{/if}
