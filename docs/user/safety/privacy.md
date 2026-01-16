---
title: "Privacy"
description: "How your data is protected on the platform."
category: tutorial
tags: ['developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Privacy

How your data is protected on the platform.

---

## Privacy by Design

The platform is built with privacy as a core principle, not an afterthought:

- **Minimal data collection** — We only process what's necessary
- **Decentralised architecture** — No single point of control
- **Cryptographic protection** — Strong encryption throughout
- **User control** — You own your identity and data

---

## Your Data

### What's Collected

| Data Type | Purpose | Who Can See |
|-----------|---------|-------------|
| Public key | Your identity | Everyone |
| Display name | How you're known | Everyone in your zones |
| Profile picture | Visual identity | Everyone in your zones |
| Channel messages | Communication | Zone members |
| Private messages | Direct communication | Only you and recipient |
| Event RSVPs | Event planning | Event participants |

### What's NOT Collected

- Email address (unless you choose to add one)
- Phone number
- Real name (unless you choose to share it)
- Location data
- Browsing history
- Message content (for private messages — encrypted)

---

## Encryption Explained

### Private Messages

Your private messages use **end-to-end encryption**:

```
You type message → Encrypted on your device → Travels encrypted → Decrypted on recipient's device
```

**What this means:**
- Only you and the recipient can read the message
- Not even platform administrators can read it
- The server only sees encrypted data
- No one can intercept and read it

### Gift Wrapping

Private messages use additional protection called "gift wrapping" that hides:
- **What** the message says ✅
- **When** it was sent ✅
- **Who** sent it ✅

The server only knows that *someone* sent *something* to your recipient.

### Channel Messages

Channel messages are:
- **Transport encrypted** — Protected while travelling
- **Visible to zone members** — Anyone in the zone can read
- **Not end-to-end encrypted** — Administrators can see them

---

## Your Identity

### How Identity Works

Instead of username/password:
- You have a **cryptographic key pair**
- Your **public key** is your identity
- Your **private key** proves it's you
- Your **recovery phrase** regenerates your keys

### Pseudonymity

- You can use any display name
- Your identity is your public key, not your real name
- Different zones can see different aspects of your profile
- You control what personal information you share

### Verification

- Public keys are unique and unforgeable
- You can verify someone's identity by their key
- No one can impersonate your key without your recovery phrase

---

## Data Storage

### Where Data Lives

The platform uses decentralised storage:
- Messages may be stored on multiple relays
- No single server has all data
- You can choose which relays to use

### What You Can Delete

| Content | Can Delete? | Effect |
|---------|-------------|--------|
| Your messages | Yes | Removed from view* |
| Your profile | Yes | Cleared from relays |
| Your reactions | Yes | Removed immediately |
| Your account | Yes | Keys still exist, but profile cleared |

*Note: Due to decentralised nature, some copies may persist on relays you don't control.

### Data Portability

- Your identity works across any compatible platform
- You can export your data
- You're not locked into any single service

---

## Administrator Access

### What Administrators CAN See

- Channel messages in their zones
- Member lists
- Public profile information
- Event attendance
- Moderation logs

### What Administrators CANNOT See

- Your private messages (end-to-end encrypted)
- Your recovery phrase
- Your private key
- Messages in zones they don't administer

---

## Privacy Settings

### Available Controls

In **Settings > Privacy**, you can control:

| Setting | Options |
|---------|---------|
| Online status | Visible / Hidden |
| Read receipts | On / Off |
| Profile visibility | Full / Basic / Minimal |
| Who can message you | Anyone / Zone members / No one |

### Blocking

When you block someone:
- They can't message you
- They can't see your online status
- You won't see their messages
- They won't know they're blocked

---

## Third-Party Access

### What We Don't Do

- ❌ Sell your data
- ❌ Show targeted advertising
- ❌ Share with data brokers
- ❌ Build profiles for marketing
- ❌ Allow third-party tracking

### External Links

When you click links to external sites:
- You leave the platform's protection
- The external site's privacy policy applies
- We don't track where you go

---

## Legal Requests

### If Legally Required

If compelled by law to provide data:
- We can only provide what we have
- Private messages are encrypted — we can't read them
- We would notify affected users where legally permitted
- We would fight overbroad requests

---

## Your Rights

You have the right to:
- **Access** your data
- **Export** your data
- **Delete** your data
- **Know** what's collected
- **Control** your privacy settings

---

## Frequently Asked Questions

<details>
<summary><strong>Can you read my private messages?</strong></summary>

No. Private messages are end-to-end encrypted. Only you and your recipient have the keys to decrypt them. We literally cannot read them.

</details>

<details>
<summary><strong>What happens to my data if I delete my account?</strong></summary>

Your profile is cleared from relays. Due to the decentralised nature, some historical messages may persist on relays you don't control, but they're no longer associated with an active profile.

</details>

<details>
<summary><strong>Can other users see my activity?</strong></summary>

Other users can see:
- Your public profile
- Messages you post in shared channels
- Your reactions on messages
- Your event RSVPs (to participants)

They cannot see:
- Your private messages
- Your browsing activity
- Which channels you're reading
- Your notification settings

</details>

<details>
<summary><strong>Is my IP address visible?</strong></summary>

Your IP address is visible to relays you connect to, but not to other users. Use a VPN if you want to hide your IP from relays.

</details>

---

## Related

- [Account Security](account-security.md) — Protecting your account
- [Private Messages](../features/private-messages.md) — How encrypted DMs work
- [Reporting](reporting.md) — Handling privacy violations

---

[← Back to Safety](index.md) | [Next: Account Security →](account-security.md)
