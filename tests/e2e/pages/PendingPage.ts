/**
 * Page Object Model: Pending Approval Page
 *
 * Handles the pending approval state for new users awaiting admin approval
 */

import { Page, Locator, expect } from '@playwright/test';

export class PendingPage {
  readonly page: Page;

  // Main elements
  readonly welcomeHeading: Locator;
  readonly pendingBadge: Locator;
  readonly awaitingApprovalText: Locator;
  readonly logoutButton: Locator;

  // Info cards
  readonly whatHappensNextCard: Locator;
  readonly communityZonesCard: Locator;

  // Auto-refresh indicator
  readonly autoRefreshNote: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main elements
    this.welcomeHeading = page.getByRole('heading', { name: /welcome/i });
    this.pendingBadge = page.locator('.badge-warning, .badge-error').filter({ hasText: /awaiting|pending/i });
    this.awaitingApprovalText = page.getByText(/awaiting admin approval/i);
    this.logoutButton = page.getByRole('button', { name: /logout/i });

    // Info cards
    this.whatHappensNextCard = page.getByText(/what happens next/i);
    this.communityZonesCard = page.getByText(/community zones/i);

    // Auto-refresh note
    this.autoRefreshNote = page.getByText(/auto.*refresh/i);
  }

  /**
   * Navigate to pending page
   */
  async goto(): Promise<void> {
    await this.page.goto('/pending');
  }

  /**
   * Wait for pending page to load
   */
  async waitForPendingPage(): Promise<void> {
    await expect(this.awaitingApprovalText).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify all pending page elements are visible
   */
  async verifyPendingState(): Promise<void> {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.awaitingApprovalText).toBeVisible();
    await expect(this.logoutButton).toBeVisible();
  }

  /**
   * Check if pending approval badge is visible
   */
  async isPendingBadgeVisible(): Promise<boolean> {
    try {
      await expect(this.awaitingApprovalText).toBeVisible({ timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click logout button
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  /**
   * Wait for redirect to chat (after approval)
   */
  async waitForApprovalRedirect(timeout = 60000): Promise<void> {
    await this.page.waitForURL(/\/chat/, { timeout });
  }

  /**
   * Force refresh the page
   */
  async refresh(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Get the current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Check if user is on pending page
   */
  isOnPendingPage(): boolean {
    return this.page.url().includes('/pending');
  }

  /**
   * Check if user was redirected to chat
   */
  isOnChatPage(): boolean {
    return this.page.url().includes('/chat');
  }
}
