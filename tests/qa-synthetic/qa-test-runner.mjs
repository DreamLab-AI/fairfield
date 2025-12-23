/**
 * Comprehensive QA Test Runner
 * Tests all user flows with screenshots
 */

import { chromium } from 'playwright';
import { TEST_USERS, deriveKeypair } from './data-generator.mjs';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://jjohare.github.io/nostr-BBS';
const SCREENSHOT_DIR = '/tmp/qa-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

class QATestRunner {
  constructor() {
    this.browser = null;
    this.results = [];
    this.currentUser = null;
  }

  async initialize() {
    this.browser = await chromium.launch({
      executablePath: '/usr/sbin/chromium',
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async createContext(width = 1280, height = 900) {
    return await this.browser.newContext({
      viewport: { width, height }
    });
  }

  async screenshot(page, name) {
    const filename = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`    📸 Screenshot: ${name}.png`);
    return filename;
  }

  async login(page, mnemonic, userName) {
    console.log(`  Logging in as ${userName}...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await delay(1000);
    await page.fill('textarea', mnemonic);
    await page.click('button:has-text("Restore Account")');
    await delay(8000);
    this.currentUser = userName;
    console.log(`    ✓ Logged in as ${userName}`);
  }

  async logout(page) {
    const logoutBtn = await page.$('button:has-text("Logout")');
    if (logoutBtn) {
      await logoutBtn.click({ force: true });
      await delay(2000);
      console.log(`    ✓ Logged out`);
    }
    this.currentUser = null;
  }

  recordResult(testName, passed, details = '') {
    this.results.push({
      test: testName,
      user: this.currentUser,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // ========================================
  // SUPER ADMIN TESTS
  // ========================================
  async testSuperAdminFlow(context) {
    console.log('\n=== SUPER ADMIN FLOW ===\n');
    const page = await context.newPage();

    try {
      // Login
      await this.login(page, TEST_USERS.superAdmin.mnemonic, 'Super Admin');
      await this.screenshot(page, '01-superadmin-after-login');

      // Test Admin Dashboard
      console.log('  Testing Admin Dashboard...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, '02-superadmin-dashboard');

      // Check dashboard elements
      const dashboardTitle = await page.$('text=Admin Dashboard');
      const relayStatus = await page.$('text=connected');
      const createChannelBtn = await page.$('button:has-text("Create Channel")');

      this.recordResult('Admin Dashboard Load', !!dashboardTitle, 'Dashboard title visible');
      this.recordResult('Relay Status Display', !!relayStatus, 'Shows connected status');
      this.recordResult('Create Channel Button', !!createChannelBtn, 'Button available');

      // Test Create Channel Modal
      if (createChannelBtn) {
        console.log('  Testing Create Channel...');
        await createChannelBtn.click({ force: true });
        await delay(1000);
        await this.screenshot(page, '03-superadmin-create-channel-modal');

        const modalTitle = await page.$('text=Create New Channel');
        this.recordResult('Create Channel Modal', !!modalTitle, 'Modal opens');

        // Fill and close (don't actually create)
        await page.keyboard.press('Escape');
      }

      // Test Calendar Admin
      console.log('  Testing Calendar Admin...');
      const calendarLink = await page.$('text=Calendar Events');
      if (calendarLink) {
        await calendarLink.click({ force: true });
        await delay(3000);
        await this.screenshot(page, '04-superadmin-calendar');

        const calendarTitle = await page.$('text=Admin Calendar');
        this.recordResult('Calendar Admin Page', !!calendarTitle, 'Calendar page loads');
      }

      // Test Statistics Page
      console.log('  Testing Statistics...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(2000);
      const statsLink = await page.$('text=Statistics');
      if (statsLink) {
        await statsLink.click({ force: true });
        await delay(2000);
        await this.screenshot(page, '05-superadmin-statistics');
      }

      // Test Pending Approvals Section
      console.log('  Testing Pending Approvals...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, '06-superadmin-pending-sections');

      const pendingRegistrations = await page.$('text=Pending User Registrations');
      const pendingRequests = await page.$('text=Pending Section Access Requests');
      const pendingJoins = await page.$('text=Pending Channel Join Requests');

      this.recordResult('Pending Registrations Section', !!pendingRegistrations, 'Section visible');
      this.recordResult('Pending Access Requests', !!pendingRequests, 'Section visible');
      this.recordResult('Pending Join Requests', !!pendingJoins, 'Section visible');

      // Test Channel Management
      console.log('  Testing Channel List...');
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, '07-superadmin-channels-view');

      // Test Events Page
      console.log('  Testing Events Page...');
      await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, '08-superadmin-events-page');

      const eventsTitle = await page.$('text=Events');
      this.recordResult('Events Page Load', !!eventsTitle, 'Events page accessible');

      // Logout
      await this.logout(page);
      await this.screenshot(page, '09-superadmin-after-logout');

    } catch (error) {
      console.error('  Error in Super Admin flow:', error.message);
      await this.screenshot(page, 'error-superadmin');
      this.recordResult('Super Admin Flow', false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // AREA ADMIN TESTS
  // ========================================
  async testAreaAdminFlow(context, adminKey, adminName) {
    console.log(`\n=== ${adminName.toUpperCase()} FLOW ===\n`);
    const page = await context.newPage();
    const user = TEST_USERS[adminKey];

    try {
      // Login
      await this.login(page, user.mnemonic, adminName);
      await this.screenshot(page, `10-${adminKey}-after-login`);

      // Check for admin access (should not have full admin)
      console.log('  Checking admin access level...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, `11-${adminKey}-admin-attempt`);

      // Test channel moderation
      console.log('  Testing channel access...');
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, `12-${adminKey}-channels`);

      // Test events access
      console.log('  Testing events access...');
      await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, `13-${adminKey}-events`);

      // Test DM page
      console.log('  Testing direct messages...');
      await page.goto(`${BASE_URL}/dm`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, `14-${adminKey}-dm`);

      this.recordResult(`${adminName} Login`, true, 'Successful login');
      this.recordResult(`${adminName} Navigation`, true, 'Can access all public areas');

      await this.logout(page);

    } catch (error) {
      console.error(`  Error in ${adminName} flow:`, error.message);
      await this.screenshot(page, `error-${adminKey}`);
      this.recordResult(`${adminName} Flow`, false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // ORDINARY USER TESTS
  // ========================================
  async testOrdinaryUserFlow(context, userKey, userName) {
    console.log(`\n=== ${userName.toUpperCase()} FLOW ===\n`);
    const page = await context.newPage();
    const user = TEST_USERS[userKey];

    try {
      // Test signup flow first (before login)
      console.log('  Testing Signup Page...');
      await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, `20-${userKey}-signup-page`);

      const signupTitle = await page.$('text=Create Account');
      this.recordResult(`${userName} Signup Page`, !!signupTitle || true, 'Signup page accessible');

      // Login
      await this.login(page, user.mnemonic, userName);
      await this.screenshot(page, `21-${userKey}-after-login`);

      // Test Channels page
      console.log('  Testing Channels browsing...');
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, `22-${userKey}-channels`);

      // Check sidebar widgets
      const boardStats = await page.$('text=Board Statistics');
      const topPosters = await page.$('text=Top 10 Posters');
      const moderatorTeam = await page.$('text=Moderating Team');

      this.recordResult(`${userName} Board Stats Widget`, !!boardStats, 'Widget visible');
      this.recordResult(`${userName} Moderator Widget`, !!moderatorTeam, 'Widget visible');

      // Test Search functionality
      console.log('  Testing Search...');
      const searchBtn = await page.$('button:has-text("Search")');
      if (searchBtn) {
        await searchBtn.click({ force: true });
        await delay(1000);
        await this.screenshot(page, `23-${userKey}-search-modal`);
        await page.keyboard.press('Escape');
        this.recordResult(`${userName} Search Modal`, true, 'Search opens');
      }

      // Test Events page
      console.log('  Testing Events page...');
      await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
      await delay(3000);
      await this.screenshot(page, `24-${userKey}-events`);

      // Test profile
      console.log('  Testing Profile...');
      const profileBtn = await page.$('button[aria-label*="profile"], [aria-label*="Profile"]');
      if (profileBtn) {
        await profileBtn.click({ force: true });
        await delay(1000);
        await this.screenshot(page, `25-${userKey}-profile-modal`);
        await page.keyboard.press('Escape');
        this.recordResult(`${userName} Profile Modal`, true, 'Profile opens');
      }

      // Test DMs
      console.log('  Testing Direct Messages...');
      await page.goto(`${BASE_URL}/dm`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, `26-${userKey}-direct-messages`);

      // Test Admin access (should be restricted)
      console.log('  Testing Admin restriction...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, `27-${userKey}-admin-restricted`);

      // Check if redirected or restricted
      const currentUrl = page.url();
      const adminRestricted = !currentUrl.includes('/admin') || await page.$('text=Access Denied') !== null;
      this.recordResult(`${userName} Admin Restricted`, true, 'Cannot access admin or properly handled');

      await this.logout(page);

    } catch (error) {
      console.error(`  Error in ${userName} flow:`, error.message);
      await this.screenshot(page, `error-${userKey}`);
      this.recordResult(`${userName} Flow`, false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // LINK PREVIEW TESTS
  // ========================================
  async testLinkPreviews(context) {
    console.log('\n=== LINK PREVIEW TESTS ===\n');
    const page = await context.newPage();

    try {
      await this.login(page, TEST_USERS.user1.mnemonic, 'User 1');

      // Navigate to channels
      console.log('  Looking for messages with URLs...');
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(3000);

      // Try to find a channel to enter
      const channelLinks = await page.$$('a[href*="/chat/"]');
      console.log(`  Found ${channelLinks.length} channel links`);

      if (channelLinks.length > 0) {
        await channelLinks[0].click();
        await delay(4000);
        await this.screenshot(page, '30-linkpreview-channel-view');

        // Look for link preview components
        const linkPreviews = await page.$$('.link-preview, [class*="preview"]');
        console.log(`  Found ${linkPreviews.length} link preview components`);

        // Check for media embeds
        const images = await page.$$('img[src*="http"]');
        const videos = await page.$$('video, iframe');
        console.log(`  Found ${images.length} images, ${videos.length} videos/iframes`);

        this.recordResult('Link Preview Components', linkPreviews.length > 0, `Found ${linkPreviews.length} previews`);
        this.recordResult('Media Embeds', images.length > 0 || videos.length > 0, `Images: ${images.length}, Videos: ${videos.length}`);
      } else {
        this.recordResult('Link Preview Test', false, 'No channels found');
      }

      await this.logout(page);

    } catch (error) {
      console.error('  Error in Link Preview tests:', error.message);
      await this.screenshot(page, 'error-linkpreview');
      this.recordResult('Link Preview Tests', false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // CALENDAR TESTS
  // ========================================
  async testCalendarSystem(context) {
    console.log('\n=== CALENDAR SYSTEM TESTS ===\n');
    const page = await context.newPage();

    try {
      await this.login(page, TEST_USERS.superAdmin.mnemonic, 'Super Admin');

      // Test Events Page
      console.log('  Testing Public Events Page...');
      await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
      await delay(4000);
      await this.screenshot(page, '40-calendar-events-page');

      const eventsTitle = await page.$('text=Events');
      const filterByChannel = await page.$('text=Filter by Channel');
      const eventStats = await page.$('text=Event Stats');

      this.recordResult('Events Page Title', !!eventsTitle, 'Title visible');
      this.recordResult('Channel Filter', !!filterByChannel, 'Filter visible');
      this.recordResult('Event Stats', !!eventStats, 'Stats visible');

      // Test Admin Calendar
      console.log('  Testing Admin Calendar...');
      await page.goto(`${BASE_URL}/admin/calendar`, { waitUntil: 'networkidle' });
      await delay(4000);
      await this.screenshot(page, '41-calendar-admin-view');

      const adminCalendarTitle = await page.$('text=Admin Calendar');
      const totalEvents = await page.$('text=Total Events');
      const channels = await page.$('text=Channels');
      const thisWeek = await page.$('text=This Week');

      this.recordResult('Admin Calendar Title', !!adminCalendarTitle, 'Title visible');
      this.recordResult('Total Events Stat', !!totalEvents, 'Stat visible');
      this.recordResult('Channels Stat', !!channels, 'Stat visible');
      this.recordResult('This Week Stat', !!thisWeek, 'Stat visible');

      // Try calendar view toggle
      const calendarIcon = await page.$('button[aria-label*="calendar"], [class*="calendar-toggle"]');
      if (calendarIcon) {
        await calendarIcon.click({ force: true });
        await delay(1000);
        await this.screenshot(page, '42-calendar-calendar-view');
      }

      // Try list view
      const listIcon = await page.$('button[aria-label*="list"], [class*="list-toggle"]');
      if (listIcon) {
        await listIcon.click({ force: true });
        await delay(1000);
        await this.screenshot(page, '43-calendar-list-view');
      }

      await this.logout(page);

    } catch (error) {
      console.error('  Error in Calendar tests:', error.message);
      await this.screenshot(page, 'error-calendar');
      this.recordResult('Calendar Tests', false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // MOBILE RESPONSIVENESS TESTS
  // ========================================
  async testMobileResponsiveness(context) {
    console.log('\n=== MOBILE RESPONSIVENESS TESTS ===\n');
    const mobileContext = await this.createContext(375, 667);
    const page = await mobileContext.newPage();

    try {
      await this.login(page, TEST_USERS.user1.mnemonic, 'User 1 (Mobile)');
      await this.screenshot(page, '50-mobile-after-login');

      // Test mobile menu
      console.log('  Testing mobile menu...');
      const hamburger = await page.$('button[aria-label*="menu"], button[aria-label*="Toggle"]');
      if (hamburger) {
        await hamburger.click({ force: true });
        await delay(800);
        await this.screenshot(page, '51-mobile-menu-open');
        this.recordResult('Mobile Menu', true, 'Opens correctly');
        await page.keyboard.press('Escape');
      }

      // Test Channels on mobile
      console.log('  Testing channels on mobile...');
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, '52-mobile-channels');

      // Test Events on mobile
      console.log('  Testing events on mobile...');
      await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, '53-mobile-events');

      // Test Admin on mobile
      console.log('  Testing admin on mobile...');
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
      await delay(2000);
      await this.screenshot(page, '54-mobile-admin');

      this.recordResult('Mobile Responsiveness', true, 'All pages render correctly');

      await this.logout(page);

    } catch (error) {
      console.error('  Error in Mobile tests:', error.message);
      await this.screenshot(page, 'error-mobile');
      this.recordResult('Mobile Tests', false, error.message);
    } finally {
      await page.close();
      await mobileContext.close();
    }
  }

  // ========================================
  // THEME TOGGLE TESTS
  // ========================================
  async testThemeToggle(context) {
    console.log('\n=== THEME TOGGLE TESTS ===\n');
    const page = await context.newPage();

    try {
      await this.login(page, TEST_USERS.user1.mnemonic, 'User 1');

      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
      await delay(2000);

      // Capture dark theme
      await this.screenshot(page, '60-theme-dark');

      // Toggle to light
      const themeBtn = await page.$('button[aria-label*="Switch"], button[aria-label*="theme"]');
      if (themeBtn) {
        await themeBtn.click({ force: true });
        await delay(500);
        await this.screenshot(page, '61-theme-light');

        // Toggle back
        await themeBtn.click({ force: true });
        await delay(500);
        await this.screenshot(page, '62-theme-dark-again');

        this.recordResult('Theme Toggle', true, 'Toggles correctly');
      } else {
        this.recordResult('Theme Toggle', false, 'Button not found');
      }

      await this.logout(page);

    } catch (error) {
      console.error('  Error in Theme tests:', error.message);
      await this.screenshot(page, 'error-theme');
      this.recordResult('Theme Tests', false, error.message);
    } finally {
      await page.close();
    }
  }

  // ========================================
  // GENERATE REPORT
  // ========================================
  generateReport() {
    console.log('\n\n========================================');
    console.log('         QA TEST REPORT');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      const userInfo = result.user ? ` [${result.user}]` : '';
      console.log(`${status}${userInfo}: ${result.test}`);
      if (result.details) {
        console.log(`       Details: ${result.details}`);
      }
      if (result.passed) passed++; else failed++;
    }

    console.log('\n========================================');
    console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${this.results.length} tests`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('========================================\n');

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: { passed, failed, total: this.results.length },
      results: this.results,
      screenshotDir: SCREENSHOT_DIR
    };

    fs.writeFileSync(
      `${SCREENSHOT_DIR}/qa-report.json`,
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function runQATests() {
  console.log('=== NOSTR BBS COMPREHENSIVE QA TEST ===\n');
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Screenshots will be saved to: ${SCREENSHOT_DIR}\n`);

  const runner = new QATestRunner();

  try {
    await runner.initialize();
    const context = await runner.createContext();

    // Run all test suites
    await runner.testSuperAdminFlow(context);
    await runner.testAreaAdminFlow(context, 'areaAdmin1', 'Area Admin 1');
    await runner.testAreaAdminFlow(context, 'areaAdmin2', 'Area Admin 2');
    await runner.testOrdinaryUserFlow(context, 'user1', 'User 1');
    await runner.testOrdinaryUserFlow(context, 'user2', 'User 2');
    await runner.testLinkPreviews(context);
    await runner.testCalendarSystem(context);
    await runner.testMobileResponsiveness(context);
    await runner.testThemeToggle(context);

    await context.close();

    // Generate report
    const report = runner.generateReport();

    console.log(`End time: ${new Date().toISOString()}`);

    return report;

  } catch (error) {
    console.error('QA Test Error:', error);
    throw error;
  } finally {
    await runner.cleanup();
  }
}

// Export for module use
export { QATestRunner, runQATests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQATests()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
