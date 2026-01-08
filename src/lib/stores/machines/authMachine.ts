/**
 * Auth State Machine
 * Finite state machine for authentication flow with explicit state transitions.
 * Provides predictable state management following state machine patterns.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// ============================================================================
// State Types
// ============================================================================

/**
 * Discriminated union of all possible auth states.
 * Each state variant carries only the data relevant to that state.
 */
export type AuthState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'unauthenticated' }
  | { state: 'authenticating'; pubkey: string }
  | { state: 'authenticated'; pubkey: string; privateKey: string }
  | { state: 'error'; error: string; previousState?: AuthState };

/**
 * Events that can trigger state transitions
 */
export type AuthEvent =
  | { type: 'INIT' }
  | { type: 'RESTORE_SESSION'; pubkey: string; privateKey: string }
  | { type: 'LOGIN'; pubkey: string; privateKey: string }
  | { type: 'LOGIN_START'; pubkey: string }
  | { type: 'LOGIN_SUCCESS'; pubkey: string; privateKey: string }
  | { type: 'LOGIN_FAILURE'; error: string }
  | { type: 'LOGOUT' }
  | { type: 'ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

/**
 * Transition result with optional side effects
 */
export interface TransitionResult {
  state: AuthState;
  effects?: AuthEffect[];
}

/**
 * Side effects that should be executed after state transition
 */
export type AuthEffect =
  | { type: 'PERSIST_SESSION'; pubkey: string; privateKey: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'CONNECT_RELAY'; pubkey: string; privateKey: string }
  | { type: 'DISCONNECT_RELAY' }
  | { type: 'NOTIFY'; message: string; level: 'info' | 'error' | 'success' };

// ============================================================================
// State Machine Reducer
// ============================================================================

/**
 * Pure state transition function.
 * Given current state and event, returns new state and optional effects.
 *
 * State transition diagram:
 *
 * idle ──INIT──> loading
 * loading ──RESTORE_SESSION──> authenticated
 * loading ──ERROR──> unauthenticated
 * unauthenticated ──LOGIN_START──> authenticating
 * authenticating ──LOGIN_SUCCESS──> authenticated
 * authenticating ──LOGIN_FAILURE──> error
 * authenticated ──LOGOUT──> unauthenticated
 * error ──CLEAR_ERROR──> unauthenticated
 * any ──RESET──> idle
 */
export function authReducer(state: AuthState, event: AuthEvent): TransitionResult {
  switch (state.state) {
    case 'idle':
      return handleIdleState(state, event);

    case 'loading':
      return handleLoadingState(state, event);

    case 'unauthenticated':
      return handleUnauthenticatedState(state, event);

    case 'authenticating':
      return handleAuthenticatingState(state, event);

    case 'authenticated':
      return handleAuthenticatedState(state, event);

    case 'error':
      return handleErrorState(state, event);

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = state;
      return { state: _exhaustive };
  }
}

function handleIdleState(state: AuthState, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'INIT':
      return { state: { state: 'loading' } };

    case 'RESET':
      return { state: { state: 'idle' } };

    default:
      return { state };
  }
}

function handleLoadingState(state: AuthState, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'RESTORE_SESSION':
      return {
        state: {
          state: 'authenticated',
          pubkey: event.pubkey,
          privateKey: event.privateKey
        },
        effects: [
          { type: 'CONNECT_RELAY', pubkey: event.pubkey, privateKey: event.privateKey }
        ]
      };

    case 'ERROR':
      return {
        state: { state: 'unauthenticated' },
        effects: [
          { type: 'NOTIFY', message: event.error, level: 'error' }
        ]
      };

    case 'LOGIN':
      return {
        state: {
          state: 'authenticated',
          pubkey: event.pubkey,
          privateKey: event.privateKey
        },
        effects: [
          { type: 'PERSIST_SESSION', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'CONNECT_RELAY', pubkey: event.pubkey, privateKey: event.privateKey }
        ]
      };

    case 'RESET':
      return { state: { state: 'idle' } };

    default:
      // No session found, transition to unauthenticated
      if (event.type === 'INIT') {
        return { state: { state: 'unauthenticated' } };
      }
      return { state };
  }
}

function handleUnauthenticatedState(state: AuthState, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'LOGIN_START':
      return {
        state: { state: 'authenticating', pubkey: event.pubkey }
      };

    case 'LOGIN':
      return {
        state: {
          state: 'authenticated',
          pubkey: event.pubkey,
          privateKey: event.privateKey
        },
        effects: [
          { type: 'PERSIST_SESSION', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'CONNECT_RELAY', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'NOTIFY', message: 'Successfully logged in', level: 'success' }
        ]
      };

    case 'ERROR':
      return {
        state: { state: 'error', error: event.error, previousState: state }
      };

    case 'RESET':
      return { state: { state: 'idle' } };

    default:
      return { state };
  }
}

function handleAuthenticatingState(state: AuthState & { state: 'authenticating' }, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'LOGIN_SUCCESS':
      return {
        state: {
          state: 'authenticated',
          pubkey: event.pubkey,
          privateKey: event.privateKey
        },
        effects: [
          { type: 'PERSIST_SESSION', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'CONNECT_RELAY', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'NOTIFY', message: 'Successfully logged in', level: 'success' }
        ]
      };

    case 'LOGIN_FAILURE':
      return {
        state: { state: 'error', error: event.error, previousState: state },
        effects: [
          { type: 'NOTIFY', message: event.error, level: 'error' }
        ]
      };

    case 'LOGOUT':
    case 'RESET':
      return {
        state: { state: 'unauthenticated' },
        effects: [{ type: 'CLEAR_SESSION' }]
      };

    default:
      return { state };
  }
}

function handleAuthenticatedState(state: AuthState & { state: 'authenticated' }, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'LOGOUT':
      return {
        state: { state: 'unauthenticated' },
        effects: [
          { type: 'CLEAR_SESSION' },
          { type: 'DISCONNECT_RELAY' },
          { type: 'NOTIFY', message: 'Logged out successfully', level: 'info' }
        ]
      };

    case 'ERROR':
      return {
        state: { state: 'error', error: event.error, previousState: state },
        effects: [
          { type: 'NOTIFY', message: event.error, level: 'error' }
        ]
      };

    case 'RESET':
      return {
        state: { state: 'idle' },
        effects: [
          { type: 'CLEAR_SESSION' },
          { type: 'DISCONNECT_RELAY' }
        ]
      };

    default:
      return { state };
  }
}

function handleErrorState(state: AuthState & { state: 'error' }, event: AuthEvent): TransitionResult {
  switch (event.type) {
    case 'CLEAR_ERROR':
      // Return to previous state if available, otherwise unauthenticated
      if (state.previousState?.state === 'authenticated') {
        return { state: state.previousState };
      }
      return { state: { state: 'unauthenticated' } };

    case 'LOGIN':
      return {
        state: {
          state: 'authenticated',
          pubkey: event.pubkey,
          privateKey: event.privateKey
        },
        effects: [
          { type: 'PERSIST_SESSION', pubkey: event.pubkey, privateKey: event.privateKey },
          { type: 'CONNECT_RELAY', pubkey: event.pubkey, privateKey: event.privateKey }
        ]
      };

    case 'LOGIN_START':
      return {
        state: { state: 'authenticating', pubkey: event.pubkey }
      };

    case 'RESET':
      return { state: { state: 'idle' } };

    default:
      return { state };
  }
}

// ============================================================================
// Auth Machine Store
// ============================================================================

export interface AuthMachine {
  subscribe: Writable<AuthState>['subscribe'];
  send: (event: AuthEvent) => void;
  getState: () => AuthState;
  isAuthenticated: Readable<boolean>;
  pubkey: Readable<string | null>;
  error: Readable<string | null>;
  isLoading: Readable<boolean>;
}

/**
 * Create an auth state machine with Svelte store integration.
 * Handles state transitions and executes side effects.
 */
export function createAuthMachine(
  effectHandler?: (effect: AuthEffect) => void | Promise<void>
): AuthMachine {
  const initialState: AuthState = { state: 'idle' };
  const store: Writable<AuthState> = writable(initialState);

  /**
   * Execute side effects asynchronously
   */
  async function executeEffects(effects: AuthEffect[] | undefined): Promise<void> {
    if (!effects || !effectHandler) return;

    for (const effect of effects) {
      try {
        await effectHandler(effect);
      } catch (error) {
        console.error('[AuthMachine] Effect execution failed:', effect.type, error);
      }
    }
  }

  /**
   * Send an event to the machine, triggering state transition
   */
  function send(event: AuthEvent): void {
    const currentState = get(store);
    const result = authReducer(currentState, event);

    if (result.state !== currentState) {
      store.set(result.state);
    }

    // Execute effects after state update
    executeEffects(result.effects);
  }

  /**
   * Get current state synchronously
   */
  function getState(): AuthState {
    return get(store);
  }

  // Derived stores for common queries
  const isAuthenticated = derived(store, ($state) => $state.state === 'authenticated');

  const pubkey = derived(store, ($state) => {
    if ($state.state === 'authenticated') return $state.pubkey;
    if ($state.state === 'authenticating') return $state.pubkey;
    return null;
  });

  const error = derived(store, ($state) => {
    if ($state.state === 'error') return $state.error;
    return null;
  });

  const isLoading = derived(store, ($state) =>
    $state.state === 'loading' || $state.state === 'authenticating'
  );

  return {
    subscribe: store.subscribe,
    send,
    getState,
    isAuthenticated,
    pubkey,
    error,
    isLoading
  };
}

// ============================================================================
// State Guards and Helpers
// ============================================================================

/**
 * Type guard for authenticated state
 */
export function isAuthenticatedState(
  state: AuthState
): state is AuthState & { state: 'authenticated' } {
  return state.state === 'authenticated';
}

/**
 * Type guard for error state
 */
export function isErrorState(
  state: AuthState
): state is AuthState & { state: 'error' } {
  return state.state === 'error';
}

/**
 * Type guard for loading states
 */
export function isLoadingState(state: AuthState): boolean {
  return state.state === 'loading' || state.state === 'authenticating';
}

/**
 * Extract pubkey from any state that has it
 */
export function extractPubkey(state: AuthState): string | null {
  if (state.state === 'authenticated' || state.state === 'authenticating') {
    return state.pubkey;
  }
  return null;
}

/**
 * Check if a transition is valid for the current state
 */
export function canTransition(state: AuthState, eventType: AuthEvent['type']): boolean {
  const validTransitions: Record<AuthState['state'], AuthEvent['type'][]> = {
    idle: ['INIT', 'RESET'],
    loading: ['RESTORE_SESSION', 'ERROR', 'LOGIN', 'RESET', 'INIT'],
    unauthenticated: ['LOGIN_START', 'LOGIN', 'ERROR', 'RESET'],
    authenticating: ['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'RESET'],
    authenticated: ['LOGOUT', 'ERROR', 'RESET'],
    error: ['CLEAR_ERROR', 'LOGIN', 'LOGIN_START', 'RESET']
  };

  return validTransitions[state.state]?.includes(eventType) ?? false;
}
