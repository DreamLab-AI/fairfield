---
title: "Nostr Chat App - Complete Authentication Flow Design"
description: "## Overview"
category: tutorial
tags: ['authentication', 'developer', 'nostr', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Nostr Chat App - Complete Authentication Flow Design

## Overview

This document specifies the complete signup and login flow for a Nostr-based chat application that abstracts Nostr's complexity behind familiar authentication patterns.

**Core Philosophy**: Present as traditional username/password while operating as Nostr-native in the background.

---

## Authentication Architecture

### Terminology Mapping

| User-Facing | Technical | Storage |
|------------|-----------|---------|
| Nickname | Display name | kind 0 (profile) |
| Password | Hex-encoded private key | Client localStorage (encrypted) |
| Recovery Phrase | BIP39 mnemonic | Optional, user-generated |
| Browser Extension | NIP-07 signer | External key management |

### User Mental Model

```
Signup: Nickname + Auto-Generated Password
       ↓
Login: Password (or Recovery Phrase or Extension)
       ↓
Authenticated Session with Nostr events
```

---

## SIGNUP FLOW

### Signup Architecture

```
Signup Entry Point
    ↓
Select Path Dialog (1 screen)
    ├── Path 1: Quick Start (Default) → Quick Signup (2 screens)
    └── Path 2: Secure Setup → Mnemonic Flow (existing)
```

---

### Screen 1: Choose Your Setup Path

**Route**: `/auth/signup`

**Layout**: Centered card with two prominent options

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Create Your Nostr Chat Account                  ║
║                                                            ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 🚀 QUICK START (Recommended)                         │ ║
║  │                                                      │ ║
║  │ Get started in 30 seconds                           │ ║
║  │ • One-click setup                                   │ ║
║  │ • Auto-generated password                           │ ║
║  │ • Perfect for casual users                          │ ║
║  │                                                      │ ║
║  │                    [Choose Quick Start]             │ ║
║  └──────────────────────────────────────────────────────┘ ║
║                                                            ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 🔐 SECURE SETUP                                      │ ║
║  │                                                      │ ║
║  │ For security-conscious users                        │ ║
║  │ • 12-word recovery phrase                           │ ║
║  │ • Full control & backup                             │ ║
║  │ • Recommended for power users                       │ ║
║  │                                                      │ ║
║  │              [Choose Secure Setup]                  │ ║
║  └──────────────────────────────────────────────────────┘ ║
║                                                            ║
║  Already have an account? [Login]                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `SignupPathSelector`

```typescript
interface SignupPathSelectorProps {
  onSelectPath: (path: 'quick' | 'secure') => void;
  isLoading?: boolean;
}
```

**Interactions**:
- Click "Choose Quick Start" → Navigate to `/auth/signup/quick` Screen 2
- Click "Choose Secure Setup" → Navigate to `/auth/signup/secure` (existing mnemonic flow)
- Click "Login" → Navigate to `/auth/login`

---

### Screen 2: Create Your Account (Quick Start)

**Route**: `/auth/signup/quick`

**Layout**: Centered card, single input field

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Create Your Account                             ║
║                                                            ║
║  What's your nickname?                                   ║
║  (This is how others will see you)                       ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Nickname                                           │  ║
║  │ [_________________________________]               │  ║
║  │ 2-50 characters, letters/numbers/underscore        │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ⓘ Your nickname can be changed later in settings        ║
║                                                            ║
║                                                            ║
║                      [Create Account]                     ║
║                                                            ║
║  Back                                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `QuickSignupNickname`

```typescript
interface QuickSignupNicknameProps {
  onSubmit: (nickname: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}

interface SignupFormData {
  nickname: string;
}
```

**Input Validation**:
- **Nickname**:
  - Length: 2-50 characters
  - Allowed: `a-z`, `A-Z`, `0-9`, `_`, `-`
  - Pattern: `^[a-zA-Z0-9_-]{2,50}$`
  - Real-time validation with feedback
  - Cannot be: "admin", "root", "system", "nostr" (reserved words)

**Error States**:
- "Nickname too short (minimum 2 characters)"
- "Nickname too long (maximum 50 characters)"
- "Nickname contains invalid characters"
- "This nickname is reserved"
- "This nickname is already taken" (check against kind 0 profiles)

**Button States**:
- Default: "Create Account" (enabled if valid)
- Loading: "Creating..." (disabled, spinner)
- Success: Transition to Screen 3 (automatic)

**Interactions**:
- Enter text → Real-time validation feedback
- Click "Create Account" →
  1. Generate new keypair
  2. Generate displayName in kind 0 profile
  3. Store hex privkey in localStorage
  4. Create kind 0 event
  5. Navigate to Screen 3 with privkey
- Click "Back" → Return to Screen 1

---

### Screen 3: Your Account Created (Password Display)

**Route**: `/auth/signup/quick/success`

**Layout**: Centered card with prominent warning section

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Account Created! 🎉                             ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ ⚠️  SAVE YOUR PASSWORD                            │  ║
║  │                                                    │  ║
║  │ This is your private login password. We can't     │  ║
║  │ recover it if you lose it. Save it somewhere safe │  ║
║  │ (password manager, paper, etc.)                   │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  Your Password:                                           ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 │ [Copy] │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  Your Nickname:                                           ║
║  alex_smith                                              ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ ☐ I have saved my password in a safe place        │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  [Start Chatting] (disabled)                              ║
║                                                            ║
║  Want more security options? [View Recovery Phrase]      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `QuickSignupSuccess`

```typescript
interface QuickSignupSuccessProps {
  nickname: string;
  hexPrivkey: string;
  publicKey: string;
  onContinue: () => void;
  onGenerateRecoveryPhrase?: () => void;
}

interface SuccessState {
  isSaved: boolean;
  showRecoveryPrompt: boolean;
  copied: boolean;
}
```

**Key Elements**:

1. **Warning Box**:
   - Background: Light red/orange
   - Icon: ⚠️
   - Text: "SAVE YOUR PASSWORD"
   - Explanation of consequences

2. **Password Display**:
   - Monospace font
   - Non-selectable (use copy button only)
   - Display: First 8 chars + "..." + last 8 chars option
   - Copy button behavior:
     - Click → Copy to clipboard
     - Button text: "Copy" → "Copied!" (2 sec)
   - Show warning: "Don't share with anyone"

3. **Nickname Display**:
   - Plain text (already selected)
   - Note: "Can change later"

4. **Checkbox State Machine**:
   ```
   ☐ Unchecked → [Start Chatting] disabled
   ☑ Checked → [Start Chatting] enabled
   ```

5. **Secondary Action**:
   - Link: "Want more security options?"
   - Opens recovery phrase generation modal
   - Allows user to create backup before continuing

**Interactions**:
- Click copy button → Password copied to clipboard, visual feedback
- Check checkbox → Enable "Start Chatting" button
- Click "Start Chatting" →
  1. Verify checkbox state
  2. Publish kind 0 profile event
  3. Store session
  4. Navigate to `/app/chat`
- Click "View Recovery Phrase" → Modal with optional mnemonic backup
- Browser back button → Warn user about unsaved password

---

## LOGIN FLOW

### Login Architecture

```
Login Entry Point
    ↓
Three Tabs / Options
├── Tab 1: Simple Login (Password) - Default active
├── Tab 2: Recovery Phrase
└── Tab 3: Browser Extension (NIP-07)
```

---

### Screen 1: Login - Tab 1: Simple Login (Password)

**Route**: `/auth/login`

**Default Tab**: "Simple Login"

**Layout**: Centered card with tabbed interface

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              Login to Your Chat                           ║
║                                                            ║
║  [Simple Login] [Recovery Phrase] [Browser Extension]    ║
║                                                            ║
║  Enter your password to login                             ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Password                                           │  ║
║  │ [________________________________] [👁 / 👁‍🗨]      │  ║
║  │ This is your account password from signup          │  ║
║  │ 64 character hex string                            │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ⓘ For better security, consider using a browser        ║
║     extension (Alby, nos2x) instead                      ║
║                                                            ║
║                                                            ║
║                          [Login]                          ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ New user? [Create Account]                         │  ║
║  │ Forgot password? [Recover Account]                 │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `LoginSimple`

```typescript
interface LoginSimpleProps {
  onSubmit: (privkey: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

interface LoginFormState {
  privkey: string;
  showPassword: boolean;
  isValidating: boolean;
}
```

**Input Validation**:

- **Privkey Input**:
  - Length: Exactly 64 characters (hex encoded)
  - Format: Hex string (0-9a-f)
  - Pattern: `^[0-9a-f]{64}$` (case-insensitive)
  - Real-time format validation
  - Auto-trimming whitespace
  - Case conversion to lowercase

**Input Behaviors**:
- Show/hide toggle (eye icon)
- Password mode by default (dots)
- Paste friendly (auto-validates)
- Shows "Valid password format" when correct

**Error States**:
- "Invalid password format (must be 64 hex characters)"
- "Password is too short"
- "Password contains invalid characters"
- Network error: "Unable to verify account. Check your connection."
- Auth error: "Invalid password or account not found"
- Rate limit: "Too many login attempts. Please try again in 5 minutes."

**Button States**:
- Default: "Login" (enabled if valid format)
- Loading: "Logging in..." (disabled, spinner)
- Error: "Login" (enabled, error message below)

**Security Notes**:
- Info icon with tooltip: "Your password is your private key. Never share it with anyone."
- No account verification needed (decentralized)
- Password never sent to server

**Interactions**:
- Type password → Real-time format validation
- Click eye icon → Toggle show/hide
- Click "Login" →
  1. Validate format
  2. Derive public key from privkey
  3. Fetch kind 0 profile (if exists)
  4. Create session
  5. Navigate to `/app/chat`
- Click "Create Account" → `/auth/signup`
- Click "Recover Account" → Tab 2
- Tab navigation → Switch between login methods

---

### Screen 1b: Login - Tab 2: Recovery Phrase

**Route**: `/auth/login` (tab-based routing)

**Layout**: Centered card, textarea input

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              Login to Your Chat                           ║
║                                                            ║
║  [Simple Login] [Recovery Phrase] [Browser Extension]    ║
║                                                            ║
║  Enter your 12-word recovery phrase                       ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Recovery Phrase                                    │  ║
║  │ ┌──────────────────────────────────────────────┐  │  ║
║  │ │ one two three four five six seven eight      │  │  ║
║  │ │ nine ten eleven twelve                       │  │  ║
║  │ └──────────────────────────────────────────────┘  │  ║
║  │ 12 words separated by spaces                      │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ⓘ Each word from your backup phrase                      ║
║                                                            ║
║                                                            ║
║                    [Recover Account]                      ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Lost your phrase? [Create New Account]             │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `LoginRecoveryPhrase`

```typescript
interface LoginRecoveryPhraseProps {
  onSubmit: (mnemonic: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

interface RecoveryPhraseState {
  mnemonic: string;
  wordCount: number;
  isValid: boolean;
}
```

**Input Validation**:
- BIP39 word list validation
- Exactly 12 words required
- Words separated by single space
- Case-insensitive
- Real-time word validation with suggestions
- Invalid words highlighted in red

**Error States**:
- "Invalid recovery phrase (not in BIP39 dictionary)"
- "Expected 12 words, got X"
- "Word X is not valid"
- Suggestions: "Did you mean: word1, word2?"
- Derivation error: "Unable to recover account from phrase"

**Button States**:
- Default: "Recover Account" (enabled if valid phrase)
- Loading: "Recovering..." (disabled, spinner)
- Error: "Recover Account" (enabled, error message below)

**Interactions**:
- Paste phrase → Auto-split by spaces
- Type words → Real-time validation
- Click "Recover Account" →
  1. Validate all 12 words (BIP39)
  2. Derive privkey from mnemonic
  3. Derive public key
  4. Create session
  5. Navigate to `/app/chat`
- Click "Create New Account" → `/auth/signup`

---

### Screen 1c: Login - Tab 3: Browser Extension (NIP-07)

**Route**: `/auth/login` (tab-based routing)

**Layout**: Centered card with prominent button

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              Login to Your Chat                           ║
║                                                            ║
║  [Simple Login] [Recovery Phrase] [Browser Extension]    ║
║                                                            ║
║  Connect with your browser extension                      ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Most secure option - your keys never leave your    │  ║
║  │ device. Sign in with Alby, nos2x, or other NIP-07 │  ║
║  │ compatible extensions.                             │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ 🦊 [Connect with Alby]                             │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ 🔐 [Connect with nos2x]                            │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ [Auto-detect Extension]                            │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ 📦 Don't have an extension?                        │  ║
║  │ [Get Alby] [Learn More] [Use Password Instead]    │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `LoginExtension`

```typescript
interface LoginExtensionProps {
  onConnect: (pubkey: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  detectedExtensions?: ExtensionType[];
}

type ExtensionType = 'alby' | 'nos2x' | 'unknown';

interface ExtensionState {
  isConnecting: boolean;
  connectedExtension?: ExtensionType;
  pubkey?: string;
}
```

**Extension Detection**:
- Check for `window.nostr` API
- Identify extension by user agent or metadata
- Show detected extension first
- Fallback to manual selection

**Error States**:
- "No NIP-07 extension detected"
- "Extension not responding"
- "User cancelled extension permission"
- "Failed to get public key from extension"
- "Unable to create session"

**Button Behaviors**:

1. **[Connect with Alby]**:
   - Check if available: window.nostr + Alby detection
   - On click:
     - Request pubkey via `window.nostr.getPublicKey()`
     - Extension shows permission dialog
     - Receive pubkey
     - Create session
     - Navigate to `/app/chat`

2. **[Auto-detect Extension]**:
   - Scan for available extensions
   - Show results
   - Auto-connect if only one available

3. **[Get Alby]**:
   - Open new tab to Alby download page
   - Links: https://getalby.com

**Interactive States**:
- Default: All buttons enabled
- Connecting: "Connecting..." (disabled, spinner)
- Permission dialog shown: UI in waiting state
- Error: Error message + retry buttons enabled

**Interactions**:
- Click extension button →
  1. Call `window.nostr.getPublicKey()`
  2. Show permission dialog (extension handles)
  3. Receive pubkey
  4. Create session with NIP-07 flag
  5. Navigate to `/app/chat`
- Click "Auto-detect" → Scan and list available extensions
- Click "Get Alby" → Open browser tab
- Click "Use Password Instead" → Switch to Tab 1

---

## POST-LOGIN SECURITY PROMPTS

### Progressive Security Upgrade (Triggered at Login #4)

**Route**: Modal overlay after successful login

**Trigger Condition**:
- User has logged in 3+ times using "Simple Login" (password) method
- No recovery phrase created
- No extension configured
- Not shown more than once per 7 days

**Layout**: Modal dialog, centered

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Upgrade Your Account Security                   ║
║                                                            ║
║  You've logged in X times using your password. Let's     ║
║  secure your account with additional options.            ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ ✓ Option 1: Create Recovery Phrase               │  ║
║  │   Backup your account with a 12-word phrase       │  ║
║  │   you can use to recover your account anytime.    │  ║
║  │                                                    │  ║
║  │   [Create Recovery Phrase]                        │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ ✓ Option 2: Install Browser Extension            │  ║
║  │   Use Alby or nos2x for the most secure login.    │  ║
║  │   Your keys stay safe on your device.             │  ║
║  │                                                    │  ║
║  │   [Get Browser Extension]                         │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ [Maybe Later]                                      │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Component**: `SecurityUpgradePrompt`

```typescript
interface SecurityUpgradePromptProps {
  loginCount: number;
  onCreateRecoveryPhrase: () => void;
  onInstallExtension: () => void;
  onDismiss: () => void;
  isShowing: boolean;
}

interface PromptState {
  selectedOption?: 'recovery' | 'extension' | null;
  isProcessing: boolean;
}
```

**Trigger Logic**:
```typescript
// In LoginSuccess handler
if (loginMethod === 'simple-login' && loginCount >= 3) {
  if (!hasRecoveryPhrase && !usesExtension) {
    showSecurityUpgradePrompt();
  }
}

// Store in localStorage
localStorage.setItem('lastSecurityPrompt', Date.now());

// Don't show again within 7 days
const lastShown = localStorage.getItem('lastSecurityPrompt');
if (Date.now() - lastShown < 7 * 24 * 60 * 60 * 1000) {
  return;
}
```

**Interactions**:
- Click "Create Recovery Phrase" →
  1. Show recovery phrase generation modal
  2. Allow user to backup
  3. Return to chat
- Click "Get Browser Extension" →
  1. Open new tab to Alby/nos2x
  2. Show setup instructions
  3. Allow user to return and connect extension later
- Click "Maybe Later" →
  1. Dismiss modal
  2. Store timestamp
  3. Don't show again for 7 days
  4. Continue to chat

---

## Component Structure

### Directory Layout

```
src/
├── components/
│   ├── auth/
│   │   ├── SignupPathSelector.tsx
│   │   ├── QuickSignupNickname.tsx
│   │   ├── QuickSignupSuccess.tsx
│   │   ├── LoginTabs.tsx
│   │   ├── LoginSimple.tsx
│   │   ├── LoginRecoveryPhrase.tsx
│   │   ├── LoginExtension.tsx
│   │   ├── SecurityUpgradePrompt.tsx
│   │   └── PasswordDisplay.tsx
│   └── common/
│       ├── WarningBox.tsx
│       ├── InfoBox.tsx
│       ├── TabNavigation.tsx
│       └── CopyButton.tsx
├── hooks/
│   ├── useSignup.ts
│   ├── useLogin.ts
│   ├── useNostr.ts
│   ├── useExtension.ts
│   └── useLocalStorage.ts
├── utils/
│   ├── crypto.ts (nostr key generation)
│   ├── validation.ts (input validation)
│   ├── storage.ts (secure localStorage)
│   └── formatting.ts (display formatting)
├── types/
│   ├── auth.ts
│   ├── nostr.ts
│   └── validation.ts
└── pages/
    ├── auth/
    │   ├── signup/
    │   │   ├── index.tsx (path selector)
    │   │   ├── quick.tsx (Screen 2)
    │   │   └── success.tsx (Screen 3)
    │   └── login.tsx (unified login)
    └── app/
        └── chat.tsx
```

---

## Input Validation Rules

### Nickname Validation

```typescript
interface NicknameValidation {
  minLength: 2;
  maxLength: 50;
  pattern: /^[a-zA-Z0-9_-]{2,50}$/;
  reserved: ['admin', 'root', 'system', 'nostr'];
  uniqueCheck: async (nickname: string) => boolean;
  feedback: {
    tooShort: 'Nickname too short (minimum 2 characters)',
    tooLong: 'Nickname too long (maximum 50 characters)',
    invalidChars: 'Nickname contains invalid characters (use letters, numbers, _ or -)',
    reserved: 'This nickname is reserved',
    taken: 'This nickname is already taken',
    valid: 'Nickname available ✓',
  };
}
```

### Privkey Validation

```typescript
interface PrivkeyValidation {
  length: 64;
  pattern: /^[0-9a-f]{64}$/i;
  feedback: {
    tooShort: 'Password too short',
    tooLong: 'Password too long',
    invalidChars: 'Password contains invalid characters (must be hex)',
    format: 'Invalid password format',
    valid: 'Valid password format ✓',
  };
}
```

### Mnemonic Validation

```typescript
interface MnemonicValidation {
  wordCount: 12;
  dictionary: 'BIP39';
  separator: /\s+/; // flexible whitespace
  feedback: {
    invalidWord: (word: string) => `"${word}" is not a valid word`,
    wordCount: (count: number) => `Expected 12 words, got ${count}`,
    suggestions: (word: string) => string[], // Similar valid words
    valid: 'Valid recovery phrase ✓',
  };
}
```

---

## Warning & Info Messaging

### Warning Boxes (Red/Orange Theme)

**Save Password Warning** (Screen 3):
```
⚠️  SAVE YOUR PASSWORD

This is your private login password. We can't recover it
if you lose it. Save it somewhere safe (password manager,
paper, secure note, etc.)
```

**Extension Security Info** (Login Tab 3):
```
ℹ️  MOST SECURE OPTION

Your keys never leave your device. Extensions like Alby
manage your keys locally, and this app only requests
permission to sign messages.
```

**Simple Login Security Note** (Login Tab 1):
```
ℹ️  SECURITY TIP

For better security, consider using a browser extension
(Alby, nos2x) instead. Your keys stay safer on your device.
```

### Info Tooltips

**Password field tooltip**:
```
Your password is your Nostr private key encoded as hex.

⚠️  Never share with anyone.
⚠️  We cannot recover it if lost.
✓  You can export it anytime in settings.
```

**Nickname tooltip**:
```
This is your public display name in chat.
You can change it anytime in settings.
```

**Recovery Phrase tooltip**:
```
12 random words that can regenerate your account.
Save in a safe place!
```

---

## Button States & Interactions

### Primary Action Buttons

**State Machine**:
```
Default (valid input)
  → Hover: Background darkens, cursor pointer
  → Active/Press: Background darker
  → Loading: Spinner + text "Loading..."
  → Success: Not applicable (navigate away)
  → Error: Back to default, error message shown
  → Disabled: Opacity 50%, cursor not-allowed
```

**Example States**:

```typescript
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  isError: boolean;
  text: string;
  onClick: () => Promise<void>;
}

// Login button
{
  isLoading: false,
  isDisabled: !isValidPrivkey,
  isError: false,
  text: 'Login',
  onClick: handleLogin,
}

// After click
{
  isLoading: true,
  isDisabled: true,
  isError: false,
  text: 'Logging in...',
  onClick: () => {}, // no-op
}

// Error case
{
  isLoading: false,
  isDisabled: false,
  isError: true,
  text: 'Login',
  onClick: handleLogin, // can retry
}
```

### Secondary Buttons

- Text links for navigation
- No disabled state
- Hover: Underline or color change
- Click: Navigate or switch tabs

---

## Error Handling & Recovery

### Error Categories

**1. Validation Errors** (Client-side)
- User can see and fix immediately
- Real-time feedback
- Example: "Invalid password format"

**2. Lookup Errors** (Network/Data)
- Account not found
- Unable to fetch kind 0 profile
- Allow user to retry or try different method

**3. Derivation Errors** (Crypto)
- Invalid privkey derivation
- Invalid mnemonic derivation
- User should double-check input

**4. Rate Limit Errors** (Server)
- Too many login attempts
- Show countdown timer
- Suggest recovery phrase or extension method

### Error Message Patterns

**Format**:
```
[Icon] Title
Description with actionable next steps
[Action Button] or [Try Again]
```

**Example**:
```
⚠️  Invalid Password

The password you entered is not valid. Make sure it's
exactly 64 characters and contains only hex characters
(0-9, a-f).

[Try Again] [Use Recovery Phrase Instead] [Create New Account]
```

---

## Security Considerations

### Client-Side

- Private keys stored in localStorage (encrypted if possible)
- Never transmit privkey to backend
- Clear sensitive data on logout
- Use `event.preventDefault()` on password fields
- Disable browser autocomplete for password (optional - balances UX)

### Backend (if applicable)

- Only store public keys and kind 0 profiles
- No authentication backend needed (Nostr is decentralized)
- Validate signatures for user-created events

### User Education

- Display warnings on password display
- Emphasize "this is a password" not a recovery phrase
- Suggest browser extension as default for new installs
- Show security upgrade prompt progressively

---

## Copy & Messages Reference

### Signup Path Selector

**Heading**: "Create Your Nostr Chat Account"

**Quick Start Card**:
- Title: "🚀 QUICK START (Recommended)"
- Features:
  - "Get started in 30 seconds"
  - "One-click setup"
  - "Auto-generated password"
  - "Perfect for casual users"
- Button: "Choose Quick Start"

**Secure Setup Card**:
- Title: "🔐 SECURE SETUP"
- Features:
  - "For security-conscious users"
  - "12-word recovery phrase"
  - "Full control & backup"
  - "Recommended for power users"
- Button: "Choose Secure Setup"

**Footer**: "Already have an account? [Login]"

---

### Quick Signup - Nickname Screen

**Heading**: "Create Your Account"

**Label**: "What's your nickname?"

**Sublabel**: "(This is how others will see you)"

**Help Text**: "2-50 characters, letters/numbers/underscore"

**Note**: "ⓘ Your nickname can be changed later in settings"

**Button**: "Create Account"

**Secondary**: "[Back]"

---

### Quick Signup - Success Screen

**Heading**: "Account Created! 🎉"

**Warning Box**:
- Title: "⚠️  SAVE YOUR PASSWORD"
- Text: "This is your private login password. We can't recover it if you lose it. Save it somewhere safe (password manager, paper, etc.)"

**Label**: "Your Password:"

**Help**: "Your unique login password (save in password manager)"

**Label**: "Your Nickname:"

**Help**: "(Can change anytime)"

**Checkbox**: "I have saved my password in a safe place"

**Button**: "[Start Chatting]" (disabled until checkbox)

**Secondary Link**: "Want more security options? [View Recovery Phrase]"

---

### Login - Simple Tab

**Heading**: "Login to Your Chat"

**Label**: "Enter your password to login"

**Input Placeholder**: "Your 64-character password"

**Help**: "This is your account password from signup"

**Security Note**: "ⓘ For better security, consider using a browser extension (Alby, nos2x) instead"

**Button**: "[Login]"

**Footer Links**:
- "New user? [Create Account]"
- "Forgot password? [Recover Account]"

---

### Login - Recovery Phrase Tab

**Heading**: "Recover Account with Recovery Phrase"

**Label**: "Enter your 12-word recovery phrase"

**Input Placeholder**: "one two three four five six..."

**Help**: "Each word from your backup phrase"

**Button**: "[Recover Account]"

**Footer Links**:
- "Lost your phrase? [Create New Account]"

---

### Login - Extension Tab

**Heading**: "Connect with Browser Extension"

**Intro**: "Most secure option - your keys never leave your device. Sign in with Alby, nos2x, or other NIP-07 compatible extensions."

**Button 1**: "🦊 Connect with Alby"

**Button 2**: "🔐 Connect with nos2x"

**Button 3**: "[Auto-detect Extension]"

**No Extension Box**:
- Title: "📦 Don't have an extension?"
- Links: "[Get Alby] [Learn More] [Use Password Instead]"

---

### Security Upgrade Prompt

**Heading**: "Upgrade Your Account Security"

**Text**: "You've logged in X times using your password. Let's secure your account with additional options."

**Option 1**:
- Checkbox: ✓
- Title: "Create Recovery Phrase"
- Description: "Backup your account with a 12-word phrase you can use to recover your account anytime."
- Button: "[Create Recovery Phrase]"

**Option 2**:
- Checkbox: ✓
- Title: "Install Browser Extension"
- Description: "Use Alby or nos2x for the most secure login. Your keys stay safe on your device."
- Button: "[Get Browser Extension]"

**Button**: "[Maybe Later]"

---

## Testing Scenarios

### Happy Path: Quick Signup
1. User opens app → See path selector
2. Click "Quick Start" → Nickname screen
3. Enter "alex_smith" → Create Account
4. See password display → Copy password
5. Check checkbox → Start Chatting enabled
6. Click "Start Chatting" → Chat home page
7. Can chat immediately

### Happy Path: Login with Password
1. User opens app → Redirect to login
2. Login tab active by default
3. Enter 64-char hex password
4. Click "Login" → Authenticated
5. Chat home page loads

### Happy Path: Login with Extension
1. User opens app → Login page
2. Click Extension tab
3. Browser extension detected
4. Click "Connect with Alby"
5. Permission dialog shows
6. User approves
7. Authenticated → Chat home page

### Security Upgrade Flow
1. User logs in 4th time with password
2. Modal shows after login
3. Click "Create Recovery Phrase"
4. Modal closes, recovery flow starts
5. User backs up phrase
6. Return to chat

### Error Case: Invalid Password
1. User enters wrong-length password
2. Real-time validation shows error
3. Button disabled
4. User fixes → Error clears → Button enabled
5. Click Login → "Invalid password or account not found"
6. Can retry or try other method

### Error Case: Lost Password
1. User on Simple Login tab
2. Click "Recover Account"
3. Switch to Recovery Phrase tab
4. Enter 12-word phrase
5. Account recovered → Login successful

---

## Responsive Design Notes

### Mobile (< 640px)

- Full-width cards
- Buttons stack vertically
- Password display uses smaller font
- Copy button always visible
- Tab navigation: Scrollable horizontal or dropdown
- Modal: Full screen or large overlay
- Touch-friendly: Larger tap targets (48px minimum)

### Tablet (640px - 1024px)

- Centered cards with 90% width
- Side-by-side elements where possible
- Tab navigation: Horizontal line
- Modal: Centered, constrained width

### Desktop (> 1024px)

- Centered cards with max-width 600px
- Full tab interface visible
- Modal: Centered overlay with backdrop

---

## Accessibility Requirements

- ✓ All inputs labeled properly
- ✓ Error messages associated with inputs
- ✓ Color not only indicator (+ text)
- ✓ Tab order logical
- ✓ Focus visible on all interactive elements
- ✓ ARIA labels for icons
- ✓ Keyboard navigation: Tab, Enter, Escape
- ✓ Screen reader friendly copy
- ✓ Sufficient color contrast (WCAG AA)

---

## Summary

This complete authentication flow provides:

1. **Two signup paths** - Quick Start for casual users, Secure Setup for power users
2. **Three login methods** - Password, Recovery Phrase, Browser Extension
3. **Progressive security** - Gentle upgrades without forcing
4. **Clear messaging** - Hidden Nostr complexity, familiar UX patterns
5. **Comprehensive validation** - Real-time feedback and clear errors
6. **Mobile-friendly** - Responsive design from start
7. **Accessibility** - WCAG compliant

The system abstracts Nostr as a traditional username/password app while maintaining true decentralized key management and user sovereignty.
