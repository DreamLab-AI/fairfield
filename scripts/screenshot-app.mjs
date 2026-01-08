import { chromium } from 'playwright';

const browser = await chromium.launch({ 
  headless: false,
  args: ['--no-sandbox', '--disable-gpu']
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }
});
const page = await context.newPage();

const screenshotDir = '/tmp/playwright-screenshots';

// 1. Homepage (unauthenticated)
console.log('1. Navigating to homepage...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${screenshotDir}/01-homepage.png`, fullPage: true });
console.log('Screenshot: 01-homepage.png');

// 2. Check what's on the page
const title = await page.title();
console.log('Page title:', title);

// Look for navigation elements
const navLinks = await page.$$('nav a, .nav a, [role="navigation"] a');
console.log('Found nav links:', navLinks.length);

// 3. Try to find login/auth or main sections
const loginBtn = await page.$('text=Login') || await page.$('text=Sign In') || await page.$('button:has-text("Login")');
if (loginBtn) {
  console.log('Found login button');
}

// 4. Navigate to different routes if available
const routes = ['/messages', '/calendar', '/admin', '/profile'];
for (const route of routes) {
  try {
    console.log(`Trying route: ${route}`);
    await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const filename = route.replace('/', '') || 'root';
    await page.screenshot({ path: `${screenshotDir}/02-${filename}.png`, fullPage: true });
    console.log(`Screenshot: 02-${filename}.png`);
  } catch (e) {
    console.log(`Route ${route} failed:`, e.message);
  }
}

await browser.close();
console.log('Done!');
