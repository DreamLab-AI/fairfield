import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { encryptPrivateKey, decryptPrivateKey, isEncryptionAvailable } from '$lib/utils/key-encryption';
import { isPWAInstalled, checkIfPWA } from '$lib/stores/pwa';
import { hasNip07Extension, getPublicKeyFromExtension, getExtensionName, waitForNip07 } from '$lib/nostr/nip07';
import { setNip07Signer, clearSigner } from '$lib/nostr/ndk';

export interface AuthState {
  state: 'unauthenticated' | 'authenticating' | 'authenticated';
  pubkey: string | null;
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  nickname: string | null;
  avatar: string | null;
  isPending: boolean;
  error: string | null;
  isEncrypted: boolean;
  accountStatus: 'incomplete' | 'complete';
  nsecBackedUp: boolean;
  isReady: boolean;
  /** Whether using NIP-07 browser extension for signing */
  isNip07: boolean;
  /** Name of the NIP-07 extension if available */
  extensionName: string | null;
}

const initialState: AuthState = {
  state: 'unauthenticated',
  pubkey: null,
  isAuthenticated: false,
  publicKey: null,
  privateKey: null,
  nickname: null,
  avatar: null,
  isPending: false,
  error: null,
  isEncrypted: false,
  accountStatus: 'incomplete',
  nsecBackedUp: false,
  isReady: false,
  isNip07: false,
  extensionName: null
};

const STORAGE_KEY = 'nostr_bbs_keys';
const SESSION_KEY = 'nostr_bbs_session';
const COOKIE_KEY = 'nostr_bbs_auth';
const KEEP_SIGNED_IN_KEY = 'nostr_bbs_keep_signed_in';
const PWA_AUTH_KEY = 'nostr_bbs_pwa_auth';

/**
 * Check if running as installed PWA
 */
function isRunningAsPWA(): boolean {
  if (!browser) return false;
  // Check current state or stored PWA mode
  return get(isPWAInstalled) || checkIfPWA() || localStorage.getItem('nostr_bbs_pwa_mode') === 'true';
}

/**
 * Cookie utilities for persistent auth
 */
function setCookie(name: string, value: string, days: number): void {
  if (!browser) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict; Secure`;
}

function getCookie(name: string): string | null {
  if (!browser) return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string): void {
  if (!browser) return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict; Secure`;
}

/**
 * Check if user wants persistent login
 */
function shouldKeepSignedIn(): boolean {
  if (!browser) return false;
  return localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'false';
}


/**
 * Get or generate session encryption key
 * Session key is stored in sessionStorage (cleared on tab close)
 */
function getSessionKey(): string {
  if (!browser) return '';

  let sessionKey = sessionStorage.getItem(SESSION_KEY);
  if (!sessionKey) {
    // Generate a random session key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    sessionKey = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
}

function createAuthStore() {
  const { subscribe, set, update }: Writable<AuthState> = writable(initialState);

  // Promise that resolves when session restore is complete
  let readyPromise: Promise<void> | null = null;

  // Helper to sync state and pubkey with isAuthenticated and publicKey
  function syncStateFields(updates: Partial<AuthState>): Partial<AuthState> {
    const result = { ...updates };
    if (updates.isAuthenticated !== undefined) {
      result.state = updates.isAuthenticated ? 'authenticated' : 'unauthenticated';
    }
    if (updates.publicKey !== undefined) {
      result.pubkey = updates.publicKey;
    }
    return result;
  }

  // Restore from localStorage on init
  async function restoreSession() {
    if (!browser) {
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      return;
    }

    // Check for PWA persistent auth first (no session expiry)
    const pwaAuth = localStorage.getItem(PWA_AUTH_KEY);
    if (pwaAuth && isRunningAsPWA()) {
      try {
        const pwaData = JSON.parse(pwaAuth);
        if (pwaData.publicKey && pwaData.privateKey) {
          console.log('[Auth] Restoring PWA persistent session');
          update(state => ({
            ...state,
            ...syncStateFields({
              publicKey: pwaData.publicKey,
              privateKey: pwaData.privateKey,
              nickname: pwaData.nickname || null,
              avatar: pwaData.avatar || null,
              isAuthenticated: true,
              isEncrypted: false,
              nsecBackedUp: pwaData.nsecBackedUp || false,
              isReady: true
            })
          }));
          return;
        }
      } catch {
        // Invalid PWA auth data, continue with normal flow
      }
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      // Check if using NIP-07 extension mode
      if (parsed.isNip07) {
        // Verify extension is still available
        const extensionReady = await waitForNip07(1000);
        if (extensionReady) {
          try {
            // Re-verify public key from extension
            const currentPubkey = await getPublicKeyFromExtension();
            if (currentPubkey === parsed.publicKey) {
              // Set NDK to use NIP-07 extension signer
              setNip07Signer();

              update(state => ({
                ...state,
                ...syncStateFields({
                  publicKey: parsed.publicKey,
                  privateKey: null,
                  nickname: parsed.nickname || null,
                  avatar: parsed.avatar || null,
                  isAuthenticated: true,
                  isEncrypted: false,
                  accountStatus: parsed.accountStatus || 'complete',
                  nsecBackedUp: true,
                  isNip07: true,
                  extensionName: getExtensionName(),
                  isReady: true
                })
              }));
              return;
            }
          } catch {
            // Extension denied access or pubkey mismatch - need to re-auth
          }
        }
        // Extension not available or pubkey mismatch - clear NIP-07 state
        update(state => ({
          ...state,
          ...syncStateFields({
            publicKey: parsed.publicKey,
            nickname: parsed.nickname || null,
            avatar: parsed.avatar || null,
            isAuthenticated: false,
            isNip07: false,
            error: 'Nostr extension not detected. Please unlock your extension or login with nsec.',
            isReady: true
          })
        }));
        return;
      }

      // Check if data is encrypted
      if (parsed.encryptedPrivateKey && isEncryptionAvailable()) {
        const sessionKey = getSessionKey();
        try {
          const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, sessionKey);
          update(state => ({
            ...state,
            ...syncStateFields({
              publicKey: parsed.publicKey,
              privateKey,
              nickname: parsed.nickname || null,
              avatar: parsed.avatar || null,
              isAuthenticated: true,
              isEncrypted: true,
              accountStatus: parsed.accountStatus || 'incomplete',
              nsecBackedUp: parsed.nsecBackedUp || false,
              isReady: true
            })
          }));
        } catch {
          // Session key changed (new session) - need to re-authenticate
          // But if we're in PWA mode, try to use the stored keys directly
          if (isRunningAsPWA() && parsed.publicKey) {
            // For PWA, prompt user to re-enter password once to migrate
            update(state => ({
              ...state,
              ...syncStateFields({
                publicKey: parsed.publicKey,
                nickname: parsed.nickname || null,
                avatar: parsed.avatar || null,
                isAuthenticated: false,
                isEncrypted: true,
                error: 'Please unlock to enable persistent PWA login.',
                isReady: true
              })
            }));
          } else {
            update(state => ({
              ...state,
              ...syncStateFields({
                publicKey: parsed.publicKey,
                nickname: parsed.nickname || null,
                avatar: parsed.avatar || null,
                isAuthenticated: false,
                isEncrypted: true,
                error: 'Session expired. Please enter your password to unlock.',
                isReady: true
              })
            }));
          }
        }
      } else if (parsed.privateKey) {
        // Legacy unencrypted data - migrate on next save
        update(state => ({
          ...state,
          ...syncStateFields({
            ...parsed,
            isAuthenticated: true,
            isEncrypted: false,
            accountStatus: parsed.accountStatus || 'incomplete',
            nsecBackedUp: parsed.nsecBackedUp || false,
            isReady: true
          })
        }));
      } else {
        update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
    }
  }

  // Initialize restoration
  if (browser) {
    readyPromise = restoreSession();
  } else {
    readyPromise = Promise.resolve();
  }

  return {
    subscribe,

    /**
     * Wait for the auth store to be ready (session restored)
     */
    waitForReady: () => readyPromise || Promise.resolve(),

    /**
     * Login using NIP-07 browser extension
     * @returns Object with publicKey on success, or throws on failure
     */
    loginWithExtension: async (): Promise<{ publicKey: string }> => {
      if (!browser) {
        throw new Error('Browser environment required');
      }

      // Wait for extension to be ready
      const extensionReady = await waitForNip07(2000);
      if (!extensionReady) {
        throw new Error('No NIP-07 extension found. Please install Alby, nos2x, or another Nostr signer.');
      }

      try {
        const publicKey = await getPublicKeyFromExtension();
        const extensionName = getExtensionName();

        // Store NIP-07 mode in localStorage
        const storageData = {
          publicKey,
          isNip07: true,
          extensionName,
          accountStatus: 'complete', // Extension users are presumed to be existing Nostr users
          nsecBackedUp: true // Extension manages keys
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

        // Set NDK to use NIP-07 extension signer
        setNip07Signer();

        // Update store state
        update(state => ({
          ...state,
          ...syncStateFields({
            publicKey,
            privateKey: null, // No private key stored - extension handles signing
            isAuthenticated: true,
            isPending: false,
            error: null,
            isEncrypted: false,
            accountStatus: 'complete',
            nsecBackedUp: true,
            isNip07: true,
            extensionName
          })
        }));

        return { publicKey };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect to extension';
        update(state => ({ ...state, error: message }));
        throw error;
      }
    },

    /**
     * Check if NIP-07 extension is available
     */
    hasExtension: () => hasNip07Extension(),

    /**
     * Set keys with encryption
     */
    setKeys: async (
      publicKey: string,
      privateKey: string,
      accountStatus: 'incomplete' | 'complete' = 'incomplete',
      nsecBackedUp: boolean = false
    ) => {
      const sessionKey = getSessionKey();

      const authData: Partial<AuthState> = {
        publicKey,
        privateKey,
        isAuthenticated: true,
        isPending: false,
        error: null,
        isEncrypted: isEncryptionAvailable(),
        accountStatus,
        nsecBackedUp
      };

      if (browser) {
        const existing = localStorage.getItem(STORAGE_KEY);
        let existingData: { nickname?: string; avatar?: string; accountStatus?: string; nsecBackedUp?: boolean } = {};
        if (existing) {
          try { existingData = JSON.parse(existing); } catch { /* ignore */ }
        }

        const storageData: Record<string, unknown> = {
          publicKey,
          nickname: existingData.nickname || null,
          avatar: existingData.avatar || null,
          accountStatus: accountStatus,
          nsecBackedUp: nsecBackedUp
        };

        // Encrypt private key if available
        if (isEncryptionAvailable()) {
          storageData.encryptedPrivateKey = await encryptPrivateKey(privateKey, sessionKey);
        } else {
          // Fallback for environments without Web Crypto (shouldn't happen in modern browsers)
          storageData.privateKey = privateKey;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

        // If keep signed in is enabled, also set a cookie for persistence
        if (shouldKeepSignedIn()) {
          setCookie(COOKIE_KEY, publicKey, 30); // 30 day cookie
        }

        // For PWA mode: store persistent auth that survives session changes
        if (isRunningAsPWA()) {
          const pwaAuthData = {
            publicKey,
            privateKey,
            nickname: existingData.nickname || null,
            avatar: existingData.avatar || null,
            nsecBackedUp: existingData.nsecBackedUp || false
          };
          localStorage.setItem(PWA_AUTH_KEY, JSON.stringify(pwaAuthData));
          console.log('[Auth] PWA persistent auth stored');
        }
      }

      update(state => ({ ...state, ...syncStateFields(authData) }));
    },

    /**
     * Mark nsec as backed up
     */
    confirmNsecBackup: () => {
      update(state => ({
        ...state,
        nsecBackedUp: true
      }));

      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            data.nsecBackedUp = true;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
    },

    /**
     * Mark account signup as complete
     */
    completeSignup: () => {
      update(state => ({
        ...state,
        accountStatus: 'complete'
      }));

      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            data.accountStatus = 'complete';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
    },

    /**
     * Unlock with password (for encrypted storage)
     */
    unlock: async (password: string) => {
      if (!browser) return false;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      try {
        const parsed = JSON.parse(stored);
        if (!parsed.encryptedPrivateKey) return false;

        const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, password);

        // Re-encrypt with session key for this session
        const sessionKey = getSessionKey();
        const newEncrypted = await encryptPrivateKey(privateKey, sessionKey);
        parsed.encryptedPrivateKey = newEncrypted;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

        // For PWA mode: store persistent auth that survives session changes
        if (isRunningAsPWA()) {
          const pwaAuthData = {
            publicKey: parsed.publicKey,
            privateKey,
            nickname: parsed.nickname || null,
            avatar: parsed.avatar || null,
            nsecBackedUp: parsed.nsecBackedUp || false
          };
          localStorage.setItem(PWA_AUTH_KEY, JSON.stringify(pwaAuthData));
          console.log('[Auth] PWA persistent auth stored after unlock');
        }

        update(state => ({
          ...state,
          ...syncStateFields({
            privateKey,
            publicKey: parsed.publicKey,
            isAuthenticated: true,
            error: null
          })
        }));

        return true;
      } catch {
        update(state => ({ ...state, error: 'Invalid password' }));
        return false;
      }
    },

    setProfile: (nickname: string | null, avatar: string | null) => {
      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            data.nickname = nickname;
            data.avatar = avatar;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
      update(state => ({ ...state, nickname, avatar }));
    },

    setPending: (isPending: boolean) => {
      update(state => ({ ...state, isPending }));
    },

    setError: (error: string) => {
      update(state => ({ ...state, error }));
    },

    clearError: () => {
      update(state => ({ ...state, error: null }));
    },

    logout: async () => {
      set(initialState);
      if (browser) {
        // Clear NDK signer
        clearSigner();

        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PWA_AUTH_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        deleteCookie(COOKIE_KEY);
        const { goto } = await import('$app/navigation');
        goto(`${base}/`);
      }
    },

    reset: () => set(initialState)
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const isReady = derived(authStore, $auth => $auth.isReady);
export const isReadOnly = derived(authStore, $auth => $auth.accountStatus === 'incomplete');
export const accountStatus = derived(authStore, $auth => $auth.accountStatus);
