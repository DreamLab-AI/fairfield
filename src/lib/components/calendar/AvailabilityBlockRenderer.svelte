<script lang="ts">
	import type { AvailabilityBlock, CalendarBlockType } from '$lib/config/types';
	import type { UserPermissions } from '$lib/config/types';
	import { getVisibleBlockInfo, getMostRestrictiveBlockType } from '$lib/utils/calendar-visibility';

	// Props
	export let blocks: AvailabilityBlock[] = [];
	export let userPermissions: UserPermissions | undefined = undefined;
	export let variant: 'dot' | 'bar' | 'full' = 'dot';
	export let showLabel = false;
	export let maxBlocks = 3;
	export let onClick: ((block: AvailabilityBlock) => void) | undefined = undefined;

	// Get visible block info with permission filtering
	$: visibleBlocks = blocks.map(block => {
		if (!userPermissions) return block;
		return getVisibleBlockInfo(block, userPermissions) as AvailabilityBlock;
	});

	// Get most restrictive block type for styling
	$: mostRestrictiveType = getMostRestrictiveBlockType(blocks);

	// Get status message based on block type
	function getStatusMessage(blockType: CalendarBlockType | null): string {
		switch (blockType) {
			case 'hard':
				return 'House unavailable';
			case 'soft':
				return 'Reduced capacity';
			case 'tentative':
				return 'Guests may be present';
			default:
				return 'Available';
		}
	}

	// Get status class based on block type
	function getStatusClass(blockType: CalendarBlockType | null): string {
		switch (blockType) {
			case 'hard':
				return 'status-unavailable';
			case 'soft':
				return 'status-reduced';
			case 'tentative':
				return 'status-tentative';
			default:
				return 'status-available';
		}
	}

	// Format time for display
	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	// Format time range
	function formatTimeRange(start: number, end: number): string {
		return `${formatTime(start)} - ${formatTime(end)}`;
	}

	// Handle block click
	function handleBlockClick(block: AvailabilityBlock) {
		if (onClick) {
			onClick(block);
		}
	}
</script>

{#if blocks.length === 0}
	<!-- No blocks - don't render anything -->
{:else if variant === 'dot'}
	<!-- Dot variant - small coloured dots for mini calendar -->
	<div class="block-dots">
		{#each visibleBlocks.slice(0, maxBlocks) as block}
			<button
				class="block-dot"
				style="--block-color: {block.displayColour}"
				on:click|stopPropagation={() => handleBlockClick(block)}
				title={block.label || getStatusMessage(block.blockType)}
				aria-label={block.label || getStatusMessage(block.blockType)}
			/>
		{/each}
		{#if blocks.length > maxBlocks}
			<span class="block-overflow">+{blocks.length - maxBlocks}</span>
		{/if}
	</div>
{:else if variant === 'bar'}
	<!-- Bar variant - horizontal bar with colour gradient -->
	<div class="block-bar {getStatusClass(mostRestrictiveType)}">
		<div
			class="block-bar-fill"
			style="background-color: {blocks[0]?.displayColour || '#6b7280'}"
		/>
		{#if showLabel}
			<span class="block-bar-label">
				{getStatusMessage(mostRestrictiveType)}
			</span>
		{/if}
	</div>
{:else if variant === 'full'}
	<!-- Full variant - detailed block cards -->
	<div class="block-list">
		{#each visibleBlocks as block}
			<button
				class="block-card {getStatusClass(block.blockType)}"
				style="--block-color: {block.displayColour}"
				on:click|stopPropagation={() => handleBlockClick(block)}
				aria-label={block.label || getStatusMessage(block.blockType)}
			>
				<div class="block-indicator" />
				<div class="block-content">
					<div class="block-time">{formatTimeRange(block.start, block.end)}</div>
					{#if block.label}
						<div class="block-label">{block.label}</div>
					{/if}
					{#if block.reason}
						<div class="block-reason">{block.reason}</div>
					{/if}
					{#if !block.label && !block.reason}
						<div class="block-status">{getStatusMessage(block.blockType)}</div>
					{/if}
				</div>
				{#if block.blockType === 'hard'}
					<div class="block-badge unavailable">Unavailable</div>
				{:else if block.blockType === 'soft'}
					<div class="block-badge reduced">Reduced</div>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Dot variant */
	.block-dots {
		display: flex;
		gap: 2px;
		align-items: center;
	}

	.block-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--block-color, #6b7280);
		border: none;
		padding: 0;
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	.block-dot:hover {
		transform: scale(1.3);
	}

	.block-overflow {
		font-size: 0.625rem;
		color: #6b7280;
		font-weight: 500;
		margin-left: 2px;
	}

	/* Bar variant */
	.block-bar {
		position: relative;
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: #e5e7eb;
	}

	.block-bar-fill {
		position: absolute;
		inset: 0;
		border-radius: 2px;
	}

	.block-bar-label {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.625rem;
		font-weight: 600;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		white-space: nowrap;
	}

	/* Full variant */
	.block-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.block-card {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px;
		border-radius: 6px;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.block-card:hover {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
		transform: translateY(-1px);
	}

	.block-indicator {
		width: 4px;
		min-height: 32px;
		border-radius: 2px;
		background-color: var(--block-color, #6b7280);
		flex-shrink: 0;
	}

	.block-content {
		flex: 1;
		min-width: 0;
	}

	.block-time {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		font-family: 'Courier New', monospace;
	}

	.block-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #111827;
		margin-top: 2px;
	}

	.block-reason {
		font-size: 0.75rem;
		color: #4b5563;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.block-status {
		font-size: 0.75rem;
		color: #6b7280;
		font-style: italic;
		margin-top: 2px;
	}

	.block-badge {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		flex-shrink: 0;
	}

	.block-badge.unavailable {
		background: #991b1b;
		color: white;
	}

	.block-badge.reduced {
		background: #c2410c;
		color: white;
	}

	/* Status classes */
	.status-unavailable {
		--status-color: #991b1b;
	}

	.status-reduced {
		--status-color: #c2410c;
	}

	.status-tentative {
		--status-color: #6366f1;
	}

	.status-available {
		--status-color: #10b981;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.block-card {
			background: #1f2937;
			border-color: #374151;
		}

		.block-label {
			color: #f9fafb;
		}

		.block-reason {
			color: #d1d5db;
		}

		.block-status {
			color: #9ca3af;
		}

		.block-bar {
			background: #374151;
		}

		.block-overflow {
			color: #9ca3af;
		}
	}
</style>
