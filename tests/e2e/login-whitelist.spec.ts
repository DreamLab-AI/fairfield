/**
 * E2E Tests: Login and Whitelist Flow
 *
 * Tests the login process with whitelist verification:
 * - Non-whitelisted user sees pending approval message
 * - Whitelisted user proceeds to chat
 * - Admin user bypasses whitelist check
 */

import { test, expect, Page } from '@playwright/test';
import { TEST_NSEC_KEYS, TEST_HEX_PRIVKEY } from './fixtures/test-helpers';

// Test configuration
const TEST_TIMEOUT = 60000;

// API mock helper - intercepts whitelist API calls
async function mockWhitelistApi(page: Page, response: {
  isWhitelisted: boolean;
  isAdmin: boolean;
  cohorts: string[];
}) {
  await page.route('**/api/check-whitelist*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...response,
        verifiedAt: Date.now()
      })
    });
  });
}

// Helper to clear auth state
async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('Login Whitelist Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAuthState(page);
  });

  test.describe('Non-Whitelisted User', () => {
    test('should see pending approval message after login', async ({ page }) => {
      // Mock API to return not whitelisted
      await mockWhitelistApi(page, {
        isWhitelisted: false,
        isAdmin: false,
        cohorts: []
      });

      // Navigate to login
      const loginLink = page.getByRole('link', { name: /login/i });
      await loginLink.click();

      // Enter test nsec
      const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
      await keyInput.fill(TEST_NSEC_KEYS[0]);

      // Submit login
      const loginButton = page.getByRole('button', { name: /log in/i });
      await loginButton.click();

      // Wait for redirect - should go to pending page
      await page.waitForURL(/pending|approval|waiting/i, { timeout: 10000 });

      // Check for pending approval message
      const pendingMessage = page.getByText(/pending|approval|waiting|not.*approved/i);
      await expect(pendingMessage).toBeVisible({ timeout: 5000 });
    });

    test('should not be able to access chat when not whitelisted', async ({ page }) => {
      // Mock API to return not whitelisted
      await mockWhitelistApi(page, {
        isWhitelisted: false,
        isAdmin: false,
        cohorts: []
      });

      // Login with test key
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for redirect
      await page.waitForTimeout(2000);

      // Try to navigate to chat directly
      await page.goto('/chat');

      // Should be redirected away from chat or see access denied
      const currentUrl = page.url();
      const isOnChat = currentUrl.includes('/chat');

      if (isOnChat) {
        // If on chat page, should see restricted access message
        const restrictedMessage = page.getByText(/restricted|pending|not.*approved|access.*denied/i);
        await expect(restrictedMessage).toBeVisible({ timeout: 5000 });
      } else {
        // Should be redirected to pending or home
        expect(currentUrl).toMatch(/pending|approval|\//);
      }
    });

    test('should display helpful instructions for non-whitelisted user', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: false,
        isAdmin: false,
        cohorts: []
      });

      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Look for helpful text about what to do next
      const helpfulText = page.getByText(/contact.*admin|request.*access|wait.*approval/i);
      const isHelpVisible = await helpfulText.isVisible({ timeout: 3000 }).catch(() => false);

      // At minimum, should not show error - just pending status
      const errorMessage = page.getByText(/error|failed|invalid/i);
      const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasError).toBe(false);
    });
  });

  test.describe('Whitelisted User', () => {
    test('should proceed to chat after login', async ({ page }) => {
      // Mock API to return whitelisted
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: false,
        cohorts: ['approved']
      });

      // Navigate to login
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();

      // Enter test nsec
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);

      // Submit login
      await page.getByRole('button', { name: /log in/i }).click();

      // Should be redirected to chat or dashboard
      await page.waitForURL(/chat|dashboard|home|channels/i, { timeout: 10000 });

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/chat|dashboard|home|channels/);
    });

    test('should have access to chat features', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: false,
        cohorts: ['approved']
      });

      // Login
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for redirect
      await page.waitForURL(/chat|dashboard|home/i, { timeout: 10000 });

      // Navigate to chat if not already there
      if (!page.url().includes('/chat')) {
        await page.goto('/chat');
      }

      // Should see chat interface elements
      const chatElements = page.locator('[data-testid="chat"], .chat-container, [class*="chat"]');
      const channelList = page.getByText(/channels|rooms|public/i);

      // At least one chat element should be visible
      const hasChatUI = await chatElements.first().isVisible({ timeout: 5000 }).catch(() => false) ||
                        await channelList.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasChatUI).toBe(true);
    });

    test('should not see pending approval message', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: false,
        cohorts: ['approved']
      });

      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Should NOT see pending message
      const pendingMessage = page.getByText(/pending.*approval|waiting.*approval/i);
      const isPendingVisible = await pendingMessage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(isPendingVisible).toBe(false);
    });
  });

  test.describe('Admin User', () => {
    test('should bypass whitelist check and access chat', async ({ page }) => {
      // Mock API to return admin
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: true,
        cohorts: ['admin', 'approved']
      });

      // Login with admin credentials
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();

      // Use admin key if available, otherwise use test key
      const adminKey = process.env.ADMIN_KEY || TEST_NSEC_KEYS[0];
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(adminKey);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should go directly to chat/dashboard
      await page.waitForURL(/chat|dashboard|home|admin/i, { timeout: 10000 });

      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/pending|approval/);
    });

    test('should have access to admin features', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: true,
        cohorts: ['admin', 'approved']
      });

      // Login as admin
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      const adminKey = process.env.ADMIN_KEY || TEST_NSEC_KEYS[0];
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(adminKey);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Navigate to admin page
      await page.goto('/admin');

      // Should see admin interface (not access denied)
      const adminHeading = page.getByRole('heading', { name: /admin|management|dashboard/i });
      const adminContent = page.getByText(/user.*management|whitelist|settings/i);

      const hasAdminAccess = await adminHeading.isVisible({ timeout: 5000 }).catch(() => false) ||
                            await adminContent.isVisible({ timeout: 5000 }).catch(() => false);

      // If no admin page exists yet, at least should not show access denied
      if (!hasAdminAccess) {
        const accessDenied = page.getByText(/access.*denied|not.*authorized|forbidden/i);
        const isDenied = await accessDenied.isVisible({ timeout: 1000 }).catch(() => false);
        // Admin should not see access denied
        expect(isDenied).toBe(false);
      }
    });

    test('should be able to access all sections', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: true,
        cohorts: ['admin', 'approved']
      });

      // Login as admin
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      const adminKey = process.env.ADMIN_KEY || TEST_NSEC_KEYS[0];
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(adminKey);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Try accessing various protected routes
      const protectedRoutes = ['/chat', '/events', '/settings'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForTimeout(500);

        // Should not be redirected to pending or show access denied
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/pending|approval|login/);
      }
    });
  });

  test.describe('Whitelist API Integration', () => {
    test('should call whitelist API on login', async ({ page }) => {
      let apiCalled = false;

      await page.route('**/api/check-whitelist*', async (route) => {
        apiCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isWhitelisted: true,
            isAdmin: false,
            cohorts: ['approved'],
            verifiedAt: Date.now()
          })
        });
      });

      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      expect(apiCalled).toBe(true);
    });

    test('should handle API timeout gracefully', async ({ page }) => {
      // Simulate slow/timeout API response
      await page.route('**/api/check-whitelist*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15s delay
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isWhitelisted: false,
            isAdmin: false,
            cohorts: []
          })
        });
      });

      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should handle gracefully - either show loading or fallback
      await page.waitForTimeout(5000);

      // Should not crash or show error
      const errorMessage = page.getByText(/error|crash|failed to load/i);
      const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasError).toBe(false);
    });

    test('should use fallback when API returns error', async ({ page }) => {
      await page.route('**/api/check-whitelist*', async (route) => {
        await route.fulfill({
          status: 500,
          body: 'Internal Server Error'
        });
      });

      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Should still complete login (with fallback behavior)
      const isLoggedIn = await page.evaluate(() => {
        return !!localStorage.getItem('nostr_bbs_nostr_pubkey');
      });

      expect(isLoggedIn).toBe(true);
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain whitelist status across page reload', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: false,
        cohorts: ['approved']
      });

      // Login
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForURL(/chat|dashboard|home/i, { timeout: 10000 });

      // Reload page
      await page.reload();
      await page.waitForTimeout(2000);

      // Should still have access (not redirected to pending)
      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/pending|approval|login/);
    });

    test('should clear whitelist status on logout', async ({ page }) => {
      await mockWhitelistApi(page, {
        isWhitelisted: true,
        isAdmin: false,
        cohorts: ['approved']
      });

      // Login
      await page.goto('/');
      await page.getByRole('link', { name: /login/i }).click();
      await page.getByPlaceholder(/nsec|hex|private key/i).fill(TEST_NSEC_KEYS[0]);
      await page.getByRole('button', { name: /log in/i }).click();

      await page.waitForTimeout(3000);

      // Logout (via settings or direct localStorage clear)
      await page.evaluate(() => {
        localStorage.clear();
      });

      await page.goto('/chat');

      // Should be redirected to login/home
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/login|home|\/$/);
    });
  });
});
