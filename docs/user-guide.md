---
title: "Fairfield User Guide"
description: "Welcome to Fairfield, a decentralized chat and community application built on the Nostr protocol. This guide will help you get started and make the most of the platform."
category: howto
tags: ['developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Fairfield User Guide

Welcome to Fairfield, a decentralized chat and community application built on the Nostr protocol. This guide will help you get started and make the most of the platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating an Account](#creating-an-account)
3. [Logging In](#logging-in)
4. [Understanding Your Keys](#understanding-your-keys)
5. [Navigating Zones and Sections](#navigating-zones-and-sections)
6. [Chat Features](#chat-features)
7. [Events and Calendar](#events-and-calendar)
8. [Direct Messages](#direct-messages)
9. [Profile Management](#profile-management)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

Fairfield is a Progressive Web App (PWA) that runs in your browser. No installation required.

### Supported Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | Recommended |
| Firefox | 88+ | Supported |
| Safari | 14+ | Supported |
| Edge | 90+ | Supported |

### Access the Application

Visit the live site: [https://dreamlab-ai.github.io/fairfield/](https://dreamlab-ai.github.io/fairfield/)

---

## Creating an Account

Fairfield uses Nostr keys for authentication. You have two options:

### Option 1: Generate New Keys

1. Click **"Create Account"** on the welcome screen
2. The app generates a new private key (nsec) for you
3. **IMPORTANT**: Back up your key immediately
   - Click **"Reveal"** to see your nsec
   - Click **"Copy"** to copy to clipboard, OR
   - Click **"Download"** to save as a `.txt` file
4. Check **"I have backed up my key"**
5. Click **"Continue"**

> **Warning**: Your private key is the ONLY way to recover your account. If you lose it, you lose access permanently. There is no password reset.

### Option 2: Quick Start (Read-Only)

1. Click **"Browse First"** to explore without signing up
2. You will have read-only access:
   - Can browse channels and read messages
   - Cannot post, react, or send DMs
3. A yellow banner will remind you to complete signup
4. Click **"Complete Signup"** when ready

---

## Logging In

If you already have a Nostr key:

1. Click **"Login"** on the welcome screen
2. Enter your private key in one of two formats:
   - **nsec format**: `nsec1abc...xyz` (bech32 encoded)
   - **Hex format**: 64 hexadecimal characters
3. Click **"Login"**

### Security Notes

- Your key is encrypted with AES-256-GCM before storage
- Keys never leave your browser
- Session expires after 30 minutes of inactivity

---

## Understanding Your Keys

Nostr uses public-key cryptography:

| Key Type | Format | Purpose |
|----------|--------|---------|
| **Private Key (nsec)** | `nsec1...` | Proves your identity. KEEP SECRET. |
| **Public Key (npub)** | `npub1...` | Your public identifier. Safe to share. |
| **Hex Private** | 64 hex chars | Alternative format for nsec |
| **Hex Public** | 64 hex chars | Alternative format for npub |

### Where to Find Your Public Key

1. Go to **Profile** (click your avatar)
2. Your npub is displayed at the top
3. Click to copy to clipboard

### Backing Up Your Key

Your key should be stored:
- In a password manager (recommended)
- In an encrypted file on a USB drive
- Written on paper in a secure location

**Never store your nsec in:**
- Plain text files on your computer
- Cloud storage (Google Drive, Dropbox)
- Screenshots or photos
- Email or chat messages

---

## Navigating Zones and Sections

Fairfield is organised into three **Zones**, each containing multiple **Sections**:

### The Three Zones

| Zone | Purpose | Who it's for |
|------|---------|--------------|
| **Fairfield Family** | Private family space | Core family members |
| **Minimoonoir** | Social gathering space | Friends and visitors |
| **DreamLab** | Business and training | Trainees and business collaborators |

### Zone Access

| Zone | Access | Description |
|------|--------|-------------|
| **Minimoonoir Welcome** | Open | No approval needed for authenticated users |
| **Fairfield Family** | Requires Approval | Family cohort membership required |
| **DreamLab** | Requires Approval | Business/trainee cohort membership required |

### Requesting Access

1. Navigate to the zone or section you want to join
2. Click **"Request Access"**
3. Optionally add a message explaining why
4. Wait for admin approval
5. Check your status in the **"My Access"** panel

### Access Statuses

| Status | Meaning |
|--------|---------|
| **Approved** | Full access to zone/section forums |
| **Pending** | Waiting for admin review |
| **Not Requested** | Click to request access |

---

## Chat Features

### Joining Channels

1. Navigate to your approved section
2. Click on a channel name
3. Start chatting!

### Sending Messages

1. Type your message in the input box
2. Press **Enter** or click **Send**
3. Messages appear in real-time

### Message Features

- **Reactions**: Click the reaction icon to add emoji reactions
- **Reply**: Click the reply icon to thread your response
- **Delete**: You can delete your own messages (kind 5 event)

### Message Formatting

Messages support basic formatting:
- Plain text
- URLs auto-link
- Nostr references (npub, note IDs)

---

## Events and Calendar

### Viewing Events

1. Navigate to the **Events** section
2. Browse upcoming calendar events
3. Click an event for details

### Calendar Visibility

Your calendar view depends on your section membership:

| Membership | Visibility |
|------------|------------|
| Fairfield Guests | Full event details |
| Fairfield Members | Full event details |
| DreamLab Members | Dates only (details masked) |

DreamLab members can see event availability but not specific event details unless the event is tagged for their cohort.

### Event Information

Events display:
- Title
- Date and time
- Location (if visible)
- Description (if visible)
- Host/organiser

---

## Direct Messages

Fairfield supports encrypted direct messages using NIP-17/NIP-59 gift wrapping.

### Sending a DM

1. Click the **DM** icon in the navigation
2. Enter the recipient's npub
3. Type your message
4. Click **Send**

### DM Security

- Messages are end-to-end encrypted (NIP-44)
- Gift-wrapped for metadata protection (NIP-59)
- Only you and the recipient can read the content
- Timestamp is fuzzy for privacy

### Finding Someone's npub

You can get someone's npub from:
- Their profile page in Fairfield
- Other Nostr clients
- Direct sharing

---

## Profile Management

### Viewing Your Profile

1. Click your avatar in the top right
2. Select **Profile**

### Editing Your Profile

1. Go to **Profile** > **Edit**
2. Update your information:
   - Display name
   - Avatar URL
   - Bio/About
3. Click **Save**

### Profile Data

Your profile is stored as a Nostr kind 0 event and synced across the Nostr network.

---

## Troubleshooting

### Cannot Login

**Issue**: "Invalid key format" error
- Ensure your key starts with `nsec1` or is exactly 64 hex characters
- Remove any spaces before/after the key
- Try copying the key again from your backup

**Issue**: "Too many login attempts"
- Wait 15 minutes before trying again
- Check that you're using the correct key

### Messages Not Appearing

**Issue**: Sent message doesn't show
- Check your internet connection
- The relay may be temporarily unavailable
- Try refreshing the page

**Issue**: Cannot see messages in a channel
- Verify you have access to the section
- Check if your access is still pending

### Session Expired

**Issue**: Logged out unexpectedly
- Sessions expire after 30 minutes of inactivity
- You'll see a warning 2 minutes before expiration
- Simply log in again with your nsec

### Read-Only Mode

**Issue**: Cannot post messages
- You may be in read-only mode (incomplete signup)
- Look for the yellow banner at the top
- Click **"Complete Signup"** and back up your key

### Lost My Key

**Issue**: Forgot or lost my nsec
- Unfortunately, there is no recovery process
- Without your private key, your account cannot be recovered
- You will need to create a new account

### Browser Issues

**Issue**: App not loading properly
- Clear your browser cache
- Try a different browser
- Disable browser extensions that might interfere
- Check if JavaScript is enabled

---

## Privacy and Security Tips

1. **Never share your nsec** - Anyone with your private key can impersonate you
2. **Verify recipient npubs** - Double-check before sending sensitive DMs
3. **Use a unique key** - Don't reuse keys across services
4. **Log out on shared devices** - Always log out when using public computers
5. **Keep your backup secure** - Treat your key like a bank password

---

## Getting Help

### Community Support

- Join the public chat channels
- Ask questions in the **Fairfield Guests** section

### Technical Issues

- Check the [GitHub Issues](https://github.com/dreamlab-ai/fairfield/issues)
- Report bugs with detailed reproduction steps

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Escape` | Close modal |
| `Tab` | Navigate form fields |

---

## Glossary

| Term | Definition |
|------|------------|
| **Nostr** | Notes and Other Stuff Transmitted by Relays - the protocol Fairfield uses |
| **nsec** | Nostr private key in bech32 format |
| **npub** | Nostr public key in bech32 format |
| **Relay** | Server that stores and forwards Nostr events |
| **Event** | A message or action in the Nostr protocol |
| **NIP** | Nostr Implementation Possibility - protocol specifications |
| **Gift Wrap** | Privacy technique for encrypted messages |
| **Cohort** | User group with specific access permissions |

---

*Last updated: January 2025*
