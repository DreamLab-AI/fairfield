/**
 * Page Object Model: Signup Page
 *
 * Handles the multi-step signup flow:
 * 1. Signup - Create Account button
 * 2. NsecBackup - Backup private key
 * 3. NicknameSetup - Set display name
 * 4. Redirect to pending or chat
 */

import { Page, Locator, expect } from '@playwright/test';

export class SignupPage {
  readonly page: Page;

  // Step 1: Signup component
  readonly createAccountButton: Locator;
  readonly alreadyHaveKeyButton: Locator;

  // Step 2: NsecBackup component
  readonly backupHeading: Locator;
  readonly revealButton: Locator;
  readonly nsecDisplay: Locator;
  readonly copyButton: Locator;
  readonly downloadButton: Locator;
  readonly confirmCheckbox: Locator;
  readonly continueButton: Locator;
  readonly copiedMessage: Locator;

  // Step 3: NicknameSetup component
  readonly nicknameHeading: Locator;
  readonly nicknameInput: Locator;
  readonly nicknameContinueButton: Locator;
  readonly skipButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Step 1: Signup component locators
    this.createAccountButton = page.getByRole('button', { name: /create account/i });
    this.alreadyHaveKeyButton = page.getByRole('button', { name: /already have.*key/i });

    // Step 2: NsecBackup component locators
    this.backupHeading = page.getByRole('heading', { name: /backup your private key/i });
    this.revealButton = page.getByRole('button', { name: /reveal.*private key/i });
    this.nsecDisplay = page.locator('p.font-mono');
    this.copyButton = page.getByRole('button', { name: /copy/i });
    this.downloadButton = page.getByRole('button', { name: /download/i });
    this.confirmCheckbox = page.getByRole('checkbox', { name: /securely backed up/i });
    this.continueButton = page.getByRole('button', { name: /continue/i });
    this.copiedMessage = page.getByText(/copied/i);

    // Step 3: NicknameSetup component locators
    this.nicknameHeading = page.getByRole('heading', { name: /choose your nickname/i });
    this.nicknameInput = page.locator('#nickname-input');
    this.nicknameContinueButton = page.getByRole('button', { name: /continue/i });
    this.skipButton = page.getByRole('button', { name: /skip for now/i });
  }

  /**
   * Navigate to signup page
   */
  async goto(): Promise<void> {
    await this.page.goto('/signup');
  }

  /**
   * Wait for signup step to be visible
   */
  async waitForSignupStep(): Promise<void> {
    await expect(this.createAccountButton).toBeVisible({ timeout: 5000 });
  }

  /**
   * Click Create Account to generate new keys
   */
  async clickCreateAccount(): Promise<void> {
    await this.createAccountButton.click();
  }

  /**
   * Wait for backup step to be visible
   */
  async waitForBackupStep(): Promise<void> {
    await expect(this.backupHeading).toBeVisible({ timeout: 5000 });
  }

  /**
   * Reveal the nsec private key
   */
  async revealNsec(): Promise<void> {
    await this.revealButton.click();
    await expect(this.nsecDisplay).toBeVisible({ timeout: 3000 });
  }

  /**
   * Get the displayed nsec key
   */
  async getNsec(): Promise<string> {
    const text = await this.nsecDisplay.textContent();
    return text?.trim() || '';
  }

  /**
   * Copy nsec to clipboard
   */
  async copyNsec(): Promise<void> {
    // Grant clipboard permissions
    await this.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await this.copyButton.click();
    await expect(this.copiedMessage).toBeVisible({ timeout: 2000 });
  }

  /**
   * Download backup file
   */
  async downloadBackup(): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    const download = await downloadPromise;
    return download.suggestedFilename();
  }

  /**
   * Check the confirmation checkbox
   */
  async confirmBackup(): Promise<void> {
    await this.confirmCheckbox.check();
  }

  /**
   * Click continue button on backup step
   */
  async clickContinueFromBackup(): Promise<void> {
    await expect(this.continueButton).toBeEnabled();
    await this.continueButton.click();
  }

  /**
   * Complete the full backup step (reveal, copy, confirm, continue)
   */
  async completeBackupStep(): Promise<string> {
    await this.waitForBackupStep();
    await this.revealNsec();
    const nsec = await this.getNsec();
    await this.copyNsec();
    await this.confirmBackup();
    await this.clickContinueFromBackup();
    return nsec;
  }

  /**
   * Wait for nickname step to be visible
   */
  async waitForNicknameStep(): Promise<void> {
    await expect(this.nicknameHeading).toBeVisible({ timeout: 5000 });
  }

  /**
   * Enter a nickname
   */
  async enterNickname(nickname: string): Promise<void> {
    await this.nicknameInput.fill(nickname);
  }

  /**
   * Click continue on nickname step
   */
  async clickContinueFromNickname(): Promise<void> {
    await this.nicknameContinueButton.click();
  }

  /**
   * Complete the nickname step
   */
  async completeNicknameStep(nickname: string): Promise<void> {
    await this.waitForNicknameStep();
    await this.enterNickname(nickname);
    await this.clickContinueFromNickname();
  }

  /**
   * Skip nickname step
   */
  async skipNicknameStep(): Promise<void> {
    await this.waitForNicknameStep();
    await this.skipButton.click();
  }

  /**
   * Complete full registration flow (create account + backup + nickname)
   * Returns the generated nsec key
   */
  async completeFullRegistration(nickname: string): Promise<string> {
    await this.goto();
    await this.waitForSignupStep();
    await this.clickCreateAccount();
    const nsec = await this.completeBackupStep();
    await this.completeNicknameStep(nickname);
    return nsec;
  }

  /**
   * Get stored pubkey from localStorage
   */
  async getStoredPubkey(): Promise<string | null> {
    return await this.page.evaluate(() =>
      localStorage.getItem('nostr_bbs_nostr_pubkey')
    );
  }

  /**
   * Get account status from localStorage
   */
  async getAccountStatus(): Promise<string | null> {
    return await this.page.evaluate(() =>
      localStorage.getItem('nostr_bbs_nostr_account_status')
    );
  }

  /**
   * Check if user is pending approval
   */
  async isPending(): Promise<boolean> {
    const status = await this.page.evaluate(() =>
      localStorage.getItem('nostr_bbs_nostr_pending')
    );
    return status === 'true';
  }
}
