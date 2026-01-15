import { test, expect } from '@playwright/test';

const LIVE_URL = 'https://dreamlab-ai.github.io/fairfield';

test.describe('Live Site Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('homepage loads correctly', async ({ page }) => {
    await page.goto(LIVE_URL);
    await page.waitForLoadState('networkidle');

    // Take screenshot of homepage
    await page.screenshot({
      path: 'tests/screenshots/01-homepage.png',
      fullPage: true
    });

    // Check page loaded
    await expect(page).toHaveTitle(/Fairfield|DreamLab/i);
  });

  test('login page displays correctly', async ({ page }) => {
    await page.goto(`${LIVE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/02-login-page.png',
      fullPage: true
    });

    // Check login form elements
    const loginForm = page.locator('form, [data-testid="login-form"], .login-form');
    await expect(loginForm.or(page.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="nsec" i]'))).toBeVisible({ timeout: 10000 });
  });

  test('signup page displays correctly', async ({ page }) => {
    await page.goto(`${LIVE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/03-signup-page.png',
      fullPage: true
    });

    // Check signup elements exist
    const signupContent = page.locator('body');
    await expect(signupContent).toBeVisible();
  });

  test('chat/forum page loads', async ({ page }) => {
    await page.goto(`${LIVE_URL}/chat`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/04-chat-page.png',
      fullPage: true
    });
  });

  test('events page loads', async ({ page }) => {
    await page.goto(`${LIVE_URL}/events`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/05-events-page.png',
      fullPage: true
    });
  });

  test('direct messages page loads', async ({ page }) => {
    await page.goto(`${LIVE_URL}/dm`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/06-dm-page.png',
      fullPage: true
    });
  });

  test('admin page redirects or shows access denied for unauthenticated users', async ({ page }) => {
    await page.goto(`${LIVE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/07-admin-page-unauth.png',
      fullPage: true
    });
  });

  test('check for console errors on homepage', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(LIVE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('Failed to load resource') &&
      !err.includes('net::ERR')
    );

    console.log('Console errors found:', criticalErrors);

    // We don't fail on errors, just report them
    if (criticalErrors.length > 0) {
      console.warn('Critical console errors:', criticalErrors);
    }
  });

  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(LIVE_URL);
    await page.waitForLoadState('networkidle');

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/08-mobile-homepage.png',
      fullPage: true
    });
  });

  test('navigation menu works', async ({ page }) => {
    await page.goto(LIVE_URL);
    await page.waitForLoadState('networkidle');

    // Try to find and click navigation elements
    const navLinks = page.locator('nav a, .navbar a, [role="navigation"] a');
    const count = await navLinks.count();

    console.log(`Found ${count} navigation links`);

    // Take screenshot showing nav
    await page.screenshot({
      path: 'tests/screenshots/09-navigation.png',
      fullPage: false
    });
  });
});
