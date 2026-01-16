/**
 * Authentication Types for Nostr Chat App
 *
 * Maps user-facing terminology to technical Nostr concepts:
 * - Nickname = kind 0 profile displayName
 * - Password = hex-encoded private key
 * - Recovery Phrase = BIP39 mnemonic
 * - Browser Extension = NIP-07 signer
 */

/**
 * User's authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  loginMethod: LoginMethod;
  sessionId?: string;
  expiresAt?: number;
}

/**
 * Authenticated user with Nostr identity
 */
export interface AuthenticatedUser {
  publicKey: string; // Nostr npub (or hex)
  nickname: string; // kind 0 displayName
  profile?: NostrProfile; // Full kind 0 profile
  loginMethod: LoginMethod;
  createdAt: number;
}

/**
 * Login method used
 */
export type LoginMethod = 'simple-login' | 'recovery-phrase' | 'extension' | 'signup';

/**
 * Signup flow state
 */
export interface SignupState {
  step: SignupStep;
  path: SignupPath;
  nickname: string;
  privkey: string; // hex-encoded
  publicKey: string;
  mnemonic?: string;
}

export type SignupStep = 'path-select' | 'nickname' | 'success';
export type SignupPath = 'quick' | 'secure';

/**
 * Login form state
 */
export interface LoginFormState {
  privkey: string;
  mnemonic: string;
  showPassword: boolean;
  isValidating: boolean;
  validationError?: string;
}

/**
 * Nostr kind 0 profile metadata
 */
export interface NostrProfile {
  name?: string; // nickname
  about?: string;
  picture?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  display_name?: string;
  banner?: string;
}

/**
 * Nostr event (minimal for auth flow)
 */
export interface NostrEvent {
  content: string;
  created_at: number;
  kind: number;
  pubkey: string;
  sig: string;
  tags: string[][];
}

/**
 * Keypair for session
 */
export interface Keypair {
  publicKey: string;
  privateKey: string; // hex-encoded, never transmitted
}

/**
 * Extension detection result
 */
export interface ExtensionDetectionResult {
  available: boolean;
  type?: ExtensionType;
  hasPermission?: boolean;
}

export type ExtensionType = 'alby' | 'nos2x' | 'unknown';

/**
 * Session configuration
 */
export interface SessionConfig {
  storageKey: string; // localStorage key prefix
  encryptSession: boolean;
  sessionTimeout?: number; // ms
  rememberMe?: boolean;
}

/**
 * Login response from any method
 */
export interface LoginResponse {
  publicKey: string;
  nickname: string;
  profile?: NostrProfile;
  loginMethod: LoginMethod;
  sessionId: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Security metrics for progressive upgrade
 */
export interface SecurityMetrics {
  loginCount: number;
  lastLoginMethod: LoginMethod;
  hasRecoveryPhrase: boolean;
  usesExtension: boolean;
  lastSecurityPromptDate?: number;
}
