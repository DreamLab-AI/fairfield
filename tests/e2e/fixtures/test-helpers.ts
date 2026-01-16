/**
 * E2E Test Helpers
 * Common utilities for Playwright tests
 * Updated for nsec-based authentication (no mnemonic)
 */

import { Page, expect } from '@playwright/test';

/**
 * Test user credentials from .env
 * Now uses nsec format instead of mnemonic
 * Falls back to test keys when env vars not set (for non-admin tests)
 */
export const ADMIN_CREDENTIALS = {
  pubkey: process.env.VITE_ADMIN_PUBKEY || 'TEST_ADMIN_PUBKEY_NOT_SET',
  // Admin key should now be in nsec or hex format
  nsec: process.env.ADMIN_KEY || 'TEST_ADMIN_KEY_NOT_SET'
};

/**
 * Check if admin credentials are properly configured
 */
export function hasAdminCredentials(): boolean {
  return process.env.VITE_ADMIN_PUBKEY !== undefined &&
         process.env.ADMIN_KEY !== undefined;
}

/**
 * Valid test nsec keys for regular users
 * These are well-known test keys - DO NOT use in production
 */
export const TEST_NSEC_KEYS = [
  // Test key 1 - corresponds to known test pubkey
  'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  // Test key 2 - another known test key
  'nsec1a2kvxppk8m5wqhxgqrrcqg8jjj5v2x5g0mvp4pwn9fmgjgzp6q4qfhe50r'
];

/**
 * Generate a test nsec for testing
 * Returns a random test nsec from the pool
 */
export function getTestNsec(): string {
  return TEST_NSEC_KEYS[Math.floor(Math.random() * TEST_NSEC_KEYS.length)];
}

/**
 * Valid 64-character hex private key for testing
 * This is a test key - DO NOT use in production
 */
export const TEST_HEX_PRIVKEY = 'e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7';

/**
 * Login as admin user
 * Requires VITE_ADMIN_PUBKEY and ADMIN_KEY env vars
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!hasAdminCredentials()) {
    throw new Error('Admin credentials not configured. Set VITE_ADMIN_PUBKEY and ADMIN_KEY env vars.');
  }

  await page.goto('/');

  // Navigate to login page
  const loginButton = page.getByRole('link', { name: /login|setup/i });
  await loginButton.click();

  // Enter admin nsec/hex key - use first() to handle duplicate elements
  const keyInput = page.locator('#private-key-input').first();
  await keyInput.fill(ADMIN_CREDENTIALS.nsec);

  // Submit - use first() for duplicate button handling
  const loginSubmit = page.getByRole('button', { name: /log in/i }).first();
  await loginSubmit.click();

  // Wait for authentication to complete and redirect
  await page.waitForTimeout(3000);

  // Verify admin is logged in - check for stored keys (contains publicKey)
  const stored = await page.evaluate(() => localStorage.getItem('nostr_bbs_keys'));
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored!);
  expect(parsed.publicKey).toBeTruthy();
}

/**
 * Login as regular user with nsec or hex key
 */
export async function loginAsUser(page: Page, nsecOrHex?: string): Promise<string> {
  const userKey = nsecOrHex || getTestNsec();

  await page.goto('/');

  // Navigate to login page
  const loginButton = page.getByRole('link', { name: /login|setup/i });
  await loginButton.click();

  // Enter nsec/hex key - use first() to handle duplicate elements
  const keyInput = page.locator('#private-key-input').first();
  await keyInput.fill(userKey);

  // Submit - use first() for duplicate button handling
  const loginSubmit = page.getByRole('button', { name: /log in/i }).first();
  await loginSubmit.click();

  // Wait for authentication and redirect
  await page.waitForTimeout(3000);

  return userKey;
}

/**
 * Create a new account via signup flow
 * Returns the nsec for the new account
 */
export async function signupNewUser(page: Page): Promise<string> {
  await page.goto('/');

  // Click create account
  const createButton = page.getByRole('link', { name: /create account|signup/i });
  await createButton.click();

  // Wait for key generation - should show NsecBackup component
  await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

  // Click reveal button to show nsec
  const revealButton = page.getByRole('button', { name: /reveal/i });
  await revealButton.click();

  // Wait for nsec to be displayed
  await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

  // Get the generated nsec
  const nsecElement = page.locator('p.font-mono');
  const nsec = await nsecElement.textContent();

  // Copy to clipboard (this marks hasBackedUp = true)
  const copyButton = page.getByRole('button', { name: /copy/i });
  await copyButton.click();
  await page.waitForTimeout(500);

  // Confirm backup checkbox
  const checkbox = page.getByRole('checkbox', { name: /backed up|securely/i });
  await checkbox.check();

  // Continue
  const continueButton = page.getByRole('button', { name: /continue/i });
  await continueButton.click();

  // Wait for redirect
  await page.waitForTimeout(1000);

  return nsec?.trim() || '';
}

/**
 * Navigate to a specific section
 */
export async function navigateToSection(page: Page, section: 'public-lobby' | 'community-rooms' | 'dreamlab'): Promise<void> {
  // Ensure we're on chat page
  await page.goto('/chat');

  // Find and click section card
  const sectionNames: Record<string, RegExp> = {
    'public-lobby': /public lobby|public/i,
    'community-rooms': /community rooms|community/i,
    'dreamlab': /dreamlab|dream lab/i
  };

  const sectionCard = page.getByText(sectionNames[section]).first();
  await sectionCard.click();
}

/**
 * Request access to a section
 */
export async function requestSectionAccess(page: Page, section: 'community-rooms' | 'dreamlab', message?: string): Promise<void> {
  // Click on section card
  await navigateToSection(page, section);

  // Click request access button
  const requestButton = page.getByRole('button', { name: /request access/i });
  await requestButton.click();

  // Fill optional message if provided
  if (message) {
    const messageInput = page.getByPlaceholder(/message|reason/i);
    if (await messageInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await messageInput.fill(message);
    }
  }

  // Confirm request
  const confirmButton = page.getByRole('button', { name: /send|submit|confirm/i });
  await confirmButton.click();

  // Wait for request to be submitted
  await page.waitForTimeout(1000);
}

/**
 * Approve a pending access request (admin only)
 */
export async function approvePendingRequest(page: Page, userPubkey: string): Promise<void> {
  // Navigate to admin page
  await page.goto('/admin');

  // Navigate to pending requests
  const pendingButton = page.getByRole('button', { name: /pending|approvals|requests/i });
  await pendingButton.click();

  // Wait for requests to load
  await page.waitForTimeout(1000);

  // Find and approve the specific request
  const approveButtons = page.getByRole('button', { name: /approve/i });
  const count = await approveButtons.count();

  // Click first approve button (in real tests, filter by pubkey)
  if (count > 0) {
    await approveButtons.first().click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Create a chatroom in a section (admin only)
 */
export async function createChatroom(page: Page, name: string, section: string, description?: string): Promise<void> {
  // Navigate to admin page
  await page.goto('/admin');

  // Click create channel button
  const createButton = page.getByRole('button', { name: /create channel/i });
  await createButton.click();

  // Fill channel name
  const nameInput = page.getByPlaceholder(/channel name/i);
  await nameInput.fill(name);

  // Fill description if provided
  if (description) {
    const descInput = page.getByPlaceholder(/description/i);
    await descInput.fill(description);
  }

  // Select section (if section selector exists)
  const sectionSelect = page.locator('select[name="section"]');
  if (await sectionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sectionSelect.selectOption(section);
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /create|submit/i });
  await submitButton.click();

  // Wait for channel creation
  await page.waitForTimeout(1500);
}

/**
 * Navigate to calendar page
 */
export async function navigateToCalendar(page: Page): Promise<void> {
  await page.goto('/events');
  await page.waitForTimeout(1000);
}

/**
 * Check if calendar event details are visible
 */
export async function canSeeEventDetails(page: Page, eventTitle: string): Promise<boolean> {
  await navigateToCalendar(page);

  // Look for event title
  const eventElement = page.getByText(eventTitle);
  const isVisible = await eventElement.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isVisible) return false;

  // Click on event to see details
  await eventElement.click();
  await page.waitForTimeout(500);

  // Check if details are visible (description, location, etc.)
  const hasDescription = await page.getByText(/description|details/i).isVisible({ timeout: 1000 }).catch(() => false);
  const hasLocation = await page.getByText(/location/i).isVisible({ timeout: 1000 }).catch(() => false);

  return hasDescription || hasLocation;
}

/**
 * Check if calendar shows only availability (masked details)
 */
export async function showsOnlyAvailability(page: Page): Promise<boolean> {
  await navigateToCalendar(page);

  // Check for "booked" or "busy" indicators
  const hasAvailability = await page.getByText(/booked|busy|unavailable/i).isVisible({ timeout: 2000 }).catch(() => false);

  // Should NOT see detailed titles or descriptions
  const hasDetails = await page.locator('[data-event-title], [data-event-description]').isVisible({ timeout: 1000 }).catch(() => false);

  return hasAvailability && !hasDetails;
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button (usually in settings or profile menu)
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Try navigating to settings first
    await page.goto('/settings');
    const settingsLogout = page.getByRole('button', { name: /logout|sign out/i });
    await settingsLogout.click();
  }

  await page.waitForTimeout(1000);

  // Clear localStorage
  await page.evaluate(() => localStorage.clear());
}

/**
 * Get current user's pubkey from localStorage
 */
export async function getCurrentUserPubkey(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem('nostr_bbs_keys'));
}

/**
 * Wait for Nostr connection
 */
export async function waitForNostrConnection(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if NDK is connected (this may vary based on implementation)
      return window.localStorage.getItem('nostr_bbs_keys') !== null;
    },
    { timeout }
  );
}
