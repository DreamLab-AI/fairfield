import { test, expect, Page } from '@playwright/test';

/**
 * QE Audit Test Suite for Fairfield DreamLab
 *
 * Comprehensive end-to-end testing of the live deployed site
 * Testing all critical user flows with screenshots
 *
 * TARGET: https://dreamlab-ai.github.io/fairfield
 */

const LIVE_URL = 'https://dreamlab-ai.github.io/fairfield';
const SCREENSHOT_DIR = 'tests/screenshots/qe-audit';

interface AuditFindings {
  page: string;
  consoleErrors: string[];
  networkErrors: string[];
  accessibilityIssues: string[];
  uiIssues: string[];
  performance: {
    loadTime: number;
    domContentLoaded: number;
  };
}

const auditResults: AuditFindings[] = [];

// Helper function to capture comprehensive page data
async function capturePageAudit(
  page: Page,
  pageName: string,
  screenshotName: string
): Promise<AuditFindings> {
  const findings: AuditFindings = {
    page: pageName,
    consoleErrors: [],
    networkErrors: [],
    accessibilityIssues: [],
    uiIssues: [],
    performance: { loadTime: 0, domContentLoaded: 0 },
  };

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      findings.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    findings.consoleErrors.push(`Page Error: ${err.message}`);
  });

  // Capture network errors
  page.on('requestfailed', (request) => {
    findings.networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`);
  });

  return findings;
}

test.describe('QE Audit - Fairfield DreamLab Live Site', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000); // 2 minutes per test for thorough auditing

  test('01 - Homepage Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Homepage', '01-homepage');

    const startTime = Date.now();
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Take full page screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-homepage-full.png`,
      fullPage: true,
    });

    // Take above-fold screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-homepage-viewport.png`,
      fullPage: false,
    });

    // Check page title
    const title = await page.title();
    console.log(`[Homepage] Title: ${title}`);

    // Check for main content elements
    const bodyText = await page.locator('body').textContent();
    console.log(`[Homepage] Body text length: ${bodyText?.length || 0}`);

    // Check branding
    const hasFairfield = bodyText?.toLowerCase().includes('fairfield') ||
                         bodyText?.toLowerCase().includes('dreamlab');
    console.log(`[Homepage] Branding present: ${hasFairfield}`);

    // Find navigation elements
    const navLinks = await page.locator('nav a, .navbar a, header a').count();
    console.log(`[Homepage] Navigation links: ${navLinks}`);

    // Find buttons
    const buttons = await page.locator('button').count();
    console.log(`[Homepage] Buttons: ${buttons}`);

    // Log console errors
    await page.waitForTimeout(2000);
    console.log(`[Homepage] Console errors: ${findings.consoleErrors.length}`);
    findings.consoleErrors.forEach((err) => console.log(`  - ${err}`));

    auditResults.push(findings);
    expect(page).toBeTruthy();
  });

  test('02 - Login Page Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Login', '02-login');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/login`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot login page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-login-page.png`,
      fullPage: true,
    });

    // Check for login form elements
    const passwordInput = page.locator('input[type="password"], input[placeholder*="nsec" i], input[placeholder*="key" i], input[placeholder*="secret" i]');
    const passwordVisible = await passwordInput.first().isVisible().catch(() => false);
    console.log(`[Login] Password/Key input visible: ${passwordVisible}`);

    // Check for login button
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Connect"), button[type="submit"]');
    const loginButtonVisible = await loginButton.first().isVisible().catch(() => false);
    console.log(`[Login] Login button visible: ${loginButtonVisible}`);

    // Check for signup link
    const signupLink = page.locator('a:has-text("Sign up"), a:has-text("Create"), a:has-text("Register"), a[href*="signup"]');
    const signupLinkVisible = await signupLink.first().isVisible().catch(() => false);
    console.log(`[Login] Signup link visible: ${signupLinkVisible}`);

    // Check for extension login option
    const extensionOption = page.locator('text=/extension|nos2x|alby/i');
    const extensionVisible = await extensionOption.first().isVisible().catch(() => false);
    console.log(`[Login] Extension login option: ${extensionVisible}`);

    await page.waitForTimeout(2000);
    console.log(`[Login] Console errors: ${findings.consoleErrors.length}`);
    findings.consoleErrors.forEach((err) => console.log(`  - ${err}`));

    auditResults.push(findings);
  });

  test('03 - Signup Flow Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Signup', '03-signup');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/signup`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot signup page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-signup-page.png`,
      fullPage: true,
    });

    // Check for fast signup / generate keys button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("New Account"), button:has-text("Fast")');
    const generateVisible = await generateButton.first().isVisible().catch(() => false);
    console.log(`[Signup] Generate keys button: ${generateVisible}`);

    // Check for username/display name field
    const usernameField = page.locator('input[placeholder*="name" i], input[name*="name" i], input[id*="name" i]');
    const usernameVisible = await usernameField.first().isVisible().catch(() => false);
    console.log(`[Signup] Username field: ${usernameVisible}`);

    // Check for nsec backup warning
    const backupWarning = page.locator('text=/backup|save|nsec|private key|secure/i');
    const backupWarningVisible = await backupWarning.first().isVisible().catch(() => false);
    console.log(`[Signup] Backup warning visible: ${backupWarningVisible}`);

    await page.waitForTimeout(2000);
    console.log(`[Signup] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('04 - Chat/Boards Section Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Chat', '04-chat');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/chat`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot chat page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-chat-overview.png`,
      fullPage: true,
    });

    // Check for sections panel
    const sectionsPanel = page.locator('text=/section|board|channel|fairfield guests|minimoonoir|dreamlab/i');
    const sectionsVisible = await sectionsPanel.first().isVisible().catch(() => false);
    console.log(`[Chat] Sections panel visible: ${sectionsVisible}`);

    // Look for specific boards mentioned
    const fairfieldGuests = await page.locator('text=/Fairfield Guests/i').isVisible().catch(() => false);
    const miniMooNoir = await page.locator('text=/MiniMooNoir/i').isVisible().catch(() => false);
    const dreamLab = await page.locator('text=/DreamLab/i').isVisible().catch(() => false);

    console.log(`[Chat] Fairfield Guests board: ${fairfieldGuests}`);
    console.log(`[Chat] MiniMooNoir board: ${miniMooNoir}`);
    console.log(`[Chat] DreamLab board: ${dreamLab}`);

    // Check for message list or chat area
    const messageArea = page.locator('[class*="message"], [class*="chat"], [data-testid*="message"]');
    const messageAreaVisible = await messageArea.first().isVisible().catch(() => false);
    console.log(`[Chat] Message area visible: ${messageAreaVisible}`);

    // Check for compose/input area
    const composeArea = page.locator('textarea, input[placeholder*="message" i], [class*="compose"], [class*="input"]');
    const composeVisible = await composeArea.first().isVisible().catch(() => false);
    console.log(`[Chat] Compose area visible: ${composeVisible}`);

    await page.waitForTimeout(3000);
    console.log(`[Chat] Console errors: ${findings.consoleErrors.length}`);
    findings.consoleErrors.forEach((err) => console.log(`  - ${err}`));

    auditResults.push(findings);
  });

  test('05 - Events/Calendar Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Events', '05-events');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/events`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot events page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-events-page.png`,
      fullPage: true,
    });

    // Check for calendar elements
    const calendar = page.locator('[class*="calendar"], [role="grid"], table');
    const calendarVisible = await calendar.first().isVisible().catch(() => false);
    console.log(`[Events] Calendar visible: ${calendarVisible}`);

    // Check for mini calendar sidebar
    const miniCalendar = page.locator('[class*="mini"], [class*="sidebar"] [class*="calendar"]');
    const miniCalendarVisible = await miniCalendar.first().isVisible().catch(() => false);
    console.log(`[Events] Mini calendar: ${miniCalendarVisible}`);

    // Check for event list
    const eventList = page.locator('[class*="event"], [data-testid*="event"]');
    const eventListCount = await eventList.count();
    console.log(`[Events] Event items found: ${eventListCount}`);

    // Check for date navigation
    const dateNav = page.locator('button:has-text("Today"), button:has-text("Next"), button:has-text("Previous"), [class*="nav"]');
    const dateNavVisible = await dateNav.first().isVisible().catch(() => false);
    console.log(`[Events] Date navigation: ${dateNavVisible}`);

    await page.waitForTimeout(2000);
    console.log(`[Events] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('06 - Forum Page Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Forum', '06-forum');

    // Try /forum first
    let forumExists = false;
    try {
      const startTime = Date.now();
      const response = await page.goto(`${LIVE_URL}/forum`, { waitUntil: 'networkidle', timeout: 15000 });
      findings.performance.loadTime = Date.now() - startTime;
      forumExists = response?.status() === 200;
    } catch {
      console.log('[Forum] /forum route not available');
    }

    if (!forumExists) {
      // Try /boards as fallback
      try {
        await page.goto(`${LIVE_URL}/boards`, { waitUntil: 'networkidle', timeout: 15000 });
      } catch {
        console.log('[Forum] /boards route not available either');
      }
    }

    // Screenshot whatever loaded
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-forum-page.png`,
      fullPage: true,
    });

    // Check for forum elements
    const threads = page.locator('[class*="thread"], [class*="topic"], [class*="post"]');
    const threadCount = await threads.count();
    console.log(`[Forum] Thread/topic elements: ${threadCount}`);

    await page.waitForTimeout(2000);
    console.log(`[Forum] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('07 - Direct Messages Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'DM', '07-dm');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/dm`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot DM page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-dm-page.png`,
      fullPage: true,
    });

    // Check for conversation list
    const conversationList = page.locator('[class*="conversation"], [class*="contact"], [class*="dm-list"]');
    const convListVisible = await conversationList.first().isVisible().catch(() => false);
    console.log(`[DM] Conversation list: ${convListVisible}`);

    // Check for message compose area
    const composeArea = page.locator('textarea, input[placeholder*="message" i]');
    const composeVisible = await composeArea.first().isVisible().catch(() => false);
    console.log(`[DM] Compose area: ${composeVisible}`);

    // Check for login prompt (expected for unauthenticated users)
    const loginPrompt = page.locator('text=/log in|sign in|connect/i');
    const loginPromptVisible = await loginPrompt.first().isVisible().catch(() => false);
    console.log(`[DM] Login prompt (expected): ${loginPromptVisible}`);

    await page.waitForTimeout(2000);
    console.log(`[DM] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('08 - Admin Page (Unauthenticated) Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Admin', '08-admin');

    const startTime = Date.now();
    await page.goto(`${LIVE_URL}/admin`, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot admin page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-admin-unauth.png`,
      fullPage: true,
    });

    // Check for access denied or redirect to login
    const accessDenied = page.locator('text=/access denied|unauthorized|not authorized|permission/i');
    const accessDeniedVisible = await accessDenied.first().isVisible().catch(() => false);
    console.log(`[Admin] Access denied message: ${accessDeniedVisible}`);

    // Check if redirected to login
    const currentUrl = page.url();
    const redirectedToLogin = currentUrl.includes('/login');
    console.log(`[Admin] Redirected to login: ${redirectedToLogin}`);

    await page.waitForTimeout(2000);
    console.log(`[Admin] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('09 - Mobile Responsive Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Mobile', '09-mobile');

    // Test iPhone viewport
    await page.setViewportSize({ width: 375, height: 812 });

    const startTime = Date.now();
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
    findings.performance.loadTime = Date.now() - startTime;

    // Screenshot mobile homepage
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-mobile-homepage.png`,
      fullPage: true,
    });

    // Check for hamburger menu
    const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu" i], [class*="mobile-menu"]');
    const hamburgerVisible = await hamburger.first().isVisible().catch(() => false);
    console.log(`[Mobile] Hamburger menu: ${hamburgerVisible}`);

    // Test login page on mobile
    await page.goto(`${LIVE_URL}/login`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-mobile-login.png`,
      fullPage: true,
    });

    // Test chat page on mobile
    await page.goto(`${LIVE_URL}/chat`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-mobile-chat.png`,
      fullPage: true,
    });

    // Test events page on mobile
    await page.goto(`${LIVE_URL}/events`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-mobile-events.png`,
      fullPage: true,
    });

    await page.waitForTimeout(2000);
    console.log(`[Mobile] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('10 - Navigation Flow Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Navigation', '10-nav');

    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

    // Find all navigation links
    const navLinks = await page.locator('nav a, header a, [role="navigation"] a').all();
    console.log(`[Navigation] Total nav links found: ${navLinks.length}`);

    // Screenshot main navigation
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-navigation-main.png`,
      fullPage: false,
    });

    // List all link hrefs
    for (const link of navLinks.slice(0, 10)) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      console.log(`[Navigation] Link: "${text?.trim()}" -> ${href}`);
    }

    // Test clicking on each major section if links exist
    const chatLink = page.locator('a[href*="chat"], a:has-text("Chat"), a:has-text("Boards")').first();
    if (await chatLink.isVisible().catch(() => false)) {
      await chatLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/10-nav-to-chat.png`,
        fullPage: true,
      });
    }

    const eventsLink = page.locator('a[href*="events"], a:has-text("Events"), a:has-text("Calendar")').first();
    if (await eventsLink.isVisible().catch(() => false)) {
      await eventsLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/10-nav-to-events.png`,
        fullPage: true,
      });
    }

    await page.waitForTimeout(2000);
    console.log(`[Navigation] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('11 - Accessibility Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Accessibility', '11-a11y');

    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

    // Check for alt text on images
    const imagesWithoutAlt = await page.locator('img:not([alt]), img[alt=""]').count();
    console.log(`[A11y] Images without alt text: ${imagesWithoutAlt}`);

    // Check for form labels
    const inputsWithoutLabel = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
      let count = 0;
      inputs.forEach(input => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : false;
        if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
          count++;
        }
      });
      return count;
    });
    console.log(`[A11y] Inputs without labels: ${inputsWithoutLabel}`);

    // Check for heading hierarchy
    const headings = await page.evaluate(() => {
      const h1 = document.querySelectorAll('h1').length;
      const h2 = document.querySelectorAll('h2').length;
      const h3 = document.querySelectorAll('h3').length;
      return { h1, h2, h3 };
    });
    console.log(`[A11y] Headings: H1=${headings.h1}, H2=${headings.h2}, H3=${headings.h3}`);

    // Check for ARIA roles
    const ariaRoles = await page.locator('[role]').count();
    console.log(`[A11y] Elements with ARIA roles: ${ariaRoles}`);

    // Check for skip link
    const skipLink = page.locator('a[href="#main"], a:has-text("Skip to"), [class*="skip"]');
    const skipLinkExists = await skipLink.first().isVisible().catch(() => false);
    console.log(`[A11y] Skip to content link: ${skipLinkExists}`);

    // Check color contrast (basic check - text should be visible)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-accessibility-homepage.png`,
      fullPage: true,
    });

    // Check keyboard focus indicators
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-accessibility-focus.png`,
      fullPage: false,
    });

    if (imagesWithoutAlt > 0) {
      findings.accessibilityIssues.push(`${imagesWithoutAlt} images without alt text`);
    }
    if (inputsWithoutLabel > 0) {
      findings.accessibilityIssues.push(`${inputsWithoutLabel} inputs without labels`);
    }

    await page.waitForTimeout(2000);
    console.log(`[A11y] Console errors: ${findings.consoleErrors.length}`);

    auditResults.push(findings);
  });

  test('12 - Performance & Console Errors Audit', async ({ page }) => {
    const findings = await capturePageAudit(page, 'Performance', '12-performance');

    const consoleMessages: { type: string; text: string }[] = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Test homepage performance
    const startTime = Date.now();
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    console.log(`[Performance] Homepage load time: ${loadTime}ms`);

    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perfEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfEntries.domContentLoadedEventEnd - perfEntries.startTime,
        loadComplete: perfEntries.loadEventEnd - perfEntries.startTime,
        firstByte: perfEntries.responseStart - perfEntries.startTime,
      };
    });
    console.log(`[Performance] DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`[Performance] Load Complete: ${performanceMetrics.loadComplete.toFixed(0)}ms`);
    console.log(`[Performance] Time to First Byte: ${performanceMetrics.firstByte.toFixed(0)}ms`);

    // Wait for any async errors
    await page.waitForTimeout(5000);

    // Categorize console messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    console.log(`[Performance] Total console errors: ${errors.length}`);
    console.log(`[Performance] Total console warnings: ${warnings.length}`);

    // Log first 10 errors
    errors.slice(0, 10).forEach((err, i) => {
      console.log(`  Error ${i + 1}: ${err.text.substring(0, 200)}`);
    });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-performance-final.png`,
      fullPage: true,
    });

    findings.performance = {
      loadTime,
      domContentLoaded: performanceMetrics.domContentLoaded,
    };

    auditResults.push(findings);
  });

  test('13 - Generate Audit Report', async ({ page }) => {
    // This test generates the final audit report
    console.log('\n========== QE AUDIT SUMMARY ==========\n');

    let totalErrors = 0;
    let totalNetworkErrors = 0;
    let totalA11yIssues = 0;

    auditResults.forEach((result) => {
      console.log(`Page: ${result.page}`);
      console.log(`  Load Time: ${result.performance.loadTime}ms`);
      console.log(`  Console Errors: ${result.consoleErrors.length}`);
      console.log(`  Network Errors: ${result.networkErrors.length}`);
      console.log(`  Accessibility Issues: ${result.accessibilityIssues.length}`);
      console.log('');

      totalErrors += result.consoleErrors.length;
      totalNetworkErrors += result.networkErrors.length;
      totalA11yIssues += result.accessibilityIssues.length;
    });

    console.log('========== TOTALS ==========');
    console.log(`Total Console Errors: ${totalErrors}`);
    console.log(`Total Network Errors: ${totalNetworkErrors}`);
    console.log(`Total Accessibility Issues: ${totalA11yIssues}`);
    console.log(`Pages Audited: ${auditResults.length}`);
    console.log('============================\n');

    // Take a final screenshot of homepage as visual confirmation
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/13-audit-complete.png`,
      fullPage: true,
    });

    expect(true).toBeTruthy(); // Always pass - this is a report generation test
  });
});
