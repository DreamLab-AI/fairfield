<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { nip19 } from 'nostr-tools';
	import { connectNDK, getNDK } from '$lib/nostr/ndk';
	import { formatRelativeTime } from '$lib/nostr/events';
	import UserDisplay from '$lib/components/user/UserDisplay.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { profileCache } from '$lib/stores/profiles';
	import { getAvatarUrl } from '$lib/utils/identicon';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	$: noteId = $page.params.noteId;

	let loading = true;
	let error: string | null = null;
	let event: NDKEvent | null = null;
	let authorProfile: { displayName?: string; avatar?: string | null; about?: string | null; nip05?: string | null } | null = null;

	onMount(async () => {
		await loadNote();
	});

	async function loadNote() {
		loading = true;
		error = null;

		try {
			// Decode noteId - could be note1... or hex
			let eventId: string;

			if (noteId.startsWith('note1')) {
				try {
					const decoded = nip19.decode(noteId);
					if (decoded.type !== 'note') {
						throw new Error('Invalid note format');
					}
					eventId = decoded.data as string;
				} catch {
					throw new Error('Invalid note ID format');
				}
			} else if (noteId.startsWith('nevent1')) {
				try {
					const decoded = nip19.decode(noteId);
					if (decoded.type !== 'nevent') {
						throw new Error('Invalid nevent format');
					}
					eventId = (decoded.data as { id: string }).id;
				} catch {
					throw new Error('Invalid nevent format');
				}
			} else if (/^[0-9a-f]{64}$/i.test(noteId)) {
				eventId = noteId.toLowerCase();
			} else {
				throw new Error('Invalid note ID format. Expected note1..., nevent1..., or hex event ID');
			}

			// Connect to NDK
			await connectNDK();
			const ndk = getNDK();

			// Fetch the event
			const events = await ndk.fetchEvents({
				ids: [eventId]
			});

			const fetchedEvent = Array.from(events)[0];

			if (!fetchedEvent) {
				throw new Error('Note not found');
			}

			event = fetchedEvent;

			// Fetch author profile
			profileCache.getProfile(fetchedEvent.pubkey);
			profileCache.subscribe(($cache) => {
				const profile = $cache.profiles.get(fetchedEvent.pubkey);
				if (profile) {
					authorProfile = profile;
				}
			});
		} catch (e) {
			console.error('Error loading note:', e);
			error = e instanceof Error ? e.message : 'Failed to load note';
		} finally {
			loading = false;
		}
	}

	function handleQuickBrowse() {
		goto(`${base}/login`);
	}

	function handleFullSignup() {
		goto(`${base}/signup`);
	}

	$: displayName = authorProfile?.displayName || (event?.pubkey ? truncatePubkey(event.pubkey) : 'Unknown');
	$: avatarUrl = authorProfile?.avatar || (event?.pubkey ? getAvatarUrl(event.pubkey, 80) : '');

	function truncatePubkey(pk: string): string {
		if (pk.length <= 16) return pk;
		return `${pk.slice(0, 8)}...${pk.slice(-4)}`;
	}

	function formatContent(content: string): string {
		return content;
	}
</script>

<svelte:head>
	<title>{event ? `Note by ${displayName}` : 'View Note'} - Fairfield</title>
	<meta name="description" content={event?.content?.slice(0, 160) || 'View this post on Fairfield'} />
</svelte:head>

<div class="min-h-screen bg-base-200 gradient-mesh flex flex-col">
	<!-- Simple header -->
	<header class="bg-base-100 border-b border-base-300 py-4">
		<div class="container mx-auto px-4 max-w-2xl">
			<a href="{base}/" class="text-xl font-bold text-primary hover:opacity-80 transition-opacity">
				Fairfield
			</a>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 container mx-auto px-4 py-8 max-w-2xl">
		{#if loading}
			<div class="flex justify-center items-center py-20">
				<div class="loading loading-spinner loading-lg text-primary"></div>
			</div>
		{:else if error}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body text-center">
					<div class="text-error mb-4">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold mb-2">Unable to load note</h2>
					<p class="text-base-content/70 mb-6">{error}</p>
					<div class="flex flex-col sm:flex-row gap-3 justify-center">
						<button class="btn btn-primary" on:click={handleFullSignup}>
							Sign Up
						</button>
						<button class="btn btn-ghost" on:click={() => goto(`${base}/`)}>
							Go Home
						</button>
					</div>
				</div>
			</div>
		{:else if event}
			<!-- Note card -->
			<div class="card bg-base-100 shadow-xl mb-6">
				<div class="card-body">
					<!-- Author info -->
					<div class="flex items-center gap-3 mb-4">
						<Avatar
							src={avatarUrl}
							pubkey={event.pubkey}
							size="md"
							alt={displayName}
						/>
						<div class="flex-1 min-w-0">
							<p class="font-semibold truncate">{displayName}</p>
							{#if authorProfile?.nip05}
								<p class="text-sm text-base-content/60 flex items-center gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
									</svg>
									{authorProfile.nip05}
								</p>
							{/if}
						</div>
						<div class="text-sm text-base-content/60">
							{formatRelativeTime(event.created_at || 0)}
						</div>
					</div>

					<!-- Note content -->
					<div class="prose prose-sm max-w-none">
						<p class="whitespace-pre-wrap text-base leading-relaxed">{formatContent(event.content)}</p>
					</div>

					<!-- Timestamp -->
					<div class="mt-4 pt-4 border-t border-base-200 text-sm text-base-content/60">
						{new Date((event.created_at || 0) * 1000).toLocaleString(undefined, {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							hour: 'numeric',
							minute: '2-digit'
						})}
					</div>
				</div>
			</div>

			<!-- Signup CTA -->
			<div class="card bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
				<div class="card-body text-center">
					<h3 class="text-xl font-bold mb-2">Join the conversation</h3>
					<p class="text-base-content/70 mb-6">
						Connect with the community on Fairfield. Reply to posts, share your thoughts, and discover more content.
					</p>

					<div class="flex flex-col sm:flex-row gap-3 justify-center">
						<button
							class="btn btn-primary btn-lg"
							on:click={handleFullSignup}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
							</svg>
							Create Account
						</button>

						<button
							class="btn btn-outline btn-lg"
							on:click={handleQuickBrowse}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
							</svg>
							Sign In
						</button>
					</div>

					<p class="text-xs text-base-content/50 mt-4">
						Fairfield uses the Nostr protocol - your identity is portable and you control your data.
					</p>
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="bg-base-100 border-t border-base-300 py-4">
		<div class="container mx-auto px-4 max-w-2xl text-center text-sm text-base-content/60">
			<p>Powered by Nostr - Decentralized social networking</p>
		</div>
	</footer>
</div>
