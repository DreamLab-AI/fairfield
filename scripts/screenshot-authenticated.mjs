import { chromium } from 'playwright';

const screenshotDir = '/tmp/playwright-screenshots';

const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox', '--disable-gpu']
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }
});
const page = await context.newPage();

let screenshotNum = 1;

async function screenshot(name) {
  const filename = `${screenshotNum.toString().padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: `${screenshotDir}/${filename}`, fullPage: true });
  console.log(`Screenshot ${screenshotNum}: ${filename}`);
  screenshotNum++;
}

// 1. Homepage (login screen)
console.log('Navigating to homepage...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await screenshot('login-screen');

// 2. Click Create Account
console.log('Clicking Create Account...');
await page.click('text=Create Account');
await page.waitForTimeout(1500);
await screenshot('onboarding-welcome');

// 3. Skip the tutorial
console.log('Skipping tutorial...');
const skipBtn = await page.$('text=Skip Tutorial');
if (skipBtn) {
  await skipBtn.click();
  await page.waitForTimeout(2000);
  await screenshot('account-form');
}

// 4. Look for Create/Generate button or form
console.log('Looking for account creation button...');
// Try clicking any primary action button in the modal
const createBtn = await page.$('.modal button.btn-primary')
  || await page.$('button:has-text("Create Account")')
  || await page.$('button:has-text("Generate Keys")');

if (createBtn) {
  await createBtn.click();
  await page.waitForTimeout(3000);
  await screenshot('keys-generated');
}

// 5. Check the consent checkbox for recovery phrase
console.log('Looking for consent checkbox...');
const consentCheckbox = await page.$('input[type="checkbox"]') || await page.$('.checkbox') || await page.$('[role="checkbox"]');
if (consentCheckbox) {
  await consentCheckbox.click();
  await page.waitForTimeout(500);
  console.log('Checked consent checkbox');
}

// 5b. Click Reveal Recovery Phrase button
const revealBtn = await page.$('text=Reveal Recovery Phrase') || await page.$('button:has-text("Reveal")');
let recoveryWords = [];
if (revealBtn) {
  await revealBtn.click();
  await page.waitForTimeout(2000);

  // Extract the 12 recovery words for later verification
  const wordElements = await page.$$('.grid span, [class*="word"]');
  for (const el of wordElements) {
    const text = await el.textContent();
    if (text && !text.includes('.') && text.length > 1 && text.length < 15) {
      recoveryWords.push(text.trim().toLowerCase());
    }
  }
  // If that didn't work, try getting all text from the word grid
  if (recoveryWords.length < 12) {
    recoveryWords = [];
    const gridContent = await page.$eval('.grid, [class*="phrase"]', el => el.innerText);
    const words = gridContent.split(/\s+/).filter(w => w.length > 1 && !w.includes('.') && !/^\d+$/.test(w));
    recoveryWords = words.slice(0, 12).map(w => w.toLowerCase());
  }
  console.log('Recovery words captured:', recoveryWords.length);

  await screenshot('recovery-phrase-revealed');
}

// 5c. Check the "I have saved my recovery phrase" checkbox
console.log('Looking for saved phrase checkbox...');
const savedCheckbox = await page.$('text=I have saved my recovery phrase');
if (savedCheckbox) {
  await savedCheckbox.click();
  await page.waitForTimeout(500);
  console.log('Checked saved phrase checkbox');
} else {
  // Try finding the second checkbox directly
  const checkboxes = await page.$$('input[type="checkbox"]');
  if (checkboxes.length > 1) {
    await checkboxes[1].click();
    await page.waitForTimeout(500);
    console.log('Clicked second checkbox');
  }
}

// 5d. Click Continue button (should now be enabled)
console.log('Looking for Continue button...');
await page.waitForTimeout(500);
const continueBtn = await page.$('button:has-text("Continue")');
if (continueBtn) {
  await continueBtn.click();
  await page.waitForTimeout(2000);
  console.log('Clicked continue button');
}

// 6. Complete 3-step onboarding wizard
// Step 1: Save Your Recovery Phrase - click "I've Written It Down"
console.log('Onboarding Step 1...');
const writtenBtn = await page.$('text=I\'ve Written It Down') || await page.$('button:has-text("Written")');
if (writtenBtn) {
  await writtenBtn.click();
  await page.waitForTimeout(2000);
  console.log('Completed Step 1');
  await screenshot('onboarding-step2');
}

// Step 2: Verify Your Backup - fill in specific words
console.log('Onboarding Step 2 - Verify backup...');

// Find all labels to determine which word numbers are requested
const labels = await page.$$eval('label, [class*="label"]', els =>
  els.map(el => el.textContent).filter(t => t && t.includes('Word #'))
);
console.log('Requested words:', labels);

// Extract word positions from labels (e.g., "Word #4" -> 4) and deduplicate
const allPositions = labels.map(label => {
  const match = label.match(/#(\d+)/);
  return match ? parseInt(match[1]) - 1 : -1; // Convert to 0-indexed
}).filter(p => p >= 0);
// Deduplicate while preserving order
const positions = [...new Set(allPositions)];
console.log('Word positions (deduped):', positions);

// Find the input fields
const inputs = await page.$$('input[placeholder*="Enter word"], input[type="text"]');
console.log('Found inputs:', inputs.length);

if (inputs.length >= 3 && recoveryWords.length >= 12 && positions.length >= 3) {
  for (let i = 0; i < Math.min(inputs.length, positions.length); i++) {
    const wordIndex = positions[i];
    if (wordIndex < recoveryWords.length) {
      await inputs[i].fill(recoveryWords[wordIndex]);
      console.log(`Input ${i}: Word #${wordIndex + 1} = ${recoveryWords[wordIndex]}`);
    }
  }
  await page.waitForTimeout(500);
}
await screenshot('onboarding-step2-filled');

// Click Verify Words button
const verifyBtn = await page.$('text=Verify Words') || await page.$('button:has-text("Verify")');
if (verifyBtn) {
  await verifyBtn.click();
  await page.waitForTimeout(2000);
  console.log('Completed Step 2 verification');
  await screenshot('onboarding-step3');
}

// Step 3: Final confirmation - need to check responsibility checkbox first
console.log('Onboarding Step 3 - Final confirmation...');
await screenshot('onboarding-step3-confirmation');

// Check the responsibility acceptance checkbox
const responsibilityCheckbox = await page.$('text=I understand and accept responsibility') || await page.$('input[type="checkbox"]');
if (responsibilityCheckbox) {
  await responsibilityCheckbox.click();
  await page.waitForTimeout(500);
  console.log('Checked responsibility checkbox');
}

// Now click Complete Setup
const completeBtn = await page.$('text=Complete Setup') || await page.$('button.btn-primary:not([disabled])');
if (completeBtn) {
  await page.waitForTimeout(500);
  await completeBtn.click();
  await page.waitForTimeout(3000);
  console.log('Completed Setup');
}

// Give the app time to initialize after onboarding
await page.waitForTimeout(3000);
await screenshot('authenticated-home');

// 6. Check if logged in - navigate to authenticated routes
console.log('Checking authentication state...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await screenshot('post-login-home');

// 7. Capture messages/channels view
console.log('Navigating to messages...');
await page.goto('http://localhost:5173/messages', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await screenshot('messages-view');

// 8. Capture calendar view
console.log('Navigating to calendar...');
await page.goto('http://localhost:5173/calendar', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await screenshot('calendar-view');

// 9. Capture admin view (if accessible)
console.log('Navigating to admin...');
await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await screenshot('admin-view');

// 10. Check page state
const currentUrl = page.url();
console.log(`Current URL: ${currentUrl}`);
const pageContent = await page.content();
console.log(`Page content length: ${pageContent.length}`);

await browser.close();
console.log(`Done! ${screenshotNum - 1} screenshots saved to ${screenshotDir}`);
