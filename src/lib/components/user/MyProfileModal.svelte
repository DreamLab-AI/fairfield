<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { profileCache } from '$lib/stores/profiles';
	import { encodePubkey, encodePrivkey } from '$lib/nostr/keys';
	import { ndk, isConnected } from '$lib/nostr/relay';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { browser } from '$app/environment';
	import ImageUpload from '$lib/components/ui/ImageUpload.svelte';
	import type { ImageUploadResult } from '$lib/utils/imageUpload';
	import { canInstall, triggerInstall, isPWAInstalled } from '$lib/stores/pwa';
	import { getAppConfig } from '$lib/config/loader';

	const appConfig = getAppConfig();
	const appName = appConfig.name.split(' - ')[0];

	export let open = false;

	let showNsec = false;
	let confirmReveal = false;
	let nsecAutoHideTimer: ReturnType<typeof setTimeout> | null = null;
	const NSEC_AUTO_HIDE_SECONDS = 30;
	let nsecTimeRemaining = NSEC_AUTO_HIDE_SECONDS;
	let copiedNpub = false;
	let copiedNsec = false;
	let editNickname = '';
	let editAvatar = '';
	let editBirthday = '';
	let profileSaved = false;
	let profileSaving = false;
	let profileError: string | null = null;
	let previousFocusElement: HTMLElement | null = null;
	let useImageUpload = false;
	let pwaInstalling = false;

	async function handlePWAInstall() {
		pwaInstalling = true;
		try {
			await triggerInstall();
		} finally {
			pwaInstalling = false;
		}
	}

	function handleAvatarUpload(event: CustomEvent<ImageUploadResult>) {
		const result = event.detail;
		if (result.success && result.url) {
			editAvatar = result.url;
		}
	}

	function handleAvatarError(event: CustomEvent<string>) {
		profileError = event.detail;
	}

	$: npub = $authStore.publicKey ? encodePubkey($authStore.publicKey) : '';
	$: nsec = $authStore.privateKey ? encodePrivkey($authStore.privateKey) : '';

	// Initialize form fields when modal opens
	let lastModalState = false;
	$: if (open && !lastModalState) {
		editNickname = $authStore.nickname || '';
		editAvatar = $authStore.avatar || '';
		editBirthday = '';
		previousFocusElement = document.activeElement as HTMLElement;
		// Load birthday from profile cache
		if (browser && $authStore.publicKey) {
			profileCache.getProfile($authStore.publicKey).then(cached => {
				editBirthday = (cached.profile as any)?.birthday || '';
			});
		}
	}
	$: lastModalState = open;

	function startNsecAutoHideTimer() {
		nsecTimeRemaining = NSEC_AUTO_HIDE_SECONDS;
		nsecAutoHideTimer = setInterval(() => {
			nsecTimeRemaining--;
			if (nsecTimeRemaining <= 0) {
				hideNsec();
			}
		}, 1000);
	}

	function clearNsecTimer() {
		if (nsecAutoHideTimer) {
			clearInterval(nsecAutoHideTimer);
			nsecAutoHideTimer = null;
		}
		nsecTimeRemaining = NSEC_AUTO_HIDE_SECONDS;
	}

	function hideNsec() {
		showNsec = false;
		confirmReveal = false;
		clearNsecTimer();
	}

	function closeModal() {
		open = false;
		hideNsec();
		profileSaved = false;
		if (previousFocusElement) {
			previousFocusElement.focus();
			previousFocusElement = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			closeModal();
		}

		if (e.key === 'Tab' && open) {
			const modal = document.querySelector('.modal.modal-open');
			if (!modal) return;

			const focusableElements = modal.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (e.shiftKey && document.activeElement === firstElement) {
				e.preventDefault();
				lastElement.focus();
			} else if (!e.shiftKey && document.activeElement === lastElement) {
				e.preventDefault();
				firstElement.focus();
			}
		}
	}

	async function saveProfile() {
		if (!$authStore.publicKey || !$authStore.privateKey) {
			profileError = 'Not authenticated';
			return;
		}

		profileSaving = true;
		profileError = null;

		try {
			const ndkInstance = ndk();
			if (!ndkInstance) {
				throw new Error('NDK not connected');
			}

			// Create kind 0 metadata event
			const metadataEvent = new NDKEvent(ndkInstance);
			metadataEvent.kind = 0;
			metadataEvent.content = JSON.stringify({
				name: editNickname || undefined,
				display_name: editNickname || undefined,
				picture: editAvatar || undefined,
				birthday: editBirthday || undefined,
			});

			// Sign and publish to relay
			await metadataEvent.sign();
			await metadataEvent.publish();

			// Update local auth store
			authStore.setProfile(editNickname || null, editAvatar || null);

			// Clear cached profile and force re-fetch with new data
			if ($authStore.publicKey) {
				profileCache.remove($authStore.publicKey);
				// Immediately update the cache with the new profile
				profileCache.updateCurrentUserProfile(
					$authStore.publicKey,
					editNickname || null,
					editAvatar || null
				);
			}

			profileSaved = true;
			setTimeout(() => (profileSaved = false), 3000);
		} catch (error) {
			console.error('Failed to publish profile:', error);
			profileError = error instanceof Error ? error.message : 'Failed to save profile';
		} finally {
			profileSaving = false;
		}
	}

	async function copyToClipboard(text: string, type: 'npub' | 'nsec') {
		await navigator.clipboard.writeText(text);
		if (type === 'npub') {
			copiedNpub = true;
			setTimeout(() => (copiedNpub = false), 2000);
		} else {
			copiedNsec = true;
			setTimeout(() => (copiedNsec = false), 2000);
		}
	}

	function formatKey(key: string): string {
		if (key.length <= 20) return key;
		return key.slice(0, 12) + '...' + key.slice(-8);
	}
</script>

{#if open}
	<div
		class="modal modal-open"
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="profile-modal-title"
	>
		<div class="modal-box max-w-md">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				on:click={closeModal}
				aria-label="Close profile modal"
			>
				X
			</button>
			<h3 id="profile-modal-title" class="font-bold text-lg mb-4">Your Profile</h3>

			<!-- Avatar Preview & Edit -->
			<div class="flex items-center gap-4 mb-4">
				<div class="avatar">
					<div
						class="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center overflow-hidden"
					>
						{#if editAvatar}
							<img src={editAvatar} alt="Avatar" class="w-full h-full object-cover" />
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="w-8 h-8 text-base-content/50"
								><path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/></svg
							>
						{/if}
					</div>
				</div>
				<div class="flex-1">
					<div class="text-sm font-medium mb-1">{editNickname || 'Anonymous'}</div>
					<div class="text-xs text-base-content/60 font-mono">{formatKey(npub)}</div>
				</div>
			</div>

			<!-- Nickname -->
			<div class="form-control mb-3">
				<label class="label py-1" for="profile-nickname-input">
					<span class="label-text font-semibold">Nickname</span>
				</label>
				<input
					id="profile-nickname-input"
					type="text"
					bind:value={editNickname}
					placeholder="Enter a display name"
					class="input input-bordered input-sm"
					maxlength="50"
				/>
			</div>

			<!-- Avatar -->
			<div class="form-control mb-3">
				<label class="label py-1">
					<span class="label-text font-semibold">Avatar</span>
					<button
						class="btn btn-ghost btn-xs"
						on:click={() => (useImageUpload = !useImageUpload)}
					>
						{useImageUpload ? 'Use URL' : 'Upload Image'}
					</button>
				</label>

				{#if useImageUpload}
					<div class="flex justify-center">
						<ImageUpload
							category="avatar"
							currentUrl={editAvatar}
							on:upload={handleAvatarUpload}
							on:error={handleAvatarError}
						/>
					</div>
				{:else}
					<input
						id="profile-avatar-input"
						type="url"
						bind:value={editAvatar}
						placeholder="https://example.com/avatar.jpg"
						class="input input-bordered input-sm"
					/>
					<label class="label py-1" for="profile-avatar-input">
						<span class="label-text-alt text-base-content/60">Direct link to an image</span>
					</label>
				{/if}
			</div>

			<!-- Birthday (Optional) -->
			<div class="form-control mb-4">
				<label class="label py-1" for="profile-birthday-input">
					<span class="label-text font-semibold">Birthday</span>
					<span class="label-text-alt text-base-content/60">Optional</span>
				</label>
				<input
					id="profile-birthday-input"
					type="date"
					bind:value={editBirthday}
					class="input input-bordered input-sm"
				/>
				<label class="label py-1" for="profile-birthday-input">
					<span class="label-text-alt text-base-content/60">Visible to tribe members on the calendar</span>
				</label>
			</div>

			<!-- Error Display -->
			{#if profileError}
				<div class="alert alert-error mb-3 py-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm">{profileError}</span>
				</div>
			{/if}

			<!-- Save Profile Button -->
			<button class="btn btn-primary btn-sm w-full mb-4" on:click={saveProfile} disabled={profileSaving}>
				{#if profileSaving}
					<span class="loading loading-spinner loading-sm"></span>
					Publishing to relay...
				{:else if profileSaved}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="w-4 h-4 text-success"
						><path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/></svg
					>
					Profile Published!
				{:else}
					Save & Publish Profile
				{/if}
			</button>

			<!-- PWA Install Option -->
			{#if $canInstall}
				<div class="alert alert-info mb-4">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
					<div class="flex-1">
						<p class="font-semibold text-sm">Install {appName}</p>
						<p class="text-xs opacity-80">Get offline access and faster loading</p>
					</div>
					<button
						class="btn btn-sm btn-primary"
						on:click={handlePWAInstall}
						disabled={pwaInstalling}
					>
						{#if pwaInstalling}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Install
						{/if}
					</button>
				</div>
			{:else if $isPWAInstalled}
				<div class="flex items-center gap-2 text-sm text-success mb-4 px-2">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
						<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<span>App installed</span>
				</div>
			{/if}

			<div class="divider my-2"></div>

			<!-- npub (always visible) -->
			<div class="form-control mb-4">
				<label class="label" for="profile-npub-input">
					<span class="label-text font-semibold">Public Key (npub)</span>
					<div
						class="tooltip tooltip-left"
						data-tip="Your public key is safe to share with anyone. It's how others find and message you."
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="w-5 h-5 text-info cursor-help"
						>
							<path
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
				</label>
				<div class="flex gap-2">
					<input
						id="profile-npub-input"
						type="text"
						readonly
						value={formatKey(npub)}
						class="input input-bordered flex-1 font-mono text-sm"
					/>
					<button
						class="btn btn-square btn-outline"
						on:click={() => copyToClipboard(npub, 'npub')}
						title="Copy full npub"
					>
						{#if copiedNpub}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="w-5 h-5 text-success"
								><path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/></svg
							>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="w-5 h-5"
								><path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/></svg
							>
						{/if}
					</button>
				</div>
				<label class="label" for="profile-npub-input">
					<span class="label-text-alt text-success">Safe to share - this is how others find you</span
					>
				</label>
			</div>

			<!-- nsec (hidden by default) -->
			<div class="form-control">
				<label class="label" for="profile-nsec-input">
					<span class="label-text font-semibold">Private Key (nsec)</span>
					<div
						class="tooltip tooltip-left"
						data-tip="Your private key controls your identity. NEVER share it with anyone. Anyone with it can impersonate you permanently."
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="w-5 h-5 text-error cursor-help"
						>
							<path
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
				</label>

				{#if !showNsec}
					<!-- Warning shown BEFORE reveal -->
					<div class="alert alert-error mb-3">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="stroke-current shrink-0 h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/></svg
						>
						<div class="text-sm">
							<p class="font-bold">NEVER share your private key!</p>
							<p>Anyone with it controls your identity permanently.</p>
						</div>
					</div>
					<div class="form-control mb-3">
						<label class="label cursor-pointer justify-start gap-3 py-2">
							<input type="checkbox" class="checkbox checkbox-error" bind:checked={confirmReveal} />
							<span class="label-text text-sm"
								>I understand the risk and want to reveal my private key</span
							>
						</label>
					</div>
					<button
						class="btn btn-outline btn-error btn-sm w-full"
						on:click={() => {
							showNsec = true;
							startNsecAutoHideTimer();
						}}
						disabled={!confirmReveal}
					>
						Reveal Private Key
					</button>
				{:else}
					<!-- Key is revealed -->
					<div class="alert alert-warning mb-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="stroke-current shrink-0 h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/></svg
						>
						<div class="flex-1">
							<span class="text-sm font-semibold">Your private key is now visible. Never share it!</span>
							<div class="text-xs opacity-80 mt-1">
								Auto-hiding in <span class="font-mono font-bold">{nsecTimeRemaining}s</span>
							</div>
						</div>
					</div>
					<div class="flex gap-2 mb-2">
						<input
							type="text"
							readonly
							value={formatKey(nsec)}
							class="input input-bordered input-error flex-1 font-mono text-sm"
						/>
						<button
							class="btn btn-square btn-outline btn-warning"
							on:click={() => copyToClipboard(nsec, 'nsec')}
							title="Copy full nsec"
						>
							{#if copiedNsec}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									class="w-5 h-5 text-success"
									><path
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/></svg
								>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									class="w-5 h-5"
									><path
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/></svg
								>
							{/if}
						</button>
						<button
							class="btn btn-square btn-outline"
							on:click={hideNsec}
							title="Hide private key"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="w-5 h-5"
								><path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/></svg
							>
						</button>
					</div>
				{/if}
			</div>
		</div>
		<div class="modal-backdrop" on:click={closeModal} aria-hidden="true"></div>
	</div>
{/if}
