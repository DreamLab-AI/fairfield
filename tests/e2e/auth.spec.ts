/**
 * E2E Tests: Authentication Flows
 *
 * Tests both admin and regular user authentication:
 * - Admin login with nsec/hex credentials
 * - Regular user signup and login with nsec
 * - Session persistence
 * - Logout functionality
 * - Read-only access for incomplete accounts
 */

import { test, expect } from '@playwright/test';
import {
  ADMIN_CREDENTIALS,
  loginAsAdmin,
  loginAsUser,
  signupNewUser,
  logout,
  getCurrentUserPubkey,
  TEST_NSEC_KEYS,
  TEST_HEX_PRIVKEY,
  hasAdminCredentials
} from './fixtures/test-helpers';

test.describe('Admin Authentication', () => {
  // Skip all admin tests if credentials not configured
  test.skip(!hasAdminCredentials(), 'Admin credentials not configured (VITE_ADMIN_PUBKEY and ADMIN_KEY required)');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can login with nsec credentials from .env', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify admin pubkey matches .env
    const storedPubkey = await getCurrentUserPubkey(page);
    expect(storedPubkey).toBe(ADMIN_CREDENTIALS.pubkey);
  });

  test('admin login redirects to admin dashboard or chat', async ({ page }) => {
    await loginAsAdmin(page);

    // Should redirect to authenticated area
    await page.waitForURL(/chat|admin|dashboard/i, { timeout: 5000 });

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/chat|admin|dashboard/i);
  });

  test('admin has admin privileges after login', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to admin page
    await page.goto('/admin');

    // Should see admin dashboard (not redirected away)
    await expect(page.getByText(/admin dashboard|channel management/i)).toBeVisible({ timeout: 5000 });

    // Should see admin-only features
    const createChannelButton = page.getByRole('button', { name: /create channel/i });
    await expect(createChannelButton).toBeVisible();
  });

  test('admin session persists across page reloads', async ({ page }) => {
    await loginAsAdmin(page);

    const originalPubkey = await getCurrentUserPubkey(page);

    // Reload page
    await page.reload();

    // Wait a moment for session restore
    await page.waitForTimeout(1000);

    // Pubkey should still be present
    const reloadedPubkey = await getCurrentUserPubkey(page);
    expect(reloadedPubkey).toBe(originalPubkey);
  });

  test('admin can logout', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify logged in
    expect(await getCurrentUserPubkey(page)).toBeTruthy();

    // Logout
    await logout(page);

    // Verify logged out
    const pubkeyAfterLogout = await getCurrentUserPubkey(page);
    expect(pubkeyAfterLogout).toBeNull();

    // Should redirect to home or login page
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/($|setup|signup)/);
  });
});

test.describe('Regular User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('user can signup and create new account with nsec', async ({ page }) => {
    const nsec = await signupNewUser(page);

    // Verify nsec was generated (starts with nsec1)
    expect(nsec).toBeTruthy();
    expect(nsec).toMatch(/^nsec1/);

    // Verify keys stored
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeTruthy();
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/i);
  });

  test('user can login with valid nsec key', async ({ page }) => {
    // First signup to create account
    const nsec = await signupNewUser(page);
    const originalPubkey = await getCurrentUserPubkey(page);

    // Logout
    await logout(page);

    // Login again with same nsec
    await loginAsUser(page, nsec);

    // Verify same pubkey restored
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBe(originalPubkey);
  });

  test('user can login with valid hex private key', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Enter valid hex key
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(TEST_HEX_PRIVKEY);

    // Submit
    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should store keys
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeTruthy();
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/i);
  });

  test('user cannot login with invalid nsec', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Enter invalid nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill('nsec1invalid');

    // Submit
    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });

    // Keys should not be stored
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeNull();
  });

  test('user session persists across page reloads', async ({ page }) => {
    await signupNewUser(page);

    const originalPubkey = await getCurrentUserPubkey(page);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Pubkey should still be present
    const reloadedPubkey = await getCurrentUserPubkey(page);
    expect(reloadedPubkey).toBe(originalPubkey);
  });

  test('user can logout and login again', async ({ page }) => {
    const nsec = await signupNewUser(page);
    const originalPubkey = await getCurrentUserPubkey(page);

    // Logout
    await logout(page);

    // Verify logged out
    expect(await getCurrentUserPubkey(page)).toBeNull();

    // Login again
    await loginAsUser(page, nsec);

    // Should restore same pubkey
    const restoredPubkey = await getCurrentUserPubkey(page);
    expect(restoredPubkey).toBe(originalPubkey);
  });

  test('multiple users can create separate accounts', async ({ page }) => {
    // Create first user
    const nsec1 = await signupNewUser(page);
    const pubkey1 = await getCurrentUserPubkey(page);

    // Logout
    await logout(page);

    // Create second user
    const nsec2 = await signupNewUser(page);
    const pubkey2 = await getCurrentUserPubkey(page);

    // Nsec and pubkeys should be different
    expect(nsec1).not.toBe(nsec2);
    expect(pubkey1).not.toBe(pubkey2);
  });

  test('nsec with extra whitespace is normalized', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Enter nsec with extra spaces
    const nsecWithSpaces = `  ${TEST_NSEC_KEYS[0]}  `;
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(nsecWithSpaces);

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should succeed with normalized nsec
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeTruthy();
  });

  test('account status is complete after full signup', async ({ page }) => {
    await signupNewUser(page);

    const accountStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(accountStatus).toBe('complete');
  });
});

test.describe('Read-Only Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('incomplete account shows read-only banner', async ({ page }) => {
    // Set up incomplete account directly
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
    });

    await page.goto('/chat');
    await page.waitForTimeout(1000);

    // Should show read-only banner
    const readOnlyBanner = page.getByText(/read-only|limited|complete signup/i);
    await expect(readOnlyBanner).toBeVisible({ timeout: 3000 });
  });

  test('incomplete account cannot post messages in chat', async ({ page }) => {
    // Set up incomplete account
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'b'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
    });

    await page.goto('/chat');
    await page.waitForTimeout(1000);

    // Should see disabled posting message or read-only indicator
    const disabledMessage = page.getByText(/posting.*disabled|read-only|complete signup/i);
    await expect(disabledMessage).toBeVisible({ timeout: 3000 });
  });

  test('complete account can access full features', async ({ page }) => {
    await signupNewUser(page);

    // Navigate to chat
    await page.goto('/chat');
    await page.waitForTimeout(1000);

    // Should NOT show read-only banner
    const readOnlyBanner = await page.getByText(/read-only mode|limited access/i).isVisible({ timeout: 1000 }).catch(() => false);
    expect(readOnlyBanner).toBe(false);
  });
});

test.describe('Authentication Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('empty key shows validation error', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Submit without entering key
    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show validation error
    await expect(page.getByText(/required|enter|provide|private key/i)).toBeVisible({ timeout: 3000 });
  });

  test('too short hex key shows error', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Enter short hex key
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill('abc123');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });

  test('loading state shown during authentication', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(TEST_NSEC_KEYS[0]);

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Check for loading state immediately after submit
    const hasLoadingState = await page.evaluate(() => {
      return document.querySelector('[disabled], .loading, .spinner') !== null;
    });

    expect(hasLoadingState).toBeTruthy();
  });

  test('unauthenticated user redirected to home or login', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/chat');

    // Should redirect to home or login page
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const isProtectedPage = currentUrl.includes('/chat') && !currentUrl.includes('setup') && !currentUrl.includes('signup');

    if (isProtectedPage) {
      // If still on chat, should show login prompt or empty state
      const hasLoginPrompt = await page.getByText(/login|sign in|authenticate/i).isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasLoginPrompt).toBe(true);
    } else {
      // Should be redirected
      expect(currentUrl).toMatch(/\/($|setup|signup)/);
    }
  });

  test('switching between nsec and hex formats works', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Try nsec first
    await keyInput.fill(TEST_NSEC_KEYS[0]);
    let inputValue = await keyInput.inputValue();
    expect(inputValue).toMatch(/^nsec1/);

    // Clear and try hex
    await keyInput.clear();
    await keyInput.fill(TEST_HEX_PRIVKEY);
    inputValue = await keyInput.inputValue();
    expect(inputValue).toMatch(/^[0-9a-f]{64}$/i);
  });

  test('private key input is password type for security', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    const inputType = await keyInput.getAttribute('type');

    expect(inputType).toBe('password');
  });

  test('invalid uppercase nsec shows error', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    // Enter uppercase nsec (invalid - bech32 is lowercase)
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill('NSEC1VL029MGPSPEDVA04G90VLTKH6FVH240ZQTV9K0T9AF8935KE9LAQSNLFE5');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error (bech32 is case-sensitive, lowercase only)
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });
});
