/**
 * User Permissions Store
 * Derives user permissions from auth state and whitelist status (SOURCE OF TRUTH)
 */

import { derived } from 'svelte/store';
import { authStore } from './auth';
import { whitelistStatusStore } from './user';
import type { UserPermissions } from '$lib/config/types';

/**
 * Derived store that provides user permissions based on auth state AND whitelist status
 * Returns null if user is not authenticated
 *
 * SECURITY: cohorts are populated from whitelistStatusStore which is relay-verified
 */
export const userPermissionsStore = derived<
	[typeof authStore, typeof whitelistStatusStore],
	UserPermissions | null
>(
	[authStore, whitelistStatusStore],
	([$auth, $whitelistStatus]) => {
		// Not authenticated - return null
		if (!$auth.isAuthenticated || !$auth.pubkey) {
			return null;
		}

		// Get cohorts from relay-verified whitelist status (SOURCE OF TRUTH)
		// whitelistStatusStore is populated by userStore when auth changes
		const cohorts = $whitelistStatus?.cohorts ?? [];
		const isAdmin = $whitelistStatus?.isAdmin ?? false;

		return {
			pubkey: $auth.pubkey,
			cohorts: cohorts,
			globalRole: isAdmin ? 'admin' as const : 'member' as const,
			sectionRoles: [] // Section-specific roles (populated separately if needed)
		};
	}
);

/**
 * Check if user has admin permissions
 */
export const isAdmin = derived(userPermissionsStore, ($permissions) => {
	return $permissions?.globalRole === 'admin';
});

/**
 * Get user's public key from permissions
 */
export const userPubkey = derived(userPermissionsStore, ($permissions) => {
	return $permissions?.pubkey ?? null;
});
