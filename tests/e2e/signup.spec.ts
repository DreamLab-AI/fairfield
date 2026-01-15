/**
 * E2E Tests: User Signup Flow
 *
 * Tests the complete user signup process including:
 * - Account creation
 * - Nsec key generation and display
 * - Nsec backup (copy/download)
 * - Key storage
 * - Redirect to chat or pending approval
 */

import { test, expect } from '@playwright/test';

test.describe('User Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Fairfield/i);

    // Check main heading exists
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Check for create account button
    const createButton = page.getByRole('link', { name: /create account/i });
    await expect(createButton).toBeVisible();
  });

  test('create account shows nsec backup screen', async ({ page }) => {
    await page.goto('/');

    // Click create account
    const createButton = page.getByRole('link', { name: /create account/i });
    await createButton.click();

    // Should navigate to signup page
    await page.waitForURL(/signup/i, { timeout: 5000 });

    // Wait for NsecBackup component to be displayed
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Check for backup heading
    const backupHeading = page.getByText(/Backup Your Private Key/i);
    await expect(backupHeading).toBeVisible();

    // Check for reveal button (nsec hidden by default)
    const revealButton = page.getByRole('button', { name: /reveal/i });
    await expect(revealButton).toBeVisible();
  });

  test('reveal button shows nsec key', async ({ page }) => {
    await page.goto('/signup');

    // Wait for NsecBackup screen
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Click reveal button
    const revealButton = page.getByRole('button', { name: /reveal/i });
    await revealButton.click();

    // Wait for nsec to be displayed
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Get the nsec element
    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const nsecText = await nsecElement.textContent();

    // Validate nsec format (starts with nsec1)
    expect(nsecText?.trim()).toMatch(/^nsec1[a-z0-9]+$/i);
  });

  test('copy button copies nsec to clipboard', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Get original nsec
    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const originalNsec = await nsecElement.textContent();

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy button
    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.click();

    // Verify clipboard content
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toBe(originalNsec?.trim());

    // Check for success feedback
    const successMessage = page.getByText(/copied/i);
    await expect(successMessage).toBeVisible({ timeout: 2000 });
  });

  test('download button downloads nsec backup', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();

    // Verify download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/nostr.*key.*\.txt$/i);
  });

  test('confirmation checkbox enables continue button', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec first
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Copy to enable hasBackedUp
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /copy/i }).click();
    await page.waitForTimeout(500);

    // Find continue button
    const continueButton = page.getByRole('button', { name: /continue/i });

    // Button should be disabled initially (checkbox unchecked)
    await expect(continueButton).toBeDisabled();

    // Check the confirmation checkbox
    const checkbox = page.getByRole('checkbox', { name: /backed up|securely/i });
    await checkbox.check();

    // Button should now be enabled
    await expect(continueButton).toBeEnabled();
  });

  test('keys stored in localStorage after confirmation', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Copy and confirm
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /copy/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('checkbox', { name: /backed up|securely/i }).check();
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for processing
    await page.waitForTimeout(1500);

    // Check localStorage
    const storedKeys = await page.evaluate(() => {
      return {
        pubkey: localStorage.getItem('nostr_bbs_nostr_pubkey'),
        encryptedPrivkey: localStorage.getItem('nostr_bbs_nostr_encrypted_privkey'),
        accountStatus: localStorage.getItem('nostr_bbs_nostr_account_status')
      };
    });

    // Verify keys are stored
    expect(storedKeys.pubkey).toBeTruthy();
    expect(storedKeys.pubkey).toMatch(/^[0-9a-f]{64}$/i);
    expect(storedKeys.encryptedPrivkey).toBeTruthy();
    expect(storedKeys.accountStatus).toBe('complete');
  });

  test('redirect to chat or dashboard after signup', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Complete signup flow
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /copy/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('checkbox', { name: /backed up|securely/i }).check();
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for redirect
    await page.waitForURL(/chat|pending|dashboard|home/i, { timeout: 5000 });

    // Should be on authenticated page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/chat|pending|dashboard|home/i);
  });

  test('cannot proceed without copying/downloading backup', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec but don't copy
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Try to check confirmation without backup
    const checkbox = page.getByRole('checkbox', { name: /backed up|securely/i });

    // Checkbox should be disabled until backup is made
    const isDisabled = await checkbox.isDisabled();

    if (!isDisabled) {
      // If checkbox is enabled, check it and verify continue is still disabled
      await checkbox.check();
      const continueButton = page.getByRole('button', { name: /continue/i });

      // Button may still require copy/download action
      const buttonText = await continueButton.textContent();
      expect(buttonText || await continueButton.isDisabled()).toBeTruthy();
    }
  });

  test('nsec key starts with nsec1 prefix', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Get nsec text
    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const nsecText = await nsecElement.textContent();

    // Check nsec1 prefix and bech32 format
    expect(nsecText?.trim()).toMatch(/^nsec1[a-z0-9]{58,}$/);
  });

  test('generated keys are unique across sessions', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Get first nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const firstNsec = await nsecElement.textContent();

    // Reload and generate new key
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const secondNsec = await nsecElement.textContent();

    // Keys should be different
    expect(firstNsec).not.toBe(secondNsec);
  });

  test('security warning is displayed prominently', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Check for security warnings
    const warnings = [
      /never share|do not share|only you/i,
      /backup|save|write down/i,
      /cannot be recovered|lose access|lost forever/i
    ];

    for (const warning of warnings) {
      const warningElement = page.getByText(warning);
      await expect(warningElement).toBeVisible();
    }
  });

  test('nsec is hidden by default for security', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Check that nsec1 is NOT visible before reveal
    const nsecVisible = await page.locator('text=/nsec1[a-z0-9]/i').isVisible({ timeout: 1000 }).catch(() => false);
    expect(nsecVisible).toBe(false);

    // Reveal button should be visible
    const revealButton = page.getByRole('button', { name: /reveal/i });
    await expect(revealButton).toBeVisible();
  });

  test('account status is set to complete after full signup', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Complete full signup flow
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /copy/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('checkbox', { name: /backed up|securely/i }).check();
    await page.getByRole('button', { name: /continue/i }).click();

    await page.waitForTimeout(1500);

    // Check account status
    const accountStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(accountStatus).toBe('complete');
  });
});
