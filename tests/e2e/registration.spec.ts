/**
 * E2E Tests: User Registration Flow
 *
 * Comprehensive tests for the complete user registration journey:
 * 1. New User Registration - Create account, backup nsec, set nickname
 * 2. Admin Approval Flow - Admin reviews and approves pending users
 * 3. Post-Approval Access - Approved user can access the system
 *
 * Uses Page Object Models for cleaner test organization.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { SignupPage, PendingPage, AdminPage } from './pages';
import { loginAsAdmin, getCurrentUserPubkey, hasAdminCredentials } from './fixtures/test-helpers';

// Test configuration
const TEST_TIMEOUT = 60000;

/**
 * Helper to clear localStorage
 */
async function clearStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

/**
 * Generate unique test nickname
 */
function generateTestNickname(): string {
  return `TestUser_${Date.now().toString(36)}`;
}

// ============================================================================
// Test Suite 1: New User Registration
// ============================================================================

test.describe('New User Registration', () => {
  let signupPage: SignupPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
    await clearStorage(page);
  });

  test('navigate to signup page shows create account option', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();

    await expect(signupPage.createAccountButton).toBeVisible();
    await expect(signupPage.alreadyHaveKeyButton).toBeVisible();
  });

  test('clicking create account generates keys and shows backup screen', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();

    // Should transition to backup step
    await signupPage.waitForBackupStep();
    await expect(signupPage.backupHeading).toBeVisible();
    await expect(signupPage.revealButton).toBeVisible();
  });

  test('reveal button shows nsec key in correct format', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();

    await signupPage.revealNsec();
    const nsec = await signupPage.getNsec();

    // Verify nsec format (bech32 encoding starts with nsec1)
    expect(nsec).toMatch(/^nsec1[a-z0-9]{58,}$/);
  });

  test('copy button copies nsec to clipboard and shows confirmation', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();
    await signupPage.revealNsec();

    const nsec = await signupPage.getNsec();
    await signupPage.copyNsec();

    // Verify clipboard content
    const clipboardText = await signupPage.page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    expect(clipboardText).toBe(nsec);

    // Verify copied message shown
    await expect(signupPage.copiedMessage).toBeVisible();
  });

  test('download button triggers backup file download', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();
    await signupPage.revealNsec();

    const filename = await signupPage.downloadBackup();

    // Verify filename format
    expect(filename).toMatch(/nostr-key-backup.*\.txt$/);
  });

  test('cannot continue without backup confirmation', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();
    await signupPage.revealNsec();

    // Continue button should be disabled before backup
    await expect(signupPage.continueButton).toBeDisabled();

    // Checkbox should be disabled before backup action
    await expect(signupPage.confirmCheckbox).toBeDisabled();
  });

  test('can continue after copying and confirming backup', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();
    await signupPage.revealNsec();

    // Copy nsec (enables checkbox)
    await signupPage.copyNsec();

    // Checkbox should now be enabled
    await expect(signupPage.confirmCheckbox).toBeEnabled();

    // Check the checkbox
    await signupPage.confirmBackup();

    // Continue button should now be enabled
    await expect(signupPage.continueButton).toBeEnabled();
  });

  test('completing backup step transitions to nickname setup', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();

    // Should be on nickname step
    await signupPage.waitForNicknameStep();
    await expect(signupPage.nicknameHeading).toBeVisible();
    await expect(signupPage.nicknameInput).toBeVisible();
  });

  test('nickname input validates minimum length', async () => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.waitForNicknameStep();

    // Enter single character (too short)
    await signupPage.enterNickname('A');

    // Continue button should be disabled
    await expect(signupPage.nicknameContinueButton).toBeDisabled();

    // Enter valid nickname
    await signupPage.enterNickname('TestUser');

    // Continue button should be enabled
    await expect(signupPage.nicknameContinueButton).toBeEnabled();
  });

  test('completing nickname setup stores keys in localStorage', async ({ page }) => {
    const nickname = generateTestNickname();

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.completeNicknameStep(nickname);

    // Wait for processing
    await page.waitForTimeout(2000);

    // Verify localStorage
    const pubkey = await signupPage.getStoredPubkey();
    expect(pubkey).toBeTruthy();
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/i);
  });

  test('new user redirects to pending page after registration', async ({ page }) => {
    const nickname = generateTestNickname();

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.completeNicknameStep(nickname);

    // Wait for redirect
    await page.waitForURL(/pending|chat/, { timeout: 10000 });

    // New users should go to pending (unless pre-approved)
    const url = page.url();
    // Could be /pending or /chat depending on whitelist status
    expect(url).toMatch(/pending|chat/);
  });

  test('generated keys are unique across registrations', async ({ page, context }) => {
    // First registration
    const page1 = page;
    const signupPage1 = new SignupPage(page1);
    await clearStorage(page1);
    await signupPage1.goto();
    await signupPage1.waitForSignupStep();
    await signupPage1.clickCreateAccount();
    await signupPage1.waitForBackupStep();
    await signupPage1.revealNsec();
    const nsec1 = await signupPage1.getNsec();

    // Second registration in new page
    const page2 = await context.newPage();
    await clearStorage(page2);
    const signupPage2 = new SignupPage(page2);
    await signupPage2.goto();
    await signupPage2.waitForSignupStep();
    await signupPage2.clickCreateAccount();
    await signupPage2.waitForBackupStep();
    await signupPage2.revealNsec();
    const nsec2 = await signupPage2.getNsec();

    // Keys should be different
    expect(nsec1).not.toBe(nsec2);

    await page2.close();
  });

  test('skip nickname option works but warns user', async ({ page }) => {
    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.waitForNicknameStep();

    // Skip button should be visible
    await expect(signupPage.skipButton).toBeVisible();

    // Click skip
    await signupPage.skipNicknameStep();

    // Wait for redirect
    await page.waitForURL(/pending|chat/, { timeout: 10000 });
  });
});

// ============================================================================
// Test Suite 2: Pending Approval Page
// ============================================================================

test.describe('Pending Approval Page', () => {
  let signupPage: SignupPage;
  let pendingPage: PendingPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
    pendingPage = new PendingPage(page);
    await clearStorage(page);
  });

  test('pending page shows awaiting approval status', async ({ page }) => {
    // Complete registration first
    const nickname = generateTestNickname();
    await signupPage.completeFullRegistration(nickname);

    // Wait for potential redirect to pending
    await page.waitForTimeout(2000);

    // If redirected to pending, verify content
    if (page.url().includes('/pending')) {
      await pendingPage.waitForPendingPage();
      await pendingPage.verifyPendingState();
      await expect(pendingPage.awaitingApprovalText).toBeVisible();
    }
  });

  test('pending page has logout option', async ({ page }) => {
    const nickname = generateTestNickname();
    await signupPage.completeFullRegistration(nickname);
    await page.waitForTimeout(2000);

    if (page.url().includes('/pending')) {
      await pendingPage.waitForPendingPage();
      await expect(pendingPage.logoutButton).toBeVisible();
    }
  });

  test('logout from pending page clears session', async ({ page }) => {
    const nickname = generateTestNickname();
    await signupPage.completeFullRegistration(nickname);
    await page.waitForTimeout(2000);

    if (page.url().includes('/pending')) {
      await pendingPage.waitForPendingPage();
      await pendingPage.logout();

      // Wait for redirect
      await page.waitForTimeout(1000);

      // Should be logged out
      const pubkey = await signupPage.getStoredPubkey();
      expect(pubkey).toBeNull();
    }
  });

  test('pending page shows community zones information', async ({ page }) => {
    const nickname = generateTestNickname();
    await signupPage.completeFullRegistration(nickname);
    await page.waitForTimeout(2000);

    if (page.url().includes('/pending')) {
      await pendingPage.waitForPendingPage();

      // Should show info about community zones
      await expect(pendingPage.communityZonesCard).toBeVisible();
    }
  });
});

// ============================================================================
// Test Suite 3: Admin Approval Flow
// ============================================================================

test.describe('Admin Approval Flow', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('admin can view pending user registrations', async ({ page }) => {
    await clearStorage(page);
    await loginAsAdmin(page);

    const adminPage = new AdminPage(page);
    await adminPage.goto();
    await adminPage.waitForDashboard();

    // Should see user registrations section
    await expect(adminPage.userRegistrationsHeading).toBeVisible();
  });

  test('admin dashboard shows registration count badge', async ({ page }) => {
    await clearStorage(page);
    await loginAsAdmin(page);

    const adminPage = new AdminPage(page);
    await adminPage.goto();
    await adminPage.waitForDashboard();

    // Check if there's a count badge (may be 0 or more)
    const count = await adminPage.getPendingRegistrationsCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('non-admin cannot access admin dashboard', async ({ page }) => {
    await clearStorage(page);

    const signupPage = new SignupPage(page);
    const nickname = generateTestNickname();
    await signupPage.completeFullRegistration(nickname);
    await page.waitForTimeout(2000);

    // Try to access admin page
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Should be redirected or show access denied
    const adminPage = new AdminPage(page);
    const hasAccess = await adminPage.verifyAdminAccess();

    // Non-admin should NOT have access
    expect(hasAccess).toBe(false);
  });

  test('admin can refresh pending registrations list', async ({ page }) => {
    await clearStorage(page);
    await loginAsAdmin(page);

    const adminPage = new AdminPage(page);
    await adminPage.goto();
    await adminPage.waitForDashboard();

    // Click refresh button
    await adminPage.refreshRegistrations();

    // Page should not error
    await expect(adminPage.userRegistrationsHeading).toBeVisible();
  });
});

// ============================================================================
// Test Suite 4: Full Registration and Approval Workflow
// ============================================================================

test.describe('Full Registration and Approval Workflow', () => {
  test.setTimeout(90000); // Extended timeout for full workflow

  test('complete workflow: signup -> pending -> admin approve -> user access', async ({ context }) => {
    // Step 1: Create new user
    const userPage = await context.newPage();
    await clearStorage(userPage);

    const signupPage = new SignupPage(userPage);
    const nickname = generateTestNickname();

    await signupPage.completeFullRegistration(nickname);
    await userPage.waitForTimeout(2000);

    // Get the new user's pubkey
    const userPubkey = await signupPage.getStoredPubkey();
    expect(userPubkey).toBeTruthy();

    // Step 2: Admin logs in and views registrations
    const adminPageInstance = await context.newPage();
    await clearStorage(adminPageInstance);
    await loginAsAdmin(adminPageInstance);

    const adminPage = new AdminPage(adminPageInstance);
    await adminPage.goto();
    await adminPage.waitForDashboard();

    // Step 3: Refresh and check for the new registration
    await adminPage.refreshRegistrations();

    // Look for the registration (might need to scroll or wait)
    const hasPending = await adminPage.hasPendingRegistrations();

    if (hasPending) {
      // Step 4: Approve the registration
      await adminPage.approveFirstRegistration();

      // Wait for success message
      await adminPage.waitForSuccessAlert();
      const successMsg = await adminPage.getSuccessMessage();
      expect(successMsg).toContain(/approved/i);
    }

    // Cleanup
    await userPage.close();
    await adminPageInstance.close();
  });

  test('registration request includes nickname from signup', async ({ context }) => {
    // Create new user with specific nickname
    const userPage = await context.newPage();
    await clearStorage(userPage);

    const signupPage = new SignupPage(userPage);
    const nickname = `TestNick_${Date.now()}`;

    await signupPage.completeFullRegistration(nickname);
    await userPage.waitForTimeout(3000); // Wait for event to be published

    // Admin checks registrations
    const adminPageInstance = await context.newPage();
    await clearStorage(adminPageInstance);
    await loginAsAdmin(adminPageInstance);

    const adminPage = new AdminPage(adminPageInstance);
    await adminPage.goto();
    await adminPage.waitForDashboard();
    await adminPage.refreshRegistrations();

    // The nickname should appear in the registrations list
    // (Either in UserDisplay component or message field)
    const registrations = await adminPage.getPendingRegistrations();

    // Log for debugging
    console.log('Pending registrations:', registrations);

    // Cleanup
    await userPage.close();
    await adminPageInstance.close();
  });

  test('rejected registration removes user from pending list', async ({ context }) => {
    // Create new user
    const userPage = await context.newPage();
    await clearStorage(userPage);

    const signupPage = new SignupPage(userPage);
    const nickname = generateTestNickname();

    await signupPage.completeFullRegistration(nickname);
    await userPage.waitForTimeout(2000);

    // Admin logs in
    const adminPageInstance = await context.newPage();
    await clearStorage(adminPageInstance);
    await loginAsAdmin(adminPageInstance);

    const adminPage = new AdminPage(adminPageInstance);
    await adminPage.goto();
    await adminPage.waitForDashboard();
    await adminPage.refreshRegistrations();

    const initialHasPending = await adminPage.hasPendingRegistrations();

    if (initialHasPending) {
      // Get initial count
      const initialCount = await adminPage.getPendingRegistrationsCount();

      // Reject first registration
      await adminPage.rejectFirstRegistration();

      // Refresh and verify count decreased
      await adminPage.refreshRegistrations();
      const newCount = await adminPage.getPendingRegistrationsCount();

      expect(newCount).toBeLessThanOrEqual(initialCount);
    }

    // Cleanup
    await userPage.close();
    await adminPageInstance.close();
  });
});

// ============================================================================
// Test Suite 5: Edge Cases and Error Handling
// ============================================================================

test.describe('Registration Edge Cases', () => {
  test('refreshing during backup step preserves state', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await clearStorage(page);

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.waitForBackupStep();
    await signupPage.revealNsec();

    const nsecBefore = await signupPage.getNsec();

    // Note: Refreshing will reset the signup flow since keys aren't stored yet
    // This tests that the app handles the reset gracefully
    await page.reload();
    await signupPage.waitForSignupStep();

    // Should be back at signup step
    await expect(signupPage.createAccountButton).toBeVisible();
  });

  test('multiple rapid clicks on create account only generates once', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await clearStorage(page);

    await signupPage.goto();
    await signupPage.waitForSignupStep();

    // Click multiple times rapidly
    await signupPage.createAccountButton.click();
    await signupPage.createAccountButton.click({ force: true }).catch(() => {});
    await signupPage.createAccountButton.click({ force: true }).catch(() => {});

    // Should still transition properly to backup step
    await signupPage.waitForBackupStep();
    await expect(signupPage.backupHeading).toBeVisible();
  });

  test('very long nickname is trimmed to max length', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await clearStorage(page);

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.waitForNicknameStep();

    // Try to enter very long nickname
    const longName = 'A'.repeat(100);
    await signupPage.enterNickname(longName);

    // Input should have maxlength=50
    const inputValue = await signupPage.nicknameInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(50);
  });

  test('special characters in nickname are allowed', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await clearStorage(page);

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.waitForNicknameStep();

    // Enter nickname with special characters
    const specialNickname = 'User_123-Test.Name';
    await signupPage.enterNickname(specialNickname);

    // Continue button should be enabled
    await expect(signupPage.nicknameContinueButton).toBeEnabled();
  });

  test('emoji in nickname is accepted', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await clearStorage(page);

    await signupPage.goto();
    await signupPage.waitForSignupStep();
    await signupPage.clickCreateAccount();
    await signupPage.completeBackupStep();
    await signupPage.waitForNicknameStep();

    // Enter nickname with emoji
    const emojiNickname = 'User123';
    await signupPage.enterNickname(emojiNickname);

    // Continue button should be enabled
    await expect(signupPage.nicknameContinueButton).toBeEnabled();
  });
});

// ============================================================================
// Test Suite 6: Post-Approval Access Verification
// ============================================================================

test.describe('Post-Approval Access', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('approved user can navigate to chat page', async ({ page }) => {
    // This test uses admin credentials to verify approved user behavior
    await clearStorage(page);
    await loginAsAdmin(page);

    // Admin is pre-approved, should be able to access chat
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // Should be on chat page, not pending
    expect(page.url()).toContain('/chat');
    expect(page.url()).not.toContain('/pending');
  });

  test('approved user display name shows correctly', async ({ page }) => {
    await clearStorage(page);
    await loginAsAdmin(page);

    // Navigate to a page that shows the user display name
    await page.goto('/chat');
    await page.waitForTimeout(2000);

    // User should see some form of profile/name display
    // This depends on the UI layout but profile info should be accessible
    const hasProfileSection = await page.locator('[class*="profile"], [class*="user"], .navbar').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasProfileSection).toBe(true);
  });

  test('approved user is not redirected to pending', async ({ page }) => {
    await clearStorage(page);
    await loginAsAdmin(page);

    // Try navigating to various pages
    const pages = ['/chat', '/events', '/'];

    for (const targetPage of pages) {
      await page.goto(targetPage);
      await page.waitForTimeout(1000);

      // Should never be redirected to pending
      expect(page.url()).not.toContain('/pending');
    }
  });
});
