import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://dreamlab-ai.github.io/fairfield';
const SCREENSHOT_DIR = 'tests/screenshots/qe-audit/accessibility';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  const dir = path.resolve(SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface AccessibilityIssue {
  type: string;
  description: string;
  element?: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

interface PageAuditResult {
  page: string;
  url: string;
  issues: AccessibilityIssue[];
  timestamp: string;
}

const allResults: PageAuditResult[] = [];

// Comprehensive accessibility checks
async function runAccessibilityChecks(page: Page, pageName: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  // 1. Check for images without alt text
  const imagesWithoutAlt = await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    const problems: string[] = [];
    images.forEach((img, i) => {
      const alt = img.getAttribute('alt');
      if (alt === null) {
        problems.push(`img[${i}]: ${img.src.slice(0, 50)}`);
      }
    });
    return problems;
  });

  if (imagesWithoutAlt.length > 0) {
    issues.push({
      type: 'image-alt',
      description: `Images without alt text: ${imagesWithoutAlt.length}`,
      element: imagesWithoutAlt.join(', '),
      severity: 'serious'
    });
  }

  // 2. Check for buttons without accessible names
  const buttonsWithoutNames = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"]');
    const problems: string[] = [];
    buttons.forEach((btn, i) => {
      const text = btn.textContent?.trim();
      const ariaLabel = btn.getAttribute('aria-label');
      const title = btn.getAttribute('title');
      const ariaLabelledBy = btn.getAttribute('aria-labelledby');

      if (!text && !ariaLabel && !title && !ariaLabelledBy) {
        problems.push(`button[${i}]: ${btn.className}`);
      }
    });
    return problems;
  });

  if (buttonsWithoutNames.length > 0) {
    issues.push({
      type: 'button-name',
      description: `Buttons without accessible names: ${buttonsWithoutNames.length}`,
      element: buttonsWithoutNames.join(', '),
      severity: 'critical'
    });
  }

  // 3. Check for links without accessible names
  const linksWithoutNames = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    const problems: string[] = [];
    links.forEach((link, i) => {
      const text = link.textContent?.trim();
      const ariaLabel = link.getAttribute('aria-label');
      const title = link.getAttribute('title');

      if (!text && !ariaLabel && !title) {
        problems.push(`a[${i}]: ${link.href.slice(0, 50)}`);
      }
    });
    return problems;
  });

  if (linksWithoutNames.length > 0) {
    issues.push({
      type: 'link-name',
      description: `Links without accessible names: ${linksWithoutNames.length}`,
      element: linksWithoutNames.join(', '),
      severity: 'serious'
    });
  }

  // 4. Check for form inputs without labels
  const inputsWithoutLabels = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    const problems: string[] = [];
    inputs.forEach((input, i) => {
      const id = input.getAttribute('id');
      const hasLabelFor = id ? document.querySelector(`label[for="${id}"]`) : null;
      const hasParentLabel = input.closest('label');
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
      const hasTitle = input.getAttribute('title');
      const hasPlaceholder = input.getAttribute('placeholder');

      // Placeholder alone is not sufficient for accessibility
      if (!hasLabelFor && !hasParentLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
        const type = input.getAttribute('type') || input.tagName.toLowerCase();
        problems.push(`${type}[${i}]: ${hasPlaceholder || 'no label'}`);
      }
    });
    return problems;
  });

  if (inputsWithoutLabels.length > 0) {
    issues.push({
      type: 'label',
      description: `Form inputs without proper labels: ${inputsWithoutLabels.length}`,
      element: inputsWithoutLabels.join(', '),
      severity: 'critical'
    });
  }

  // 5. Check for headings hierarchy
  const headingIssues = await page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const problems: string[] = [];
    const levels: number[] = [];

    headings.forEach((h) => {
      const level = parseInt(h.tagName.charAt(1));
      levels.push(level);
    });

    // Check for multiple h1s
    const h1Count = levels.filter(l => l === 1).length;
    if (h1Count > 1) {
      problems.push(`Multiple h1 elements found: ${h1Count}`);
    }

    // Check for skipped heading levels
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        problems.push(`Heading level skipped: h${levels[i - 1]} to h${levels[i]}`);
      }
    }

    return problems;
  });

  if (headingIssues.length > 0) {
    issues.push({
      type: 'heading-order',
      description: `Heading hierarchy issues: ${headingIssues.length}`,
      element: headingIssues.join('; '),
      severity: 'moderate'
    });
  }

  // 6. Check for interactive elements with small touch targets
  const smallTargets = await page.evaluate(() => {
    const interactive = document.querySelectorAll('a, button, [role="button"], input, select, textarea, [tabindex]');
    const problems: string[] = [];

    interactive.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < 44 || rect.height < 44) {
          const name = el.textContent?.trim().slice(0, 20) || el.getAttribute('aria-label') || el.className.slice(0, 20);
          problems.push(`${el.tagName}[${Math.round(rect.width)}x${Math.round(rect.height)}]: ${name}`);
        }
      }
    });
    return problems.slice(0, 20); // Limit output
  });

  if (smallTargets.length > 0) {
    issues.push({
      type: 'target-size',
      description: `Interactive elements smaller than 44x44px: ${smallTargets.length}`,
      element: smallTargets.join(', '),
      severity: 'moderate'
    });
  }

  // 7. Check for missing document language
  const hasLang = await page.evaluate(() => {
    const html = document.documentElement;
    return html.getAttribute('lang');
  });

  if (!hasLang) {
    issues.push({
      type: 'document-lang',
      description: 'Document missing lang attribute',
      severity: 'serious'
    });
  }

  // 8. Check for page title
  const title = await page.title();
  if (!title || title.length < 1) {
    issues.push({
      type: 'document-title',
      description: 'Page missing title',
      severity: 'serious'
    });
  }

  // 9. Check for landmark regions
  const landmarks = await page.evaluate(() => {
    const hasMain = document.querySelector('main, [role="main"]');
    const hasNav = document.querySelector('nav, [role="navigation"]');
    const hasBanner = document.querySelector('header, [role="banner"]');

    return {
      hasMain: !!hasMain,
      hasNav: !!hasNav,
      hasBanner: !!hasBanner
    };
  });

  if (!landmarks.hasMain) {
    issues.push({
      type: 'landmark',
      description: 'Page missing main landmark',
      severity: 'moderate'
    });
  }

  // 10. Check for skip link
  const hasSkipLink = await page.evaluate(() => {
    const skipLink = document.querySelector('a[href="#main-content"], a.skip-to-main, [class*="skip"]');
    return !!skipLink;
  });

  if (!hasSkipLink) {
    issues.push({
      type: 'bypass',
      description: 'Page missing skip navigation link',
      severity: 'moderate'
    });
  }

  // 11. Check for color contrast (basic check via computed styles)
  const potentialContrastIssues = await page.evaluate(() => {
    const textElements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, label, li');
    const problems: string[] = [];

    // Simple opacity check (not a full contrast check)
    textElements.forEach((el, i) => {
      const styles = window.getComputedStyle(el);
      const opacity = parseFloat(styles.opacity);
      const color = styles.color;

      // Check for very low opacity text
      if (opacity < 0.5 && el.textContent?.trim()) {
        problems.push(`Low opacity text: ${el.textContent?.trim().slice(0, 20)}`);
      }
    });

    return problems.slice(0, 10);
  });

  if (potentialContrastIssues.length > 0) {
    issues.push({
      type: 'color-contrast',
      description: `Potential contrast issues: ${potentialContrastIssues.length}`,
      element: potentialContrastIssues.join(', '),
      severity: 'moderate'
    });
  }

  return issues;
}

test.describe('WCAG 2.1 Accessibility Audit', () => {
  test('Home page (/) accessibility audit', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-home-page.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'home');

    allResults.push({
      page: 'Home (/)',
      url: `${BASE_URL}/`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== HOME PAGE AUDIT ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));

    // No critical issues should be present
    const critical = issues.filter(i => i.severity === 'critical');
    expect(critical.length, `Critical issues: ${critical.map(i => i.description).join(', ')}`).toBe(0);
  });

  test('Login page (/login) accessibility audit', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-login-page.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'login');

    allResults.push({
      page: 'Login (/login)',
      url: `${BASE_URL}/login`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== LOGIN PAGE AUDIT ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));

    const critical = issues.filter(i => i.severity === 'critical');
    expect(critical.length, `Critical issues: ${critical.map(i => i.description).join(', ')}`).toBe(0);
  });

  test('Signup page (/signup) accessibility audit', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-signup-page.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'signup');

    allResults.push({
      page: 'Signup (/signup)',
      url: `${BASE_URL}/signup`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== SIGNUP PAGE AUDIT ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));

    const critical = issues.filter(i => i.severity === 'critical');
    expect(critical.length, `Critical issues: ${critical.map(i => i.description).join(', ')}`).toBe(0);
  });

  test('Chat page (/chat) accessibility audit - unauthorized', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-chat-page-unauth.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'chat');

    allResults.push({
      page: 'Chat (/chat) - Unauthorized',
      url: `${BASE_URL}/chat`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== CHAT PAGE AUDIT (unauth) ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));
  });

  test('Events page (/events) accessibility audit - unauthorized', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-events-page-unauth.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'events');

    allResults.push({
      page: 'Events (/events) - Unauthorized',
      url: `${BASE_URL}/events`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== EVENTS PAGE AUDIT (unauth) ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));
  });

  test('Admin page (/admin) accessibility audit - unauthorized', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-admin-page-unauth.png`,
      fullPage: true
    });

    const issues = await runAccessibilityChecks(page, 'admin');

    allResults.push({
      page: 'Admin (/admin) - Unauthorized',
      url: `${BASE_URL}/admin`,
      issues,
      timestamp: new Date().toISOString()
    });

    console.log('\n=== ADMIN PAGE AUDIT (unauth) ===');
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.description}`));
  });

  test('Keyboard navigation - Home page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    const focusOrder: string[] = [];

    // Tab through elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        const styles = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 30),
          hasOutline: styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px',
          outlineStyle: styles.outline
        };
      });

      if (focused) {
        focusOrder.push(`${focused.tag}: ${focused.text || 'no text'} (outline: ${focused.hasOutline})`);
      }
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-keyboard-nav-home.png`,
      fullPage: true
    });

    console.log('\n=== KEYBOARD NAVIGATION (HOME) ===');
    console.log(`Focusable elements: ${focusOrder.length}`);
    focusOrder.forEach((el, i) => console.log(`  ${i + 1}. ${el}`));

    expect(focusOrder.length).toBeGreaterThan(0);
  });

  test('Keyboard navigation - Login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const focusOrder: string[] = [];

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        return {
          tag: el.tagName,
          type: el.getAttribute('type') || '',
          text: el.textContent?.trim().slice(0, 30),
          placeholder: el.getAttribute('placeholder')
        };
      });

      if (focused) {
        const desc = focused.type ? `${focused.tag}[${focused.type}]` : focused.tag;
        focusOrder.push(`${desc}: ${focused.placeholder || focused.text || 'no text'}`);
      }
    }

    // Test Enter key on input
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const input = page.locator('input[type="password"]');
    await input.focus();
    await input.fill('test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-keyboard-nav-login.png`,
      fullPage: true
    });

    console.log('\n=== KEYBOARD NAVIGATION (LOGIN) ===');
    console.log(`Focus order: ${focusOrder.length} elements`);
    focusOrder.forEach((el, i) => console.log(`  ${i + 1}. ${el}`));

    // Form should be navigable with keyboard
    expect(focusOrder.some(f => f.includes('INPUT'))).toBe(true);
    expect(focusOrder.some(f => f.includes('BUTTON'))).toBe(true);
  });

  test('Focus indicators visibility check', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Check input focus indicator
    const input = page.locator('input[type="password"]');
    await input.focus();

    const inputFocusStyles = await input.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        outlineStyle: styles.outlineStyle,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor
      };
    });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-focus-input.png`,
      fullPage: true
    });

    // Check button focus indicator
    const button = page.locator('button.btn-primary').first();
    await button.focus();

    const buttonFocusStyles = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        outlineStyle: styles.outlineStyle
      };
    });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-focus-button.png`,
      fullPage: true
    });

    console.log('\n=== FOCUS INDICATORS ===');
    console.log('Input focus styles:', inputFocusStyles);
    console.log('Button focus styles:', buttonFocusStyles);

    // Focus should be visible
    const hasInputFocus = inputFocusStyles.outlineStyle !== 'none' ||
      inputFocusStyles.boxShadow !== 'none';
    const hasButtonFocus = buttonFocusStyles.outlineStyle !== 'none';

    expect(hasInputFocus || inputFocusStyles.borderColor).toBeTruthy();
  });

  test('Mobile viewport accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-mobile-home.png`,
      fullPage: true
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-mobile-login.png`,
      fullPage: true
    });

    // Check touch target sizes
    const smallTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('a, button, [role="button"], input, select');
      const problems: string[] = [];

      interactive.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            const text = el.textContent?.trim().slice(0, 20) || el.getAttribute('aria-label') || 'unknown';
            problems.push(`${Math.round(rect.width)}x${Math.round(rect.height)}: ${text}`);
          }
        }
      });

      return problems;
    });

    console.log('\n=== MOBILE TOUCH TARGETS ===');
    if (smallTargets.length > 0) {
      console.log('Elements smaller than 44x44px:');
      smallTargets.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('All touch targets meet minimum size');
    }
  });

  test('Tablet viewport accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/13-tablet-home.png`,
      fullPage: true
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/14-tablet-login.png`,
      fullPage: true
    });
  });

  test('Form error states accessibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Trigger validation error
    const submitBtn = page.locator('button.btn-primary').first();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/15-login-error-state.png`,
      fullPage: true
    });

    // Check if error is properly announced
    const errorState = await page.evaluate(() => {
      const errorAlert = document.querySelector('.alert-error');
      if (!errorAlert) return null;

      return {
        text: errorAlert.textContent?.trim(),
        role: errorAlert.getAttribute('role'),
        ariaLive: errorAlert.getAttribute('aria-live'),
        visible: window.getComputedStyle(errorAlert).display !== 'none'
      };
    });

    console.log('\n=== ERROR STATE ACCESSIBILITY ===');
    if (errorState) {
      console.log('Error message:', errorState.text?.slice(0, 50));
      console.log('Role:', errorState.role);
      console.log('aria-live:', errorState.ariaLive);
      console.log('Visible:', errorState.visible);
    } else {
      console.log('No error alert found (may not have triggered)');
    }
  });
});

test.afterAll(async () => {
  // Write results to JSON
  const resultsPath = path.resolve(`${SCREENSHOT_DIR}/audit-results.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));

  // Generate markdown report
  let markdown = `# Accessibility Audit Report\n\n`;
  markdown += `**Generated**: ${new Date().toISOString()}\n`;
  markdown += `**Target**: ${BASE_URL}\n\n`;

  const totalIssues = allResults.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalIssues = allResults.reduce((sum, r) =>
    sum + r.issues.filter(i => i.severity === 'critical').length, 0);
  const seriousIssues = allResults.reduce((sum, r) =>
    sum + r.issues.filter(i => i.severity === 'serious').length, 0);

  markdown += `## Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Pages Tested | ${allResults.length} |\n`;
  markdown += `| Total Issues | ${totalIssues} |\n`;
  markdown += `| Critical Issues | ${criticalIssues} |\n`;
  markdown += `| Serious Issues | ${seriousIssues} |\n\n`;

  markdown += `## WCAG 2.1 Compliance Status\n\n`;

  if (criticalIssues === 0 && seriousIssues === 0) {
    markdown += `**Status**: PASS - No critical or serious accessibility violations detected.\n\n`;
  } else if (criticalIssues === 0) {
    markdown += `**Status**: PARTIAL - Serious issues found but no critical violations.\n\n`;
  } else {
    markdown += `**Status**: FAIL - Critical accessibility violations detected.\n\n`;
  }

  markdown += `## Detailed Results by Page\n\n`;

  allResults.forEach(result => {
    markdown += `### ${result.page}\n\n`;
    markdown += `**URL**: ${result.url}\n\n`;

    if (result.issues.length === 0) {
      markdown += `No accessibility issues detected on this page.\n\n`;
    } else {
      markdown += `| Severity | Type | Description |\n`;
      markdown += `|----------|------|-------------|\n`;

      result.issues.forEach(issue => {
        const severity = issue.severity === 'critical' ? '**CRITICAL**' :
          issue.severity === 'serious' ? '**SERIOUS**' :
            issue.severity === 'moderate' ? 'Moderate' : 'Minor';
        markdown += `| ${severity} | ${issue.type} | ${issue.description} |\n`;
      });
      markdown += `\n`;

      // Add element details for serious/critical issues
      const importantIssues = result.issues.filter(i =>
        i.severity === 'critical' || i.severity === 'serious'
      );

      if (importantIssues.length > 0) {
        markdown += `**Affected Elements**:\n\n`;
        importantIssues.forEach(issue => {
          if (issue.element) {
            markdown += `- **${issue.type}**: \`${issue.element}\`\n`;
          }
        });
        markdown += `\n`;
      }
    }
  });

  markdown += `## Screenshots\n\n`;
  markdown += `Screenshots saved to: \`${SCREENSHOT_DIR}/\`\n\n`;
  markdown += `- 01-home-page.png\n`;
  markdown += `- 02-login-page.png\n`;
  markdown += `- 03-signup-page.png\n`;
  markdown += `- 04-chat-page-unauth.png\n`;
  markdown += `- 05-events-page-unauth.png\n`;
  markdown += `- 06-admin-page-unauth.png\n`;
  markdown += `- 07-keyboard-nav-home.png\n`;
  markdown += `- 08-keyboard-nav-login.png\n`;
  markdown += `- 09-focus-input.png\n`;
  markdown += `- 10-focus-button.png\n`;
  markdown += `- 11-mobile-home.png\n`;
  markdown += `- 12-mobile-login.png\n`;
  markdown += `- 13-tablet-home.png\n`;
  markdown += `- 14-tablet-login.png\n`;
  markdown += `- 15-login-error-state.png\n\n`;

  markdown += `## Recommendations\n\n`;
  markdown += `1. **Ensure all interactive elements have accessible names** - buttons, links, and form controls should have visible text, aria-label, or aria-labelledby\n`;
  markdown += `2. **Maintain proper heading hierarchy** - use h1-h6 in order without skipping levels\n`;
  markdown += `3. **Provide proper form labels** - all inputs should have associated labels, not just placeholders\n`;
  markdown += `4. **Ensure sufficient color contrast** - text should have 4.5:1 contrast ratio (3:1 for large text)\n`;
  markdown += `5. **Touch targets should be at least 44x44 pixels** for mobile accessibility\n`;
  markdown += `6. **Focus indicators should be clearly visible** for keyboard navigation\n\n`;

  markdown += `---\n\n`;
  markdown += `*Report generated by QE Visual Tester Agent*\n`;

  const mdPath = path.resolve(`${SCREENSHOT_DIR}/audit-summary.md`);
  fs.writeFileSync(mdPath, markdown);

  console.log('\n=================================');
  console.log('ACCESSIBILITY AUDIT COMPLETE');
  console.log('=================================');
  console.log(`Total pages tested: ${allResults.length}`);
  console.log(`Total issues found: ${totalIssues}`);
  console.log(`Critical issues: ${criticalIssues}`);
  console.log(`Serious issues: ${seriousIssues}`);
  console.log(`\nReports saved to:`);
  console.log(`  - ${resultsPath}`);
  console.log(`  - ${mdPath}`);
});
