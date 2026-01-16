---
title: "Nostr Chat Authentication - Design Summary"
description: "Complete specification for signup and login flows with Nostr abstraction."
category: tutorial
tags: ['authentication', 'developer', 'nostr', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Nostr Chat Authentication - Design Summary

Complete specification for signup and login flows with Nostr abstraction.

## The Challenge

Build authentication for a Nostr-based chat app that:
- Hides Nostr complexity from new users
- Provides familiar username/password UX
- Maintains true decentralization (no backend auth)
- Offers progressive security upgrades
- Supports three login methods

## The Solution

### Core Principle: Familiar Abstractions

**Map Nostr concepts to familiar terms**:
- "Nickname" → `kind 0 displayName` (public, changeable)
- "Password" → Hex-encoded private key (private, non-recoverable)
- "Recovery Phrase" → BIP39 mnemonic backup
- "Browser Extension" → NIP-07 signer for key management

Users see traditional auth. Behind the scenes: pure Nostr.

---

## Flow Overview

### Signup: Two Paths

**Path 1: Quick Start (Default)**
```
User clicks "Create Account"
    ↓
Prompt for nickname (2-50 chars)
    ↓
Generate keypair + kind 0 profile
    ↓
Display password with "Save it" warning
    ↓
Require checkbox before continuing
    ↓
Set up complete
```

**Path 2: Secure Setup**
```
User wants "more security"
    ↓
Generate 12-word BIP39 mnemonic
    ↓
Derive keys from mnemonic
    ↓
Display both password and phrase
    ↓
Require backup confirmation
```

### Login: Three Methods

**Tab 1: Simple Login (Default)**
- Paste hex password
- Real-time validation
- Auto-derive public key
- Fetch kind 0 profile

**Tab 2: Recovery Phrase**
- Paste 12-word mnemonic
- Word validation with suggestions
- Auto-derive keys

**Tab 3: Browser Extension**
- Click "Connect with Alby/nos2x"
- Extension manages keys securely
- User approves in extension UI

### Post-Login Security

After 3+ logins with simple method:
```
Show optional upgrade prompt
├─ "Create Recovery Phrase"
├─ "Install Browser Extension"
└─ "Maybe Later" (reminders in 7 days)
```

---

## Key Features

### 1. Input Validation

**Real-Time Feedback**
- As user types, show validation state
- Green checkmark for valid
- Red error for invalid
- Suggestions for similar words (mnemonic)

**Validation Rules**

| Input | Format | Length | Rules |
|-------|--------|--------|-------|
| Nickname | alphanumeric + `_-` | 2-50 | No reserved words, unique check |
| Password | hex | exactly 64 | 0-9a-f only, case insensitive |
| Mnemonic | space-separated words | exactly 12 | BIP39 wordlist, suggestions |

### 2. Security Messaging

**Warning Boxes** (⚠️ red/orange)
- "SAVE YOUR PASSWORD" on signup
- "We can't recover it" - emphasizes importance

**Info Boxes** (ℹ️ blue)
- "Most secure option" - for browser extensions
- "Security tip" - suggests extension for simple login

**Tooltips** (on hover/click)
- Explain what password actually is
- When safe to share (never)
- Where to find it later (settings)

### 3. Accessibility

✓ Semantic HTML
✓ ARIA labels for all inputs
✓ Tab navigation
✓ Focus indicators
✓ Color + text indicators (not color alone)
✓ 1.5x minimum tap targets on mobile
✓ Screen reader friendly copy

---

## Technical Architecture

### Component Hierarchy

```
App
├─ AuthLayout (wrapper)
│  ├─ SignupPathSelector (2 cards)
│  │  └─ Publish kind 0 profile
│  ├─ QuickSignupNickname (collect name)
│  │  └─ Generate keypair
│  ├─ QuickSignupSuccess (show password)
│  │  └─ Copy password button
│  ├─ LoginTabs (3 tabs)
│  │  ├─ LoginSimple (paste password)
│  │  ├─ LoginRecoveryPhrase (paste 12 words)
│  │  └─ LoginExtension (click button)
│  └─ SecurityUpgradePrompt (after 3 logins)
└─ ChatHome (authenticated)
```

### State Management

**Component State**
- Form inputs
- Validation errors
- Loading states
- Tab selection

**Session State** (localStorage)
- Authenticated user
- Login method
- Session expiry

**Security Metrics** (localStorage)
- Login count
- Last login method
- Has recovery phrase
- Uses extension
- Last prompt date

### Utilities

**Crypto** (`src/utils/crypto.ts`)
- Generate keypair
- Derive public key
- Sign events
- Convert formats (hex ↔ bech32)

**Validation** (`src/utils/validation.ts`)
- Real-time input validation
- BIP39 word checking
- Similar word suggestions
- Nickname availability check

**Storage** (`src/utils/storage.ts`)
- Save/load session
- Save/load metrics
- Clear on logout

**Nostr** (`src/utils/nostr-profile.ts`)
- Create/publish kind 0
- Fetch profiles
- Parse metadata

**Extensions** (`src/utils/nip07.ts`)
- Detect installed extensions
- Request public key
- Sign with extension

---

## Design Patterns

### 1. Progressive Validation

```typescript
// Step 1: User starts typing
"al" → no error (too short, but let them continue)

// Step 2: Minimum met
"alice" → ✓ Valid nickname available

// Step 3: Reserved word
"admin" → ✗ This nickname is reserved

// Step 4: Already taken
"bob" → ✗ This nickname is already taken
```

### 2. Graceful Error Recovery

```
User enters invalid input
       ↓
Error message appears
       ↓
User can see what's wrong
       ↓
User fixes it
       ↓
Error automatically clears
       ↓
Can submit again
```

### 3. Security Through Defaults

```
Default shown: Simple Login (easy)
But warns: "Consider browser extension"
           "Better security available"
           "Create recovery phrase" (suggested after 3 logins)
```

### 4. Confirmation Before Risk

```
Signup success screen:
  ✗ Copy password → Password shown
  ✓ Checkbox "I have saved it"
  ✗ Button disabled until checkbox
  ✓ Button enabled after checkbox
```

---

## User Flows

### Happy Path: New User Signup

```
1. "Create Account" button
   ↓
2. Path selector (Quick Start highlighted)
   ↓
3. "What's your nickname?" → "alice_smith"
   ↓
4. Real-time validation → ✓ Available
   ↓
5. "Create Account" button
   ↓
6. Password display
   ↓
7. "Copy" → ✓ Copied!
   ↓
8. Check "I have saved it"
   ↓
9. "Start Chatting" → Chat home
```

### Recovery Path: Forgot Password

```
1. Login screen
   ↓
2. "Forgot password? Recover Account" link
   ↓
3. Switch to "Recovery Phrase" tab
   ↓
4. Paste: "one two three four..."
   ↓
5. Real-time word validation
   ↓
6. "Recover Account"
   ↓
7. Logged in with recovered account
```

### Security Path: Use Extension

```
1. Login → "Browser Extension" tab
   ↓
2. "Connect with Alby" button
   ↓
3. Alby extension shows permission dialog
   ↓
4. User approves in extension
   ↓
5. App receives pubkey
   ↓
6. Logged in, keys never left device
```

### Progressive Security: Post-Login Prompt

```
1. User logs in 4th time with password
   ↓
2. Modal appears: "Upgrade Your Security"
   ↓
3. Two options:
   - Create Recovery Phrase
   - Install Browser Extension
   ↓
4. User can:
   - Click option (or follow link)
   - Click "Maybe Later" (won't ask for 7 days)
   ↓
5. Continue to chat
```

---

## Content & Copy

### Signup Path Selector

**Quick Start Card:**
- Icon: 🚀
- Title: "QUICK START (Recommended)"
- Features: "30 seconds, one-click, auto-generated password, casual users"

**Secure Setup Card:**
- Icon: 🔐
- Title: "SECURE SETUP"
- Features: "Security-conscious, 12-word backup, full control, power users"

### Signup Nickname Screen

**Heading:** "Create Your Account"
**Label:** "What's your nickname?"
**Sublabel:** "(This is how others will see you)"
**Help:** "2-50 characters, letters/numbers/underscore"
**Note:** "ⓘ Your nickname can be changed later in settings"

### Signup Success Screen

**Heading:** "Account Created! 🎉"

**Warning Box:**
```
⚠️ SAVE YOUR PASSWORD

This is your private login password. We can't recover it
if you lose it. Save it somewhere safe (password manager,
paper, etc.)
```

**Password Field:**
- Monospace font
- Non-selectable (copy button only)
- Shows: "a1b2c3...w9x8y7" (first 8 + ... + last 8)
- Copy button: "Copy" → "Copied!" (2 sec)

**Nickname Field:**
- Plain display
- "(Can change anytime)"

**Checkbox:** "I have saved my password in a safe place"

**Button State:**
- Unchecked: Disabled
- Checked: Enabled "Start Chatting"

### Login Tabs

**Simple Tab:**
```
Label: "Enter your password to login"
Input: "Your 64-character password"
Help: "This is your account password from signup"
Info: "ⓘ For better security, consider using a browser
       extension (Alby, nos2x) instead"
```

**Recovery Tab:**
```
Label: "Enter your 12-word recovery phrase"
Input: Textarea with placeholder "one two three four..."
Help: "Each word from your backup phrase"
Words shown: With numbers, validation status
```

**Extension Tab:**
```
Title: "Connect with Browser Extension"
Info: "Most secure option - your keys never leave your device"
Buttons: [Connect with Alby] [Connect with nos2x]
Fallback: "Don't have an extension? [Get Alby] [Learn More] [Use Password]"
```

### Security Upgrade Prompt

```
Heading: "Upgrade Your Account Security"

Intro: "You've logged in X times using your password.
        Let's secure your account with additional options."

Option 1:
- Icon: ✓
- Title: "Create Recovery Phrase"
- Description: "Backup your account with a 12-word phrase
               you can use to recover your account anytime."
- Button: "Create Recovery Phrase"

Option 2:
- Icon: ✓
- Title: "Install Browser Extension"
- Description: "Use Alby or nos2x for the most secure login.
               Your keys stay safe on your device."
- Button: "Get Browser Extension"

Button: "Maybe Later"
```

---

## Error Handling

### Validation Errors (User can fix)

```
Nickname too short (min 2 chars)
Nickname too long (max 50 chars)
Nickname has invalid characters (use: a-z, 0-9, _, -)
Nickname is reserved (admin, root, etc.)
Nickname already taken (check against kind 0 profiles)

Password too short (need 64 chars)
Password too long (max 64 chars)
Password has invalid characters (use hex: 0-9, a-f)

Word "xyz" is not valid (with suggestions: abc, ayz, xbc)
Expected 12 words, got X
```

### Recovery Errors (User should try other method)

```
Invalid password or account not found
Network error - check your connection
Unable to derive keys from mnemonic
Extension not responding
User denied extension permission
```

### Network Errors (Transient)

```
Unable to check nickname availability (proceed anyway)
Unable to fetch profile (use defaults)
Unable to publish to relays (can do later)
```

---

## Responsive Design

### Mobile (< 640px)

- Full-width layout
- Single column
- Buttons stack vertically
- Password shown in smaller font
- Copy button always visible
- Larger touch targets (48px min)
- Tabs: Scrollable or dropdown
- Modal: Full-screen overlay

### Tablet (640px - 1024px)

- Centered cards (90% width)
- Some horizontal layout
- Tab navigation: Horizontal line
- Modal: Centered with padding

### Desktop (> 1024px)

- Centered cards (max 600px)
- Tab navigation: Full horizontal
- Side-by-side elements where applicable
- Modal: Centered overlay with backdrop

---

## Security Considerations

### Client-Side

✓ Private keys stored only in browser memory/localStorage
✓ Never transmitted to server
✓ Auto-clear sensitive data on logout
✓ Prevent browser autocomplete on password
✓ Use secure session timeout
✓ Validate inputs on both client and (if applicable) server

### Backend (None Required!)

This is decentralized Nostr:
- No authentication backend
- No password database
- No server-side keys
- User is sovereign

### User Education

✓ Clear warnings about password importance
✓ Explain it's non-recoverable
✓ Suggest browser extension as default
✓ Progressive prompts for security upgrades
✓ Tooltips explain concepts

---

## Testing Checklist

### Functional Tests

- [ ] Signup with quick start path completes
- [ ] Signup generates valid keypair
- [ ] Password copy button works
- [ ] Cannot continue without saving password checkbox
- [ ] Login with password works
- [ ] Login with mnemonic works
- [ ] Login with extension works
- [ ] Security prompt shows after 3 password logins
- [ ] Validation shows real-time feedback
- [ ] Error messages are clear and actionable
- [ ] Session persists across page refresh
- [ ] Logout clears session

### Security Tests

- [ ] Private key never sent to server
- [ ] Private key never logged to console
- [ ] Mnemonic never transmitted
- [ ] Extension login doesn't expose keys
- [ ] localStorage cleared on logout
- [ ] Session doesn't persist after logout
- [ ] Inputs sanitized (XSS prevention)
- [ ] CSRF tokens (if backend exists)

### Accessibility Tests

- [ ] All inputs have labels
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Color + text for errors
- [ ] Screen reader friendly
- [ ] WCAG AA compliant
- [ ] Mobile keyboard friendly

### Browser Compatibility

- [ ] Chrome/Edge 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Mobile Chrome/Safari
- [ ] Extension compatibility

---

## Files Delivered

### Documentation

1. **AUTH_FLOW_DESIGN.md** (Main specification)
   - Complete screen-by-screen flows
   - Exact copy and messaging
   - Button states and interactions
   - Warnings and info boxes

2. **COMPONENT_STRUCTURE.md** (Code architecture)
   - Component hierarchy
   - Props and state for each component
   - Full TypeScript interfaces
   - Reusable UI components

3. **AUTH_IMPLEMENTATION_GUIDE.md** (Developer guide)
   - Utility functions (crypto, validation, storage)
   - Nostr integration (profiles, relays)
   - Extension integration (NIP-07)
   - Hooks (signup, login)
   - Testing examples
   - Configuration

4. **AUTH_DESIGN_SUMMARY.md** (This file)
   - Overview of solution
   - Key features and patterns
   - User flows
   - Content and copy
   - Testing checklist

### Type Definitions

5. **src/types/auth.ts** (Authentication types)
   - AuthState, AuthenticatedUser
   - SignupState, LoginFormState
   - NostrProfile, Keypair
   - SecurityMetrics

6. **src/types/validation.ts** (Validation schemas)
   - Validation rules and feedback
   - Error/info messages
   - Form submission states

7. **src/types/nostr.ts** (Nostr protocol types)
   - NostrEvent, NostrMetadata
   - Keypair formats
   - NIP-07 signer interface

---

## Implementation Roadmap

**Phase 1: Types & Utilities** (1-2 days)
- [ ] Create type definitions
- [ ] Create crypto utilities
- [ ] Create validation utilities
- [ ] Create storage utilities

**Phase 2: Components** (3-4 days)
- [ ] Create layout components
- [ ] Create signup components
- [ ] Create login components
- [ ] Create shared UI components

**Phase 3: Integration** (2-3 days)
- [ ] Create hooks (signup, login)
- [ ] Integrate Nostr/relays
- [ ] Integrate browser extensions
- [ ] Create auth context

**Phase 4: Testing** (2-3 days)
- [ ] Unit tests for utilities
- [ ] Component tests
- [ ] Integration tests
- [ ] Accessibility tests

**Phase 5: Polish** (1-2 days)
- [ ] Error message refinement
- [ ] Loading states
- [ ] Mobile optimization
- [ ] Browser testing

---

## Success Criteria

✓ Users can sign up in <2 minutes
✓ Users can log in in <30 seconds
✓ Nostr complexity hidden but available
✓ Security guidance provided without friction
✓ Progressive upgrades to browser extension
✓ Mobile-friendly (no horizontal scroll)
✓ Accessible (WCAG AA)
✓ No private keys transmitted
✓ Clear error messages
✓ Works with real relays and extensions

---

## Final Notes

This design successfully abstracts Nostr as traditional authentication while maintaining true decentralization and user sovereignty. The progressive security approach respects user choice while guiding toward better practices.

Key innovation: Hiding complexity without removing power. New users get familiar UX. Power users can use recovery phrases and browser extensions. Everyone owns their keys.
