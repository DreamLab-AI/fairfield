<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import DOMPurify from 'dompurify';
	import { fetchPreview, getCachedPreview, type LinkPreviewData } from '$lib/stores/linkPreviews';
	import { getDomain, getFaviconUrl } from '$lib/utils/linkPreview';

	export let url: string;

	let preview: LinkPreviewData | null = null;
	let loading = true;
	let error = false;
	let element: HTMLElement;
	let isVisible = false;
	let twitterContainer: HTMLElement;

	// Load Twitter widgets script when needed
	function loadTwitterWidgets() {
		if (typeof window !== 'undefined' && !(window as Window & { twttr?: unknown }).twttr) {
			const script = document.createElement('script');
			script.src = 'https://platform.twitter.com/widgets.js';
			script.async = true;
			script.charset = 'utf-8';
			document.head.appendChild(script);
		}
	}

	// Render Twitter embed HTML with sanitization
	function renderTwitterEmbed() {
		if (preview?.type === 'twitter' && preview.html && twitterContainer) {
			// Sanitize the Twitter embed HTML to prevent XSS attacks
			// Twitter oEmbed HTML is generally trusted, but defense-in-depth requires sanitization
			const sanitizedHtml = DOMPurify.sanitize(preview.html, {
				ALLOWED_TAGS: ['blockquote', 'a', 'p', 'br', 'script'],
				ALLOWED_ATTR: ['class', 'href', 'data-*'],
				FORCE_BODY: false,
				KEEP_CONTENT: true,
			});
			twitterContainer.innerHTML = sanitizedHtml;
			// Tell Twitter to process the new embed
			if (typeof window !== 'undefined') {
				const twttr = (window as Window & { twttr?: { widgets?: { load?: (el?: HTMLElement) => void } } }).twttr;
				if (twttr?.widgets?.load) {
					twttr.widgets.load(twitterContainer);
				}
			}
		}
	}

	afterUpdate(() => {
		if (preview?.type === 'twitter' && preview.html) {
			loadTwitterWidgets();
			renderTwitterEmbed();
		}
	});

	// Lazy load preview using intersection observer
	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !isVisible) {
						isVisible = true;
						loadPreview();
					}
				});
			},
			{ rootMargin: '100px' }
		);

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	});

	async function loadPreview() {
		// Check cache first
		const cached = getCachedPreview(url);
		if (cached) {
			preview = cached;
			loading = false;
			error = cached.error || false;
			return;
		}

		// Fetch preview
		try {
			preview = await fetchPreview(url);
			error = preview.error || false;
		} catch (err) {
			console.error('Failed to load preview:', err);
			error = true;
			preview = {
				url,
				domain: getDomain(url),
				favicon: getFaviconUrl(url),
				error: true,
			};
		} finally {
			loading = false;
		}
	}

	function openLink() {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<div bind:this={element} class="link-preview" role="button" tabindex="0" aria-label="Open link in new tab" on:click={openLink} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openLink())}>
	{#if loading}
		<!-- Loading skeleton -->
		<div class="preview-skeleton">
			<div class="skeleton-image"></div>
			<div class="skeleton-content">
				<div class="skeleton-title"></div>
				<div class="skeleton-description"></div>
				<div class="skeleton-domain"></div>
			</div>
		</div>
	{:else if preview?.type === 'twitter' && preview.html}
		<!-- Twitter/X embed -->
		<div class="twitter-embed" bind:this={twitterContainer} on:click|stopPropagation on:keydown|stopPropagation>
			<!-- Twitter widget will be rendered here -->
		</div>
	{:else if error || !preview?.title}
		<!-- Error state or minimal preview - just show link -->
		<div class="preview-minimal">
			{#if preview?.favicon}
				<img src={preview.favicon} alt="" class="favicon" />
			{/if}
			<div class="link-text">
				<div class="domain">{preview?.domain || getDomain(url)}</div>
				<div class="url" title={url}>{url}</div>
			</div>
			<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<polyline points="15 3 21 3 21 9" />
				<line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</div>
	{:else}
		<!-- Full preview card -->
		<div class="preview-card">
			{#if preview.image}
				<div class="preview-image-container">
					<img src={preview.image} alt={preview.title || ''} class="preview-image" loading="lazy" />
				</div>
			{/if}
			<div class="preview-content">
				<div class="preview-header">
					{#if preview.favicon}
						<img src={preview.favicon} alt="" class="favicon" />
					{/if}
					<span class="domain">{preview.siteName || preview.domain}</span>
				</div>
				<h4 class="preview-title">{preview.title}</h4>
				{#if preview.description}
					<p class="preview-description">{preview.description}</p>
				{/if}
			</div>
			<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<polyline points="15 3 21 3 21 9" />
				<line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.link-preview {
		margin-top: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.link-preview:hover {
		transform: translateY(-1px);
	}

	.link-preview:active {
		transform: translateY(0);
	}

	.preview-skeleton {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: oklch(var(--b2));
		border: 1px solid oklch(var(--b3));
		border-radius: 0.5rem;
	}

	.skeleton-image {
		width: 100px;
		height: 100px;
		background: linear-gradient(90deg, oklch(var(--b3)) 0%, oklch(var(--b2)) 50%, oklch(var(--b3)) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.375rem;
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.skeleton-title,
	.skeleton-description,
	.skeleton-domain {
		background: linear-gradient(90deg, oklch(var(--b3)) 0%, oklch(var(--b2)) 50%, oklch(var(--b3)) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.25rem;
	}

	.skeleton-title {
		height: 1.25rem;
		width: 70%;
	}

	.skeleton-description {
		height: 0.875rem;
		width: 100%;
	}

	.skeleton-domain {
		height: 0.75rem;
		width: 40%;
		margin-top: auto;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.preview-minimal {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: oklch(var(--b2));
		border: 1px solid oklch(var(--b3));
		border-radius: 0.5rem;
		transition: border-color 0.2s ease;
	}

	.preview-minimal:hover {
		border-color: oklch(var(--p));
	}

	.link-text {
		flex: 1;
		min-width: 0;
	}

	.domain {
		font-size: 0.75rem;
		color: oklch(var(--bc) / 0.6);
		font-weight: 500;
	}

	.url {
		font-size: 0.875rem;
		color: oklch(var(--bc));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: oklch(var(--b2));
		border: 1px solid oklch(var(--b3));
		border-radius: 0.5rem;
		overflow: hidden;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.preview-card:hover {
		border-color: oklch(var(--p));
		box-shadow: 0 4px 12px oklch(var(--bc) / 0.1);
	}

	.preview-image-container {
		width: 100%;
		max-height: 200px;
		overflow: hidden;
		background: oklch(var(--b3));
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.preview-content {
		padding: 0.75rem;
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.favicon {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	.preview-title {
		margin: 0 0 0.375rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: oklch(var(--bc));
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.preview-description {
		margin: 0;
		font-size: 0.8125rem;
		color: oklch(var(--bc) / 0.7);
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.external-icon {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 18px;
		height: 18px;
		color: oklch(var(--bc) / 0.6);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.preview-card:hover .external-icon,
	.preview-minimal:hover .external-icon {
		opacity: 1;
	}

	.preview-minimal .external-icon {
		position: static;
		flex-shrink: 0;
	}

	/* Twitter/X embed container */
	.twitter-embed {
		background: oklch(var(--b2));
		border: 1px solid oklch(var(--b3));
		border-radius: 0.75rem;
		overflow: hidden;
		padding: 1rem;
	}

	.twitter-embed :global(blockquote) {
		margin: 0;
		color: oklch(var(--bc));
	}

	.twitter-embed :global(a) {
		color: oklch(var(--p));
	}
</style>
