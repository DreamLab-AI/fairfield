/**
 * Screenshot Capture Script for README Documentation
 * Captures desktop and mobile views of all key app screens
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '../static/images/screenshots');

// Test mnemonic for regular user (standard BIP-39 test vector)
const TEST_USER_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Admin mnemonic from environment
const ADMIN_MNEMONIC = process.env.ADMIN_KEY || '';

interface ScreenshotConfig {
  name: string;
  path: string;
  setup?: (page: Page) => Promise<void>;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  waitFor?: string;
  delay?: number;
}

// Define all views to capture
const SCREENSHOTS: ScreenshotConfig[] = [
  // Public pages
  {
    name: 'landing-page',
    path: '/',
    waitFor: 'text=Welcome',
    delay: 500
  },
  {
    name: 'signup-gateway',
    path: '/signup',
    waitFor: 'text=Create Your Account',
    delay: 500
  },
  {
    name: 'login-simple',
    path: '/login',
    waitFor: 'text=Quick Login',
    delay: 500
  },

  // Authenticated user views
  {
    name: 'chat-hub',
    path: '/chat',
    requiresAuth: true,
    waitFor: 'text=Channels',
    delay: 1000
  },
  {
    name: 'forums-overview',
    path: '/forums',
    requiresAuth: true,
    waitFor: 'text=Forums',
    delay: 1000
  },
  {
    name: 'zone-minimoonoir',
    path: '/minimoonoir',
    requiresAuth: true,
    waitFor: 'text=Minimoonoir',
    delay: 1000
  },
  {
    name: 'section-welcome',
    path: '/minimoonoir/minimoonoir-welcome',
    requiresAuth: true,
    delay: 1000
  },
  {
    name: 'events-page',
    path: '/events',
    requiresAuth: true,
    waitFor: 'text=Events',
    delay: 1000
  },
  {
    name: 'dm-list',
    path: '/dm',
    requiresAuth: true,
    delay: 1000
  },

  // Admin views
  {
    name: 'admin-dashboard',
    path: '/admin',
    requiresAuth: true,
    requiresAdmin: true,
    waitFor: 'text=Admin',
    delay: 1000
  },
  {
    name: 'admin-stats',
    path: '/admin/stats',
    requiresAuth: true,
    requiresAdmin: true,
    delay: 1000
  },
];

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }  // iPhone 14 Pro
};

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function loginWithMnemonic(page: Page, mnemonic: string) {
  await page.goto(`${BASE_URL}/login`);

  // Switch to secure login to use mnemonic
  const switchButton = page.getByText('Login with Recovery Phrase');
  if (await switchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await switchButton.click();
    await page.waitForTimeout(500);
  }

  // Click on paste phrase tab
  const pasteTab = page.getByRole('button', { name: /paste phrase/i });
  if (await pasteTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await pasteTab.click();
  }

  // Fill mnemonic
  const textarea = page.locator('textarea').first();
  await textarea.fill(mnemonic);

  // Submit
  const restoreButton = page.getByRole('button', { name: /restore|login/i });
  await restoreButton.click();

  // Wait for redirect
  await page.waitForTimeout(3000);
}

async function loginWithPrivateKey(page: Page, privateKey: string) {
  await page.goto(`${BASE_URL}/login`);

  // Fill password field with private key
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill(privateKey);

  // Submit
  const loginButton = page.getByRole('button', { name: /login/i });
  await loginButton.click();

  await page.waitForTimeout(3000);
}

async function captureScreenshot(
  page: Page,
  config: ScreenshotConfig,
  viewport: keyof typeof VIEWPORTS,
  suffix: string = ''
) {
  const viewportConfig = VIEWPORTS[viewport];
  await page.setViewportSize(viewportConfig);

  // Navigate to the page
  await page.goto(`${BASE_URL}${config.path}`);

  // Wait for specific element if specified
  if (config.waitFor) {
    try {
      await page.waitForSelector(`text=${config.waitFor.replace('text=', '')}`, { timeout: 5000 });
    } catch {
      console.log(`  Warning: Could not find "${config.waitFor}" on ${config.path}`);
    }
  }

  // Additional delay for animations
  await page.waitForTimeout(config.delay || 500);

  // Run custom setup if provided
  if (config.setup) {
    await config.setup(page);
  }

  // Capture screenshot
  const filename = `${config.name}${suffix}-${viewport}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: false
  });

  console.log(`  Captured: ${filename}`);
  return filename;
}

async function main() {
  console.log('Starting screenshot capture...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const capturedScreenshots: string[] = [];

  try {
    // Create context for regular user
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    console.log('=== Capturing Public Pages ===\n');

    // Capture public pages without auth
    for (const config of SCREENSHOTS.filter(s => !s.requiresAuth)) {
      console.log(`Capturing: ${config.name}`);
      for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
        if (config.mobileOnly && viewport !== 'mobile') continue;
        if (config.desktopOnly && viewport !== 'desktop') continue;

        const filename = await captureScreenshot(userPage, config, viewport);
        capturedScreenshots.push(filename);
      }
      console.log('');
    }

    // Login as regular user
    console.log('=== Logging in as Regular User ===\n');

    // Generate private key from test mnemonic (using localStorage simulation)
    await userPage.goto(`${BASE_URL}/signup`);
    await userPage.waitForTimeout(1000);

    // Use quick signup flow
    const quickStartBtn = userPage.getByText('Quick Start');
    if (await quickStartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickStartBtn.click();
      await userPage.waitForTimeout(500);

      // Fill nickname
      const nicknameInput = userPage.locator('input[id="nickname-input"]');
      await nicknameInput.fill('TestUser');

      // Continue
      await userPage.getByRole('button', { name: 'Continue' }).click();
      await userPage.waitForTimeout(2000);

      // Copy password
      await userPage.getByRole('button', { name: /copy/i }).click();
      await userPage.waitForTimeout(500);

      // Complete signup
      await userPage.getByRole('button', { name: /continue/i }).click();
      await userPage.waitForTimeout(3000);
    }

    console.log('=== Capturing Authenticated User Views ===\n');

    // Capture authenticated pages
    for (const config of SCREENSHOTS.filter(s => s.requiresAuth && !s.requiresAdmin)) {
      console.log(`Capturing: ${config.name}`);
      for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
        if (config.mobileOnly && viewport !== 'mobile') continue;
        if (config.desktopOnly && viewport !== 'desktop') continue;

        try {
          const filename = await captureScreenshot(userPage, config, viewport);
          capturedScreenshots.push(filename);
        } catch (err) {
          console.log(`  Error capturing ${config.name}: ${err}`);
        }
      }
      console.log('');
    }

    await userContext.close();

    // Admin screenshots (if admin key available)
    if (ADMIN_MNEMONIC) {
      console.log('=== Capturing Admin Views ===\n');

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();

      await loginWithMnemonic(adminPage, ADMIN_MNEMONIC);

      for (const config of SCREENSHOTS.filter(s => s.requiresAdmin)) {
        console.log(`Capturing: ${config.name}`);
        for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
          if (config.mobileOnly && viewport !== 'mobile') continue;
          if (config.desktopOnly && viewport !== 'desktop') continue;

          try {
            const filename = await captureScreenshot(adminPage, config, viewport, '-admin');
            capturedScreenshots.push(filename);
          } catch (err) {
            console.log(`  Error capturing ${config.name}: ${err}`);
          }
        }
        console.log('');
      }

      await adminContext.close();
    } else {
      console.log('Skipping admin screenshots (ADMIN_KEY not set)\n');
    }

    // Generate manifest
    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      screenshots: capturedScreenshots,
      viewports: VIEWPORTS
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('=== Summary ===\n');
    console.log(`Total screenshots captured: ${capturedScreenshots.length}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('Manifest saved to: manifest.json\n');

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
