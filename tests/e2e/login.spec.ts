/**
 * E2E Tests: User Login Flow
 *
 * Tests the login process including:
 * - Login with nsec format key
 * - Login with hex format key
 * - Invalid key handling
 * - Successful login and redirect
 * - Key restoration
 */

import { test, expect } from '@playwright/test';
import { TEST_NSEC_KEYS, TEST_HEX_PRIVKEY } from './fixtures/test-helpers';

// Valid test nsec
const VALID_NSEC = TEST_NSEC_KEYS[0];

// Valid test hex key (64 characters)
const VALID_HEX = TEST_HEX_PRIVKEY;

// Invalid keys for testing
const INVALID_KEYS = [
  'invalid_key_here',
  'nsec1invalid', // Too short nsec
  'abc123', // Random short string
  '', // Empty
  'NSEC1VL029MGPSPEDVA04G90VLTKH6FVH240ZQTV9K0T9AF8935KE9LAQSNLFE5', // Uppercase nsec
  'e8f32b5a7c5e8f', // Too short hex
];

test.describe('User Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/');

    // Find and click login button
    const loginButton = page.getByRole('link', { name: /login/i });
    await expect(loginButton).toBeVisible();

    await loginButton.click();

    // Check for private key input
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await expect(keyInput).toBeVisible();
  });

  test('login with valid nsec key', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter valid nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(VALID_NSEC);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Wait for processing
    await page.waitForTimeout(1500);

    // Check that keys are stored
    const storedKeys = await page.evaluate(() => {
      return {
        pubkey: localStorage.getItem('nostr_bbs_nostr_pubkey'),
        encryptedPrivkey: localStorage.getItem('nostr_bbs_nostr_encrypted_privkey')
      };
    });

    expect(storedKeys.pubkey).toBeTruthy();
    expect(storedKeys.pubkey).toMatch(/^[0-9a-f]{64}$/i);
    expect(storedKeys.encryptedPrivkey).toBeTruthy();
  });

  test('login with valid hex key', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter valid hex key
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(VALID_HEX);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Wait for processing
    await page.waitForTimeout(1500);

    // Check that keys are stored
    const storedKeys = await page.evaluate(() => {
      return {
        pubkey: localStorage.getItem('nostr_bbs_nostr_pubkey'),
        encryptedPrivkey: localStorage.getItem('nostr_bbs_nostr_encrypted_privkey')
      };
    });

    expect(storedKeys.pubkey).toBeTruthy();
    expect(storedKeys.pubkey).toMatch(/^[0-9a-f]{64}$/i);
  });

  test('invalid key shows error - random string', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter invalid key
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(INVALID_KEYS[0]);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Check for error message
    const errorMessage = page.getByText(/invalid|incorrect|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });

    // Verify keys are NOT stored
    const hasKeys = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_bbs_nostr_pubkey');
    });

    expect(hasKeys).toBe(false);
  });

  test('invalid nsec shows error - too short', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter short nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(INVALID_KEYS[1]);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Check for error message
    const errorMessage = page.getByText(/invalid|incorrect|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('empty key shows validation error', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Submit without entering key
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Check for validation error
    const errorMessage = page.getByText(/required|enter|provide|private key/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('successful login redirects to dashboard/channels', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter valid nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(VALID_NSEC);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Wait for redirect
    await page.waitForURL(/chat|pending|dashboard|channels|home/i, { timeout: 5000 });

    // Verify we're on an authenticated page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/chat|pending|dashboard|channels|home/i);
  });

  test('nsec input trims whitespace', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter nsec with extra whitespace
    const nsecWithSpaces = `  ${VALID_NSEC}  `;

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(nsecWithSpaces);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Should succeed (whitespace trimmed)
    await page.waitForTimeout(1500);

    const hasKeys = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_bbs_nostr_pubkey');
    });

    expect(hasKeys).toBe(true);
  });

  test('restored keys produce valid pubkey', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter known nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(VALID_NSEC);

    // Submit
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForTimeout(1500);

    // Get stored pubkey
    const storedPubkey = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_pubkey');
    });

    // Verify it's a valid hex string (64 chars)
    expect(storedPubkey).toMatch(/^[0-9a-f]{64}$/i);
    expect(storedPubkey?.length).toBe(64);
  });

  test('login form has proper labels and accessibility', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Check for proper form labels
    const keyLabel = page.getByText(/private key/i);
    await expect(keyLabel).toBeVisible();

    // Check for help text about nsec/hex formats
    const formatHelp = page.getByText(/nsec.*hex|hex.*nsec/i);
    await expect(formatHelp).toBeVisible();
  });

  test('can navigate to signup from login page', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Look for create account button
    const createButton = page.getByRole('button', { name: /create.*account/i });
    await expect(createButton).toBeVisible();

    await createButton.click();

    // Should be on signup/create account page
    const signupHeading = page.getByText(/welcome|create account|backup/i);
    await expect(signupHeading).toBeVisible();
  });

  test('loading state shown during authentication', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Enter valid nsec
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(VALID_NSEC);

    // Submit and immediately check for loading state
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Check for loading indicator (spinner, disabled button, etc.)
    const isLoading = await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"], button:has(.loading)');
      return button?.hasAttribute('disabled') ||
             document.querySelector('[data-loading="true"]') !== null ||
             document.querySelector('.spinner, .loading') !== null;
    });

    // At least one loading indicator should be present
    expect(isLoading).toBeTruthy();
  });

  test('password input hides key by default', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('link', { name: /login/i }).click();

    // Check input type is password
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    const inputType = await keyInput.getAttribute('type');

    expect(inputType).toBe('password');
  });
});
