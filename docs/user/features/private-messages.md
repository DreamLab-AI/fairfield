---
title: "Private Messages"
description: "Secure, encrypted one-to-one conversations that only you and the recipient can read."
category: tutorial
tags: ['developer', 'messaging', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Private Messages

Secure, encrypted one-to-one conversations that only you and the recipient can read.

---

## How Private Messages Work

Private messages (DMs) are fundamentally different from channel messages:

| Aspect | Channel Messages | Private Messages |
|--------|------------------|------------------|
| Who can see | All zone members | Only you and recipient |
| Encryption | Standard | End-to-end encrypted |
| Admin access | Admins can see | Admins **cannot** see |
| Stored | On the server | Encrypted on server |

---

## Privacy Protection

### What End-to-End Encryption Means

When you send a private message:

1. Your message is encrypted on your device
2. It travels encrypted through the server
3. It's decrypted only on the recipient's device
4. **No one in between can read it** — not even platform administrators

### Additional Protection: Gift Wrapping

Your private messages use a technique called "gift wrapping" that hides:

- ✅ **What** the message says (encrypted)
- ✅ **When** it was sent (timestamp is randomised)
- ✅ **Who** sent it (sender identity is hidden)

The server only knows that *someone* sent *something* to your recipient.

---

## Sending Private Messages

### Starting a New Conversation

1. Click the **messages** icon (📧) in the header
2. Click **New Message** or **+**
3. Search for the person you want to message
4. Select them from the results
5. Type your message and send

### Finding Someone to Message

You can search by:
- Display name
- Username
- Public key (if you have it)

### Continuing a Conversation

1. Click the **messages** icon
2. Select an existing conversation from your list
3. Type in the message input
4. Send as normal

---

## Reading Private Messages

### Viewing Your Messages

1. Click the **messages** icon (📧)
2. See your list of conversations
3. Unread conversations are highlighted
4. Click a conversation to read

### Conversation List

Your conversations are listed with:
- Person's name and photo
- Preview of the latest message
- Timestamp of last activity
- Unread indicator if applicable

---

## Managing Conversations

### Message Actions

Within a conversation, you can:

| Action | How |
|--------|-----|
| Reply | Type and send as normal |
| React | Click emoji picker on a message |
| Delete | Menu → Delete (your copy only) |

### Deleting Messages

When you delete a private message:
- It's removed from your view
- The recipient may still have their copy
- This is different from channel messages

### Blocking Someone

If you no longer want to receive messages from someone:

1. Open the conversation
2. Click the **menu** (⋯)
3. Select **Block**
4. Confirm

Blocked users:
- Cannot send you private messages
- Cannot see you in message search
- Can be unblocked later in settings

---

## Notifications

### When You're Notified

You receive notifications for new private messages:
- Badge on the messages icon
- Push notification (if enabled)
- Sound alert (if enabled)

### Managing DM Notifications

To adjust notification settings:
1. Go to **Settings**
2. Select **Notifications**
3. Find **Private Messages** settings
4. Adjust to your preference

---

## Security Best Practices

### Do

✅ Verify you're messaging the right person
✅ Be cautious about sharing sensitive information
✅ Report suspicious messages
✅ Keep your device secure

### Don't

❌ Share your recovery phrase in DMs
❌ Click suspicious links from unknown senders
❌ Assume deleted messages are gone everywhere
❌ Share DM content without consent

---

## Troubleshooting

<details>
<summary><strong>My message shows as pending</strong></summary>

This usually means:
- You're offline — the message will send when you reconnect
- There's a temporary connection issue — wait and it should resolve
- The recipient may be offline — messages queue until they're online

</details>

<details>
<summary><strong>I can't find someone to message</strong></summary>

Check these things:
- Is the spelling correct?
- Are they in the same zone as you?
- Have they blocked you?
- Do they have DMs enabled?

</details>

<details>
<summary><strong>I think someone is impersonating another user</strong></summary>

Verify identity by:
- Checking their public key (unique and cannot be faked)
- Asking them something only the real person would know
- Reaching out through another channel you trust

Report suspected impersonation to administrators.

</details>

<details>
<summary><strong>I received a suspicious message</strong></summary>

If you receive spam or suspicious content:
1. Do not click any links
2. Block the sender
3. Report to administrators if appropriate
4. Delete the conversation

</details>

---

## Frequently Asked Questions

<details>
<summary><strong>Can administrators read my private messages?</strong></summary>

**No.** Private messages are end-to-end encrypted. Only you and your recipient have the keys to decrypt them. Platform administrators cannot read, access, or recover your private messages.

</details>

<details>
<summary><strong>What happens to my messages if I lose my account?</strong></summary>

If you lose access to your account (lost recovery phrase), your private messages cannot be recovered. The encryption keys exist only on your device and are derived from your recovery phrase.

</details>

<details>
<summary><strong>Can I export my private messages?</strong></summary>

Yes, you can export your conversations for your own records. The export will be readable on your device but encrypted for privacy.

</details>

<details>
<summary><strong>Are group DMs available?</strong></summary>

Currently, private messages are one-to-one only. For group conversations, use channel messaging within your zone.

</details>

---

## Related

- [Messaging](messaging.md) — Channel messaging
- [Privacy](../safety/privacy.md) — How your data is protected
- [Account Security](../safety/account-security.md) — Keeping your account safe

---

[← Back to Features](index.md) | [Previous: Messaging](messaging.md) | [Next: Calendar →](calendar.md)
