# Authentication Components

[Back to Main README](../../../../README.md)

Complete Svelte authentication flow for Fairfield with Tailwind CSS and DaisyUI styling.

## Components

### 1. Signup.svelte
Entry point for new users. Generates a Nostr keypair on button click.

**Features:**
- "Create Account" button
- Loading state during key generation
- Error display
- Link to login for existing users

**Events:**
- `on:next` - Emitted with `{ publicKey, privateKey }` to proceed to backup
- `on:login` - Emitted when user wants to switch to login

### 2. NsecBackup.svelte
Forces user to backup their nsec (private key) before continuing.

**Props:**
- `publicKey: string` - User's public key (hex)
- `privateKey: string` - User's private key (hex)

**Features:**
- Displays nsec-encoded private key
- Copy button with success feedback
- Download button to save as text file
- "I've backed up my key" checkbox (required)
- Continue button (disabled until backup confirmed)

**Events:**
- `on:continue` - Emitted when user confirms they've backed up

### 3. Login.svelte
Restore account using nsec or hex private key.

**Features:**
- Single password input for private key
- Supports nsec1... format or 64-character hex
- Validation with error feedback
- Enter key to submit

**Events:**
- `on:success` - Emitted with `{ publicKey, privateKey }`
- `on:signup` - Emitted when user wants to create new account

### 4. FastSignup.svelte
One-click "quick browse" signup with read-only access.

**Features:**
- Instantly generates keypair
- Clear warning about read-only limitations
- Option to complete full signup later
- Marks account as 'incomplete'

**Events:**
- `on:success` - Emitted with `{ publicKey, privateKey }`

### 5. PendingApproval.svelte
Waiting screen for admin approval.

**Props:**
- `publicKey: string` - User's public key (hex)

**Features:**
- Animated loading indicator with pulsing clock
- Rotating spinner border
- npub-encoded public key display
- Copy pubkey button
- Auto-polls whitelist status
- Status checklist

**Events:**
- `on:approved` - Emitted when user is approved

### 6. AuthFlow.svelte
Orchestrator component for complete authentication flows.

**Flow Steps:**
1. **Signup** → NsecBackup → PendingApproval
2. **Login** → PendingApproval

## Usage

### Individual Components

```svelte
<script>
  import { Signup, NsecBackup, Login, FastSignup, PendingApproval } from '$lib/components/auth';

  let publicKey = '';
  let privateKey = '';
</script>

<Signup
  on:next={(e) => {
    publicKey = e.detail.publicKey;
    privateKey = e.detail.privateKey;
    // Show NsecBackup next
  }}
  on:login={() => {
    // Switch to login view
  }}
/>
```

### Complete Flow

```svelte
<script>
  import { AuthFlow } from '$lib/components/auth';
</script>

<AuthFlow />
```

## State Management

Uses `$lib/stores/auth.ts`:

```typescript
interface AuthState {
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  accountStatus: 'incomplete' | 'complete';
  nsecBackedUp: boolean;
  isPending: boolean;
  error: string | null;
}
```

### Account Status

- **incomplete**: Fast signup, read-only access
- **complete**: Full signup with nsec backup confirmed

## Dependencies

Required packages (already in package.json):
- `nostr-tools` - Nostr key operations (secp256k1, nip19)
- `@noble/hashes` - Cryptographic utilities
- `tailwindcss` + `daisyui` - Styling

## Styling

All components use:
- DaisyUI component classes (btn, card, alert, etc.)
- Tailwind utility classes for layout
- Mobile-responsive design with breakpoints
- Dark mode compatible (DaisyUI theme system)

## Security Features

- Client-side key generation (no server transmission)
- Direct secp256k1 keypair generation (no mnemonic)
- nsec format for Nostr-native key backup
- Forced backup confirmation before account completion
- localStorage for key persistence with secure context validation
- Copy-to-clipboard for secure backup
- Visual warnings about key security
