/**
 * Admin Workflow Audit Test Suite
 *
 * QE Audit: Tests all admin workflows on the live Fairfield site
 * Captures screenshots for documentation and verification
 *
 * Test Areas:
 * 1. Admin Login Flow
 * 2. Admin Dashboard (/admin)
 * 3. Admin Calendar (/admin/calendar)
 * 4. Admin Stats (/admin/stats)
 * 5. User Management (Whitelist, approvals)
 * 6. Section Management
 */

import { test, expect, Page } from '@playwright/test';

// Configuration
const LIVE_SITE_URL = 'https://dreamlab-ai.github.io/fairfield';
const SCREENSHOT_DIR = 'tests/screenshots/qe-audit/admin';

// Admin credentials from environment
const ADMIN_PUBKEY = process.env.VITE_ADMIN_PUBKEY || '11ed64225dd5e2c5e18f61ad43d5ad9272d08739d3a20dd25886197b0738663c';
const ADMIN_NSEC = process.env.ADMIN_KEY || '';

// Test nsec for non-admin testing (well-known test key)
const NON_ADMIN_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

/**
 * Helper: Take a screenshot with timestamp
 */
async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${SCREENSHOT_DIR}/${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
  return filename;
}

/**
 * Helper: Dismiss any tutorial/onboarding modals
 */
async function dismissTutorial(page: Page): Promise<void> {
  // Try to skip tutorial if modal appears
  const skipBtn = page.locator('button:has-text("Skip Tutorial"), button:has-text("Skip"), .modal button.btn-ghost:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // Try closing modal with X button
  const closeBtn = page.locator('.modal button[aria-label*="close"], .modal button:has-text("x"), .modal .btn-circle').first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // Click modal backdrop to close
  const backdrop = page.locator('.modal-backdrop, .modal-box + div').first();
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.click({ position: { x: 0, y: 0 }, force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

/**
 * Helper: Login with nsec key
 */
async function loginWithNsec(page: Page, nsec: string): Promise<boolean> {
  try {
    // Go to homepage
    await page.goto(LIVE_SITE_URL);
    await page.waitForTimeout(2000);

    // Dismiss any tutorial modal first
    await dismissTutorial(page);

    // Look for login/setup button
    const loginLink = page.locator('a[href*="login"], a[href*="signup"], button:has-text("Login"), button:has-text("Setup")').first();

    if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(1500);
    }

    // Dismiss tutorial again if it appears on login page
    await dismissTutorial(page);

    // Find the private key input field
    const keyInput = page.locator('input[type="password"][placeholder*="nsec"], input[placeholder*="hex"], input[placeholder*="private"]').first();

    if (!await keyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Maybe we need to click "I have an account" or similar
      const existingAccountBtn = page.locator('button:has-text("Log In"), button:has-text("I have"), a:has-text("Log In")').first();
      if (await existingAccountBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await existingAccountBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Now fill the key input
    const keyInputFinal = page.locator('input[type="password"], input[placeholder*="nsec"]').first();
    await keyInputFinal.fill(nsec);
    await page.waitForTimeout(500);

    // Click login button
    const loginBtn = page.locator('button:has-text("Log In"), button:has-text("Restore"), button:has-text("Continue")').first();
    await loginBtn.click();

    // Wait for authentication
    await page.waitForTimeout(3000);

    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

test.describe('Admin Workflow Audit', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for live site tests
    test.setTimeout(60000);
  });

  test('1. Homepage and Login Page Screenshots', async ({ page }) => {
    // Screenshot: Homepage (unauthenticated)
    await page.goto(LIVE_SITE_URL);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '01-homepage-unauthenticated');

    // Navigate to login
    const loginLink = page.locator('a[href*="login"], a[href*="signup"], button:has-text("Login"), button:has-text("Get Started")').first();
    if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '02-login-page');
    }
  });

  test('2. Non-Admin Access Attempt to Admin Pages', async ({ page }) => {
    // Try to access admin pages without authentication
    await page.goto(`${LIVE_SITE_URL}/admin`);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-admin-unauthenticated-redirect');

    // Check if redirected or shows access denied
    const currentUrl = page.url();
    const pageContent = await page.content();

    console.log('Admin page access without auth:');
    console.log('  URL:', currentUrl);
    console.log('  Contains "denied":', pageContent.toLowerCase().includes('denied'));
    console.log('  Contains "login":', pageContent.toLowerCase().includes('login'));

    // Also try calendar and stats
    await page.goto(`${LIVE_SITE_URL}/admin/calendar`);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '04-admin-calendar-unauthenticated');

    await page.goto(`${LIVE_SITE_URL}/admin/stats`);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '05-admin-stats-unauthenticated');
  });

  test('3. Non-Admin User Login and Admin Access Attempt', async ({ page }) => {
    // Login as non-admin user
    await page.goto(LIVE_SITE_URL);
    await page.waitForTimeout(2000);

    // Dismiss any tutorial modal
    await dismissTutorial(page);

    // Navigate to login
    const loginLink = page.locator('a[href*="login"], a[href*="signup"], button:has-text("Login"), button:has-text("Get Started")').first();
    if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
    }

    // Dismiss tutorial again after navigation
    await dismissTutorial(page);

    // Look for "Log In" tab or button - click "Already have an account? Log in"
    const loginTab = page.locator('button:has-text("Already have an account"), button:has-text("Log In"), button:has-text("Log in")').first();
    if (await loginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginTab.click();
      await page.waitForTimeout(1000);
    }

    await takeScreenshot(page, '06-login-form-visible');

    // Fill in non-admin nsec
    const keyInput = page.locator('input[type="password"], input[placeholder*="nsec"]').first();
    if (await keyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await keyInput.fill(NON_ADMIN_NSEC);
      await takeScreenshot(page, '07-login-form-filled');

      // Submit
      const loginBtn = page.locator('button:has-text("Log In")').first();
      await loginBtn.click();
      await page.waitForTimeout(4000);
      await takeScreenshot(page, '08-non-admin-logged-in');

      // Now try to access admin pages
      await page.goto(`${LIVE_SITE_URL}/admin`);
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '09-non-admin-access-admin-page');

      // Check for access denied message
      const accessDenied = await page.locator('text=/access denied|not authorized|admin privileges/i').isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Non-admin access to /admin - Denied:', accessDenied);
    }
  });

  test('4. Admin Login Flow', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Go to homepage
    await page.goto(LIVE_SITE_URL);
    await page.waitForTimeout(2000);

    // Navigate to login
    const loginLink = page.locator('a[href*="login"], a[href*="signup"], button:has-text("Login"), button:has-text("Get Started")').first();
    if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
    }

    // Look for "Log In" tab
    const loginTab = page.locator('button:has-text("Log In"), a:has-text("Log In")').first();
    if (await loginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginTab.click();
      await page.waitForTimeout(1000);
    }

    // Fill admin credentials
    const keyInput = page.locator('input[type="password"], input[placeholder*="nsec"]').first();
    await keyInput.fill(ADMIN_NSEC);
    await takeScreenshot(page, '10-admin-login-form-filled');

    // Submit
    const loginBtn = page.locator('button:has-text("Log In")').first();
    await loginBtn.click();
    await page.waitForTimeout(5000);
    await takeScreenshot(page, '11-admin-logged-in');

    // Verify admin is logged in
    const pubkey = await page.evaluate(() => localStorage.getItem('nostr_bbs_nostr_pubkey'));
    console.log('Admin login - Stored pubkey:', pubkey);
    console.log('Admin login - Expected pubkey:', ADMIN_PUBKEY);
    console.log('Admin login - Match:', pubkey === ADMIN_PUBKEY);
  });

  test('5. Admin Dashboard (/admin)', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin first
    const loginSuccess = await loginWithNsec(page, ADMIN_NSEC);
    if (!loginSuccess) {
      console.log('Admin login failed, skipping dashboard test');
      return;
    }

    // Navigate to admin dashboard
    await page.goto(`${LIVE_SITE_URL}/admin`);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '12-admin-dashboard-main');

    // Check for admin UI elements
    const hasChannelManagement = await page.locator('text=/channels|manage|create/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasPendingRequests = await page.locator('text=/pending|requests|approvals/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasSecurityAudit = await page.locator('text=/security|audit|log/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Admin Dashboard Elements:');
    console.log('  Channel Management:', hasChannelManagement);
    console.log('  Pending Requests:', hasPendingRequests);
    console.log('  Security Audit:', hasSecurityAudit);

    // Try to expand sections for more screenshots
    const tabs = page.locator('.tabs button, .tab');
    const tabCount = await tabs.count();
    console.log('  Number of tabs:', tabCount);

    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      const tab = tabs.nth(i);
      const tabText = await tab.textContent().catch(() => `tab-${i}`);
      await tab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, `13-admin-dashboard-tab-${i}-${tabText?.replace(/\s+/g, '-').toLowerCase()}`);
    }
  });

  test('6. Admin Calendar (/admin/calendar)', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin
    await loginWithNsec(page, ADMIN_NSEC);

    // Navigate to admin calendar
    await page.goto(`${LIVE_SITE_URL}/admin/calendar`);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '14-admin-calendar-main');

    // Check for calendar elements
    const hasCalendarView = await page.locator('.calendar, [class*="calendar"], text=/calendar/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasEventsList = await page.locator('text=/events|upcoming/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasStats = await page.locator('.stats, .stat, text=/total events/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Admin Calendar Elements:');
    console.log('  Calendar View:', hasCalendarView);
    console.log('  Events List:', hasEventsList);
    console.log('  Statistics:', hasStats);

    // Click on an event if visible
    const eventElement = page.locator('[class*="event"], .calendar-event, button:has-text(/\d{1,2}/)').first();
    if (await eventElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      await eventElement.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '15-admin-calendar-event-detail');
    }
  });

  test('7. Admin Stats (/admin/stats)', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin
    await loginWithNsec(page, ADMIN_NSEC);

    // Navigate to admin stats
    await page.goto(`${LIVE_SITE_URL}/admin/stats`);
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '16-admin-stats-main');

    // Check for stats elements
    const hasOverview = await page.locator('text=/overview|platform|statistics/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasCharts = await page.locator('canvas, svg, .chart, [class*="chart"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasMetrics = await page.locator('.stat, .metric, text=/users|messages|channels/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Admin Stats Elements:');
    console.log('  Overview Section:', hasOverview);
    console.log('  Charts/Graphs:', hasCharts);
    console.log('  Metrics Display:', hasMetrics);

    // Scroll to capture full page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await takeScreenshot(page, '17-admin-stats-middle');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await takeScreenshot(page, '18-admin-stats-bottom');
  });

  test('8. User Management - Whitelist Check', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin
    await loginWithNsec(page, ADMIN_NSEC);

    // Navigate to admin dashboard
    await page.goto(`${LIVE_SITE_URL}/admin`);
    await page.waitForTimeout(3000);

    // Look for user management / whitelist section
    const userSection = page.locator('text=/users|whitelist|members|approved/i').first();
    if (await userSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userSection.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, '19-admin-user-management');
    }

    // Look for pending requests
    const pendingSection = page.locator('text=/pending|requests|awaiting/i').first();
    if (await pendingSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingSection.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, '20-admin-pending-requests');
    }
  });

  test('9. Section Management', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin
    await loginWithNsec(page, ADMIN_NSEC);

    // Navigate to admin dashboard
    await page.goto(`${LIVE_SITE_URL}/admin`);
    await page.waitForTimeout(3000);

    // Look for channel/section management
    const channelSection = page.locator('text=/channels|sections|rooms|boards/i').first();
    if (await channelSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await channelSection.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, '21-admin-section-management');
    }

    // Look for create channel button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '22-admin-create-channel-dialog');

      // Close dialog
      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), .modal-backdrop').first();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('10. Admin Navigation and UI Elements', async ({ page }) => {
    test.skip(!ADMIN_NSEC, 'ADMIN_KEY environment variable not set');

    // Login as admin
    await loginWithNsec(page, ADMIN_NSEC);

    // Navigate to admin dashboard
    await page.goto(`${LIVE_SITE_URL}/admin`);
    await page.waitForTimeout(3000);

    // Check for admin-specific navigation elements
    const adminNav = await page.locator('nav, .navbar, .sidebar').first();
    const hasAdminLinks = await page.locator('a[href*="/admin"]').count();

    console.log('Admin Navigation:');
    console.log('  Admin Links Count:', hasAdminLinks);

    // Screenshot the nav area
    await takeScreenshot(page, '23-admin-navigation');

    // Check for quick actions
    const quickActions = page.locator('text=/quick actions|shortcuts/i');
    if (await quickActions.isVisible({ timeout: 2000 }).catch(() => false)) {
      await takeScreenshot(page, '24-admin-quick-actions');
    }
  });

  test('11. Permission Boundary Test - Public Events Page', async ({ page }) => {
    // First check public events page without login
    await page.goto(`${LIVE_SITE_URL}/events`);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '25-public-events-unauthenticated');

    // Check what's visible
    const hasPublicEvents = await page.locator('.event, .calendar, text=/event/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Public Events Page:');
    console.log('  Events visible without auth:', hasPublicEvents);
  });

  test('12. Permission Boundary Test - Chat Access', async ({ page }) => {
    // Check chat page access without login
    await page.goto(`${LIVE_SITE_URL}/chat`);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '26-chat-unauthenticated');

    // Check if redirected or shows login prompt
    const currentUrl = page.url();
    const hasLoginPrompt = await page.locator('text=/login|sign in|get started/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Chat Page Access:');
    console.log('  Current URL:', currentUrl);
    console.log('  Login prompt shown:', hasLoginPrompt);
  });

  test('13. Final Summary Screenshot', async ({ page }) => {
    // Create a summary of all tested pages
    await page.goto(LIVE_SITE_URL);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '99-final-homepage');

    console.log('\n=== Admin Workflow Audit Complete ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
    console.log('Review the screenshots for visual verification.');
  });
});
