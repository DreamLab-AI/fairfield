---
title: "Account Security"
description: "Keep your account safe and secure."
category: tutorial
tags: ['developer', 'security', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Account Security

Keep your account safe and secure.

---

## Your Recovery Phrase

### What It Is

Your recovery phrase (also called seed phrase or mnemonic) is:
- 12 or 24 words in a specific order
- The **master key** to your account
- The only way to recover your account
- Generated once when you create your account

### Why It Matters

Your recovery phrase:
- **Regenerates** your cryptographic keys
- **Proves** your identity
- **Cannot be reset** if lost
- **Grants full access** to whoever has it

---

## Protecting Your Recovery Phrase

### Do

✅ Write it down on paper (not digital)
✅ Store in a secure, private location
✅ Consider multiple secure backup locations
✅ Treat it like the key to a safe deposit box
✅ Memorise it if possible

### Don't

❌ Store it digitally (screenshots, notes apps, cloud storage)
❌ Share it with anyone — ever
❌ Enter it on websites (except when recovering your account)
❌ Take photos of it
❌ Email it to yourself
❌ Save it in a password manager

### Why Digital Storage Is Dangerous

If stored digitally, your recovery phrase could be compromised by:
- Cloud storage breaches
- Malware on your devices
- Photo syncing to cloud services
- Backup services
- Device theft

---

## Recovery Phrase Scenarios

### If You Lose It

If you lose your recovery phrase and lose access to your account:
- **There is no recovery** — no one can help you
- Your account cannot be accessed
- Your private messages are permanently lost
- You'll need to create a new account

### If Someone Gets It

If someone else obtains your recovery phrase:
- They have **complete access** to your account
- They can read all your private messages
- They can impersonate you
- They can lock you out
- There is no way to revoke access

---

## Session Security

### Active Sessions

View and manage where you're logged in:

1. Go to **Settings > Security**
2. See **Active Sessions**
3. Each session shows:
   - Device type
   - Browser/app
   - Location (approximate)
   - Last activity
4. Click **End Session** on any you don't recognise

### When to End Sessions

End sessions when:
- You don't recognise a device
- You logged in on a shared computer
- A device was lost or stolen
- You see suspicious activity

---

## Recognising Threats

### Phishing Attempts

Be suspicious of:
- Messages asking for your recovery phrase
- Links to login pages that don't look right
- Urgent requests to "verify" your account
- Offers that seem too good to be true
- Messages from accounts impersonating administrators

**Remember:** No legitimate person or service will ever ask for your recovery phrase.

### Impersonation

To verify someone's identity:
- Check their public key (it's unique and unforgeable)
- Ask them something only they would know
- Contact them through another trusted channel
- Report suspected impersonation to administrators

### Suspicious Links

Before clicking links:
- Hover to see the actual URL
- Be wary of shortened URLs from unknown senders
- Don't click links in unexpected messages
- When in doubt, don't click

---

## Best Practices

### Regular Habits

| Habit | Frequency |
|-------|-----------|
| Review active sessions | Monthly |
| Check for impersonators | When suspicious |
| Verify you're on the real site | Each login |
| Update your recovery phrase backup | If damaged |

### Device Security

Protect devices where you use the platform:
- Use device lock (PIN, biometric)
- Keep operating system updated
- Use reputable security software
- Don't jailbreak/root devices used for sensitive accounts

### Network Security

When using the platform:
- Avoid public Wi-Fi for sensitive actions
- Use a VPN if connecting from untrusted networks
- Ensure HTTPS (look for the lock icon)

---

## If Your Account Is Compromised

### Immediate Steps

If you suspect compromise:

1. **Change your recovery phrase** (if still accessible)
   - This generates new keys
   - Old keys become invalid
2. **End all sessions** except your current one
3. **Review recent activity** for unauthorised actions
4. **Alert zone administrators** if impersonation occurred
5. **Warn your contacts** if messages were sent

### If Locked Out

If you're locked out and someone else has access:
- You cannot recover the account
- Alert your communities that your old identity is compromised
- Create a new account
- Warn your contacts about potential impersonation

---

## Passphrase Protection

### Additional Security Layer

Some setups allow a passphrase in addition to your recovery phrase:
- Recovery phrase + passphrase = your keys
- Without the passphrase, the recovery phrase alone won't work
- This adds protection if your recovery phrase is stolen

### Passphrase Considerations

| Advantage | Disadvantage |
|-----------|--------------|
| Extra protection | Another thing to remember |
| Plausible deniability | Lost passphrase = lost account |
| Protection from physical theft | More complex recovery |

---

## Export and Backup

### What You Can Export

- Your public key (safe to share)
- Your private key (NEVER share — treat like recovery phrase)
- Your profile data
- Your message history (where available)

### Export for Backup

1. Go to **Settings > Security**
2. Find **Export Keys**
3. Export in a secure format
4. Store as securely as your recovery phrase

---

## Frequently Asked Questions

<details>
<summary><strong>Can I change my recovery phrase?</strong></summary>

Generating a new recovery phrase creates a new identity. Your old messages and reputation don't transfer. It's effectively creating a new account.

</details>

<details>
<summary><strong>What if I forgot my recovery phrase but I'm still logged in?</strong></summary>

While logged in:
1. Go to Settings > Security
2. You may be able to view or export your keys
3. Save them securely immediately

If this option isn't available and you log out, you'll lose access permanently.

</details>

<details>
<summary><strong>Should I use a password manager for my recovery phrase?</strong></summary>

This is debated. Opinions vary:
- **Against:** Digital storage is risky; password managers can be breached
- **For:** Better than no backup; modern password managers are quite secure

If you do, use a reputable password manager with strong encryption and two-factor authentication. Paper backup in a secure location is still recommended.

</details>

<details>
<summary><strong>How do I know if my account has been compromised?</strong></summary>

Signs include:
- Sessions you don't recognise
- Messages you didn't send
- Settings you didn't change
- People saying "you" contacted them when you didn't
- Being logged out unexpectedly

</details>

---

## Related

- [Creating Account](../getting-started/creating-account.md) — Account setup
- [Privacy](privacy.md) — Data protection
- [Reporting](reporting.md) — Reporting security issues

---

[← Back to Safety](index.md) | [Previous: Privacy](privacy.md) | [Next: Reporting →](reporting.md)
