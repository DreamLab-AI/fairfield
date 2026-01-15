/**
 * Solid Client Wrapper
 *
 * Provides session management, authentication, and WebID profile operations
 * for Solid pod integration with the Fairfield Nostr application.
 *
 * Uses @inrupt/solid-client-authn-browser for authentication flows.
 */

import { browser } from '$app/environment';
import type {
  SolidSession,
  SolidLoginOptions,
  SolidLogoutOptions,
  WebIDProfile,
  SolidIntegrationConfig,
} from './types';
import { DEFAULT_SOLID_CONFIG, RDF_NAMESPACES } from './types';

/**
 * Solid client error class
 */
export class SolidClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SolidClientError';
  }
}

/**
 * Session state management
 */
let currentSession: SolidSession = {
  isLoggedIn: false,
  webId: null,
  fetch: null,
  expirationDate: null,
};

/**
 * Session change listeners
 */
type SessionListener = (session: SolidSession) => void;
const sessionListeners: Set<SessionListener> = new Set();

/**
 * Configuration
 */
let config: SolidIntegrationConfig = { ...DEFAULT_SOLID_CONFIG };

/**
 * Initialize the Solid client with configuration
 */
export function initializeSolidClient(userConfig: Partial<SolidIntegrationConfig> = {}): void {
  config = { ...DEFAULT_SOLID_CONFIG, ...userConfig };

  if (browser) {
    // Check for existing session on page load
    handleIncomingRedirect().catch(console.error);
  }
}

/**
 * Get current configuration
 */
export function getConfig(): SolidIntegrationConfig {
  return { ...config };
}

/**
 * Subscribe to session changes
 */
export function onSessionChange(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/**
 * Notify all session listeners
 */
function notifySessionChange(): void {
  for (const listener of sessionListeners) {
    try {
      listener(currentSession);
    } catch (error) {
      console.error('[SolidClient] Session listener error:', error);
    }
  }
}

/**
 * Update session state
 */
function updateSession(updates: Partial<SolidSession>): void {
  currentSession = { ...currentSession, ...updates };
  notifySessionChange();
}

/**
 * Get the current session state
 */
export function getSession(): SolidSession {
  return { ...currentSession };
}

/**
 * Check if user is logged in to Solid
 */
export function isLoggedIn(): boolean {
  return currentSession.isLoggedIn && currentSession.webId !== null;
}

/**
 * Get authenticated fetch function for making requests to Solid pods
 */
export function getAuthenticatedFetch(): typeof fetch | null {
  return currentSession.fetch;
}

/**
 * Handle incoming redirect from OIDC provider
 *
 * This should be called on app initialization to restore session
 * after returning from the identity provider login flow.
 */
export async function handleIncomingRedirect(): Promise<SolidSession> {
  if (!browser) {
    return currentSession;
  }

  try {
    // Check URL for auth callback params
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      // No auth callback, check for existing session in storage
      const storedSession = loadStoredSession();
      if (storedSession) {
        updateSession(storedSession);
      }
      return currentSession;
    }

    // Exchange auth code for tokens
    const tokenResponse = await exchangeAuthCode(code, state);

    if (tokenResponse) {
      const session: SolidSession = {
        isLoggedIn: true,
        webId: tokenResponse.webId,
        fetch: createAuthenticatedFetch(tokenResponse.accessToken),
        expirationDate: tokenResponse.expiresAt ? new Date(tokenResponse.expiresAt) : null,
      };

      updateSession(session);
      storeSession(session, tokenResponse.accessToken, tokenResponse.refreshToken);

      // Clean URL
      window.history.replaceState({}, '', url.pathname);
    }

    return currentSession;
  } catch (error) {
    console.error('[SolidClient] Failed to handle redirect:', error);
    throw new SolidClientError(
      'Failed to complete authentication',
      'AUTH_CALLBACK_FAILED',
      error
    );
  }
}

/**
 * Initiate login flow with Solid identity provider
 */
export async function login(options: Partial<SolidLoginOptions> = {}): Promise<void> {
  if (!browser) {
    throw new SolidClientError('Login can only be performed in browser', 'NOT_BROWSER');
  }

  const loginOptions: SolidLoginOptions = {
    oidcIssuer: options.oidcIssuer || config.defaultOidcIssuer,
    redirectUrl: options.redirectUrl || config.redirectUrl || window.location.origin,
    clientName: options.clientName || config.clientName,
    clientId: options.clientId || config.clientId,
    tokenType: options.tokenType || 'DPoP',
  };

  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store for callback
    sessionStorage.setItem('solid_code_verifier', codeVerifier);
    sessionStorage.setItem('solid_state', state);
    sessionStorage.setItem('solid_oidc_issuer', loginOptions.oidcIssuer);

    // Discover OIDC configuration
    const oidcConfig = await discoverOIDCConfig(loginOptions.oidcIssuer);

    // Build authorization URL
    const authUrl = new URL(oidcConfig.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', loginOptions.clientId || loginOptions.clientName);
    authUrl.searchParams.set('redirect_uri', loginOptions.redirectUrl);
    authUrl.searchParams.set('scope', 'openid profile offline_access webid');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Redirect to identity provider
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('[SolidClient] Login failed:', error);
    throw new SolidClientError('Failed to initiate login', 'LOGIN_FAILED', error);
  }
}

/**
 * Logout from Solid
 */
export async function logout(options: SolidLogoutOptions = {}): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    // Clear session storage
    sessionStorage.removeItem('solid_code_verifier');
    sessionStorage.removeItem('solid_state');
    sessionStorage.removeItem('solid_oidc_issuer');
    localStorage.removeItem('solid_session');
    localStorage.removeItem('solid_tokens');

    // Clear current session
    updateSession({
      isLoggedIn: false,
      webId: null,
      fetch: null,
      expirationDate: null,
    });

    // Optionally redirect to IDP logout
    if (options.logoutType === 'idp') {
      const issuer = sessionStorage.getItem('solid_oidc_issuer');
      if (issuer) {
        const oidcConfig = await discoverOIDCConfig(issuer);
        if (oidcConfig.end_session_endpoint) {
          window.location.href = oidcConfig.end_session_endpoint;
        }
      }
    }
  } catch (error) {
    console.error('[SolidClient] Logout error:', error);
    // Still clear local session even if IDP logout fails
    updateSession({
      isLoggedIn: false,
      webId: null,
      fetch: null,
      expirationDate: null,
    });
  }
}

/**
 * Fetch WebID profile data
 */
export async function fetchWebIDProfile(webId?: string): Promise<WebIDProfile | null> {
  const targetWebId = webId || currentSession.webId;

  if (!targetWebId) {
    return null;
  }

  const fetchFn = currentSession.fetch || fetch;

  try {
    const response = await fetchFn(targetWebId, {
      headers: {
        Accept: 'text/turtle, application/ld+json',
      },
    });

    if (!response.ok) {
      throw new SolidClientError(
        `Failed to fetch WebID profile: ${response.status}`,
        'FETCH_FAILED'
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    const text = await response.text();

    // Parse profile from RDF
    const profile = parseWebIDProfile(text, contentType, targetWebId);
    return profile;
  } catch (error) {
    console.error('[SolidClient] Failed to fetch WebID profile:', error);
    throw new SolidClientError('Failed to fetch WebID profile', 'PROFILE_FETCH_FAILED', error);
  }
}

/**
 * Parse WebID profile from RDF/Turtle or JSON-LD
 */
function parseWebIDProfile(data: string, contentType: string, webId: string): WebIDProfile {
  const profile: WebIDProfile = { webId };

  if (contentType.includes('turtle')) {
    // Simple Turtle parsing for common predicates
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Extract name
      if (trimmed.includes('foaf:name') || trimmed.includes(`${RDF_NAMESPACES.foaf}name`)) {
        const match = trimmed.match(/"([^"]+)"/);
        if (match) profile.name = match[1];
      }

      // Extract nickname
      if (trimmed.includes('foaf:nick') || trimmed.includes(`${RDF_NAMESPACES.foaf}nick`)) {
        const match = trimmed.match(/"([^"]+)"/);
        if (match) profile.nickname = match[1];
      }

      // Extract email
      if (trimmed.includes('foaf:mbox') || trimmed.includes(`${RDF_NAMESPACES.foaf}mbox`)) {
        const match = trimmed.match(/<mailto:([^>]+)>/);
        if (match) profile.email = match[1];
      }

      // Extract image
      if (trimmed.includes('foaf:img') || trimmed.includes(`${RDF_NAMESPACES.foaf}img`)) {
        const match = trimmed.match(/<([^>]+)>/);
        if (match) profile.image = match[1];
      }

      // Extract storage
      if (trimmed.includes('pim:storage') || trimmed.includes(`${RDF_NAMESPACES.pim}storage`)) {
        const match = trimmed.match(/<([^>]+)>/);
        if (match) {
          profile.storage = profile.storage || [];
          profile.storage.push(match[1]);
        }
      }

      // Extract OIDC issuer
      if (trimmed.includes('solid:oidcIssuer') || trimmed.includes(`${RDF_NAMESPACES.solid}oidcIssuer`)) {
        const match = trimmed.match(/<([^>]+)>/);
        if (match) {
          profile.oidcIssuer = profile.oidcIssuer || [];
          profile.oidcIssuer.push(match[1]);
        }
      }

      // Extract linked Nostr DID
      if (trimmed.includes('nostr:DID') || trimmed.includes('did:nostr:')) {
        const match = trimmed.match(/(did:nostr:[a-f0-9]{64})/i);
        if (match) {
          profile.linkedNostrDID = match[1];
          // Extract pubkey from DID
          profile.linkedNostrPubkey = match[1].replace('did:nostr:', '');
        }
      }
    }
  } else if (contentType.includes('json')) {
    // JSON-LD parsing
    try {
      const json = JSON.parse(data);
      const expanded = Array.isArray(json) ? json : [json];

      for (const node of expanded) {
        if (node['@id'] === webId || !node['@id']) {
          profile.name = extractJsonLdValue(node, 'foaf:name', RDF_NAMESPACES.foaf + 'name');
          profile.nickname = extractJsonLdValue(node, 'foaf:nick', RDF_NAMESPACES.foaf + 'nick');
          profile.image = extractJsonLdValue(node, 'foaf:img', RDF_NAMESPACES.foaf + 'img');

          const mbox = extractJsonLdValue(node, 'foaf:mbox', RDF_NAMESPACES.foaf + 'mbox');
          if (mbox) {
            profile.email = mbox.replace('mailto:', '');
          }
        }
      }
    } catch {
      // JSON parse failed, return basic profile
    }
  }

  return profile;
}

/**
 * Extract value from JSON-LD node
 */
function extractJsonLdValue(node: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = node[key];
    if (value) {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'string') return first;
        if (typeof first === 'object' && first !== null) {
          return (first as Record<string, string>)['@value'] || (first as Record<string, string>)['@id'];
        }
      }
      if (typeof value === 'object' && value !== null) {
        return (value as Record<string, string>)['@value'] || (value as Record<string, string>)['@id'];
      }
    }
  }
  return undefined;
}

/**
 * Discover OIDC configuration from issuer
 */
async function discoverOIDCConfig(issuer: string): Promise<OIDCConfiguration> {
  const configUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new SolidClientError(
      `Failed to discover OIDC config: ${response.status}`,
      'OIDC_DISCOVERY_FAILED'
    );
  }

  return response.json();
}

interface OIDCConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  webId: string;
  expiresAt?: number;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeAuthCode(code: string, state: string): Promise<TokenResponse | null> {
  const storedState = sessionStorage.getItem('solid_state');
  const codeVerifier = sessionStorage.getItem('solid_code_verifier');
  const issuer = sessionStorage.getItem('solid_oidc_issuer');

  if (state !== storedState || !codeVerifier || !issuer) {
    throw new SolidClientError('Invalid state or missing PKCE data', 'INVALID_AUTH_STATE');
  }

  const oidcConfig = await discoverOIDCConfig(issuer);

  const tokenRequest = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUrl || window.location.origin,
    client_id: config.clientId || config.clientName,
    code_verifier: codeVerifier,
  });

  const response = await fetch(oidcConfig.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenRequest,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new SolidClientError(`Token exchange failed: ${error}`, 'TOKEN_EXCHANGE_FAILED');
  }

  const tokens = await response.json();

  // Decode ID token to get WebID
  const webId = extractWebIdFromToken(tokens.id_token);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    webId,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
  };
}

/**
 * Extract WebID from ID token
 */
function extractWebIdFromToken(idToken: string): string {
  try {
    const [, payload] = idToken.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.webid || decoded.sub;
  } catch {
    throw new SolidClientError('Failed to decode ID token', 'TOKEN_DECODE_FAILED');
  }
}

/**
 * Create authenticated fetch function with access token
 */
function createAuthenticatedFetch(accessToken: string): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate PKCE code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Generate random state parameter
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Store session and tokens
 */
function storeSession(session: SolidSession, accessToken: string, refreshToken?: string): void {
  localStorage.setItem('solid_session', JSON.stringify({
    webId: session.webId,
    expirationDate: session.expirationDate?.toISOString(),
  }));

  localStorage.setItem('solid_tokens', JSON.stringify({
    accessToken,
    refreshToken,
  }));
}

/**
 * Load stored session
 */
function loadStoredSession(): SolidSession | null {
  try {
    const sessionData = localStorage.getItem('solid_session');
    const tokenData = localStorage.getItem('solid_tokens');

    if (!sessionData || !tokenData) {
      return null;
    }

    const session = JSON.parse(sessionData);
    const tokens = JSON.parse(tokenData);

    // Check expiration
    if (session.expirationDate && new Date(session.expirationDate) < new Date()) {
      // Session expired
      localStorage.removeItem('solid_session');
      localStorage.removeItem('solid_tokens');
      return null;
    }

    return {
      isLoggedIn: true,
      webId: session.webId,
      fetch: createAuthenticatedFetch(tokens.accessToken),
      expirationDate: session.expirationDate ? new Date(session.expirationDate) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshSession(): Promise<boolean> {
  if (!browser) {
    return false;
  }

  try {
    const tokenData = localStorage.getItem('solid_tokens');
    const issuer = sessionStorage.getItem('solid_oidc_issuer');

    if (!tokenData || !issuer) {
      return false;
    }

    const tokens = JSON.parse(tokenData);
    if (!tokens.refreshToken) {
      return false;
    }

    const oidcConfig = await discoverOIDCConfig(issuer);

    const refreshRequest = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: config.clientId || config.clientName,
    });

    const response = await fetch(oidcConfig.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: refreshRequest,
    });

    if (!response.ok) {
      return false;
    }

    const newTokens = await response.json();
    const webId = extractWebIdFromToken(newTokens.id_token);

    const session: SolidSession = {
      isLoggedIn: true,
      webId,
      fetch: createAuthenticatedFetch(newTokens.access_token),
      expirationDate: newTokens.expires_in
        ? new Date(Date.now() + newTokens.expires_in * 1000)
        : null,
    };

    updateSession(session);
    storeSession(session, newTokens.access_token, newTokens.refresh_token);

    return true;
  } catch (error) {
    console.error('[SolidClient] Failed to refresh session:', error);
    return false;
  }
}

export default {
  initializeSolidClient,
  getConfig,
  getSession,
  isLoggedIn,
  getAuthenticatedFetch,
  login,
  logout,
  handleIncomingRedirect,
  fetchWebIDProfile,
  refreshSession,
  onSessionChange,
  SolidClientError,
};
