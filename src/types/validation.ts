/**
 * Validation schemas and feedback messages
 */

export interface ValidationFeedback {
  isValid: boolean;
  error?: string;
  warning?: string;
  suggestions?: string[];
}

/**
 * Nickname validation rules
 */
export const NICKNAME_VALIDATION = {
  minLength: 2,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9_-]{2,50}$/,
  reserved: [
    'admin',
    'root',
    'system',
    'nostr',
    'bot',
    'system',
    'support',
    'moderator',
  ],
  feedback: {
    tooShort: 'Nickname too short (minimum 2 characters)',
    tooLong: 'Nickname too long (maximum 50 characters)',
    invalidChars:
      'Nickname contains invalid characters (use letters, numbers, underscore, or hyphen)',
    reserved: 'This nickname is reserved',
    taken: 'This nickname is already taken',
    valid: 'Nickname available ✓',
  },
};

/**
 * Private key (password) validation rules
 */
export const PRIVKEY_VALIDATION = {
  length: 64,
  pattern: /^[0-9a-f]{64}$/i,
  feedback: {
    tooShort: 'Password too short (must be 64 characters)',
    tooLong: 'Password too long (must be 64 characters)',
    invalidChars: 'Password contains invalid characters (must be hex: 0-9, a-f)',
    valid: 'Valid password format ✓',
  },
};

/**
 * BIP39 Mnemonic validation rules
 */
export const MNEMONIC_VALIDATION = {
  wordCount: 12,
  separator: /\s+/,
  feedback: {
    invalidWord: (word: string) => `"${word}" is not a valid word`,
    wordCount: (count: number) =>
      count < 12
        ? `Expected 12 words, got ${count}`
        : `Too many words (expected 12, got ${count})`,
    valid: 'Valid recovery phrase ✓',
  },
};

/**
 * Error messages by category
 */
export const ERROR_MESSAGES = {
  // Nickname errors
  NICKNAME_TOO_SHORT: NICKNAME_VALIDATION.feedback.tooShort,
  NICKNAME_TOO_LONG: NICKNAME_VALIDATION.feedback.tooLong,
  NICKNAME_INVALID_CHARS: NICKNAME_VALIDATION.feedback.invalidChars,
  NICKNAME_RESERVED: NICKNAME_VALIDATION.feedback.reserved,
  NICKNAME_TAKEN: NICKNAME_VALIDATION.feedback.taken,

  // Password errors
  PRIVKEY_TOO_SHORT: PRIVKEY_VALIDATION.feedback.tooShort,
  PRIVKEY_TOO_LONG: PRIVKEY_VALIDATION.feedback.tooLong,
  PRIVKEY_INVALID_CHARS: PRIVKEY_VALIDATION.feedback.invalidChars,
  PRIVKEY_INVALID_FORMAT: 'Invalid password format',

  // Login errors
  LOGIN_INVALID_CREDENTIALS: 'Invalid password or account not found',
  LOGIN_NETWORK_ERROR: 'Unable to verify account. Check your connection.',
  LOGIN_RATE_LIMIT: 'Too many login attempts. Please try again in 5 minutes.',
  LOGIN_EXTENSION_NOT_FOUND: 'No NIP-07 extension detected',
  LOGIN_EXTENSION_ERROR: 'Extension not responding',
  LOGIN_EXTENSION_DENIED: 'User cancelled extension permission',

  // Mnemonic errors
  MNEMONIC_INVALID_WORD: (word: string) =>
    MNEMONIC_VALIDATION.feedback.invalidWord(word),
  MNEMONIC_WRONG_COUNT: (count: number) =>
    MNEMONIC_VALIDATION.feedback.wordCount(count),
  MNEMONIC_DERIVATION_ERROR: 'Unable to recover account from phrase',

  // Generic errors
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Info messages and hints
 */
export const INFO_MESSAGES = {
  NICKNAME_HELP: '2-50 characters, letters/numbers/underscore or hyphen',
  NICKNAME_CHANGEABLE: 'ⓘ Your nickname can be changed later in settings',

  PRIVKEY_HELP: 'This is your account password from signup',
  PRIVKEY_FORMAT: '64 character hex string',
  PRIVKEY_SECURITY_TIP:
    'For better security, consider using a browser extension (Alby, nos2x) instead',
  PRIVKEY_NEVER_SHARE: 'Your password is your private key. Never share it with anyone.',

  MNEMONIC_HELP: 'Each word from your backup phrase',
  MNEMONIC_FORMAT: '12 words separated by spaces',

  EXTENSION_MOST_SECURE:
    'Most secure option - your keys never leave your device',
  EXTENSION_EXPLANATION:
    'Sign in with Alby, nos2x, or other NIP-07 compatible extensions',

  PASSWORD_WARNING: 'This is your private login password. We can\'t recover it if you lose it. Save it somewhere safe (password manager, paper, secure note, etc.)',
  PASSWORD_SAVE_PROMPT: 'Save this password somewhere safe. We cannot recover it for you.',

  RECOVERY_PHRASE_BACKUP:
    '12 random words that can regenerate your account. Save in a safe place!',
  RECOVERY_PHRASE_SECURE_SETUP:
    'Want more security? Use recovery phrase instead',

  SECURITY_UPGRADE_INTRO:
    'You\'ve logged in multiple times using your password. Let\'s secure your account with additional options.',
  SECURITY_UPGRADE_RECOVERY:
    'Backup your account with a 12-word phrase you can use to recover your account anytime.',
  SECURITY_UPGRADE_EXTENSION:
    'Use Alby or nos2x for the most secure login. Your keys stay safe on your device.',
};

/**
 * Warning box content
 */
export const WARNINGS = {
  SAVE_PASSWORD: {
    title: '⚠️  SAVE YOUR PASSWORD',
    description: INFO_MESSAGES.PASSWORD_WARNING,
    icon: '⚠️',
    severity: 'critical' as const,
  },

  EXTENSION_MOST_SECURE: {
    title: 'ℹ️  MOST SECURE OPTION',
    description:
      'Your keys never leave your device. Extensions like Alby manage your keys locally, and this app only requests permission to sign messages.',
    icon: 'ℹ️',
    severity: 'info' as const,
  },

  SIMPLE_LOGIN_SECURITY: {
    title: 'ℹ️  SECURITY TIP',
    description: INFO_MESSAGES.PRIVKEY_SECURITY_TIP,
    icon: 'ℹ️',
    severity: 'info' as const,
  },

  NO_EXTENSION: {
    title: '📦 Don\'t have an extension?',
    description: 'Install Alby for the most secure way to login',
    icon: '📦',
    severity: 'info' as const,
  },
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  ACCOUNT_CREATED: 'Account Created! 🎉',
  LOGIN_SUCCESSFUL: 'Login successful. Welcome back!',
  PASSWORD_COPIED: 'Password copied to clipboard',
  ACCOUNT_RECOVERED: 'Account recovered successfully',
  EXTENSION_CONNECTED: 'Successfully connected with browser extension',
};

/**
 * Form submission states
 */
export type FormSubmissionState = 'idle' | 'loading' | 'success' | 'error';

export interface FormState {
  state: FormSubmissionState;
  error?: string;
  isValid: boolean;
}
