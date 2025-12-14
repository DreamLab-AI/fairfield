import { derived, writable, type Readable, type Writable } from 'svelte/store';
import { authStore } from './auth';
import { verifyWhitelistStatus, type CohortName, type WhitelistStatus } from '$lib/nostr/whitelist';
import { browser } from '$app/environment';

/**
 * User cohort types
 */
export type CohortType = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate' | 'faculty' | 'staff' | 'alumni';

/**
 * Relay-verified whitelist status store
 * This is the SOURCE OF TRUTH for admin/cohort permissions
 */
export const whitelistStatusStore: Writable<WhitelistStatus | null> = writable(null);

/**
 * User profile interface
 */
export interface UserProfile {
  pubkey: string;
  name: string | null;
  displayName: string | null;
  avatar: string | null;
  about: string | null;
  cohorts: CohortType[];
  isAdmin: boolean;
  isApproved: boolean;
  nip05: string | null;
  lud16: string | null; // Lightning address
  website: string | null;
  banner: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/**
 * User store state
 */
export interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Creates a default user profile from pubkey
 */
function createDefaultProfile(pubkey: string): UserProfile {
  return {
    pubkey,
    name: null,
    displayName: null,
    avatar: null,
    about: null,
    cohorts: [],
    isAdmin: false,
    isApproved: false,
    nip05: null,
    lud16: null,
    website: null,
    banner: null,
    createdAt: null,
    updatedAt: null
  };
}

/**
 * User store derived from auth store
 * Automatically updates when authentication state changes
 */
export const userStore: Readable<UserState> = derived(
  authStore,
  ($auth, set) => {
    // If not authenticated, clear user
    if ($auth.state !== 'authenticated' || !$auth.pubkey) {
      set({
        profile: null,
        isLoading: false,
        error: null
      });
      return;
    }

    // Create initial profile from pubkey
    const initialProfile = createDefaultProfile($auth.pubkey);

    set({
      profile: initialProfile,
      isLoading: true,
      error: null
    });

    // In a real implementation, this would fetch the full profile from Nostr relays
    // For now, we just use the default profile
    // TODO: Implement Nostr relay queries to fetch kind 0 metadata events

    // Load profile and verify whitelist status from relay
    const loadProfile = async () => {
      try {
        // Verify whitelist status from relay (SOURCE OF TRUTH)
        if (browser) {
          const whitelistStatus = await verifyWhitelistStatus($auth.pubkey);
          whitelistStatusStore.set(whitelistStatus);

          // Update profile with relay-verified status
          const verifiedProfile: UserProfile = {
            ...initialProfile,
            isAdmin: whitelistStatus.isAdmin,
            isApproved: whitelistStatus.isWhitelisted,
            cohorts: [] // Map cohorts if needed
          };

          set({
            profile: verifiedProfile,
            isLoading: false,
            error: null
          });

          if (import.meta.env.DEV) {
            console.log('[User] Whitelist status verified:', {
              pubkey: $auth.pubkey.slice(0, 8) + '...',
              isAdmin: whitelistStatus.isAdmin,
              cohorts: whitelistStatus.cohorts,
              source: whitelistStatus.source
            });
          }
        } else {
          set({
            profile: initialProfile,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        console.warn('[User] Failed to verify whitelist status:', error);
        set({
          profile: initialProfile,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load profile'
        });
      }
    };

    loadProfile();
  },
  {
    profile: null,
    isLoading: false,
    error: null
  }
);

/**
 * Derived store for checking if current user is authenticated
 */
export const isAuthenticated: Readable<boolean> = derived(
  authStore,
  $auth => $auth.state === 'authenticated' && $auth.pubkey !== null
);

/**
 * Derived store for checking if current user is admin
 * Uses client-side check (VITE_ADMIN_PUBKEY) for fast UI updates
 */
export const isAdmin: Readable<boolean> = derived(
  userStore,
  $user => $user.profile?.isAdmin ?? false
);

/**
 * Derived store for RELAY-VERIFIED admin status
 * This is the authoritative check - use for privileged operations
 */
export const isAdminVerified: Readable<boolean> = derived(
  whitelistStatusStore,
  $status => $status?.isAdmin ?? false
);

/**
 * Derived store for whitelist verification source
 * Useful for debugging - shows if status came from relay, cache, or fallback
 */
export const whitelistSource: Readable<'relay' | 'cache' | 'fallback' | null> = derived(
  whitelistStatusStore,
  $status => $status?.source ?? null
);

/**
 * Derived store for checking if current user is approved
 */
export const isApproved: Readable<boolean> = derived(
  userStore,
  $user => $user.profile?.isApproved ?? false
);

/**
 * Derived store for current user's pubkey
 */
export const currentPubkey: Readable<string | null> = derived(
  authStore,
  $auth => $auth.pubkey
);

/**
 * Derived store for current user's cohorts
 */
export const currentCohorts: Readable<CohortType[]> = derived(
  userStore,
  $user => $user.profile?.cohorts ?? []
);

/**
 * Derived store for current user's display name
 */
export const currentDisplayName: Readable<string | null> = derived(
  userStore,
  $user => $user.profile?.displayName ?? $user.profile?.name ?? null
);
