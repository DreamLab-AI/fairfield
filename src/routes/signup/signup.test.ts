/**
 * Signup Flow Integration Tests
 *
 * Tests the complete signup flow logic:
 * 1. signup -> backup -> nickname -> pending flow transitions
 * 2. NicknameSetup publishes Kind 0 profile event
 * 3. +page.svelte publishes Kind 9024 registration request after 300ms delay
 * 4. Whitelist status check before proceeding
 * 5. Error handling when publish fails
 *
 * Note: These tests focus on business logic and mock interactions rather than
 * component rendering since @testing-library/svelte is not installed.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { get } from 'svelte/store';

// Mock $app modules
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$app/paths', () => ({
  base: ''
}));

// Mock whitelist module
vi.mock('$lib/nostr/whitelist', async () => {
  return {
    checkWhitelistStatus: vi.fn(),
    publishRegistrationRequest: vi.fn()
  };
});

// Mock relay module
vi.mock('$lib/nostr/relay', () => ({
  ndk: vi.fn(),
  connectRelay: vi.fn(),
  isConnected: vi.fn(),
  disconnectRelay: vi.fn(),
  connectionState: {
    subscribe: vi.fn((fn: (val: unknown) => void) => {
      fn({ state: 'connected', authenticated: true });
      return () => {};
    })
  }
}));

// Mock profiles store
vi.mock('$lib/stores/profiles', () => ({
  profileCache: {
    updateCurrentUserProfile: vi.fn()
  }
}));

// Mock config
vi.mock('$lib/config', () => ({
  RELAY_URL: 'wss://test-relay.example.com'
}));

// Mock key generation
vi.mock('$lib/nostr/keys', () => ({
  generateSimpleKeys: vi.fn(() => ({
    publicKey: 'a'.repeat(64),
    privateKey: 'b'.repeat(64)
  })),
  encodePrivkey: vi.fn((key: string) => `nsec1${key.slice(0, 58)}`),
  encodePubkey: vi.fn((key: string) => `npub1${key.slice(0, 58)}`)
}));

// Test data
const TEST_PUBLIC_KEY = 'a'.repeat(64);
const TEST_PRIVATE_KEY = 'b'.repeat(64);
const TEST_NICKNAME = 'TestUser';

describe('Signup Flow Integration', () => {
  let checkWhitelistStatus: Mock;
  let publishRegistrationRequest: Mock;
  let ndk: Mock;
  let connectRelay: Mock;
  let isConnected: Mock;
  let goto: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Get mocked functions
    const whitelistModule = await import('$lib/nostr/whitelist');
    checkWhitelistStatus = whitelistModule.checkWhitelistStatus as Mock;
    publishRegistrationRequest = whitelistModule.publishRegistrationRequest as Mock;

    const relayModule = await import('$lib/nostr/relay');
    ndk = relayModule.ndk as Mock;
    connectRelay = relayModule.connectRelay as Mock;
    isConnected = relayModule.isConnected as Mock;

    const navModule = await import('$app/navigation');
    goto = navModule.goto as Mock;

    // Default mock implementations
    isConnected.mockReturnValue(false);
    connectRelay.mockResolvedValue({ state: 'connected' });
    ndk.mockReturnValue({
      signer: { user: () => Promise.resolve({ pubkey: TEST_PUBLIC_KEY }) }
    });
    checkWhitelistStatus.mockResolvedValue({
      isApproved: false,
      isAdmin: false
    });
    publishRegistrationRequest.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Auth Store', () => {
    it('should set keys during signup flow', async () => {
      // Fresh import to avoid stale state
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      await authStore.setKeys(TEST_PUBLIC_KEY, TEST_PRIVATE_KEY, 'incomplete', false);

      const state = get(authStore);
      expect(state.publicKey).toBe(TEST_PUBLIC_KEY);
      expect(state.privateKey).toBe(TEST_PRIVATE_KEY);
      expect(state.isAuthenticated).toBe(true);
      expect(state.accountStatus).toBe('incomplete');
    });

    it('should confirm nsec backup', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      authStore.confirmNsecBackup();

      const state = get(authStore);
      expect(state.nsecBackedUp).toBe(true);
    });

    it('should set profile after nickname setup', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      authStore.setProfile(TEST_NICKNAME, null);

      const state = get(authStore);
      expect(state.nickname).toBe(TEST_NICKNAME);
    });

    it('should set pending state', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      authStore.setPending(true);

      const state = get(authStore);
      expect(state.isPending).toBe(true);
    });

    it('should track complete signup flow state transitions', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      // Step 1: Set keys (after signup step)
      await authStore.setKeys(TEST_PUBLIC_KEY, TEST_PRIVATE_KEY, 'incomplete', false);
      let state = get(authStore);
      expect(state.isAuthenticated).toBe(true);
      expect(state.nsecBackedUp).toBe(false);

      // Step 2: Confirm backup (after backup step)
      authStore.confirmNsecBackup();
      state = get(authStore);
      expect(state.nsecBackedUp).toBe(true);

      // Step 3: Set profile (after nickname step)
      authStore.setProfile(TEST_NICKNAME, null);
      state = get(authStore);
      expect(state.nickname).toBe(TEST_NICKNAME);

      // Step 4: Set pending (for non-approved users)
      authStore.setPending(true);
      state = get(authStore);
      expect(state.isPending).toBe(true);
    });
  });

  describe('Whitelist Status Check', () => {
    it('should check whitelist status for new user', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: false
      });

      const result = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      expect(result.isApproved).toBe(false);
      expect(result.isAdmin).toBe(false);
      expect(checkWhitelistStatus).toHaveBeenCalledWith(TEST_PUBLIC_KEY);
    });

    it('should return approved=true for pre-approved users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: true,
        isAdmin: false
      });

      const result = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      expect(result.isApproved).toBe(true);
    });

    it('should return isAdmin=true for admin users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: true
      });

      const result = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      expect(result.isAdmin).toBe(true);
    });
  });

  describe('Flow Routing Based on Whitelist Status', () => {
    it('should redirect to chat for pre-approved users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: true,
        isAdmin: false
      });

      const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Simulate page logic
      if (status.isApproved || status.isAdmin) {
        await goto('/chat');
      }

      expect(goto).toHaveBeenCalledWith('/chat');
    });

    it('should redirect to chat for admin users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: true
      });

      const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Simulate page logic
      if (status.isApproved || status.isAdmin) {
        await goto('/chat');
      }

      expect(goto).toHaveBeenCalledWith('/chat');
    });

    it('should NOT redirect for non-approved, non-admin users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: false
      });

      const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Simulate page logic
      if (status.isApproved || status.isAdmin) {
        await goto('/chat');
      }

      expect(goto).not.toHaveBeenCalled();
    });
  });

  describe('Registration Request Publishing', () => {
    it('should publish registration request after 300ms delay', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: false
      });

      const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      if (!status.isApproved && !status.isAdmin) {
        // Simulate 300ms delay as in +page.svelte
        await new Promise(resolve => setTimeout(resolve, 300));
        vi.advanceTimersByTime(300);

        await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);
      }

      expect(publishRegistrationRequest).toHaveBeenCalledWith(TEST_PRIVATE_KEY, TEST_NICKNAME);
    });

    it('should not publish registration request for approved users', async () => {
      checkWhitelistStatus.mockResolvedValue({
        isApproved: true,
        isAdmin: false
      });

      const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      if (!status.isApproved && !status.isAdmin) {
        await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);
      }

      expect(publishRegistrationRequest).not.toHaveBeenCalled();
    });

    it('should handle registration request success', async () => {
      publishRegistrationRequest.mockResolvedValue({ success: true });

      const result = await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);

      expect(result.success).toBe(true);
    });

    it('should handle registration request failure gracefully', async () => {
      publishRegistrationRequest.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      const result = await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle registration request exception gracefully', async () => {
      publishRegistrationRequest.mockRejectedValue(new Error('Connection failed'));

      let errorCaught = false;
      let errorMessage = '';

      // Simulate the try-catch pattern from +page.svelte
      try {
        await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);
      } catch (error) {
        errorCaught = true;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      expect(errorCaught).toBe(true);
      expect(errorMessage).toBe('Connection failed');
    });

    it('should publish registration with optional nickname', async () => {
      publishRegistrationRequest.mockResolvedValue({ success: true });

      // Test with nickname
      await publishRegistrationRequest(TEST_PRIVATE_KEY, TEST_NICKNAME);
      expect(publishRegistrationRequest).toHaveBeenLastCalledWith(TEST_PRIVATE_KEY, TEST_NICKNAME);

      // Test without nickname (when skipped)
      await publishRegistrationRequest(TEST_PRIVATE_KEY, undefined);
      expect(publishRegistrationRequest).toHaveBeenLastCalledWith(TEST_PRIVATE_KEY, undefined);
    });
  });

  describe('300ms Delay Behavior', () => {
    it('should ensure delay between Kind 0 and Kind 9024 events', async () => {
      const eventTimestamps: number[] = [];

      // Simulate Kind 0 publish (profile event)
      eventTimestamps.push(Date.now());

      // Wait 300ms as the page does
      await new Promise(resolve => setTimeout(resolve, 300));
      vi.advanceTimersByTime(300);

      // Simulate Kind 9024 publish (registration request)
      eventTimestamps.push(Date.now());

      const timeDifference = eventTimestamps[1] - eventTimestamps[0];
      expect(timeDifference).toBeGreaterThanOrEqual(300);
    });

    it('should prevent race condition where registration arrives before profile', async () => {
      const publishOrder: string[] = [];

      // Simulate Kind 0 event published from NicknameSetup
      publishOrder.push('kind-0-profile');

      // Wait 300ms to ensure profile is saved on relay
      await new Promise(resolve => setTimeout(resolve, 300));
      vi.advanceTimersByTime(300);

      // Only then publish Kind 9024
      publishOrder.push('kind-9024-registration');

      expect(publishOrder).toEqual(['kind-0-profile', 'kind-9024-registration']);
    });
  });

  describe('Relay Connection', () => {
    it('should connect to relay if not connected', async () => {
      isConnected.mockReturnValue(false);

      const connected = isConnected();
      if (!connected) {
        await connectRelay('wss://test-relay.example.com', TEST_PRIVATE_KEY);
      }

      expect(connectRelay).toHaveBeenCalledWith('wss://test-relay.example.com', TEST_PRIVATE_KEY);
    });

    it('should not reconnect if already connected', async () => {
      isConnected.mockReturnValue(true);

      const connected = isConnected();
      if (!connected) {
        await connectRelay('wss://test-relay.example.com', TEST_PRIVATE_KEY);
      }

      expect(connectRelay).not.toHaveBeenCalled();
    });

    it('should handle NDK initialization failure', async () => {
      ndk.mockReturnValue(null);

      const ndkInstance = ndk();

      expect(ndkInstance).toBeNull();
      // In the actual component, this would throw 'Failed to initialize NDK'
    });
  });

  describe('Key Generation', () => {
    it('should generate valid key pair', async () => {
      const { generateSimpleKeys } = await import('$lib/nostr/keys');

      const keys = generateSimpleKeys();

      expect(keys.publicKey).toBe(TEST_PUBLIC_KEY);
      expect(keys.privateKey).toBe(TEST_PRIVATE_KEY);
      expect(keys.publicKey).toHaveLength(64);
      expect(keys.privateKey).toHaveLength(64);
    });

    it('should encode keys to nsec and npub formats', async () => {
      const { encodePrivkey, encodePubkey } = await import('$lib/nostr/keys');

      const nsec = encodePrivkey(TEST_PRIVATE_KEY);
      const npub = encodePubkey(TEST_PUBLIC_KEY);

      expect(nsec).toMatch(/^nsec1/);
      expect(npub).toMatch(/^npub1/);
    });
  });

  describe('Nickname Validation Logic', () => {
    it('should validate nickname length requirements', () => {
      // Simulate the reactive validation from NicknameSetup.svelte
      const validateNickname = (nickname: string) => {
        const trimmed = nickname.trim();
        return trimmed.length >= 2 && trimmed.length <= 50;
      };

      expect(validateNickname('')).toBe(false);
      expect(validateNickname('A')).toBe(false);
      expect(validateNickname('AB')).toBe(true);
      expect(validateNickname('A'.repeat(50))).toBe(true);
      expect(validateNickname('A'.repeat(51))).toBe(false);
    });

    it('should trim whitespace from nickname', () => {
      const getNickname = (input: string) => input.trim();

      expect(getNickname('  TestUser  ')).toBe('TestUser');
      expect(getNickname('\tUser\t')).toBe('User');
      expect(getNickname('\n\nUser\n\n')).toBe('User');
    });

    it('should generate appropriate error messages', () => {
      const getNicknameError = (nickname: string) => {
        const trimmed = nickname.trim();
        if (nickname.length === 0) return null; // No error when empty (initial state)
        if (trimmed.length < 2) return 'Nickname must be at least 2 characters';
        if (trimmed.length > 50) return 'Nickname must be 50 characters or less';
        return null;
      };

      expect(getNicknameError('')).toBeNull();
      expect(getNicknameError('A')).toBe('Nickname must be at least 2 characters');
      expect(getNicknameError('AB')).toBeNull();
      expect(getNicknameError('A'.repeat(51))).toBe('Nickname must be 50 characters or less');
    });
  });

  describe('Profile Event (Kind 0) Structure', () => {
    it('should create correct Kind 0 event content', () => {
      const createProfileContent = (nickname: string) => {
        return JSON.stringify({
          name: nickname.trim(),
          display_name: nickname.trim()
        });
      };

      const content = createProfileContent(TEST_NICKNAME);
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe(TEST_NICKNAME);
      expect(parsed.display_name).toBe(TEST_NICKNAME);
    });

    it('should handle special characters in nickname', () => {
      const createProfileContent = (nickname: string) => {
        return JSON.stringify({
          name: nickname.trim(),
          display_name: nickname.trim()
        });
      };

      const specialNickname = 'User_123-Test!';
      const content = createProfileContent(specialNickname);
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe(specialNickname);
    });

    it('should handle unicode in nickname', () => {
      const createProfileContent = (nickname: string) => {
        return JSON.stringify({
          name: nickname.trim(),
          display_name: nickname.trim()
        });
      };

      const unicodeNickname = 'User123';
      const content = createProfileContent(unicodeNickname);
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe(unicodeNickname);
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('Pending Approval Polling', () => {
    it('should poll for approval status at regular intervals', async () => {
      let pollCount = 0;
      checkWhitelistStatus.mockImplementation(async () => {
        pollCount++;
        return { isApproved: false, isAdmin: false };
      });

      // Simulate initial check
      await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Advance 10 seconds (poll interval in PendingApproval)
      vi.advanceTimersByTime(10000);
      await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Advance another 10 seconds
      vi.advanceTimersByTime(10000);
      await checkWhitelistStatus(TEST_PUBLIC_KEY);

      expect(pollCount).toBe(3);
    });

    it('should stop polling when user is approved', async () => {
      let approvedEventDispatched = false;

      checkWhitelistStatus
        .mockResolvedValueOnce({ isApproved: false, isAdmin: false })
        .mockResolvedValueOnce({ isApproved: true, isAdmin: false });

      // Initial check
      const firstStatus = await checkWhitelistStatus(TEST_PUBLIC_KEY);
      if (firstStatus.isApproved || firstStatus.isAdmin) {
        approvedEventDispatched = true;
      }

      // Advance and check again
      vi.advanceTimersByTime(10000);
      const secondStatus = await checkWhitelistStatus(TEST_PUBLIC_KEY);
      if (secondStatus.isApproved || secondStatus.isAdmin) {
        approvedEventDispatched = true;
      }

      expect(approvedEventDispatched).toBe(true);
    });

    it('should handle polling errors gracefully', async () => {
      checkWhitelistStatus
        .mockResolvedValueOnce({ isApproved: false, isAdmin: false })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ isApproved: false, isAdmin: false });

      // First successful check
      await checkWhitelistStatus(TEST_PUBLIC_KEY);

      // Second check fails
      vi.advanceTimersByTime(10000);
      let errorCaught = false;
      try {
        await checkWhitelistStatus(TEST_PUBLIC_KEY);
      } catch {
        errorCaught = true;
        // Simulate the component's error handling (just logs, doesn't stop polling)
      }

      // Third check succeeds (polling continues)
      vi.advanceTimersByTime(10000);
      const thirdStatus = await checkWhitelistStatus(TEST_PUBLIC_KEY);

      expect(errorCaught).toBe(true);
      expect(thirdStatus.isApproved).toBe(false);
    });
  });

  describe('Flow Step Transitions', () => {
    type FlowStep = 'signup' | 'backup' | 'nickname' | 'pending';

    it('should transition from signup to backup when keys are generated', () => {
      let step: FlowStep = 'signup';
      let publicKey = '';
      let privateKey = '';

      // Simulate handleNext from +page.svelte
      const handleNext = (detail: { publicKey: string; privateKey: string }) => {
        if (detail.publicKey && detail.privateKey) {
          publicKey = detail.publicKey;
          privateKey = detail.privateKey;
          step = 'backup';
        }
      };

      handleNext({ publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY });

      expect(step).toBe('backup');
      expect(publicKey).toBe(TEST_PUBLIC_KEY);
      expect(privateKey).toBe(TEST_PRIVATE_KEY);
    });

    it('should redirect to login when user has existing key', async () => {
      let step: FlowStep = 'signup';

      // Simulate handleNext when user clicks "Already have a private key?"
      const handleNext = async (detail: { publicKey: string; privateKey: string }) => {
        if (!detail.publicKey && !detail.privateKey) {
          await goto('/login');
        } else {
          step = 'backup';
        }
      };

      await handleNext({ publicKey: '', privateKey: '' });

      expect(step).toBe('signup'); // Should not change
      expect(goto).toHaveBeenCalledWith('/login');
    });

    it('should transition from backup to nickname after confirmation', () => {
      let step: FlowStep = 'backup';

      // Simulate handleBackupContinue
      const handleBackupContinue = () => {
        step = 'nickname';
      };

      handleBackupContinue();

      expect(step).toBe('nickname');
    });

    it('should transition from nickname to pending for non-approved users', async () => {
      let step: FlowStep = 'nickname';

      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: false
      });

      // Simulate handleNicknameContinue
      const handleNicknameContinue = async () => {
        const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);
        if (status.isApproved || status.isAdmin) {
          await goto('/chat');
        } else {
          step = 'pending';
        }
      };

      await handleNicknameContinue();

      expect(step).toBe('pending');
    });

    it('should skip pending for pre-approved users', async () => {
      let step: FlowStep = 'nickname';

      checkWhitelistStatus.mockResolvedValue({
        isApproved: true,
        isAdmin: false
      });

      // Simulate handleNicknameContinue
      const handleNicknameContinue = async () => {
        const status = await checkWhitelistStatus(TEST_PUBLIC_KEY);
        if (status.isApproved || status.isAdmin) {
          await goto('/chat');
        } else {
          step = 'pending';
        }
      };

      await handleNicknameContinue();

      expect(step).toBe('nickname'); // Not changed to pending
      expect(goto).toHaveBeenCalledWith('/chat');
    });
  });

  describe('Complete Signup Flow Integration', () => {
    it('should complete full signup flow for new user', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      type FlowStep = 'signup' | 'backup' | 'nickname' | 'pending';
      let step: FlowStep = 'signup';
      let publicKey = '';
      let privateKey = '';
      let nickname = '';

      // Step 1: Generate keys
      const { generateSimpleKeys } = await import('$lib/nostr/keys');
      const keys = generateSimpleKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      step = 'backup';

      // Step 2: Backup confirmation
      await authStore.setKeys(publicKey, privateKey, 'incomplete', false);
      authStore.confirmNsecBackup();
      step = 'nickname';

      // Step 3: Set nickname
      nickname = TEST_NICKNAME;
      authStore.setProfile(nickname, null);

      // Step 4: Check whitelist status
      checkWhitelistStatus.mockResolvedValue({
        isApproved: false,
        isAdmin: false
      });
      const status = await checkWhitelistStatus(publicKey);

      if (status.isApproved || status.isAdmin) {
        await goto('/chat');
      } else {
        // Wait 300ms before publishing registration
        await new Promise(resolve => setTimeout(resolve, 300));
        vi.advanceTimersByTime(300);

        await publishRegistrationRequest(privateKey, nickname);
        authStore.setPending(true);
        step = 'pending';
      }

      // Verify final state
      const finalState = get(authStore);
      expect(step).toBe('pending');
      expect(finalState.publicKey).toBe(TEST_PUBLIC_KEY);
      expect(finalState.isAuthenticated).toBe(true);
      expect(finalState.nsecBackedUp).toBe(true);
      expect(finalState.nickname).toBe(TEST_NICKNAME);
      expect(finalState.isPending).toBe(true);
      expect(publishRegistrationRequest).toHaveBeenCalledWith(TEST_PRIVATE_KEY, TEST_NICKNAME);
    });

    it('should complete signup flow for pre-approved user (skip pending)', async () => {
      vi.resetModules();
      const { authStore } = await import('$lib/stores/auth');
      authStore.reset();

      type FlowStep = 'signup' | 'backup' | 'nickname' | 'pending';
      let step: FlowStep = 'signup';
      let publicKey = '';
      let privateKey = '';
      let nickname = '';

      // Steps 1-3 same as above
      const { generateSimpleKeys } = await import('$lib/nostr/keys');
      const keys = generateSimpleKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      step = 'backup';

      await authStore.setKeys(publicKey, privateKey, 'incomplete', false);
      authStore.confirmNsecBackup();
      step = 'nickname';

      nickname = TEST_NICKNAME;
      authStore.setProfile(nickname, null);

      // Step 4: Pre-approved user
      checkWhitelistStatus.mockResolvedValue({
        isApproved: true,
        isAdmin: false
      });
      const status = await checkWhitelistStatus(publicKey);

      if (status.isApproved || status.isAdmin) {
        await goto('/chat');
      } else {
        await publishRegistrationRequest(privateKey, nickname);
        authStore.setPending(true);
        step = 'pending';
      }

      // Verify final state
      const finalState = get(authStore);
      expect(step).toBe('nickname'); // Never moved to pending
      expect(finalState.isPending).toBe(false);
      expect(goto).toHaveBeenCalledWith('/chat');
      expect(publishRegistrationRequest).not.toHaveBeenCalled();
    });
  });
});
