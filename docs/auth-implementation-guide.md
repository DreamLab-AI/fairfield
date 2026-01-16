---
title: "Authentication Implementation Guide"
description: "Complete implementation reference for Nostr-based signup and login flows."
category: howto
tags: ['authentication', 'developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Authentication Implementation Guide

Complete implementation reference for Nostr-based signup and login flows.

---

## Phase 1: Setup & Utilities

### Crypto Utilities

**File**: `src/utils/crypto.ts`

```typescript
/**
 * Generate a new Nostr keypair
 * Returns hex-encoded private key and public key
 */
export async function generateKeypair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  // Use TweetNaCl.js or similar library
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bytesToHex(keypair.publicKey),
    privateKey: bytesToHex(keypair.secretKey.slice(0, 32)),
  };
}

/**
 * Derive public key from private key
 */
export function derivePublicKey(privkey: string): string {
  // Validate hex format
  if (!/^[0-9a-f]{64}$/i.test(privkey)) {
    throw new Error('Invalid private key format');
  }

  const secret = hexToBytes(privkey);
  const keypair = nacl.sign.keyPair.fromSecretKey(
    new Uint8Array([...secret, ...new Uint8Array(32)])
  );
  return bytesToHex(keypair.publicKey);
}

/**
 * Convert hex to Bech32 (npub/nsec)
 */
export function hexToNpub(pubkey: string): string {
  return bech32.encode('npub', bech32.toWords(hexToBytes(pubkey)));
}

export function hexToNsec(privkey: string): string {
  return bech32.encode('nsec', bech32.toWords(hexToBytes(privkey)));
}

/**
 * Convert Bech32 to hex
 */
export function npubToHex(npub: string): string {
  const { prefix, words } = bech32.decode(npub);
  if (prefix !== 'npub') throw new Error('Invalid npub');
  return bytesToHex(new Uint8Array(bech32.fromWords(words)));
}

export function nsecToHex(nsec: string): string {
  const { prefix, words } = bech32.decode(nsec);
  if (prefix !== 'nsec') throw new Error('Invalid nsec');
  return bytesToHex(new Uint8Array(bech32.fromWords(words)));
}

/**
 * Sign a Nostr event
 */
export function signEvent(
  event: Omit<NostrEvent, 'sig' | 'id'>,
  privkey: string
): NostrEvent {
  const eventData = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags || [],
    event.content,
  ]);

  const hash = sha256(eventData);
  const signature = nacl.sign.detached(hash, hexToBytes(privkey));

  return {
    ...event,
    id: bytesToHex(hash),
    sig: bytesToHex(signature),
  };
}

/**
 * Verify event signature
 */
export function verifyEvent(event: NostrEvent): boolean {
  try {
    const eventData = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags || [],
      event.content,
    ]);

    const hash = sha256(eventData);
    const sig = hexToBytes(event.sig);
    const pubkey = hexToBytes(event.pubkey);

    return nacl.sign.detached.verify(hash, sig, pubkey);
  } catch (err) {
    return false;
  }
}
```

### Validation Utilities

**File**: `src/utils/validation.ts`

```typescript
import {
  NICKNAME_VALIDATION,
  PRIVKEY_VALIDATION,
  MNEMONIC_VALIDATION,
  ValidationFeedback,
} from '../types/validation';

/**
 * Validate nickname
 */
export function validateNickname(nickname: string): ValidationFeedback {
  if (nickname.length < NICKNAME_VALIDATION.minLength) {
    return {
      isValid: false,
      error: NICKNAME_VALIDATION.feedback.tooShort,
    };
  }

  if (nickname.length > NICKNAME_VALIDATION.maxLength) {
    return {
      isValid: false,
      error: NICKNAME_VALIDATION.feedback.tooLong,
    };
  }

  if (!NICKNAME_VALIDATION.pattern.test(nickname)) {
    return {
      isValid: false,
      error: NICKNAME_VALIDATION.feedback.invalidChars,
    };
  }

  if (NICKNAME_VALIDATION.reserved.includes(nickname.toLowerCase())) {
    return {
      isValid: false,
      error: NICKNAME_VALIDATION.feedback.reserved,
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Validate private key (hex format)
 */
export function validatePrivkey(privkey: string): ValidationFeedback {
  const hex = privkey.trim().toLowerCase();

  if (hex.length < PRIVKEY_VALIDATION.length) {
    return {
      isValid: false,
      error: PRIVKEY_VALIDATION.feedback.tooShort,
    };
  }

  if (hex.length > PRIVKEY_VALIDATION.length) {
    return {
      isValid: false,
      error: PRIVKEY_VALIDATION.feedback.tooLong,
    };
  }

  if (!PRIVKEY_VALIDATION.pattern.test(hex)) {
    return {
      isValid: false,
      error: PRIVKEY_VALIDATION.feedback.invalidChars,
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Validate BIP39 mnemonic
 */
export function validateMnemonic(
  words: string[]
): ValidationFeedback & {
  invalidWords: string[];
  suggestions: Record<string, string[]>;
} {
  const invalidWords: string[] = [];
  const suggestions: Record<string, string[]> = {};

  if (words.length !== MNEMONIC_VALIDATION.wordCount) {
    return {
      isValid: false,
      error: MNEMONIC_VALIDATION.feedback.wordCount(words.length),
      invalidWords,
      suggestions,
    };
  }

  // Import BIP39 word list
  const bip39Words = getEnglishWordList();

  for (const word of words) {
    if (!bip39Words.includes(word)) {
      invalidWords.push(word);
      // Find similar words for suggestions
      suggestions[word] = findSimilarWords(word, bip39Words, 3);
    }
  }

  if (invalidWords.length > 0) {
    return {
      isValid: false,
      error: `Invalid words: ${invalidWords.join(', ')}`,
      invalidWords,
      suggestions,
    };
  }

  return {
    isValid: true,
    invalidWords,
    suggestions,
  };
}

/**
 * Find similar words using Levenshtein distance
 */
function findSimilarWords(
  target: string,
  wordList: string[],
  maxDistance: number
): string[] {
  return wordList
    .map((word) => ({
      word,
      distance: levenshteinDistance(target, word),
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((item) => item.word);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Check if nickname is available (async)
 * Queries kind 0 profiles from relays
 */
export async function checkNicknameAvailability(
  nickname: string
): Promise<boolean> {
  try {
    const profiles = await queryProfilesByName(nickname);
    return profiles.length === 0;
  } catch (err) {
    // On network error, assume available to allow signup
    console.warn('Could not check nickname availability:', err);
    return true;
  }
}

/**
 * Query kind 0 profiles by display name
 */
async function queryProfilesByName(
  name: string
): Promise<NostrEvent[]> {
  // Query requires relay with profile indexing support
  // Returns empty array if relay doesn't support name search
  const filter = { kinds: [0], search: name };
  const events = await ndk.fetchEvents(filter);
  return Array.from(events);
}
```

### Storage Utilities

**File**: `src/utils/storage.ts`

```typescript
const STORAGE_KEY_PREFIX = 'nostr_chat_';
const SESSION_KEY = `${STORAGE_KEY_PREFIX}session`;
const METRICS_KEY = `${STORAGE_KEY_PREFIX}metrics`;
const PRIVKEY_KEY = `${STORAGE_KEY_PREFIX}privkey`;

/**
 * Save session to localStorage
 */
export function saveSession(session: AuthenticatedUser): void {
  const data = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, data);
}

/**
 * Load session from localStorage
 */
export function loadSession(): AuthenticatedUser | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load session:', err);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PRIVKEY_KEY);
}

/**
 * Save security metrics
 */
export function saveSecurityMetrics(metrics: SecurityMetrics): void {
  const data = JSON.stringify(metrics);
  localStorage.setItem(METRICS_KEY, data);
}

/**
 * Load security metrics
 */
export function loadSecurityMetrics(): SecurityMetrics | null {
  try {
    const data = localStorage.getItem(METRICS_KEY);
    if (!data) {
      return {
        loginCount: 0,
        lastLoginMethod: 'signup',
        hasRecoveryPhrase: false,
        usesExtension: false,
      };
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load metrics:', err);
    return null;
  }
}

/**
 * Increment login count
 */
export function incrementLoginCount(): void {
  const metrics = loadSecurityMetrics() || {
    loginCount: 0,
    lastLoginMethod: 'signup',
    hasRecoveryPhrase: false,
    usesExtension: false,
  };
  metrics.loginCount++;
  metrics.lastSecurityPromptDate = Date.now();
  saveSecurityMetrics(metrics);
}

/**
 * Check if should show security upgrade prompt
 */
export function shouldShowSecurityPrompt(
  loginMethod: LoginMethod
): boolean {
  const metrics = loadSecurityMetrics();
  if (!metrics) return false;

  // Show only after 3 logins with simple method
  if (loginMethod !== 'simple-login' || metrics.loginCount < 3) {
    return false;
  }

  // Don't show if already has recovery phrase or uses extension
  if (metrics.hasRecoveryPhrase || metrics.usesExtension) {
    return false;
  }

  // Don't show again within 7 days
  if (metrics.lastSecurityPromptDate) {
    const daysSincePrompt =
      (Date.now() - metrics.lastSecurityPromptDate) / (1000 * 60 * 60 * 24);
    if (daysSincePrompt < 7) {
      return false;
    }
  }

  return true;
}
```

---

## Phase 2: Nostr Integration

### Profile Management

**File**: `src/utils/nostr-profile.ts`

```typescript
/**
 * Create or update kind 0 profile event
 */
export function createProfileEvent(
  pubkey: string,
  privkey: string,
  profile: NostrMetadata
): NostrEvent {
  const event = {
    kind: NOSTR_KIND.METADATA,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(profile),
    tags: [],
  };

  return signEvent(event, privkey);
}

/**
 * Parse profile metadata from event
 */
export function parseProfileEvent(event: NostrEvent): NostrMetadata | null {
  try {
    if (event.kind !== NOSTR_KIND.METADATA) return null;
    return JSON.parse(event.content);
  } catch (err) {
    console.error('Failed to parse profile event:', err);
    return null;
  }
}

/**
 * Fetch user profile from relays
 */
export async function fetchProfile(
  pubkey: string,
  relays: string[]
): Promise<NostrMetadata | null> {
  try {
    const events = await queryRelays(relays, {
      kinds: [NOSTR_KIND.METADATA],
      authors: [pubkey],
      limit: 1,
    });

    if (events.length === 0) return null;

    return parseProfileEvent(events[0]);
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    return null;
  }
}

/**
 * Publish profile event to relays
 */
export async function publishProfile(
  event: NostrEvent,
  relays: string[]
): Promise<boolean> {
  try {
    await publishToRelays(event, relays);
    return true;
  } catch (err) {
    console.error('Failed to publish profile:', err);
    return false;
  }
}
```

### Extension Integration

**File**: `src/utils/nip07.ts`

```typescript
/**
 * Detect available NIP-07 extensions
 */
export async function detectExtensions(): Promise<ExtensionType[]> {
  const detected: ExtensionType[] = [];

  if (window.nostr) {
    // Check user agent or other methods to identify extension
    if (detectAlby()) {
      detected.push('alby');
    } else if (detectNos2x()) {
      detected.push('nos2x');
    } else {
      detected.push('unknown');
    }
  }

  return detected;
}

function detectAlby(): boolean {
  // Check for Alby-specific properties or user agent
  return navigator.userAgent.includes('Alby');
}

function detectNos2x(): boolean {
  // Check for nos2x-specific properties
  return navigator.userAgent.includes('nos2x');
}

/**
 * Get public key from extension
 */
export async function getExtensionPublicKey(): Promise<string> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected');
  }

  try {
    const pubkey = await window.nostr.getPublicKey();
    return pubkey;
  } catch (err) {
    if (err instanceof Error && err.message.includes('denied')) {
      throw new Error('User denied permission');
    }
    throw new Error('Failed to get public key from extension');
  }
}

/**
 * Sign event with extension
 */
export async function signWithExtension(
  event: Omit<NostrEvent, 'sig' | 'id'>
): Promise<NostrEvent> {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected');
  }

  try {
    const signed = await window.nostr.signEvent(event as NostrEvent);
    return signed;
  } catch (err) {
    throw new Error('Failed to sign event with extension');
  }
}

/**
 * Connect to specific extension
 */
export async function connectToExtension(
  type: ExtensionType
): Promise<string> {
  if (type === 'unknown') {
    return getExtensionPublicKey();
  }

  // For known extensions, we could add specific logic
  return getExtensionPublicKey();
}
```

---

## Phase 3: Signup Flow

### Signup Hook

**File**: `src/hooks/useSignup.ts`

```typescript
interface UseSignupOptions {
  onSuccess?: (result: SignupResult) => void;
  onError?: (error: Error) => void;
}

interface SignupResult {
  publicKey: string;
  nickname: string;
  privkey: string;
}

export function useSignup(options: UseSignupOptions = {}) {
  const [state, setState] = React.useState<SignupState>({
    step: 'path-select',
    path: 'quick',
    nickname: '',
    privkey: '',
    publicKey: '',
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectPath = (path: SignupPath) => {
    setState({
      ...state,
      path,
      step: path === 'quick' ? 'nickname' : 'path-select',
    });
  };

  const createAccount = async (nickname: string): Promise<SignupResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate
      const validation = validateNickname(nickname);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Check availability
      const available = await checkNicknameAvailability(nickname);
      if (!available) {
        throw new Error('Nickname already taken');
      }

      // Generate keypair
      const { publicKey, privateKey } = await generateKeypair();

      // Create profile event
      const profile: NostrMetadata = {
        name: nickname,
        display_name: nickname,
      };

      const profileEvent = createProfileEvent(
        publicKey,
        privateKey,
        profile
      );

      // Publish profile (best effort)
      try {
        await publishProfile(profileEvent, DEFAULT_RELAYS);
      } catch (err) {
        console.warn('Failed to publish profile:', err);
        // Continue anyway - can be published later
      }

      const result: SignupResult = {
        publicKey,
        nickname,
        privkey: privateKey,
      };

      setState({
        step: 'success',
        path: state.path,
        nickname,
        privkey: privateKey,
        publicKey,
      });

      options.onSuccess?.(result);
      setIsLoading(false);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      options.onError?.(new Error(message));
      setIsLoading(false);
      throw err;
    }
  };

  const finishSignup = (privkey: string) => {
    // Store session
    const user: AuthenticatedUser = {
      publicKey: state.publicKey,
      nickname: state.nickname,
      loginMethod: 'signup',
      createdAt: Date.now(),
    };
    saveSession(user);

    // Record metrics
    const metrics: SecurityMetrics = {
      loginCount: 0,
      lastLoginMethod: 'signup',
      hasRecoveryPhrase: false,
      usesExtension: false,
    };
    saveSecurityMetrics(metrics);
  };

  return {
    state,
    isLoading,
    error,
    selectPath,
    createAccount,
    finishSignup,
  };
}
```

---

## Phase 4: Login Flow

### Login Hook

**File**: `src/hooks/useLogin.ts`

```typescript
interface UseLoginOptions {
  onSuccess?: (user: AuthenticatedUser) => void;
  onError?: (error: Error) => void;
}

export function useLogin(options: UseLoginOptions = {}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loginWithPassword = async (privkey: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate format
      const validation = validatePrivkey(privkey);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Derive public key
      const publicKey = derivePublicKey(privkey);

      // Try to fetch profile
      let profile: NostrMetadata | undefined;
      try {
        profile = await fetchProfile(publicKey, DEFAULT_RELAYS);
      } catch (err) {
        console.warn('Failed to fetch profile:', err);
        // Profile is optional
      }

      const user: AuthenticatedUser = {
        publicKey,
        nickname: profile?.display_name || profile?.name || 'Anonymous',
        profile,
        loginMethod: 'simple-login',
        createdAt: Date.now(),
      };

      // Save session
      saveSession(user);

      // Update metrics
      incrementLoginCount();

      options.onSuccess?.(user);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      options.onError?.(new Error(message));
      setIsLoading(false);
      throw err;
    }
  };

  const loginWithMnemonic = async (mnemonic: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const words = mnemonic.trim().split(/\s+/);

      // Validate
      const validation = validateMnemonic(words);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Derive privkey from mnemonic
      const privkey = deriveMnemonicKey(mnemonic);

      // Proceed as normal login
      await loginWithPassword(privkey);

      // Update metrics
      const metrics = loadSecurityMetrics();
      if (metrics) {
        metrics.lastLoginMethod = 'recovery-phrase';
        saveSecurityMetrics(metrics);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recovery failed';
      setError(message);
      options.onError?.(new Error(message));
      setIsLoading(false);
      throw err;
    }
  };

  const loginWithExtension = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get pubkey from extension
      const publicKey = await getExtensionPublicKey();

      // Fetch profile
      let profile: NostrMetadata | undefined;
      try {
        profile = await fetchProfile(publicKey, DEFAULT_RELAYS);
      } catch (err) {
        console.warn('Failed to fetch profile:', err);
      }

      const user: AuthenticatedUser = {
        publicKey,
        nickname: profile?.display_name || profile?.name || 'Anonymous',
        profile,
        loginMethod: 'extension',
        createdAt: Date.now(),
      };

      saveSession(user);
      incrementLoginCount();

      // Update metrics
      const metrics = loadSecurityMetrics();
      if (metrics) {
        metrics.usesExtension = true;
        metrics.lastLoginMethod = 'extension';
        saveSecurityMetrics(metrics);
      }

      options.onSuccess?.(user);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extension login failed';
      setError(message);
      options.onError?.(new Error(message));
      setIsLoading(false);
      throw err;
    }
  };

  return {
    isLoading,
    error,
    loginWithPassword,
    loginWithMnemonic,
    loginWithExtension,
  };
}
```

---

## Phase 5: Session Management

### Auth Context

**File**: `src/context/AuthContext.tsx`

```typescript
interface AuthContextType {
  state: AuthState;
  login: (method: LoginMethod, user: AuthenticatedUser) => void;
  logout: () => void;
  setError: (error: string | null) => void;
  isLoading: boolean;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = React.useState<AuthState>(() => {
    const session = loadSession();
    return {
      isAuthenticated: !!session,
      user: session,
      loginMethod: session?.loginMethod || 'signup',
    };
  });

  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const login = (method: LoginMethod, user: AuthenticatedUser) => {
    setAuthState({
      isAuthenticated: true,
      user,
      loginMethod: method,
      sessionId: crypto.randomUUID(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    saveSession(user);
    setError(null);
  };

  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      loginMethod: 'signup',
    });
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        state: authState,
        login,
        logout,
        setError,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## Testing Strategy

### Unit Tests

**Example**: `src/utils/__tests__/validation.test.ts`

```typescript
describe('validateNickname', () => {
  test('accepts valid nicknames', () => {
    const result = validateNickname('alice_123');
    expect(result.isValid).toBe(true);
  });

  test('rejects too short', () => {
    const result = validateNickname('a');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('too short');
  });

  test('rejects reserved names', () => {
    const result = validateNickname('admin');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('reserved');
  });

  test('rejects invalid characters', () => {
    const result = validateNickname('alice@123');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });
});

describe('validatePrivkey', () => {
  test('accepts valid hex', () => {
    const result = validatePrivkey(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    expect(result.isValid).toBe(true);
  });

  test('rejects wrong length', () => {
    const result = validatePrivkey('123');
    expect(result.isValid).toBe(false);
  });

  test('rejects non-hex', () => {
    const result = validatePrivkey('ghij' + 'a'.repeat(60));
    expect(result.isValid).toBe(false);
  });
});
```

### Integration Tests

**Example**: `src/__tests__/auth-flow.integration.test.ts`

```typescript
describe('Complete signup flow', () => {
  test('should create account and generate password', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <SignupPathSelector onSelectPath={mockSelectPath} />
      </AuthProvider>
    );

    // Select quick start
    fireEvent.click(getByText('Choose Quick Start'));

    // Enter nickname
    const input = getByPlaceholderText('alex_smith');
    fireEvent.change(input, { target: { value: 'test_user' } });

    // Create account
    fireEvent.click(getByText('Create Account'));

    // Wait for success screen
    await waitFor(() => {
      expect(getByText('Account Created')).toBeInTheDocument();
    });

    // Verify password is displayed
    const passwordDisplay = getByDisplayValue(/^.{8}\.\.\..{8}$/);
    expect(passwordDisplay).toBeInTheDocument();
  });
});

describe('Complete login flow', () => {
  test('should login with password', async () => {
    const privkey =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <LoginTabs />
      </AuthProvider>
    );

    const input = getByPlaceholderText('Your 64-character password');
    fireEvent.change(input, { target: { value: privkey } });
    fireEvent.click(getByText('Login'));

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });
});
```

---

## Configuration

### Environment Variables

**File**: `.env.local`

```bash
# Nostr relays
REACT_APP_RELAYS=wss://relay.damus.io,wss://relay.nostr.band

# App config
REACT_APP_APP_NAME="Nostr Chat"
REACT_APP_ENVIRONMENT=development

# Security
REACT_APP_SESSION_TIMEOUT=2592000000 # 30 days in ms
REACT_APP_ENABLE_PASSWORD_ENCRYPTION=true
```

### Constants

**File**: `src/constants.ts`

```typescript
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nostr-relay.schnitzel.world',
];

export const RESERVED_NICKNAMES = [
  'admin',
  'root',
  'system',
  'nostr',
  'bot',
  'support',
  'moderator',
];

export const SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SECURITY_PROMPT_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SECURITY_PROMPT_LOGIN_THRESHOLD = 3;
```

---

## Deployment Checklist

- [ ] Type-check all files: `npm run typecheck`
- [ ] Run unit tests: `npm test`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Verify accessibility: `npm run test:a11y`
- [ ] Security audit: `npm audit`
- [ ] Build for production: `npm run build`
- [ ] Test with real relays
- [ ] Test with real browser extensions
- [ ] Verify localStorage is cleared on logout
- [ ] Verify no privkeys in network logs
- [ ] Review all error messages for clarity

---

## Summary

This implementation guide covers:

1. **Crypto utilities** - Key generation, signing, encoding
2. **Validation** - Input validation with real-time feedback
3. **Storage** - Secure session management
4. **Nostr integration** - Profile management and relay communication
5. **Extension support** - NIP-07 signer detection and use
6. **Signup flow** - Complete account creation with password
7. **Login flow** - Three authentication methods
8. **Session management** - Auth context and storage
9. **Testing** - Unit and integration test examples
10. **Configuration** - Environment setup and constants

All code follows TypeScript best practices, maintains security, and provides excellent UX with clear error messages and progressive enhancement.
