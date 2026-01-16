/**
 * Debug test to diagnose page loading issues
 */

import { test, expect } from '@playwright/test';

test('Debug: page load and console logs', async ({ page }) => {
  // Collect all console messages
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    } else {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`[pageerror] ${error.message}`);
  });

  page.on('requestfailed', request => {
    consoleErrors.push(`[requestfailed] ${request.url()} - ${request.failure()?.errorText}`);
  });

  // Navigate to login
  console.log('Navigating to /login...');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Wait a bit for JavaScript to execute
  await page.waitForTimeout(5000);

  // Get page content
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  console.log('First 500 chars:', html.substring(0, 500));

  // Output console logs
  console.log('\n=== Console Logs ===');
  consoleLogs.forEach(log => console.log(log));

  console.log('\n=== Console Errors ===');
  consoleErrors.forEach(err => console.log(err));

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });

  // Check if body has content
  const bodyContent = await page.locator('body').innerHTML();
  console.log('\nBody innerHTML length:', bodyContent.length);

  // Try to find any visible text
  const allText = await page.locator('body').textContent();
  console.log('All visible text:', allText?.trim().substring(0, 200) || '(empty)');

  // Log network status
  console.log('\nBrowser URL:', page.url());
});
