#!/usr/bin/env node
/**
 * Comprehensive QA Test Suite for Nostr-BBS
 * Tests all user flows with screenshots and console monitoring
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LIVE_URL = 'https://jjohare.github.io/nostr-BBS/';
const SCREENSHOT_DIR = '/home/devuser/workspace/nostr-BBS/tests/qa-screenshots';
const RESULTS = { tests: [], errors: [], loadTimes: [], consoleMessages: [] };

async function takeScreenshot(page, name) {
  const timestamp = Date.now();
  const filename = `${name}-${timestamp}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot: ${filename}`);
  return filepath;
}

async function measureLoadTime(page, url, description) {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  const loadTime = Date.now() - start;
  RESULTS.loadTimes.push({ description, url, loadTime });
  console.log(`Load time for ${description}: ${loadTime}ms`);
  return loadTime;
}

async function runTest(name, testFn) {
  console.log(`\n--- Running: ${name} ---`);
  const start = Date.now();
  try {
    await testFn();
    RESULTS.tests.push({ name, status: 'PASS', duration: Date.now() - start });
    console.log(`PASS: ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    RESULTS.tests.push({ name, status: 'FAIL', error: error.message, duration: Date.now() - start });
    RESULTS.errors.push({ test: name, error: error.message });
    console.error(`FAIL: ${name} - ${error.message}`);
  }
}

async function main() {
  console.log('Starting Comprehensive QA Tests...');
  console.log(`Target: ${LIVE_URL}`);
  console.log(`Screenshot dir: ${SCREENSHOT_DIR}`);

  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: '/usr/sbin/chromium'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Collect console messages
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), timestamp: Date.now() };
    RESULTS.consoleMessages.push(entry);
    if (msg.type() === 'error') {
      console.log(`Console ERROR: ${msg.text().substring(0, 200)}`);
    }
  });

  // Collect page errors
  page.on('pageerror', error => {
    RESULTS.errors.push({ type: 'page_error', message: error.message });
    console.log(`Page ERROR: ${error.message.substring(0, 200)}`);
  });

  try {
    // Test 1: Landing page load
    await runTest('Landing Page Load', async () => {
      const loadTime = await measureLoadTime(page, LIVE_URL, 'Landing Page');
      await takeScreenshot(page, '01-landing-page');

      if (loadTime > 10000) {
        console.warn(`WARNING: Slow load time: ${loadTime}ms`);
      }

      // Check page loaded
      await page.waitForSelector('body', { timeout: 5000 });
    });

    // Test 2: Check page title and basic elements
    await runTest('Page Structure Check', async () => {
      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Check for main structural elements
      const bodyContent = await page.evaluate(() => document.body.innerText.length);
      console.log(`Body content length: ${bodyContent} chars`);

      await takeScreenshot(page, '02-page-structure');
    });

    // Test 3: Find and click login/auth elements
    await runTest('Authentication Flow', async () => {
      // Look for login-related elements
      const authElements = await page.$$eval('button, a', els =>
        els.filter(el =>
          el.textContent.toLowerCase().includes('login') ||
          el.textContent.toLowerCase().includes('sign') ||
          el.textContent.toLowerCase().includes('enter') ||
          el.textContent.toLowerCase().includes('connect')
        ).map(el => ({ tag: el.tagName, text: el.textContent.trim(), href: el.href }))
      );

      console.log(`Found ${authElements.length} auth-related elements:`);
      authElements.forEach(el => console.log(`  - ${el.tag}: "${el.text.substring(0, 50)}"`));

      // Try clicking on login if found
      const loginBtn = await page.$('button:has-text("Login"), button:has-text("Sign"), a[href*="login"]');
      if (loginBtn) {
        await loginBtn.click().catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
      }

      await takeScreenshot(page, '03-auth-flow');
    });

    // Test 4: Check for navigation menu
    await runTest('Navigation Elements', async () => {
      await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });

      const navLinks = await page.$$eval('nav a, .nav a, [role="navigation"] a, header a', els =>
        els.map(el => ({ text: el.textContent.trim(), href: el.href }))
      );

      console.log(`Found ${navLinks.length} navigation links:`);
      navLinks.slice(0, 10).forEach(link => console.log(`  - "${link.text}" -> ${link.href}`));

      await takeScreenshot(page, '04-navigation');
    });

    // Test 5: Try to access chat/channels
    await runTest('Chat Section', async () => {
      // Look for chat link
      const chatLink = await page.$('a[href*="chat"]');
      if (chatLink) {
        await chatLink.click();
        await new Promise(r => setTimeout(r, 3000));
        console.log('Navigated to chat section');
      } else {
        // Try navigating directly
        await page.goto(LIVE_URL + 'chat', { waitUntil: 'networkidle0' }).catch(() => {});
      }

      await takeScreenshot(page, '05-chat-section');
    });

    // Test 6: Try to access calendar/events
    await runTest('Calendar Section', async () => {
      await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });

      const calendarLink = await page.$('a[href*="calendar"], a[href*="event"]');
      if (calendarLink) {
        await calendarLink.click();
        await new Promise(r => setTimeout(r, 3000));
        console.log('Navigated to calendar section');
      }

      await takeScreenshot(page, '06-calendar-section');
    });

    // Test 7: Try to access admin section
    await runTest('Admin Section', async () => {
      await page.goto(LIVE_URL + 'admin', { waitUntil: 'networkidle0' }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await takeScreenshot(page, '07-admin-section');
    });

    // Test 8: Check for input forms (image upload, message input)
    await runTest('Form Elements', async () => {
      await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });

      const formElements = await page.$$eval('input, textarea, select, button[type="submit"]', els =>
        els.map(el => ({
          tag: el.tagName,
          type: el.type || '',
          placeholder: el.placeholder || '',
          name: el.name || ''
        }))
      );

      console.log(`Found ${formElements.length} form elements:`);
      formElements.slice(0, 10).forEach(el =>
        console.log(`  - ${el.tag}[${el.type}] placeholder="${el.placeholder}" name="${el.name}"`)
      );

      // Look for file input (image upload)
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        console.log('Found file upload input');
      }

      await takeScreenshot(page, '08-form-elements');
    });

    // Test 9: Performance metrics
    await runTest('Performance Metrics', async () => {
      await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });

      const metrics = await page.evaluate(() => {
        const perf = window.performance;
        const timing = perf.timing;
        const paintEntries = perf.getEntriesByType('paint');
        const navEntry = perf.getEntriesByType('navigation')[0];

        return {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
          domInteractive: timing.domInteractive - timing.navigationStart,
          resourceCount: perf.getEntriesByType('resource').length
        };
      });

      console.log('Performance Metrics:');
      console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
      console.log(`  Load Complete: ${metrics.loadComplete}ms`);
      console.log(`  First Paint: ${metrics.firstPaint.toFixed(0)}ms`);
      console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(0)}ms`);
      console.log(`  DOM Interactive: ${metrics.domInteractive}ms`);
      console.log(`  Resource Count: ${metrics.resourceCount}`);

      RESULTS.loadTimes.push({ description: 'Performance Metrics', ...metrics });
    });

    // Test 10: Console error summary
    await runTest('Console Error Analysis', async () => {
      const errors = RESULTS.consoleMessages.filter(m => m.type === 'error');
      const warnings = RESULTS.consoleMessages.filter(m => m.type === 'warning');

      console.log(`\nConsole Summary:`);
      console.log(`  Total messages: ${RESULTS.consoleMessages.length}`);
      console.log(`  Errors: ${errors.length}`);
      console.log(`  Warnings: ${warnings.length}`);

      if (errors.length > 0) {
        console.log('\nError samples:');
        errors.slice(0, 5).forEach((e, i) =>
          console.log(`  ${i + 1}. ${e.text.substring(0, 150)}...`)
        );
      }
    });

    // Test 11: Mobile viewport test
    await runTest('Mobile Viewport', async () => {
      await page.setViewport({ width: 375, height: 812 });
      await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });
      await takeScreenshot(page, '09-mobile-view');

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });

    // Final screenshot
    await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });
    await takeScreenshot(page, '10-final-state');

  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    await takeScreenshot(page, 'error-state');
  } finally {
    await browser.close();
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    url: LIVE_URL,
    summary: {
      total: RESULTS.tests.length,
      passed: RESULTS.tests.filter(t => t.status === 'PASS').length,
      failed: RESULTS.tests.filter(t => t.status === 'FAIL').length
    },
    loadTimes: RESULTS.loadTimes,
    tests: RESULTS.tests,
    errors: RESULTS.errors,
    consoleErrorCount: RESULTS.consoleMessages.filter(m => m.type === 'error').length,
    consoleWarningCount: RESULTS.consoleMessages.filter(m => m.type === 'warning').length
  };

  const reportPath = join(SCREENSHOT_DIR, `qa-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);

  // Summary
  console.log('\n========== QA TEST SUMMARY ==========');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Console Errors: ${report.consoleErrorCount}`);
  console.log(`Console Warnings: ${report.consoleWarningCount}`);
  console.log('\nLoad Times:');
  report.loadTimes.forEach(lt => {
    if (lt.loadTime) {
      console.log(`  ${lt.description}: ${lt.loadTime}ms`);
    }
  });
  console.log('=====================================\n');

  return report;
}

main().catch(console.error);
