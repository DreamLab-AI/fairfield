/**
 * Backward compatibility layer for NDK
 * Re-exports from relay.ts which is the single source of truth
 *
 * @deprecated Import from '$lib/nostr/relay' instead
 */

import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import { getActiveRelays } from '$lib/stores/settings';
import { relayManager, ndk as getNdkFromRelay, isConnected as isRelayConnected } from './relay';

/**
 * Get NDK instance from relay manager
 */
export function getNDK(): NDK {
	const instance = getNdkFromRelay();

	if (instance) {
		return instance;
	}

	// Fallback for SSR or before connection
	if (!browser) {
		return new NDK({
			explicitRelayUrls: getActiveRelays()
		});
	}

	// Return a temporary instance - should connect via relay manager
	console.warn('NDK not initialized via relay manager. Use connectRelay() from $lib/nostr/relay');
	return new NDK({
		explicitRelayUrls: getActiveRelays()
	});
}

/**
 * Export ndk for compatibility
 */
export const ndk = browser ? getNDK() : new NDK({ explicitRelayUrls: getActiveRelays() });

/**
 * Connect NDK to relays
 * @deprecated Use connectRelay() from '$lib/nostr/relay' instead
 */
export async function connectNDK(): Promise<void> {
	if (!browser) return;

	// This is a simplified wrapper - real apps should use relay manager
	console.warn('connectNDK() is deprecated. Use connectRelay() from $lib/nostr/relay');

	const instance = getNDK();
	if (instance && !isRelayConnected()) {
		await instance.connect();
	}
}

/**
 * Reconnect NDK with updated relay configuration
 * @deprecated Use disconnectRelay() and connectRelay() from '$lib/nostr/relay' instead
 */
export async function reconnectNDK(): Promise<void> {
	if (!browser) return;

	console.warn('reconnectNDK() is deprecated. Use relay manager from $lib/nostr/relay');
	await connectNDK();
}

/**
 * Set a signer for authenticated operations
 * Note: This sets signer on current instance, but relay manager uses its own signer
 */
export function setSigner(privateKey: string): void {
	if (!browser) return;

	const instance = getNDK();
	const signer = new NDKPrivateKeySigner(privateKey);
	instance.signer = signer;
}

/**
 * Clear the current signer (logout)
 */
export function clearSigner(): void {
	if (!browser) return;

	const instance = getNdkFromRelay();
	if (instance) {
		instance.signer = undefined;
	}
}

/**
 * Check if NDK has a signer configured
 */
export function hasSigner(): boolean {
	if (!browser) return false;

	const instance = getNdkFromRelay();
	return instance?.signer !== undefined;
}

/**
 * Get connection status
 * @deprecated Use isConnected() from '$lib/nostr/relay' instead
 */
export function isNDKConnected(): boolean {
	return isRelayConnected();
}

/**
 * Get configured relay URLs
 * @deprecated Use relayManager.getRelayUrls() from '$lib/nostr/relay' instead
 */
export function getRelayUrls(): string[] {
	return relayManager.getRelayUrls();
}
