#!/usr/bin/env node
/**
 * Browser Feature Tests for Private Relay Data
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

    // Set longer timeout for relay connections
    this.page.setDefaultTimeout(30000);
  }

  async screenshot(name) {
    this.screenshotCount++;
    const filename = `${String(this.screenshotCount).padStart(2, '0')}-${name}.png`;
    await this.page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: false });
    return filename;
  }

  async test(name, testFn) {
    const result = { name, passed: false, error: null, screenshots: [] };
    try {
      const screenshots = await testFn();
      result.passed = true;
      result.screenshots = screenshots || [];
      console.log(`✓ ${name}`);
    } catch (error) {
      result.error = error.message;
      console.log(`✗ ${name}: ${error.message}`);
    }
    this.results.push(result);
    return result;
  }

  async loginWithMnemonic(mnemonic) {
    await this.page.goto(`${APP_URL}/signup`);
    await this.page.waitForTimeout(2000);

    // Look for "I have a mnemonic" or import option
    const importButton = this.page.locator('button:has-text("have"), button:has-text("import"), button:has-text("existing")');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await this.page.waitForTimeout(500);
    }

    // Fill mnemonic
    const mnemonicInput = this.page.locator('textarea, input[type="text"]').first();
    await mnemonicInput.fill(mnemonic);
    await this.page.waitForTimeout(500);

    // Click continue/submit
    const submitButton = this.page.locator('button:has-text("Continue"), button:has-text("Login"), button:has-text("Import")');
    if (await submitButton.count() > 0) {
      await submitButton.first().click();
    }

    await this.page.waitForTimeout(3000);
  }

  // Test nickname display in various places
  async testNicknameDisplay() {
    return await this.test('Nickname Display', async () => {
      const screenshots = [];

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      // Check for any user names displayed (top posters, message authors, etc.)
      const nameElements = await this.page.locator('[class*="name"], [class*="author"], [class*="display"]').all();

      // Look for specific test user names
      const pageContent = await this.page.content();
      const hasNicknames =
        pageContent.includes('Queen Seraphina') ||
        pageContent.includes('Zen Master Luna') ||
        pageContent.includes('Alice Wonderland') ||
        pageContent.includes('Bob Builder');

      screenshots.push(await this.screenshot('nickname-check'));

      // Navigate to channels if available
      const channelsLink = this.page.locator('a[href*="channel"], button:has-text("Channels")');
      if (await channelsLink.count() > 0) {
        await channelsLink.first().click();
        await this.page.waitForTimeout(2000);
        screenshots.push(await this.screenshot('channels-nicknames'));
      }

      return screenshots;
    });
  }

  // Test avatar rendering
  async testAvatarRendering() {
    return await this.test('Avatar Rendering', async () => {
      const screenshots = [];

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      // Find avatar elements
      const avatars = await this.page.locator('.avatar, [class*="avatar"], img[src*="robohash"]').all();
      console.log(`  Found ${avatars.length} avatar elements`);

      screenshots.push(await this.screenshot('avatars-main'));

      // Check for robohash fallback images
      const robohashImages = await this.page.locator('img[src*="robohash"]').count();
      console.log(`  Robohash avatars: ${robohashImages}`);

      // Check for custom avatar URLs
      const customAvatars = await this.page.locator('img[src*="nostr.build"], img[src*="unsplash"]').count();
      console.log(`  Custom avatars: ${customAvatars}`);

      return screenshots;
    });
  }

  // Test reaction display
  async testReactionDisplay() {
    return await this.test('Reaction Display', async () => {
      const screenshots = [];

      // Navigate to a channel with messages
      await this.page.goto(`${APP_URL}/chat/meditation-circle`);
      await this.page.waitForTimeout(4000);

      screenshots.push(await this.screenshot('channel-reactions-1'));

      // Look for reaction elements
      const reactionElements = await this.page.locator('[class*="reaction"], [class*="emoji"], .reaction-bar').all();
      console.log(`  Found ${reactionElements.length} reaction elements`);

      // Check for specific emoji reactions
      const pageContent = await this.page.content();
      const hasReactions = ['❤️', '👍', '🔥', '🎉', '😂', '🙏'].some(emoji => pageContent.includes(emoji));
      console.log(`  Emoji reactions visible: ${hasReactions}`);

      // Try tech-talk channel too
      await this.page.goto(`${APP_URL}/chat/tech-talk`);
      await this.page.waitForTimeout(3000);
      screenshots.push(await this.screenshot('channel-reactions-2'));

      return screenshots;
    });
  }

  // Test image embedding in messages
  async testImageEmbedding() {
    return await this.test('Image Embedding', async () => {
      const screenshots = [];

      // Navigate to art-gallery channel (has image messages)
      await this.page.goto(`${APP_URL}/chat/art-gallery`);
      await this.page.waitForTimeout(4000);

      screenshots.push(await this.screenshot('image-messages-1'));

      // Look for embedded images
      const embeddedImages = await this.page.locator('img[src*="unsplash"], img[src*="images"], .media-embed img').all();
      console.log(`  Found ${embeddedImages.length} embedded images`);

      // Check for link previews
      const linkPreviews = await this.page.locator('[class*="preview"], [class*="embed"], .link-preview').all();
      console.log(`  Found ${linkPreviews.length} link preview elements`);

      // Try meditation-circle channel
      await this.page.goto(`${APP_URL}/chat/meditation-circle`);
      await this.page.waitForTimeout(3000);
      screenshots.push(await this.screenshot('image-messages-2'));

      return screenshots;
    });
  }

  // Test user profile modal
  async testUserProfileModal() {
    return await this.test('User Profile Modal', async () => {
      const screenshots = [];

      // Login first
      await this.loginWithMnemonic(TEST_USERS.superAdmin.mnemonic);
      screenshots.push(await this.screenshot('after-login'));

      // Look for profile button/avatar to click
      const profileTrigger = this.page.locator('.avatar, [class*="profile"], button:has-text("Profile")').first();
      if (await profileTrigger.count() > 0) {
        await profileTrigger.click();
        await this.page.waitForTimeout(1000);
        screenshots.push(await this.screenshot('profile-modal'));
      }

      // Check if profile shows nickname and avatar fields
      const nicknameField = await this.page.locator('input[placeholder*="name"], input[placeholder*="nickname"]').count();
      const avatarField = await this.page.locator('input[placeholder*="avatar"], input[type="url"]').count();

      console.log(`  Nickname field: ${nicknameField > 0 ? 'found' : 'not found'}`);
      console.log(`  Avatar field: ${avatarField > 0 ? 'found' : 'not found'}`);

      return screenshots;
    });
  }

  // Test channel list with pictures
  async testChannelPictures() {
    return await this.test('Channel Pictures', async () => {
      const screenshots = [];

      await this.page.goto(`${APP_URL}/channels`);
      await this.page.waitForTimeout(3000);

      screenshots.push(await this.screenshot('channels-list'));

      // Look for channel images
      const channelImages = await this.page.locator('.channel img, [class*="channel"] img, img[alt*="channel"]').all();
      console.log(`  Found ${channelImages.length} channel images`);

      // Check for channel names we created
      const pageContent = await this.page.content();
      const hasTestChannels = ['Meditation Circle', 'Art Gallery', 'Tech Talk', 'Community Events']
        .filter(ch => pageContent.includes(ch)).length;
      console.log(`  Test channels visible: ${hasTestChannels}/4`);

      return screenshots;
    });
  }

  // Test admin dashboard with user list
  async testAdminUserList() {
    return await this.test('Admin User List', async () => {
      const screenshots = [];

      // Login as admin
      await this.loginWithMnemonic(TEST_USERS.superAdmin.mnemonic);
      await this.page.waitForTimeout(2000);

      // Navigate to admin
      await this.page.goto(`${APP_URL}/admin`);
      await this.page.waitForTimeout(3000);

      screenshots.push(await this.screenshot('admin-dashboard'));

      // Look for user list with avatars
      const userListItems = await this.page.locator('[class*="user"], [class*="member"], .avatar').all();
      console.log(`  User list items: ${userListItems.length}`);

      // Check for test user names
      const pageContent = await this.page.content();
      const testUsersFound = Object.values(TEST_USERS)
        .filter(u => pageContent.includes(u.name)).length;
      console.log(`  Test users visible in admin: ${testUsersFound}`);

      return screenshots;
    });
  }

  // Test top posters widget
  async testTopPostersWidget() {
    return await this.test('Top Posters Widget', async () => {
      const screenshots = [];

      await this.page.goto(APP_URL);
      await this.page.waitForTimeout(3000);

      // Look for top posters section
      const topPostersSection = this.page.locator('[class*="top-posters"], [class*="TopPosters"], :text("Top Posters")');

      if (await topPostersSection.count() > 0) {
        screenshots.push(await this.screenshot('top-posters'));

        // Check for avatars and names in widget
        const widgetAvatars = await this.page.locator('[class*="top-posters"] .avatar, [class*="TopPosters"] img').count();
        console.log(`  Avatars in top posters: ${widgetAvatars}`);
      } else {
        console.log('  Top posters widget not visible');
      }

      return screenshots;
    });
  }

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  FEATURE TESTS - Nicknames, Avatars, Reactions, Images         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await this.init();

    // Run all feature tests
    await this.testNicknameDisplay();
    await this.testAvatarRendering();
    await this.testChannelPictures();
    await this.testTopPostersWidget();
    await this.testReactionDisplay();
    await this.testImageEmbedding();
    await this.testUserProfileModal();
    await this.testAdminUserList();

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

    // Save results
    fs.writeFileSync(
      `${SCREENSHOT_DIR}/feature-test-results.json`,
      JSON.stringify({ results: this.results, summary: { passed, failed, total: this.results.length } }, null, 2)
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
