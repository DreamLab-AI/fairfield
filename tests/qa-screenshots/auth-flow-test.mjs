#!/usr/bin/env node
/**
 * Authenticated Flow QA Tests
 * Tests login, admin access, and image upload with authentication
 */

import puppeteer from 'puppeteer';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LIVE_URL = 'https://jjohare.github.io/nostr-BBS/';
const IMAGE_API = 'https://image-api-617806532906.us-central1.run.app';
const SCREENSHOT_DIR = '/home/devuser/workspace/nostr-BBS/tests/qa-screenshots';

// Standard BIP-39 test mnemonic (well-known test vector)
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function takeScreenshot(page, name) {
  const filename = `auth-${name}-${Date.now()}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot: ${filename}`);
  return filepath;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('=== Authenticated Flow QA Tests ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: '/usr/sbin/chromium'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Track console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Go to landing page
    console.log('1. Loading landing page...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '01-landing');

    // 2. Click Login button
    console.log('2. Clicking Login button...');
    // Find and click Login using evaluate
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const loginLink = links.find(el => el.textContent.trim() === 'Login');
      if (loginLink) {
        loginLink.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await delay(2000);
      console.log('   Login button clicked');
    } else {
      console.log('   No login button found');
    }
    await takeScreenshot(page, '02-login-click');

    // 3. Check for mnemonic input
    console.log('3. Looking for login form...');
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // Find textarea or input for mnemonic
    const textarea = await page.$('textarea');
    const passwordInput = await page.$('input[type="password"]');
    const textInput = await page.$('input[type="text"]');

    if (textarea) {
      console.log('   Found textarea - entering mnemonic...');
      await textarea.type(TEST_MNEMONIC, { delay: 10 });
      await takeScreenshot(page, '03-mnemonic-entered');

      // Look for submit button using evaluate
      const submitted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(btn =>
          btn.type === 'submit' ||
          btn.textContent.includes('Login') ||
          btn.textContent.includes('Continue') ||
          btn.textContent.includes('Enter')
        );
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
        return false;
      });
      if (submitted) {
        await delay(5000);
        console.log('   Form submitted');
      }
    } else if (passwordInput || textInput) {
      console.log('   Found input field...');
      const input = passwordInput || textInput;
      await input.type(TEST_MNEMONIC, { delay: 10 });
      await takeScreenshot(page, '03-input-entered');
    } else {
      console.log('   No login form found');
    }

    await takeScreenshot(page, '04-after-login');

    // 4. Check authentication state
    console.log('4. Checking authentication state...');
    const authState = await page.evaluate(() => {
      const keys = localStorage.getItem('nostr_bbs_keys');
      return {
        hasKeys: !!keys,
        keys: keys ? JSON.parse(keys) : null
      };
    });
    console.log(`   Authenticated: ${authState.hasKeys}`);
    if (authState.hasKeys && authState.keys) {
      console.log(`   Pubkey: ${authState.keys.publicKey?.substring(0, 16)}...`);
    }

    // 5. Navigate to chat
    console.log('5. Navigating to chat...');
    await page.goto(LIVE_URL + 'chat', { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(3000);
    await takeScreenshot(page, '05-chat-page');

    // 6. Check for channel list
    const channels = await page.$$('.channel, [class*="channel"], [data-channel]');
    console.log(`   Found ${channels.length} channel elements`);

    // 7. Navigate to admin
    console.log('6. Navigating to admin panel...');
    await page.goto(LIVE_URL + 'admin', { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(3000);
    await takeScreenshot(page, '06-admin-page');

    // 8. Check page content
    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasAdminContent = pageContent.toLowerCase().includes('admin') ||
                           pageContent.toLowerCase().includes('dashboard') ||
                           pageContent.toLowerCase().includes('management');
    console.log(`   Admin content visible: ${hasAdminContent}`);

    // 9. Test image API directly
    console.log('7. Testing Image API...');
    try {
      const response = await fetch(`${IMAGE_API}/health`);
      const health = await response.json();
      console.log(`   Image API health: ${JSON.stringify(health)}`);
    } catch (e) {
      console.log(`   Image API error: ${e.message}`);
    }

    // 10. Summary
    console.log('\n=== Console Errors Summary ===');
    const significantErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('manifest')
    );
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Significant errors: ${significantErrors.length}`);
    if (significantErrors.length > 0) {
      console.log('Significant errors:');
      significantErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 100)}`));
    }

  } catch (error) {
    console.error(`Test error: ${error.message}`);
    await takeScreenshot(page, 'error');
  } finally {
    await browser.close();
  }

  console.log('\n=== Tests Complete ===');
}

main().catch(console.error);
