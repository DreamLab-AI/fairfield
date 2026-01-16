---
title: Mobile UI Components
description: Material Design 3 inspired mobile-optimised components with touch gestures and accessibility
category: features
tags: [mobile, ui, md3, accessibility, touch]
last_updated: 2025-01-15
---

# Mobile UI Components

This document describes the Material Design 3 (MD3) inspired mobile components available for building touch-friendly interfaces.

## Table of Contents

1. [BottomSheet](#bottomsheet)
2. [SwipeableMessage](#swipeablemessage)
3. [VirtualList](#virtuallist)
4. [Accessibility](#accessibility)

---

## BottomSheet

A mobile-friendly modal sheet that slides up from the bottom with snap points and drag gestures.

### Location

`src/lib/components/ui/BottomSheet.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | `false` | Controls visibility |
| `title` | `string` | `''` | Optional header title |
| `snapPoints` | `number[]` | `[0.5, 0.9]` | Height fractions (0-1) |
| `initialSnap` | `number` | `0` | Index of initial snap point |
| `dismissible` | `boolean` | `true` | Allow dismiss via backdrop/swipe |
| `showHandle` | `boolean` | `true` | Show drag handle indicator |

### Events

| Event | Description |
|-------|-------------|
| `close` | Fired when sheet is dismissed |
| `snap` | Fired when sheet snaps to a point |

### Usage

```svelte
<script>
  import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
  let showSheet = false;
</script>

<button on:click={() => showSheet = true}>Open Sheet</button>

<BottomSheet
  bind:open={showSheet}
  title="Select Option"
  snapPoints={[0.4, 0.8]}
  on:close={() => console.log('Closed')}
>
  <p>Sheet content here</p>
</BottomSheet>
```

### Features

- **Snap Points**: Sheet snaps to predefined height fractions
- **Drag to Resize**: Touch and drag the handle to resize
- **Backdrop Blur**: Semi-transparent blurred backdrop
- **Haptic Feedback**: Vibration on snap (where supported)
- **Safe Area Support**: Respects mobile safe areas

---

## SwipeableMessage

A chat message bubble with swipe-to-reply and long-press context menu.

### Location

`src/lib/components/ui/SwipeableMessage.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | required | Message content |
| `timestamp` | `Date \| string` | required | Message timestamp |
| `sender` | `string` | `''` | Sender display name |
| `avatar` | `string` | `''` | Avatar URL |
| `isSent` | `boolean` | `false` | True for outgoing messages |
| `status` | `'sending' \| 'sent' \| 'delivered' \| 'read' \| 'error'` | `'sent'` | Delivery status |
| `swipeThreshold` | `number` | `80` | Pixels to trigger swipe action |
| `enableSwipe` | `boolean` | `true` | Enable swipe gesture |
| `enableLongPress` | `boolean` | `true` | Enable long-press menu |

### Events

| Event | Description |
|-------|-------------|
| `reply` | Swipe or menu reply action |
| `react` | Add reaction |
| `delete` | Delete message |
| `copy` | Copy message text |
| `forward` | Forward message |
| `longpress` | Long-press detected |

### Usage

```svelte
<script>
  import SwipeableMessage from '$lib/components/ui/SwipeableMessage.svelte';
</script>

<SwipeableMessage
  message="Hello, how are you?"
  timestamp={new Date()}
  sender="Alice"
  isSent={false}
  on:reply={() => handleReply()}
  on:react={() => showReactionPicker()}
  on:delete={() => confirmDelete()}
/>
```

### Features

- **Swipe Direction**: Sent messages swipe left, received swipe right
- **Spring Animation**: Smooth physics-based animation
- **Status Indicators**: Animated icons for sending/sent/delivered/read
- **Long-Press Menu**: Context menu with reply, react, copy, forward, delete
- **Haptic Feedback**: Vibration on swipe threshold and long-press

### Status Icons

| Status | Visual |
|--------|--------|
| `sending` | Pulsing dot |
| `sent` | Single tick |
| `delivered` | Double tick |
| `read` | Blue double tick |
| `error` | Warning circle |

---

## VirtualList

A high-performance virtualised list for rendering large datasets efficiently.

### Location

`src/lib/components/ui/VirtualList.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `T[]` | `[]` | Array of items to render |
| `itemHeight` | `number` | `60` | Fixed height per item (pixels) |
| `overscan` | `number` | `3` | Items to render outside viewport |
| `height` | `string` | `'100%'` | Container height |
| `getKey` | `(item: T, index: number) => string \| number` | `(_, i) => i` | Unique key function |
| `reverse` | `boolean` | `false` | Reverse list (chat-style) |
| `onReachTop` | `() => void` | `undefined` | Callback when scrolled to top |
| `onReachBottom` | `() => void` | `undefined` | Callback when scrolled to bottom |
| `reachThreshold` | `number` | `100` | Pixels from edge to trigger callbacks |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `scrollToIndex` | `(index: number, behavior?: ScrollBehavior) => void` | Scroll to specific item |
| `scrollToTop` | `(behavior?: ScrollBehavior) => void` | Scroll to top |
| `scrollToBottom` | `(behavior?: ScrollBehavior) => void` | Scroll to bottom |
| `getScrollTop` | `() => number` | Get current scroll position |
| `isAtBottom` | `() => boolean` | Check if at bottom |
| `saveScrollPosition` | `() => void` | Save position before prepend |
| `restoreScrollPosition` | `() => Promise<void>` | Restore after prepend |

### Usage

```svelte
<script>
  import VirtualList from '$lib/components/ui/VirtualList.svelte';

  let items = Array.from({ length: 10000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
  let virtualList: VirtualList<typeof items[0]>;

  function loadMore() {
    // Load older messages...
  }
</script>

<VirtualList
  bind:this={virtualList}
  {items}
  itemHeight={80}
  height="500px"
  getKey={(item) => item.id}
  onReachTop={loadMore}
  let:item
  let:index
>
  <div class="item">
    {item.text}
  </div>
</VirtualList>

<button on:click={() => virtualList.scrollToBottom('smooth')}>
  Jump to bottom
</button>
```

### Performance Features

- **Windowing**: Only renders visible items plus overscan
- **CSS Containment**: `contain: strict` for paint optimisation
- **Layout Containment**: Items use `contain: layout style`
- **Position Caching**: Efficient transform-based positioning

### Chat Use Case

For chat interfaces with prepended messages:

```svelte
<script>
  async function loadOlderMessages() {
    virtualList.saveScrollPosition();

    const older = await fetchOlderMessages();
    items = [...older, ...items];

    await virtualList.restoreScrollPosition();
  }
</script>

<VirtualList
  bind:this={virtualList}
  {items}
  reverse={true}
  onReachTop={loadOlderMessages}
>
  <!-- message template -->
</VirtualList>
```

---

## Accessibility

All mobile components follow WCAG 2.1 Level AA guidelines:

### BottomSheet

- `role="dialog"` with `aria-modal="true"`
- Focus trapped within sheet when open
- Escape key closes sheet
- Screen reader announces title

### SwipeableMessage

- `role="listitem"` for list context
- `aria-label` describes sender and content
- Long-press menu has `role="menu"` with `role="menuitem"` buttons
- Keyboard accessible via Enter/Space

### VirtualList

- `role="list"` on container
- `role="listitem"` on each item
- `tabindex="0"` for keyboard navigation
- `aria-label="Scrollable list"` for screen readers
- Maintains focus position during virtualisation

---

## Related Documentation

- [Authentication](./authentication.md)
- [Direct Messages Implementation](./dm-implementation.md)
- [Secure Clipboard](./secure-clipboard.md)

---

*Last updated: January 2025*
