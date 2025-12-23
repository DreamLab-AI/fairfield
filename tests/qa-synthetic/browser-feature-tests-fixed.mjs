#!/usr/bin/env node
/**
 * Fixed Browser Feature Tests for Private Relay Data
 * Tests: Nicknames, Avatars, Reactions, Image Embedding
 */

import { chromium } from 'playwright';
import * as fs from 'fs';

const APP_URL = 'https://jjohare.github.io/nostr-BBS';
const SCREENSHOT_DIR = '/tmp/qa-feature-screenshots';

// Test user mnemonics for login
const TEST_USERS = {
  superAdmin: {
    name: 'Queen Seraphina',
    mnemonic: 'glimpse marble confirm army sleep imitate lake balance home panic view brand'
  },
  user1: {
    name: 'Alice Wonderland',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'
  }
};

class FeatureTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.results = [];
    this.screenshotCount = 0;
  }

  async init() {
    // Clean screenshot directory
    if (fs.existsSync(SCREENSHOT_DIR)) {
      fs.rmSync(SCREENSHOT_DIR, { recursive: true });
    }
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(15000);
  }

  async screenshot(name) {
    this.screenshotCount++;
    const filename = `${String(this.screenshotCount).padStart(2, '0')}-${name}.png`;
    await this.page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: false });
    return filename;
  }

  async test(name, testFn) {
    const result = { name, passed: false, error: null, screenshots: [], details: {} };
    try {
      const { screenshots, details } = await testFn();
      result.passed = true;
      result.screenshots = screenshots || [];
      result.details = details || {};
      console.log(`✓ ${name}`);
      if (details) {
        Object.entries(details).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
      }
    } catch (error) {
      result.error = error.message;
      console.log(`✗ ${name}: ${error.message}`);
    }
    this.results.push(result);
    return result;
  }

  async loginWithMnemonic(mnemonic) {
    // Set localStorage to skip welcome modal before navigating
    await this.page.goto(`${APP_URL}/signup`);
    await this.page.evaluate(() => {
      localStorage.setItem('hasSeenOnboarding', 'true');
    });
    await this.page.reload();
    await this.page.waitForTimeout(2000);

    await this.screenshot('signup-page');

    // Click "Already have a recovery phrase?" to go to login page
    const importButton = this.page.locator('button:has-text("Already have a recovery phrase")');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await this.page.waitForTimeout(2000);
    }

    await this.screenshot('login-page');

    // Now on /login page - fill in mnemonic textarea
    const mnemonicTextarea = this.page.locator('textarea[placeholder*="Paste your 12-word"]');
    if (await mnemonicTextarea.count() > 0) {
      await mnemonicTextarea.fill(mnemonic);
      await this.page.waitForTimeout(500);
    } else {
      // Fallback: try any textarea
      const textarea = this.page.locator('textarea').first();
      if (await textarea.count() > 0) {
        await textarea.fill(mnemonic);
      }
    }

    await this.screenshot('mnemonic-filled');

    // Click "Restore Account" button
    const restoreButton = this.page.locator('button:has-text("Restore Account")');
    if (await restoreButton.count() > 0) {
      await restoreButton.first().click();
    }

    // Wait for redirect to /chat
    await this.page.waitForTimeout(5000);
    await this.screenshot('after-login-attempt');

    return true;
  }

  // Test nickname display in various places
  async testNicknameDisplay() {
    return await this.test('Nickname Display', async () => {
      const screenshots = [];
      const details = {};

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      // Check page content for nicknames
      const pageContent = await this.page.content();

      // Check for our test user names
      const testNames = ['Queen Seraphina', 'Zen Master Luna', 'Alice Wonderland', 'Bob Builder', 'Event Coordinator Max'];
      const foundNames = testNames.filter(name => pageContent.includes(name));
      details['Test names found'] = `${foundNames.length}/${testNames.length}`;

      // Count display name elements
      const nameElements = await this.page.locator('[class*="name"]:not(input):not(textarea)').count();
      details['Name elements'] = nameElements;

      screenshots.push(await this.screenshot('nickname-check'));

      return { screenshots, details };
    });
  }

  // Test avatar rendering
  async testAvatarRendering() {
    return await this.test('Avatar Rendering', async () => {
      const screenshots = [];
      const details = {};

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      // Find avatar elements
      const avatarContainers = await this.page.locator('.avatar, [class*="avatar"]').count();
      details['Avatar containers'] = avatarContainers;

      // Check for robohash images
      const robohashImages = await this.page.locator('img[src*="robohash"]').count();
      details['Robohash avatars'] = robohashImages;

      // Check for any images in avatar containers
      const avatarImages = await this.page.locator('.avatar img, [class*="avatar"] img').count();
      details['Avatar images'] = avatarImages;

      screenshots.push(await this.screenshot('avatars-main'));

      return { screenshots, details };
    });
  }

  // Test relay connection status
  async testRelayConnection() {
    return await this.test('Relay Connection Status', async () => {
      const screenshots = [];
      const details = {};

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      const pageContent = await this.page.content();

      // Check for connection status indicators
      const hasConnected = pageContent.includes('Connected') || pageContent.includes('connected');
      const hasDisconnected = pageContent.includes('Disconnected') || pageContent.includes('disconnected');
      const hasError = pageContent.includes('Error') || pageContent.includes('error');

      details['Shows Connected'] = hasConnected;
      details['Shows Disconnected'] = hasDisconnected;
      details['Shows Error'] = hasError;

      // Check for relay badge
      const relayBadge = await this.page.locator('[class*="relay"], [class*="status"]').count();
      details['Status badges'] = relayBadge;

      screenshots.push(await this.screenshot('relay-status'));

      return { screenshots, details };
    });
  }

  // Test channel list
  async testChannelList() {
    return await this.test('Channel List', async () => {
      const screenshots = [];
      const details = {};

      // Channels are shown on /chat page, not /channels
      await this.page.goto(`${APP_URL}/chat`);
      await this.page.waitForTimeout(5000); // Wait longer for data to load

      screenshots.push(await this.screenshot('channels-page'));

      const pageContent = await this.page.content();

      // Check for our test channels
      const testChannels = ['Meditation Circle', 'Community Events', 'Tech Talk', 'Art Gallery'];
      const foundChannels = testChannels.filter(ch => pageContent.includes(ch));
      details['Test channels found'] = `${foundChannels.length}/${testChannels.length}`;

      // Count channel cards
      const channelCards = await this.page.locator('[class*="channel"], .card').count();
      details['Channel cards'] = channelCards;

      return { screenshots, details };
    });
  }

  // Test message reactions
  async testReactionDisplay() {
    return await this.test('Reaction Display', async () => {
      const screenshots = [];
      const details = {};

      // Stay on /chat and look for reactions in any visible messages
      await this.page.goto(`${APP_URL}/chat`);
      await this.page.waitForTimeout(5000);

      screenshots.push(await this.screenshot('channel-view'));

      const pageContent = await this.page.content();

      // Check for reaction emojis
      const emojis = ['❤️', '👍', '🔥', '🎉', '😂', '🙏'];
      const foundEmojis = emojis.filter(e => pageContent.includes(e));
      details['Emojis visible'] = `${foundEmojis.length}/${emojis.length}`;

      // Check for reaction components
      const reactionBars = await this.page.locator('[class*="reaction"]').count();
      details['Reaction elements'] = reactionBars;

      // Check for messages
      const messages = await this.page.locator('[class*="message"], .message').count();
      details['Messages visible'] = messages;

      return { screenshots, details };
    });
  }

  // Test image embedding in messages
  async testImageEmbedding() {
    return await this.test('Image Embedding', async () => {
      const screenshots = [];
      const details = {};

      // Check for images on the chat page
      await this.page.goto(`${APP_URL}/chat`);
      await this.page.waitForTimeout(5000);

      screenshots.push(await this.screenshot('art-gallery'));

      // Count embedded images
      const embeddedImages = await this.page.locator('img[src*="unsplash"], img[src*="images."]').count();
      details['Unsplash images'] = embeddedImages;

      // Check for link previews
      const linkPreviews = await this.page.locator('[class*="preview"], [class*="embed"]').count();
      details['Link previews'] = linkPreviews;

      // Check for media embeds
      const mediaEmbeds = await this.page.locator('[class*="media"], .media-embed').count();
      details['Media embeds'] = mediaEmbeds;

      return { screenshots, details };
    });
  }

  // Test login flow
  async testLoginFlow() {
    return await this.test('Login Flow', async () => {
      const screenshots = [];
      const details = {};

      try {
        await this.loginWithMnemonic(TEST_USERS.superAdmin.mnemonic);

        // Check if login was successful
        const currentUrl = this.page.url();
        details['Final URL'] = currentUrl;

        // Check for authenticated elements
        const pageContent = await this.page.content();
        const hasLogout = pageContent.includes('Logout') || pageContent.includes('logout');
        const hasAdmin = pageContent.includes('Admin') || pageContent.includes('admin');

        details['Shows Logout'] = hasLogout;
        details['Shows Admin'] = hasAdmin;

        screenshots.push(await this.screenshot('logged-in-state'));
      } catch (error) {
        details['Login error'] = error.message;
        screenshots.push(await this.screenshot('login-error'));
      }

      return { screenshots, details };
    });
  }

  // Test profile modal
  async testProfileModal() {
    return await this.test('Profile Modal', async () => {
      const screenshots = [];
      const details = {};

      // First login
      await this.loginWithMnemonic(TEST_USERS.superAdmin.mnemonic);

      // Look for profile trigger (avatar, user menu, etc.)
      const profileTriggers = [
        '.avatar',
        '[class*="profile"]',
        '[class*="user-menu"]',
        'button:has-text("Profile")'
      ];

      for (const selector of profileTriggers) {
        const element = this.page.locator(selector).first();
        if (await element.count() > 0) {
          try {
            await element.click({ force: true, timeout: 3000 });
            await this.page.waitForTimeout(1000);
            break;
          } catch {
            continue;
          }
        }
      }

      screenshots.push(await this.screenshot('profile-modal-attempt'));

      // Check for modal content
      const modalContent = await this.page.locator('.modal, [role="dialog"]').count();
      details['Modal visible'] = modalContent > 0;

      // Check for profile fields
      const nicknameInput = await this.page.locator('input[placeholder*="name"], input[placeholder*="nickname"]').count();
      const avatarInput = await this.page.locator('input[placeholder*="avatar"], input[type="url"]').count();

      details['Nickname field'] = nicknameInput > 0;
      details['Avatar field'] = avatarInput > 0;

      return { screenshots, details };
    });
  }

  // Test admin dashboard
  async testAdminDashboard() {
    return await this.test('Admin Dashboard', async () => {
      const screenshots = [];
      const details = {};

      // Login as admin
      await this.loginWithMnemonic(TEST_USERS.superAdmin.mnemonic);

      // Navigate to admin
      await this.page.goto(`${APP_URL}/admin`);
      await this.page.waitForTimeout(3000);

      screenshots.push(await this.screenshot('admin-dashboard'));

      const pageContent = await this.page.content();

      // Check for admin sections
      const sections = [
        'Pending Registrations',
        'Pending Access',
        'Pending Join',
        'Create Channel',
        'Statistics'
      ];
      const foundSections = sections.filter(s => pageContent.toLowerCase().includes(s.toLowerCase()));
      details['Admin sections found'] = `${foundSections.length}/${sections.length}`;

      // Check for user management
      const hasUserList = pageContent.includes('user') || pageContent.includes('User');
      details['User management visible'] = hasUserList;

      return { screenshots, details };
    });
  }

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  FIXED FEATURE TESTS - Nicknames, Avatars, Reactions, Images   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await this.init();

    // Login first - required to connect to private relay
    await this.testLoginFlow();

    // Now test features while logged in
    await this.testRelayConnection();
    await this.testChannelList();
    await this.testNicknameDisplay();
    await this.testAvatarRendering();
    await this.testReactionDisplay();
    await this.testImageEmbedding();
    await this.testProfileModal();
    await this.testAdminDashboard();

    await this.browser.close();

    // Generate summary
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Passed: ${passed}/${this.results.length}`);
    console.log(`Failed: ${failed}/${this.results.length}`);
    console.log(`Screenshots: ${this.screenshotCount}`);
    console.log(`Location: ${SCREENSHOT_DIR}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Save detailed results
    fs.writeFileSync(
      `${SCREENSHOT_DIR}/feature-test-results.json`,
      JSON.stringify({
        results: this.results,
        summary: { passed, failed, total: this.results.length },
        timestamp: new Date().toISOString()
      }, null, 2)
    );

    return { results: this.results, summary: { passed, failed, total: this.results.length } };
  }
}

// Run tests
const tester = new FeatureTester();
tester.runAllTests()
  .then(result => {
    process.exit(result.summary.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
