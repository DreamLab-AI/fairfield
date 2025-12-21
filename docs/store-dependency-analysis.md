# nostr-BBS Store Dependency Graph Analysis

## Executive Summary

**Critical Issues Found:**
1. **CIRCULAR DEPENDENCY**: `channelStore.ts` ↔ `auth.ts` (lazy initialization workaround exists but fragile)
2. **Multiple overlapping channel stores**: `channels.ts` and `channelStore.ts` serve similar purposes
3. **State synchronization issues**: Profile data duplicated across `auth`, `user`, and `profiles` stores
4. **Initialization race conditions**: NDK initialization vs. store initialization ordering not guaranteed

## Store Inventory (28 stores)

### Core Authentication & User Management
- **auth.ts** - Primary authentication state (pubkey, privateKey, isAuthenticated)
- **user.ts** - User profile derived from auth + relay verification
- **session.ts** - Session timeout management
- **profiles.ts** - Profile cache for all users (NDK-based)

### Channel Management (DUPLICATE FUNCTIONALITY)
- **channels.ts** - NIP-29 channel store with cohort filtering
- **channelStore.ts** - Generic channel store with message storage
  - **ISSUE**: Both stores manage channels but with different data models

### Message & Content Stores
- **messages.ts** - Message management with relay subscriptions
- **pinnedMessages.ts** - Pinned message management
- **dm.ts** - Direct messages
- **reactions.ts** - Message reactions
- **reply.ts** - Reply composition state
- **drafts.ts** - Message drafts

### Admin & Moderation
- **admin.ts** - Admin dashboard state (pending requests, users, channels)
- **sections.ts** - Section access control

### UI & Application State
- **ndk.ts** - NDK instance store (relay connection)
- **settings.ts** - User settings
- **preferences.ts** - User preferences
- **bookmarks.ts** - Bookmarked messages
- **mute.ts** - Muted users
- **readPosition.ts** - Read position tracking
- **notifications.ts** - Notification management
- **toast.ts** - Toast notifications
- **confirm.ts** - Confirmation dialogs
- **pwa.ts** - PWA state
- **setup.ts** - Setup wizard state
- **linkPreviews.ts** - Link preview cache
- **channelStats.ts** - Channel statistics

## Dependency Graph

### Level 0: Foundation Stores (No Dependencies)
```
ndk.ts (NDK instance)
toast.ts (UI notifications)
confirm.ts (UI dialogs)
pwa.ts (PWA state)
session.ts (session timeout - independent)
```

### Level 1: Core Authentication
```
auth.ts
├── Imports: NONE from other stores
├── Exports: authStore, isAuthenticated, isAdmin, isReady
└── Used by: user.ts, channelStore.ts, messages.ts, profiles.ts, pinnedMessages.ts, sections.ts
```

### Level 2: User & Profile Management
```
user.ts
├── Imports: authStore (from auth.ts), profileCache (from profiles.ts)
├── Exports: userStore, isAuthenticated, isAdmin, isAdminVerified, whitelistStatusStore
└── Creates: CIRCULAR RISK with profiles.ts

profiles.ts
├── Imports: ndkStore (from ndk.ts), authStore (from auth.ts)
├── Exports: profileCache, createProfileStore()
└── Used by: user.ts, messages.ts
```

### Level 3: Channel Stores (PROBLEMATIC)
```
channels.ts
├── Imports: NONE from stores (standalone)
├── Exports: channelStore, fetchChannels(), derived stores
└── NOTE: Completely independent NIP-29 implementation

channelStore.ts (DUPLICATE/LEGACY)
├── Imports: auth.ts (LAZY via dynamic import to avoid circular)
├── Exports: channelStore, selectedChannel, selectedMessages, userMemberStatus
└── ISSUE: Lazy initialization of derived stores to avoid circular dependency
```

### Level 4: Messages & Content
```
messages.ts
├── Imports: currentPubkey (from user.ts), toast (from toast.ts)
├── Exports: messageStore, activeMessages, messageCount
└── DEPENDENCY: Requires user.ts which requires auth.ts

pinnedMessages.ts
├── Imports: isAdmin (from user.ts), ndk (from relay - NOT from ndk.ts store)
├── Exports: pinnedStore, getPinnedForChannel(), isPinnedMessage()
└── NOTE: Imports NDK functions directly, not via store
```

### Level 5: Admin & Moderation
```
admin.ts
├── Imports: NONE from stores
├── Exports: adminStore, pendingRequestsByChannel, usersByCohort
└── NOTE: Independent but could benefit from user.ts integration

sections.ts
├── Imports: currentPubkey, isAdminVerified (from user.ts), notificationStore
├── Exports: sectionStore, accessibleSections, pendingSections
└── DEPENDENCY: Requires user.ts for admin verification
```

## Circular Dependencies

### 🔴 CRITICAL: channelStore.ts ↔ auth.ts

**The Problem:**
```typescript
// channelStore.ts line 139-154
export function getUserMemberStatus(): Readable<MemberStatus> {
  if (!_userMemberStatus) {
    // Dynamic import to avoid circular dependency
    import('./auth').then(({ authStore }) => {
      // Creates derived store from authStore
      _userMemberStatus = derived([selChan, authStore], ...)
    });
    // Returns temporary store while async import resolves
    return writable<MemberStatus>('non-member');
  }
  return _userMemberStatus;
}
```

**Why It's Fragile:**
1. Returns different store instances on first vs. subsequent calls
2. Subscribers may miss initial state updates during async import
3. No guarantee the import completes before store is used
4. Race condition if called before async import resolves

**Root Cause:**
- `channelStore.ts` needs `authStore.publicKey` to determine user membership
- But multiple files import both, creating initialization order issues

### 🟡 POTENTIAL: user.ts ↔ profiles.ts

**Current State:**
```typescript
// user.ts imports from profiles.ts
import { profileCache } from './profiles';

// profiles.ts imports from auth.ts
import { authStore } from './auth';

// user.ts ALSO imports from auth.ts
import { authStore } from './auth';
```

**Why It's Not Currently Circular:**
- Both import from `auth.ts` (common dependency)
- `user.ts` imports `profileCache` from `profiles.ts` (one-way)
- `profiles.ts` does NOT import from `user.ts` (avoids cycle)

**Risk:**
- If `profiles.ts` ever needs user cohort info or admin status, circular dependency would form

## State Synchronization Issues

### 1. Profile Data Duplication

**Three Sources of Profile Data:**
```typescript
// auth.ts (lines 13-15)
nickname: string | null;
avatar: string | null;

// user.ts (lines 23-26)
name: string | null;
displayName: string | null;
avatar: string | null;

// profiles.ts (lines 12-20)
profile: NDKUserProfile | null;
displayName: string;
avatar: string | null;
```

**Inconsistency:**
- `auth.ts` stores local nickname/avatar in localStorage
- `user.ts` fetches from relay and merges with auth data
- `profiles.ts` caches relay data independently
- **Result**: Three different versions of "user display name" exist simultaneously

### 2. Admin Status Confusion

**Four Ways to Check Admin:**
```typescript
// auth.ts line 103-109
function isAdminPubkey(pubkey: string): boolean

// auth.ts line 395
export const isAdmin = derived(authStore, $auth => $auth.isAdmin);

// user.ts line 196-199
export const isAdmin: Readable<boolean> = derived(userStore, ...);

// user.ts line 204-208
export const isAdminVerified: Readable<boolean> = derived(whitelistStatusStore, ...);
```

**Problem:**
- `auth.ts` exports `isAdmin` (client-side check against VITE_ADMIN_PUBKEY)
- `user.ts` ALSO exports `isAdmin` (from relay verification)
- **Name collision**: Both files export `isAdmin` with different semantics
- Components importing `isAdmin` may get wrong one depending on import order

### 3. Channel Data Split

**Two Incompatible Channel Models:**

```typescript
// channels.ts (NIP-29 compliant)
interface Channel {
  id: string;              // 'd' tag value (group ID)
  cohorts: ('business' | 'moomaa-tribe')[];
  section: ChannelSection;
  visibility: ChannelVisibility;
  isMember: boolean;
  hasRequestPending: boolean;
}

// channelStore.ts (legacy/generic)
interface Channel {
  id: string;
  admins: string[];
  members: string[];
  pendingRequests: string[];
}
```

**Incompatibility:**
- Different field names (`cohorts` vs `members`)
- Different visibility models (`visibility` field vs `admins` array)
- Different member tracking (`isMember` boolean vs `members` array)
- **Components must choose one model and stick with it**

## Store Initialization Order Issues

### Problem: NDK Must Initialize Before Stores Use It

**Current State:**
```typescript
// ndk.ts - Creates store but doesn't auto-initialize
const { subscribe, set } = writable<NDK | null>(null);
const init = async () => { /* connects to relays */ };

// messages.ts - Assumes NDK is ready
await subscribeToRelay(relayUrl, [filter], async (event) => {
  // Will fail if NDK not initialized
});
```

**Missing Initialization Guarantees:**
1. No central initialization orchestrator
2. Stores don't wait for NDK to be ready
3. Components may render before stores are initialized
4. No loading state coordination across stores

### Recommended Initialization Sequence

```typescript
// Ideal initialization order
1. ndk.init()              // Connect to relays
2. authStore.waitForReady() // Restore session
3. userStore (auto-derives) // Load user profile
4. channelStore.fetchChannels() // Load channels
5. UI components render
```

**Current Reality:**
- Each component independently tries to initialize what it needs
- Race conditions possible
- No global "app ready" state

## Stores That Should Be Combined

### 1. Merge `channels.ts` and `channelStore.ts`

**Recommendation:** Use `channels.ts` as the single source of truth

**Reasoning:**
- `channels.ts` is NIP-29 compliant
- `channelStore.ts` is legacy with simpler model
- Maintaining both creates confusion and bugs

**Migration Path:**
1. Audit all imports of `channelStore.ts`
2. Migrate to `channels.ts` API
3. Delete `channelStore.ts`
4. Update tests

### 2. Consolidate Admin Checks in `user.ts`

**Recommendation:** Remove `isAdmin` export from `auth.ts`, keep only in `user.ts`

**Reasoning:**
- Client-side check (`auth.ts`) is for UI only
- Relay-verified check (`user.ts`) is source of truth
- Having both creates import confusion

**Migration Path:**
```typescript
// auth.ts - Remove export
// export const isAdmin = derived(...);  // DELETE THIS

// user.ts - Keep both
export const isAdmin = ...;           // UI convenience
export const isAdminVerified = ...;   // Source of truth
```

### 3. Unify Profile Data in `profiles.ts`

**Recommendation:** Make `profiles.ts` the single profile cache, remove duplication

**Current Duplication:**
- `auth.ts` stores nickname/avatar in localStorage
- `user.ts` fetches from relay
- `profiles.ts` caches relay data

**Proposed:**
```typescript
// profiles.ts - Single source of truth
interface CachedProfile {
  pubkey: string;
  displayName: string;  // Prefers local override → relay name → truncated pubkey
  avatar: string | null;
  isLocalOverride: boolean; // True if using local nickname
}

// auth.ts - Only stores authentication
interface AuthState {
  publicKey: string | null;
  privateKey: string | null;
  // Remove: nickname, avatar (move to profiles.ts)
}
```

## Stale State Issues

### 1. Profile Cache Expiration

**Issue:**
```typescript
// profiles.ts line 31
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Problem: If user updates their profile, cache may serve stale data for 5 minutes
```

**Missing Invalidation:**
- No mechanism to invalidate cache when profile changes
- No subscription to profile update events
- Manual cache clear required

### 2. Channel Member Lists

**Issue:**
```typescript
// channels.ts fetches member lists once
const memberPubkeys = memberEvent?.tags.filter(t => t[0] === 'p').map(t => t[1]) || [];

// Problem: If someone joins/leaves, member count becomes stale
```

**Missing Real-Time Updates:**
- No subscription to member list changes
- No refresh mechanism
- Components must manually refetch

### 3. Admin Pending Requests

**Issue:**
```typescript
// admin.ts - Fetches once
export async function fetchPendingRequests(relay: NDKRelay): Promise<void>

// Problem: New join requests don't appear until manual refresh
```

**Missing:**
- No real-time subscription to kind 9021 events
- Admin must refresh page to see new requests

## Recommended Architecture Improvements

### 1. Establish Clear Store Hierarchy

```
Layer 0: Infrastructure
├── ndk.ts (relay connection)
└── toast.ts, confirm.ts, pwa.ts (UI utilities)

Layer 1: Authentication
├── auth.ts (authentication only - no profile data)
└── session.ts (timeout management)

Layer 2: User Data
├── profiles.ts (ALL profile data - single source of truth)
└── user.ts (derives from auth + profiles, adds whitelist verification)

Layer 3: Domain Stores
├── channels.ts (single channel store - NIP-29)
├── messages.ts
├── admin.ts
└── sections.ts

Layer 4: Feature Stores
├── pinnedMessages.ts
├── reactions.ts
├── bookmarks.ts
└── etc.
```

### 2. Implement Store Initialization Manager

```typescript
// stores/init.ts
export async function initializeStores() {
  // Phase 1: Infrastructure
  await ndk.init();

  // Phase 2: Authentication
  await authStore.waitForReady();

  // Phase 3: User data (auto-derives from auth)
  // userStore automatically updates when auth changes

  // Phase 4: Subscribe to real-time updates
  await subscribeToGlobalEvents();

  return { ready: true };
}
```

### 3. Add State Synchronization Layer

```typescript
// stores/sync.ts
export function syncStores() {
  // When auth updates, invalidate profile cache
  authStore.subscribe($auth => {
    if ($auth.publicKey) {
      profileCache.remove($auth.publicKey);
      profileCache.getProfile($auth.publicKey); // Refresh
    }
  });

  // When channel members change, refetch channel list
  // (via relay subscription)
}
```

### 4. Fix Circular Dependency

**Option A: Dependency Injection**
```typescript
// channelStore.ts - Accept authStore as parameter
export function createChannelStore(authStore: Readable<AuthState>) {
  return derived([channelStore, authStore], ([$channel, $auth]) => {
    // No dynamic import needed
  });
}
```

**Option B: Event Bus**
```typescript
// events.ts
export const authEvents = writable<AuthState | null>(null);

// auth.ts
authStore.subscribe(state => authEvents.set(state));

// channelStore.ts - Subscribe to events instead of importing store
authEvents.subscribe($auth => {
  // Update membership status
});
```

**Option C: Move Membership Logic to User Store**
```typescript
// user.ts - Already has auth dependency
export const userChannelMembership = derived(
  [userStore, channelStore],
  ([$user, $channels]) => {
    // Calculate membership for all channels
  }
);

// channelStore.ts - Remove auth dependency entirely
```

## Conclusion

**Critical Actions Needed:**
1. ✅ **Resolve circular dependency** between `channelStore.ts` and `auth.ts`
2. ✅ **Merge duplicate channel stores** (`channels.ts` + `channelStore.ts`)
3. ✅ **Fix isAdmin name collision** (remove from `auth.ts`, keep only in `user.ts`)
4. ✅ **Unify profile data** (single source of truth in `profiles.ts`)
5. ✅ **Implement initialization manager** to guarantee store setup order
6. ✅ **Add real-time subscriptions** for admin panel, member lists, profiles

**Impact if Not Fixed:**
- Stale data displayed to users
- Admin actions fail due to outdated state
- Race conditions on app startup
- Profile updates not reflected in UI
- Join requests not appearing for admins
- Unpredictable behavior when importing stores in different orders
