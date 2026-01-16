---
title: "Administrator Guide"
description: "Administrative functions, security management, and platform configuration guide for Fairfield administrators"
category: howto
tags: [admin, security, config, management, moderation]
difficulty: advanced
related-docs:
  - ./security/admin-security.md
last-updated: 2026-01-16
---

# Fairfield Administrator Guide

This guide covers administrative functions, security management, and platform configuration for Fairfield administrators.

## Table of Contents

1. [Admin Overview](#admin-overview)
2. [Accessing the Admin Panel](#accessing-the-admin-panel)
3. [User Management](#user-management)
4. [Channel Management](#channel-management)
5. [Section Management](#section-management)
6. [Calendar Management](#calendar-management)
7. [Security Monitoring](#security-monitoring)
8. [Whitelist Management](#whitelist-management)
9. [Rate Limiting](#rate-limiting)
10. [Troubleshooting Admin Issues](#troubleshooting-admin-issues)

---

## Admin Overview

Administrators have elevated privileges to manage users, channels, sections, and monitor platform security.

### Admin Capabilities

| Feature | Admin Can |
|---------|-----------|
| User Management | Approve/reject access requests, assign cohorts |
| Channel Management | Create, edit, delete channels |
| Section Management | Configure section access rules |
| Calendar | Full visibility, create/edit events |
| Security | View activity logs, manage whitelist |

### Admin Requirements

- Must be whitelisted with `admin` cohort
- Admin pubkey configured in environment variables
- Server-side verification via relay API

---

## Accessing the Admin Panel

### Navigation

1. Log in with your admin nsec/hex key
2. Navigate to `/admin` in the URL bar, OR
3. Click **"Admin"** in the navigation menu (visible only to admins)

### Authentication Verification

Admin access is verified in two ways:

1. **Client-side**: Shows admin UI elements
2. **Server-side**: All actions verified against relay whitelist

> **Security Note**: Even if someone bypasses client-side checks, all admin actions are validated server-side via `verifyWhitelistStatus()`.

### Access Denied

If you see "Access denied: Admin privileges required":
- Verify your pubkey is in the admin whitelist
- Contact another admin to check your cohort assignment
- Wait 2 seconds - you will be redirected to chat

---

## User Management

### Viewing Pending Requests

1. Go to **Admin Panel** > **Access Requests**
2. See all pending section access requests
3. Each request shows:
   - User's pubkey (truncated)
   - Requested section
   - Request timestamp
   - Optional message

### Approving Access

1. Find the pending request
2. Click **"Approve"**
3. User is added to the section's whitelist
4. User receives full section access immediately

### Rejecting Access

1. Find the pending request
2. Click **"Reject"**
3. Optionally add a rejection reason
4. Request is removed from pending list

### Cohort Management

Users can be assigned to cohorts with different permissions:

| Cohort | Description | Can Self-Assign |
|--------|-------------|-----------------|
| `admin` | Full administrative access | No |
| `approved` | Standard approved user | No |
| `business` | Business section access | No |
| `moomaa-tribe` | Special community access | No |

### Changing User Cohorts

1. Go to **Admin Panel** > **Whitelist**
2. Find the user by pubkey
3. Select new cohort from dropdown
4. Click **"Update"**

> **Warning**: You cannot remove your own admin cohort (safety feature).

### User Management Panel

The User Management panel (`/admin/users`) provides a comprehensive interface for managing user zone assignments:

#### Zone Cohorts

| Zone | Colour | Description |
|------|--------|-------------|
| **Family** | Green (#4a7c59) | Family community section |
| **DreamLab** | Pink (#ec4899) | DreamLab creative space |
| **Minimoonoir** | Purple (#8b5cf6) | Minimoonoir community |
| **Admin** | Red (#ef4444) | Full administrative access |

#### Features

- **Pagination**: Navigate through users 10/20/50/100 at a time
- **Search**: Find users by display name or pubkey
- **Filter by Zone**: View only users in a specific zone
- **Radio Selection**: Single-click zone assignment with visual feedback
- **Pending State**: Loading indicators while updates process

#### Using the Panel

1. Navigate to **Admin Panel** > **User Management**
2. Browse or search for users
3. Click a zone radio button to assign that user to the zone
4. The `approved` cohort is automatically preserved
5. Non-zone cohorts (e.g., `business`) are preserved
6. Success message confirms the change

#### API Endpoints Used

```typescript
// Fetch paginated users
GET /api/whitelist/list?limit=20&offset=0&cohort=family

// Update user cohorts
POST /api/whitelist/update-cohorts
{
  "pubkey": "<64-char-hex>",
  "cohorts": ["family", "approved"],
  "adminPubkey": "<admin-hex>"
}
```

---

## Channel Management

### Creating a Channel

1. Go to **Admin Panel** > **Channels**
2. Click **"Create Channel"**
3. Fill in the form:
   - **Name**: Channel identifier (alphanumeric, hyphens, underscores)
   - **Section**: Which section this channel belongs to
   - **Description**: Brief description (optional)
   - **Access Type**: Open or Gated
4. Click **"Create"**

### Channel Access Types

| Type | Who Can Post |
|------|--------------|
| **Open** | Anyone with section access |
| **Gated** | Only channel members |

### Editing Channels

1. Navigate to the channel
2. Click **"Edit Channel"** (gear icon)
3. Modify settings
4. Click **"Save"**

### Deleting Channels

1. Navigate to the channel
2. Click **"Delete Channel"**
3. Confirm the deletion

> **Warning**: Deleting a channel does not delete messages. Messages remain on the relay but are no longer displayed.

---

## Section Management

### Available Sections

| Section | Default Access |
|---------|----------------|
| Fairfield Guests | Open (auto-approved) |
| Fairfield | Requires approval |
| DreamLab | Requires approval |

### Section Statistics

View section stats in **Admin Panel** > **Stats**:
- Number of channels
- Number of approved users
- Pending access requests
- Recent activity

### Configuring Section Access

Section access is controlled by the whitelist system:
1. User requests access to a section
2. Request appears in admin panel
3. Admin approves or rejects
4. User is added to section cohort

---

## Calendar Management

### Viewing All Events

Admins have full calendar visibility:
- All event details visible
- No masking regardless of cohort
- Can edit/delete any event

### Creating Events

1. Go to **Events** > **Create Event**
2. Fill in event details:
   - Title
   - Date and time
   - Location
   - Description
   - Cohort visibility (optional)
3. Click **"Create Event"**

### Event Visibility

Events can be tagged with cohorts to control visibility:

```
Tags: ["cohort", "business"]
```

Users not in the tagged cohort will see:
- Date/time (availability only)
- "Event details restricted" message

### Editing Events

1. Click on an event
2. Click **"Edit"**
3. Modify details
4. Click **"Save"**

---

## Security Monitoring

### Suspicious Activity Log

The admin panel displays security alerts:

| Severity | Type | Description |
|----------|------|-------------|
| HIGH | `self_admin_attempt` | User tried to self-assign admin |
| HIGH | `invalid_signature` | Event signature verification failed |
| MEDIUM | `unauthorized_action` | Non-admin attempted admin action |
| LOW | `rate_limit_exceeded` | Too many requests |

### Viewing Security Logs

1. Go to **Admin Panel** > **Security**
2. View recent suspicious activities
3. Filter by severity or type

### Security Events Tracked

The system automatically tracks:
- Unauthorized cohort change attempts
- Invalid signature submissions
- Rate limit violations
- Author/pubkey mismatches
- Replay attack attempts

---

## Whitelist Management

### How Whitelisting Works

The whitelist is stored on the Nostr relay using NIP-51 pin lists (kind 30001).

### Viewing the Whitelist

1. Go to **Admin Panel** > **Whitelist**
2. See all whitelisted users
3. View their cohorts and approval dates

### Adding Users to Whitelist

1. Click **"Add User"**
2. Enter the user's pubkey (hex format)
3. Select cohort(s)
4. Click **"Add"**

### Removing Users

1. Find the user in the whitelist
2. Click **"Remove"**
3. Confirm removal

> **Note**: Removed users lose section access immediately but can request again.

### Whitelist API

The relay provides a verification API:

```
GET /api/check-whitelist?pubkey=<64-char-hex>
```

Returns:
```json
{
  "isWhitelisted": true,
  "isAdmin": false,
  "cohorts": ["approved", "business"]
}
```

---

## Rate Limiting

### Admin Rate Limits

Admin actions are rate-limited to prevent abuse:

| Action | Max Attempts | Window | Backoff |
|--------|--------------|--------|---------|
| Section Access | 5 | 1 minute | 2x |
| Cohort Change | 3 | 1 hour | 3x |
| General Admin | 10 | 1 minute | 1.5x |

### Exponential Backoff

After exceeding limits:
```
Attempt 1: Immediate
Attempt 2: windowMs * 2
Attempt 3: windowMs * 4
...
Maximum: maxBackoffMs
```

### Checking Rate Limit Status

If you're rate-limited:
1. Wait for the cooldown period
2. Try again after the specified time
3. Contact another admin if urgent

---

## Troubleshooting Admin Issues

### Cannot Access Admin Panel

**Issue**: "Access denied" error
- Verify your pubkey is in the admin whitelist
- Check that `VITE_ADMIN_PUBKEY` includes your pubkey
- Try logging out and back in

### Approval Not Working

**Issue**: User still cannot access section after approval
- Check the relay connection
- Verify the approval event was published
- Ask the user to refresh their page

### Whitelist Not Updating

**Issue**: Changes not reflecting
- Wait a few seconds for relay sync
- Refresh the admin panel
- Check browser console for errors

### Rate Limited

**Issue**: "Too many requests" error
- Wait for the cooldown period (shown in error)
- Admin actions have strict rate limits
- Contact another admin if urgent

### Security Alert Investigation

**Issue**: Seeing HIGH severity alerts
1. Note the pubkey involved
2. Check if it's a legitimate user
3. Review their recent activity
4. Consider removing from whitelist if malicious

---

## Admin Security Best Practices

### Key Management

1. **Use a dedicated admin key** - Don't use your personal key for admin
2. **Store admin key securely** - Hardware security key if possible
3. **Rotate keys periodically** - Change admin key if compromised

### Access Control

1. **Minimize admin count** - Only grant admin to trusted users
2. **Review admin actions** - Check security logs regularly
3. **Verify before approving** - Confirm user identity if possible

### Monitoring

1. **Check security logs daily** - Look for suspicious patterns
2. **Monitor rate limit events** - May indicate attack attempts
3. **Review pending requests** - Don't let them accumulate

---

## API Reference

### Admin Security Functions

```typescript
// Check rate limit before action
import { checkRateLimit } from '$lib/nostr/admin-security';
const result = checkRateLimit('cohortChange', pubkey);

// Verify whitelist status
import { verifyWhitelistStatus } from '$lib/nostr/whitelist';
const status = await verifyWhitelistStatus(pubkey);

// Log suspicious activity
import { logSuspiciousActivity } from '$lib/nostr/admin-security';
logSuspiciousActivity({
  type: 'unauthorized_action',
  actor: pubkey,
  details: { action: 'attempted admin access' }
});
```

### Cohort Validation

```typescript
import { validateCohortAssignment } from '$lib/nostr/admin-security';
const result = validateCohortAssignment({
  targetPubkey: userPubkey,
  cohort: 'approved',
  assignerPubkey: adminPubkey
});
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Google Cloud Project
GOOGLE_CLOUD_PROJECT=your-project-id

# Admin public key (hex format)
VITE_ADMIN_PUBKEY=64-character-hex-pubkey

# Relay URL (Cloud Run)
VITE_RELAY_URL=wss://nostr-relay-<PROJECT_NUMBER>.us-central1.run.app

# Optional: Multiple admin pubkeys (comma-separated)
VITE_ADMIN_PUBKEYS=pubkey1,pubkey2,pubkey3
```

### Cloud Run API Services

```bash
# Embedding API for semantic search
VITE_EMBEDDING_API_URL=https://embedding-api-<PROJECT_NUMBER>.us-central1.run.app

# Image upload API
VITE_IMAGE_API_URL=https://image-api-<PROJECT_NUMBER>.us-central1.run.app
```

### Getting Cloud Run URLs

```bash
# List all Cloud Run services with URLs
gcloud run services list --format="table(SERVICE,REGION,URL)"

# Example output:
# SERVICE        REGION       URL
# embedding-api  us-central1  https://embedding-api-617806532906.us-central1.run.app
# image-api      us-central1  https://image-api-617806532906.us-central1.run.app
# nostr-relay    us-central1  https://nostr-relay-617806532906.us-central1.run.app
```

### GitHub Actions Secrets

For CI/CD deployments:

| Secret | Description |
|--------|-------------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON for deployments |

---

## Related Documentation

- [Authentication System](features/authentication.md)
- [Admin Security Hardening](security/admin-security.md)
- [Security Audit Report](security-audit-report.md)

---

*Last updated: January 2025*
