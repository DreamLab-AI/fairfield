/**
 * Page Object Model: Admin Dashboard Page
 *
 * Handles admin functionality including:
 * - User registration approvals
 * - Section access requests
 * - Channel management
 * - User management
 */

import { Page, Locator, expect } from '@playwright/test';

export interface PendingRegistration {
  pubkey: string;
  displayName?: string;
  message?: string;
  createdAt: string;
}

export class AdminPage {
  readonly page: Page;

  // Main page elements
  readonly dashboardHeading: Locator;
  readonly relayStatusBadge: Locator;

  // Stats
  readonly statsSection: Locator;
  readonly pendingApprovalsCount: Locator;

  // User Registrations section
  readonly userRegistrationsSection: Locator;
  readonly userRegistrationsHeading: Locator;
  readonly registrationRefreshButton: Locator;
  readonly registrationTable: Locator;
  readonly approveButtons: Locator;
  readonly rejectButtons: Locator;
  readonly noRegistrationsMessage: Locator;

  // Section Requests section
  readonly sectionRequestsSection: Locator;

  // Channel Management
  readonly channelManagementSection: Locator;
  readonly createChannelButton: Locator;

  // Error/Success alerts
  readonly errorAlert: Locator;
  readonly successAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main page elements
    this.dashboardHeading = page.getByRole('heading', { name: /admin dashboard/i });
    this.relayStatusBadge = page.locator('.badge').filter({ hasText: /connected|disconnected|error/i });

    // Stats
    this.statsSection = page.locator('[class*="stats"]');
    this.pendingApprovalsCount = page.locator('.badge-error, .badge-warning').first();

    // User Registrations section
    this.userRegistrationsSection = page.locator('.card').filter({ hasText: /pending user registrations/i });
    this.userRegistrationsHeading = page.getByText(/pending user registrations/i);
    this.registrationRefreshButton = this.userRegistrationsSection.getByRole('button', { name: /refresh/i });
    this.registrationTable = this.userRegistrationsSection.locator('table');
    this.approveButtons = this.userRegistrationsSection.getByRole('button', { name: /approve/i });
    this.rejectButtons = this.userRegistrationsSection.getByRole('button', { name: /reject/i });
    this.noRegistrationsMessage = page.getByText(/no pending user registrations/i);

    // Section Requests section
    this.sectionRequestsSection = page.locator('.card').filter({ hasText: /section.*request|access.*request/i });

    // Channel Management
    this.channelManagementSection = page.locator('.card').filter({ hasText: /channel management/i });
    this.createChannelButton = page.getByRole('button', { name: /create channel/i });

    // Alerts
    this.errorAlert = page.locator('.alert-error');
    this.successAlert = page.locator('.alert-success');
  }

  /**
   * Navigate to admin page
   */
  async goto(): Promise<void> {
    await this.page.goto('/admin');
  }

  /**
   * Wait for admin dashboard to load
   */
  async waitForDashboard(): Promise<void> {
    await expect(this.dashboardHeading).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verify admin access (dashboard visible)
   */
  async verifyAdminAccess(): Promise<boolean> {
    try {
      await expect(this.dashboardHeading).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for relay connection
   */
  async waitForRelayConnection(): Promise<void> {
    await this.page.waitForSelector('.badge:has-text("connected")', { timeout: 10000 });
  }

  /**
   * Get pending registrations count from badge
   */
  async getPendingRegistrationsCount(): Promise<number> {
    const badge = this.userRegistrationsSection.locator('.badge-error');
    try {
      const text = await badge.textContent({ timeout: 2000 });
      return parseInt(text || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Check if there are pending registrations
   */
  async hasPendingRegistrations(): Promise<boolean> {
    const count = await this.getPendingRegistrationsCount();
    return count > 0;
  }

  /**
   * Get all pending registration rows
   */
  async getPendingRegistrations(): Promise<PendingRegistration[]> {
    const registrations: PendingRegistration[] = [];

    // Check if no registrations message is visible
    if (await this.noRegistrationsMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
      return registrations;
    }

    // Get all table rows
    const rows = this.registrationTable.locator('tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');

      // Extract data from each row
      const pubkeyCell = await cells.nth(0).textContent();
      const messageCell = await cells.nth(1).textContent();
      const timeCell = await cells.nth(2).textContent();

      registrations.push({
        pubkey: pubkeyCell?.trim() || '',
        message: messageCell?.trim() || undefined,
        createdAt: timeCell?.trim() || ''
      });
    }

    return registrations;
  }

  /**
   * Find a registration by pubkey (partial match)
   */
  async findRegistrationByPubkey(partialPubkey: string): Promise<Locator | null> {
    const rows = this.registrationTable.locator('tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text?.includes(partialPubkey)) {
        return row;
      }
    }
    return null;
  }

  /**
   * Find a registration by display name
   */
  async findRegistrationByDisplayName(displayName: string): Promise<Locator | null> {
    const rows = this.registrationTable.locator('tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text?.toLowerCase().includes(displayName.toLowerCase())) {
        return row;
      }
    }
    return null;
  }

  /**
   * Approve the first pending registration
   */
  async approveFirstRegistration(): Promise<void> {
    const approveButton = this.approveButtons.first();
    await expect(approveButton).toBeVisible({ timeout: 5000 });
    await approveButton.click();

    // Wait for success message or registration to be removed
    await this.page.waitForTimeout(1500);
  }

  /**
   * Approve a specific registration by row
   */
  async approveRegistration(row: Locator): Promise<void> {
    const approveButton = row.getByRole('button', { name: /approve/i });
    await approveButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Reject the first pending registration
   */
  async rejectFirstRegistration(): Promise<void> {
    const rejectButton = this.rejectButtons.first();
    await expect(rejectButton).toBeVisible({ timeout: 5000 });
    await rejectButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Reject a specific registration by row
   */
  async rejectRegistration(row: Locator): Promise<void> {
    const rejectButton = row.getByRole('button', { name: /reject/i });
    await rejectButton.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Refresh the registrations list
   */
  async refreshRegistrations(): Promise<void> {
    await this.registrationRefreshButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for success alert
   */
  async waitForSuccessAlert(): Promise<void> {
    await expect(this.successAlert).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    const text = await this.successAlert.textContent();
    return text?.trim() || '';
  }

  /**
   * Wait for error alert
   */
  async waitForErrorAlert(): Promise<void> {
    await expect(this.errorAlert).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const text = await this.errorAlert.textContent();
    return text?.trim() || '';
  }

  /**
   * Dismiss error alert
   */
  async dismissErrorAlert(): Promise<void> {
    const dismissButton = this.errorAlert.getByRole('button', { name: /dismiss/i });
    await dismissButton.click();
  }

  /**
   * Dismiss success alert
   */
  async dismissSuccessAlert(): Promise<void> {
    const dismissButton = this.successAlert.getByRole('button', { name: /dismiss/i });
    await dismissButton.click();
  }

  /**
   * Check if user is on admin page
   */
  isOnAdminPage(): boolean {
    return this.page.url().includes('/admin');
  }

  /**
   * Navigate to channel management
   */
  async goToChannelManagement(): Promise<void> {
    // Scroll to channel management if needed
    await this.channelManagementSection.scrollIntoViewIfNeeded();
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, description?: string): Promise<void> {
    await this.createChannelButton.click();

    const nameInput = this.page.getByPlaceholder(/channel name|name/i);
    await nameInput.fill(name);

    if (description) {
      const descInput = this.page.getByPlaceholder(/description/i);
      if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await descInput.fill(description);
      }
    }

    const submitButton = this.page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await this.page.waitForTimeout(1500);
  }
}
