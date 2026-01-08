<script lang="ts" generics="T">
  import { onMount, onDestroy, tick } from 'svelte';

  /** Array of items to render */
  export let items: T[] = [];

  /** Height of each item in pixels (fixed for performance) */
  export let itemHeight = 60;

  /** Number of items to render above/below the visible area */
  export let overscan = 3;

  /** Container height (defaults to 100%) */
  export let height: string = '100%';

  /** Unique key function for items */
  export let getKey: (item: T, index: number) => string | number = (_, i) => i;

  /** Whether to reverse the list (for chat-like displays) */
  export let reverse = false;

  /** Callback when scroll reaches top (for loading more) */
  export let onReachTop: (() => void) | undefined = undefined;

  /** Callback when scroll reaches bottom */
  export let onReachBottom: (() => void) | undefined = undefined;

  /** Threshold in pixels for triggering reach callbacks */
  export let reachThreshold = 100;

  let container: HTMLDivElement;
  let scrollTop = 0;
  let containerHeight = 0;
  let resizeObserver: ResizeObserver | null = null;

  // Calculate total height of all items
  $: totalHeight = items.length * itemHeight;

  // Calculate visible range
  $: startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  $: endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Get visible items
  $: visibleItems = items.slice(startIndex, endIndex).map((item, i) => ({
    item,
    index: startIndex + i,
    key: getKey(item, startIndex + i)
  }));

  // Calculate offset for positioning visible items
  $: offsetY = startIndex * itemHeight;

  function handleScroll() {
    if (!container) return;

    scrollTop = container.scrollTop;

    // Check if reached top
    if (onReachTop && scrollTop < reachThreshold) {
      onReachTop();
    }

    // Check if reached bottom
    if (onReachBottom && container.scrollHeight - scrollTop - containerHeight < reachThreshold) {
      onReachBottom();
    }
  }

  function updateContainerHeight() {
    if (container) {
      containerHeight = container.clientHeight;
    }
  }

  /**
   * Scroll to a specific item index
   */
  export function scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    if (!container) return;

    const targetIndex = Math.max(0, Math.min(index, items.length - 1));
    const targetScrollTop = targetIndex * itemHeight;

    container.scrollTo({ top: targetScrollTop, behavior });
  }

  /**
   * Scroll to the top of the list
   */
  export function scrollToTop(behavior: ScrollBehavior = 'auto'): void {
    container?.scrollTo({ top: 0, behavior });
  }

  /**
   * Scroll to the bottom of the list
   */
  export function scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    if (!container) return;
    container.scrollTo({ top: totalHeight, behavior });
  }

  /**
   * Get current scroll position
   */
  export function getScrollTop(): number {
    return scrollTop;
  }

  /**
   * Check if scrolled to bottom (within threshold)
   */
  export function isAtBottom(): boolean {
    if (!container) return false;
    return container.scrollHeight - scrollTop - containerHeight < reachThreshold;
  }

  /**
   * Maintain scroll position after items added at top
   * Call this before adding items, then call restoreScrollPosition after
   */
  let previousScrollHeight = 0;
  export function saveScrollPosition(): void {
    if (container) {
      previousScrollHeight = container.scrollHeight;
    }
  }

  export async function restoreScrollPosition(): Promise<void> {
    if (!container) return;
    await tick();
    const heightDiff = container.scrollHeight - previousScrollHeight;
    container.scrollTop = scrollTop + heightDiff;
  }

  onMount(() => {
    updateContainerHeight();

    resizeObserver = new ResizeObserver(() => {
      updateContainerHeight();
    });

    if (container) {
      resizeObserver.observe(container);
    }

    // Initial scroll to bottom if reverse mode
    if (reverse) {
      tick().then(() => scrollToBottom());
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });
</script>

<div
  bind:this={container}
  class="virtual-list-container overflow-y-auto"
  style="height: {height};"
  on:scroll={handleScroll}
  role="list"
  tabindex="0"
>
  <div
    class="virtual-list-spacer"
    style="height: {totalHeight}px; position: relative;"
  >
    <div
      class="virtual-list-content"
      style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({offsetY}px);"
    >
      {#each visibleItems as { item, index, key } (key)}
        <div
          class="virtual-list-item"
          style="height: {itemHeight}px;"
          role="listitem"
          data-index={index}
        >
          <slot {item} {index} />
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-list-container {
    will-change: transform;
    contain: strict;
  }

  .virtual-list-item {
    contain: layout style;
    box-sizing: border-box;
  }
</style>
