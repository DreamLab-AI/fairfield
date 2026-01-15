# ADR-001: User Registration and Approval Flow

## Status
**RESOLVED** - Root cause identified and fixed

## Context
The Fairfield Nostr application requires a user registration and approval flow where:
1. New users create an account with a nickname
2. Admin must approve users before they can access zones
3. Users can be assigned to multiple zone cohorts (family, dreamlab, minimoonoir, admin)

### Issues Identified (January 2026)
1. **Display Name Issue**: Admin panel showed "DemoUser" instead of user's registered nickname
2. **Pending Requests Visibility**: Admin could not see fresh pending user requests
3. **Flow Fragility**: The overall onboarding flow appeared unreliable

## Root Cause Analysis

### Critical Bug Found: handlers.ts Whitelist Check (Lines 67-75)

The Nostr relay's event handler (`services/nostr-relay/src/handlers.ts`) was blocking **ALL** events from non-whitelisted users, including the registration events themselves:

```typescript
// PREVIOUS CODE (BROKEN)
// Check environment whitelist
const envAllowed = this.whitelist.isAllowed(event.pubkey);
// Check database whitelist
const dbAllowed = await this.db.isWhitelisted(event.pubkey);

if (!envAllowed && !dbAllowed) {
  this.sendOK(ws, event.id, false, 'blocked: pubkey not whitelisted');
  return;
}
```

This created a **circular dependency**:
1. User signs up → generates keypair
2. User publishes Kind 0 profile event → **BLOCKED** (not whitelisted)
3. User publishes Kind 9024 registration request → **BLOCKED** (not whitelisted)
4. Admin never sees user → user waits forever
5. User can never get whitelisted because their registration is blocked

### Secondary Issue: Race Condition

The frontend signup flow published Kind 0 (profile) and Kind 9024 (registration) sequentially without delay, potentially causing Kind 9024 to arrive before Kind 0 was fully saved.

## Decision

### Fix 1: Allow Registration Events from Non-Whitelisted Users

Modified `services/nostr-relay/src/handlers.ts` to bypass whitelist check for:
- **Kind 0**: Profile metadata (NIP-01) - needed for display name
- **Kind 9024**: Registration request (custom) - needed for admin visibility

```typescript
// FIXED CODE
// Registration-related events: allow from anyone (breaks circular dependency)
// Kind 0: Profile metadata (NIP-01) - needed for display name during signup
// Kind 9024: Registration request (custom) - needed for admin to see pending users
const isRegistrationEvent = event.kind === 0 || event.kind === 9024;

if (!isRegistrationEvent) {
  // Check environment whitelist
  const envAllowed = this.whitelist.isAllowed(event.pubkey);
  // Check database whitelist
  const dbAllowed = await this.db.isWhitelisted(event.pubkey);

  if (!envAllowed && !dbAllowed) {
    this.sendOK(ws, event.id, false, 'blocked: pubkey not whitelisted');
    return;
  }
}
```

### Fix 2: Add Delay Between Event Publishes

Modified `src/routes/signup/+page.svelte` to add a 300ms delay between Kind 0 profile publish and Kind 9024 registration request to ensure proper event ordering.

## Architecture

### Components
1. **Nostr Relay** (`services/nostr-relay/`)
   - PostgreSQL database with `whitelist` and `events` tables
   - HTTP APIs: `/api/check-whitelist`, `/api/whitelist/list`, `/api/whitelist/add`, `/api/whitelist/update-cohorts`
   - WebSocket for Nostr events (REQ/EVENT/CLOSE)

2. **Frontend** (`src/`)
   - SvelteKit application
   - Routes: `/signup`, `/login`, `/pending`, `/admin`
   - Stores: `auth`, `user`, `whitelist`

3. **Event Kinds**
   - Kind 0: User profile (NIP-01) - display_name, name
   - Kind 9024: User registration request (custom)

### User Registration Flow (Fixed)
```
1. User arrives at /signup
2. User generates keypair OR enters existing nsec
3. User shown nsec backup screen (must acknowledge)
4. User enters display name in NicknameSetup
5. App publishes Kind 0 profile event with display_name ← NOW ACCEPTED
6. 300ms delay to ensure event propagation
7. App publishes Kind 9024 registration request event ← NOW ACCEPTED
8. User redirected to /pending
9. Admin sees pending request in /admin panel (with display name!)
10. Admin approves → adds to whitelist with cohorts
11. User auto-redirected to /chat when approved
```

### Admin Panel Display Name Resolution

The `listWhitelistPaginated()` method in `db.ts` joins the whitelist table with events to get display names:

```typescript
// db.ts lines 395-420
SELECT
  w.pubkey,
  w.cohorts,
  w.added_at,
  w.added_by,
  (
    SELECT e.content
    FROM events e
    WHERE e.pubkey = w.pubkey AND e.kind = 0
    ORDER BY e.created_at DESC
    LIMIT 1
  ) as profile_content
FROM whitelist w
```

Profile content is parsed for `display_name` or `name` fields.

## Security Considerations

### Why This is Safe
1. **Kind 0 and 9024 only**: Only profile and registration events bypass whitelist
2. **All other events blocked**: Regular messages, reactions, etc. still require whitelist
3. **Signature verification**: All events are still cryptographically verified
4. **Rate limiting**: Events still subject to rate limiting
5. **Admin approval still required**: Users still can't access zones without approval

### Potential Concerns Addressed
- **Spam profiles**: Rate limiting prevents profile spam
- **Fake registrations**: Admin reviews all pending registrations
- **Profile impersonation**: Each profile is tied to cryptographic pubkey

## Test Plan
1. ✅ Create new keypair (fresh user)
2. ✅ Register with specific nickname
3. ✅ Verify Kind 0 and Kind 9024 events saved to relay
4. ✅ Login as admin
5. ✅ Verify pending request visible with correct display name
6. ✅ Approve user with zones
7. ✅ Verify user can access app
8. ✅ Verify display name shows correctly in chat

## Consequences

### Positive
- User registration now works reliably
- Display names properly saved and shown
- Admin can see all pending registration requests
- Clear separation between registration events and content events

### Negative
- Non-whitelisted users can update their profile at any time (Kind 0)
- Slight increase in event storage from non-approved users

### Neutral
- 300ms delay adds small latency to signup (acceptable UX)

## Files Changed
1. `services/nostr-relay/src/handlers.ts` - Allow Kind 0/9024 from anyone
2. `src/routes/signup/+page.svelte` - Add 300ms delay between events

## Related NIPs
- NIP-01: Basic protocol flow (Kind 0 profiles)
- NIP-11: Relay information document
- NIP-16: Event treatment (replaceable events)
- NIP-33: Parameterized replaceable events
- NIP-98: HTTP Auth

## References
- Previous audit agents: a0847c3, ae365c7, a0480ff, ab84ab9
- DeepSeek reasoning consultation on optimal registration flow
