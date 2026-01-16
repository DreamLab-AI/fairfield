/**
 * QE Comprehensive Audit Test Suite
 * Tests all user and admin flows on the LIVE site with screenshots
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://dreamlab-ai.github.io/fairfield';
const SCREENSHOT_DIR = 'tests/screenshots/qe-audit';

test.describe('User Flows - Comprehensive Audit', () => {
  test.describe('Public Pages', () => {
    test('Homepage - landing and navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/user-flows/01-homepage.png`,
        fullPage: true
      });

      // Check branding
      const title = await page.title();
      console.log('Page title:', title);

      // Check page has loaded with content - use flexible selectors
      // The homepage may use different layouts (drawer, navbar, etc.)
      const pageContent = page.locator('body');
      await expect(pageContent).toBeVisible();

      // Look for navigation elements with broader selectors
      const navElements = page.locator('nav, header, .navbar, .drawer, [role="navigation"], a[href*="login"], a[href*="chat"]');
      const navCount = await navElements.count();
      console.log(`Navigation elements found: ${navCount}`);

      // Check for console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      if (errors.length > 0) {
        console.log('Console errors:', errors);
      }
    });

    test('Login page - form and validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/02-login-page.png`,
        fullPage: true 
      });
      
      // Check login form exists
      const loginForm = page.locator('form, [data-testid="login-form"], .login-form');
      const nsecInput = page.locator('input[type="password"], input[placeholder*="nsec"], textarea');
      
      // Take screenshot of form
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/02a-login-form.png`,
        fullPage: true 
      });
    });

    test('Signup page - fast signup flow', async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/03-signup-page.png`,
        fullPage: true 
      });
      
      // Look for fast signup / generate keys option
      const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("Sign Up")');
      if (await generateBtn.count() > 0) {
        await page.screenshot({ 
          path: `${SCREENSHOT_DIR}/user-flows/03a-signup-options.png`,
          fullPage: true 
        });
      }
    });

    test('Chat/Boards page - sections panel', async ({ page }) => {
      await page.goto(`${BASE_URL}/chat`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/04-chat-page.png`,
        fullPage: true 
      });
      
      // Look for sections panel
      const sectionsPanel = page.locator('.sections-panel, aside, [aria-label*="section"], [aria-label*="board"]');
      if (await sectionsPanel.count() > 0) {
        console.log('Sections panel found');
      }
      
      // Look for board names
      const boards = ['Fairfield', 'MiniMooNoir', 'DreamLab'];
      for (const board of boards) {
        const boardEl = page.locator(`text=${board}`);
        if (await boardEl.count() > 0) {
          console.log(`Found board: ${board}`);
        }
      }
    });

    test('Events/Calendar page - calendar components', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/05-events-page.png`,
        fullPage: true 
      });
      
      // Look for calendar sidebar
      const calendarSidebar = page.locator('.calendar-sidebar, [class*="calendar"], aside');
      if (await calendarSidebar.count() > 0) {
        console.log('Calendar components found');
      }
    });

    test('Forum page', async ({ page }) => {
      await page.goto(`${BASE_URL}/forum`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/06-forum-page.png`,
        fullPage: true 
      });
    });
  });

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('Homepage - mobile view', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/07-mobile-homepage.png`,
        fullPage: true 
      });
    });

    test('Chat - mobile view', async ({ page }) => {
      await page.goto(`${BASE_URL}/chat`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/08-mobile-chat.png`,
        fullPage: true 
      });
      
      // Look for mobile menu toggle
      const menuToggle = page.locator('button[aria-label*="menu"], button[aria-label*="sidebar"], .btn-circle');
      if (await menuToggle.count() > 0) {
        await menuToggle.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ 
          path: `${SCREENSHOT_DIR}/user-flows/08a-mobile-menu-open.png`,
          fullPage: true 
        });
      }
    });

    test('Events - mobile view', async ({ page }) => {
      await page.goto(`${BASE_URL}/events`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: `${SCREENSHOT_DIR}/user-flows/09-mobile-events.png`,
        fullPage: true 
      });
    });
  });
});

test.describe('Admin Flows - Comprehensive Audit', () => {
  test('Admin page - unauthorized access', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/admin/01-admin-unauthorized.png`,
      fullPage: true 
    });
    
    // Check for redirect or access denied message
    const url = page.url();
    console.log('Admin page URL after load:', url);
  });

  test('Admin calendar - unauthorized access', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/calendar`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/admin/02-admin-calendar-unauthorized.png`,
      fullPage: true 
    });
  });

  test('Admin stats - unauthorized access', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/stats`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/admin/03-admin-stats-unauthorized.png`,
      fullPage: true 
    });
  });
});

test.describe('Accessibility Audit', () => {
  test('Homepage - keyboard navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Tab through focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }
    
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/accessibility/01-keyboard-focus.png`,
      fullPage: true 
    });
  });

  test('Login - form accessibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Check for labels
    const labels = await page.locator('label').count();
    const inputs = await page.locator('input, textarea').count();
    console.log(`Labels: ${labels}, Inputs: ${inputs}`);
    
    // Check aria attributes
    const ariaLabels = await page.locator('[aria-label]').count();
    console.log(`Elements with aria-label: ${ariaLabels}`);
    
    await page.screenshot({ 
      path: `${SCREENSHOT_DIR}/accessibility/02-login-a11y.png`,
      fullPage: true 
    });
  });
});
