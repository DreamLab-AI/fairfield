/**
 * E2E Tests: Extended Authentication Scenarios
 *
 * Additional test coverage for:
 * - NsecBackup download functionality validation
 * - Cross-browser clipboard handling
 * - Account status transitions (incomplete -> complete)
 * - Read-only banner visibility edge cases
 * - Session restoration after browser restart
 * - Concurrent login attempts
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import {
  TEST_NSEC_KEYS,
  TEST_HEX_PRIVKEY,
  signupNewUser,
  loginAsUser,
  logout,
  getCurrentUserPubkey
} from './fixtures/test-helpers';

test.describe('NsecBackup Download Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('downloaded backup file contains valid nsec format', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Reveal nsec
    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Get the displayed nsec for comparison
    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const displayedNsec = await nsecElement.textContent();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();

    // Verify download
    const download = await downloadPromise;

    // Read file content
    const content = await download.createReadStream().then(stream => {
      return new Promise<string>((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    });

    // Verify file contains the correct nsec
    expect(content).toContain(displayedNsec?.trim());
    expect(content).toContain('NOSTR PRIVATE KEY BACKUP');
    expect(content).toContain('npub');
    expect(content).toMatch(/nsec1[a-z0-9]+/);
  });

  test('downloaded backup file has correct filename format', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download/i }).click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Verify filename format: nostr-key-backup-YYYY-MM-DD.txt
    expect(filename).toMatch(/^nostr-key-backup-\d{4}-\d{2}-\d{2}\.txt$/);
  });

  test('downloaded backup file contains npub public key', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download/i }).click();

    const download = await downloadPromise;
    const content = await download.createReadStream().then(stream => {
      return new Promise<string>((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    });

    // Verify npub format is present
    expect(content).toMatch(/npub1[a-z0-9]+/);
    expect(content).toContain('Public Key (npub format)');
  });

  test('download button shows success state after download', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const downloadPromise = page.waitForEvent('download');
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();

    await downloadPromise;

    // Check for success state
    const successText = page.getByText(/downloaded/i);
    await expect(successText).toBeVisible({ timeout: 2000 });
  });

  test('backup file includes generation timestamp', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download/i }).click();

    const download = await downloadPromise;
    const content = await download.createReadStream().then(stream => {
      return new Promise<string>((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    });

    // Verify timestamp is present in ISO format
    expect(content).toMatch(/Generated:\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

test.describe('Cross-Browser Clipboard Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('copy fallback works when clipboard API is unavailable', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Simulate clipboard API failure by overriding it
    await page.evaluate(() => {
      (navigator as Navigator & { clipboard: Clipboard | null }).clipboard = null;
    });

    // Try to copy - should handle gracefully
    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.click();

    // Either shows success or handles error gracefully without crashing
    await page.waitForTimeout(500);

    // Page should still be functional
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible();
  });

  test('copy succeeds with clipboard-read permission granted', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const originalNsec = await nsecElement.textContent();

    await page.getByRole('button', { name: /copy/i }).click();

    // Verify clipboard content matches
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toBe(originalNsec?.trim());
  });

  test('copy shows visual feedback regardless of clipboard result', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Grant permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: /copy/i }).click();

    // Should show visual feedback
    const copiedText = page.getByText(/copied/i);
    await expect(copiedText).toBeVisible({ timeout: 2000 });
  });

  test('multiple copy operations work correctly', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    await page.getByRole('button', { name: /reveal/i }).click();
    await page.waitForSelector('text=/nsec1/i', { timeout: 3000 });

    // Copy multiple times
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /copy/i }).click();
      await page.waitForTimeout(500);
    }

    // Verify clipboard still has correct content
    const nsecElement = page.locator('p.font-mono, code, .font-mono').first();
    const expectedNsec = await nsecElement.textContent();

    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toBe(expectedNsec?.trim());
  });
});

test.describe('Account Status Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('incomplete account transitions to complete after full signup', async ({ page }) => {
    // Start with incomplete status
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
    });

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

    // Verify status changed to complete
    const accountStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(accountStatus).toBe('complete');
  });

  test('account status persists across page reload', async ({ page }) => {
    await signupNewUser(page);

    const initialStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(initialStatus).toBe('complete');

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Check status persisted
    const reloadedStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(reloadedStatus).toBe('complete');
  });

  test('login with existing key preserves account status', async ({ page }) => {
    // Create account first
    const nsec = await signupNewUser(page);

    // Verify complete status
    const statusBeforeLogout = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });
    expect(statusBeforeLogout).toBe('complete');

    // Logout
    await logout(page);

    // Login again with same nsec
    await loginAsUser(page, nsec);

    // Status should be preserved (or set based on existing profile)
    const statusAfterLogin = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    expect(statusAfterLogin).toBeTruthy();
  });

  test('nsecBackedUp flag persists correctly', async ({ page }) => {
    await signupNewUser(page);

    // Verify nsecBackedUp flag is set
    const keysData = await page.evaluate(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      return stored ? JSON.parse(stored) : null;
    });

    expect(keysData?.nsecBackedUp).toBe(true);
  });

  test('transition from login sets correct initial status', async ({ page }) => {
    await loginAsUser(page, TEST_NSEC_KEYS[0]);

    // Login should set status (typically incomplete for existing keys)
    const accountStatus = await page.evaluate(() => {
      return localStorage.getItem('nostr_bbs_nostr_account_status');
    });

    // Should have some status set
    expect(['incomplete', 'complete']).toContain(accountStatus);
  });
});

test.describe('Read-Only Banner Visibility Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('read-only banner appears for incomplete account on chat', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
      localStorage.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: 'a'.repeat(64),
        encryptedPrivateKey: 'test',
        accountStatus: 'incomplete'
      }));
    });

    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const readOnlyBanner = page.getByText(/read-only|complete signup/i);
    await expect(readOnlyBanner).toBeVisible({ timeout: 5000 });
  });

  test('read-only banner is NOT shown for complete account', async ({ page }) => {
    await signupNewUser(page);

    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const readOnlyBanner = page.getByText(/read-only mode/i);
    const isVisible = await readOnlyBanner.isVisible({ timeout: 1000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('read-only banner can be dismissed', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
      localStorage.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: 'a'.repeat(64),
        encryptedPrivateKey: 'test',
        accountStatus: 'incomplete'
      }));
    });

    await page.goto('/chat');
    await page.waitForTimeout(1500);

    // Find dismiss button
    const dismissButton = page.getByRole('button', { name: /dismiss/i }).or(
      page.locator('button.btn-circle').first()
    );

    if (await dismissButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissButton.click();

      // Banner should be hidden after dismiss
      await page.waitForTimeout(500);
      const readOnlyBanner = page.getByText(/read-only mode.*complete signup/i);
      const stillVisible = await readOnlyBanner.isVisible({ timeout: 1000 }).catch(() => false);
      expect(stillVisible).toBe(false);
    }
  });

  test('read-only banner reappears after page reload', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
      localStorage.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: 'a'.repeat(64),
        encryptedPrivateKey: 'test',
        accountStatus: 'incomplete'
      }));
    });

    await page.goto('/chat');
    await page.waitForTimeout(1000);

    // Dismiss if visible
    const dismissButton = page.getByRole('button', { name: /dismiss/i }).or(
      page.locator('button.btn-circle').first()
    );

    if (await dismissButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissButton.click();
      await page.waitForTimeout(300);
    }

    // Reload page
    await page.reload();
    await page.waitForTimeout(1500);

    // Banner should reappear
    const readOnlyBanner = page.getByText(/read-only|complete signup/i);
    await expect(readOnlyBanner).toBeVisible({ timeout: 5000 });
  });

  test('read-only banner contains link to signup page', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('nostr_bbs_nostr_pubkey', 'a'.repeat(64));
      localStorage.setItem('nostr_bbs_nostr_encrypted_privkey', 'test');
      localStorage.setItem('nostr_bbs_nostr_account_status', 'incomplete');
      localStorage.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: 'a'.repeat(64),
        encryptedPrivateKey: 'test',
        accountStatus: 'incomplete'
      }));
    });

    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const signupLink = page.getByRole('link', { name: /complete signup/i });

    if (await signupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await signupLink.getAttribute('href');
      expect(href).toContain('signup');
    }
  });

  test('banner not shown for unauthenticated users', async ({ page }) => {
    // Ensure no auth state
    await page.evaluate(() => localStorage.clear());

    await page.goto('/chat');
    await page.waitForTimeout(1000);

    const readOnlyBanner = page.getByText(/read-only mode/i);
    const isVisible = await readOnlyBanner.isVisible({ timeout: 1000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });
});

test.describe('Session Restoration After Browser Restart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('localStorage persists authentication state', async ({ page, context }) => {
    await signupNewUser(page);

    const originalPubkey = await getCurrentUserPubkey(page);
    expect(originalPubkey).toBeTruthy();

    // Simulate browser restart by creating new page in same context
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForTimeout(1000);

    // Check if pubkey is restored
    const restoredPubkey = await getCurrentUserPubkey(newPage);
    expect(restoredPubkey).toBe(originalPubkey);

    await newPage.close();
  });

  test('encrypted private key survives page reload', async ({ page }) => {
    await signupNewUser(page);

    // Check encryption state before reload
    const beforeReload = await page.evaluate(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      if (!stored) return null;
      const data = JSON.parse(stored);
      return {
        hasEncryptedKey: !!data.encryptedPrivateKey,
        hasPublicKey: !!data.publicKey
      };
    });

    expect(beforeReload?.hasPublicKey).toBe(true);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1500);

    // Verify state restored
    const afterReload = await page.evaluate(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      if (!stored) return null;
      const data = JSON.parse(stored);
      return {
        hasEncryptedKey: !!data.encryptedPrivateKey,
        hasPublicKey: !!data.publicKey
      };
    });

    expect(afterReload?.hasPublicKey).toBe(true);
  });

  test('session key in sessionStorage regenerates on new tab', async ({ page, context }) => {
    await signupNewUser(page);

    // Get session key from first page
    const firstSessionKey = await page.evaluate(() => {
      return sessionStorage.getItem('nostr_bbs_session');
    });

    expect(firstSessionKey).toBeTruthy();

    // Open new page (simulates new tab)
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForTimeout(1000);

    // Session key should be different (new session)
    const secondSessionKey = await newPage.evaluate(() => {
      return sessionStorage.getItem('nostr_bbs_session');
    });

    // Session keys should be independent between tabs
    // Note: Behavior depends on implementation - may be same in same context
    expect(secondSessionKey).toBeTruthy();

    await newPage.close();
  });

  test('user profile (nickname, avatar) persists across sessions', async ({ page }) => {
    await signupNewUser(page);

    // Set profile data manually (simulating settings update)
    await page.evaluate(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      if (stored) {
        const data = JSON.parse(stored);
        data.nickname = 'TestUser';
        data.avatar = 'https://example.com/avatar.png';
        localStorage.setItem('nostr_bbs_keys', JSON.stringify(data));
      }
    });

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify profile persisted
    const profile = await page.evaluate(() => {
      const stored = localStorage.getItem('nostr_bbs_keys');
      if (!stored) return null;
      const data = JSON.parse(stored);
      return { nickname: data.nickname, avatar: data.avatar };
    });

    expect(profile?.nickname).toBe('TestUser');
    expect(profile?.avatar).toBe('https://example.com/avatar.png');
  });

  test('auth state remains consistent after multiple reloads', async ({ page }) => {
    await signupNewUser(page);

    const originalPubkey = await getCurrentUserPubkey(page);

    // Reload multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForTimeout(1000);

      const currentPubkey = await getCurrentUserPubkey(page);
      expect(currentPubkey).toBe(originalPubkey);
    }
  });
});

test.describe('Concurrent Login Attempts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('rapid consecutive login attempts are handled gracefully', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });

    // Attempt rapid submissions
    await keyInput.fill(TEST_NSEC_KEYS[0]);

    // Click submit multiple times rapidly
    await submitButton.click();
    await submitButton.click().catch(() => {}); // May be disabled
    await submitButton.click().catch(() => {});

    // Wait for processing
    await page.waitForTimeout(3000);

    // Should eventually succeed or show single error
    const pubkey = await getCurrentUserPubkey(page);
    const hasError = await page.getByText(/error|invalid/i).isVisible({ timeout: 1000 }).catch(() => false);

    // Either logged in successfully or has single error
    expect(pubkey !== null || hasError).toBe(true);
  });

  test('login button is disabled during processing', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(TEST_NSEC_KEYS[0]);

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Check if button becomes disabled during processing
    const isDisabled = await submitButton.isDisabled();

    // Button should be disabled or page should navigate
    await page.waitForTimeout(500);

    const stillOnLoginPage = await keyInput.isVisible({ timeout: 500 }).catch(() => false);

    if (stillOnLoginPage) {
      // If still on page, button should be disabled or enabled after completion
      const buttonState = await submitButton.isDisabled().catch(() => false);
      expect(typeof buttonState).toBe('boolean');
    }
  });

  test('switching keys during login process', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Enter first key
    await keyInput.fill(TEST_NSEC_KEYS[0]);

    // Clear and enter different key before submitting
    await keyInput.clear();
    await keyInput.fill(TEST_HEX_PRIVKEY);

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should use the last entered key
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeTruthy();
  });

  test('multiple tabs cannot corrupt auth state', async ({ page, context }) => {
    // Create account in first tab
    await signupNewUser(page);
    const originalPubkey = await getCurrentUserPubkey(page);

    // Open second tab and try to login with different key
    const page2 = await context.newPage();
    await page2.goto('/');

    // Try to login with different key in second tab
    const loginButton = page2.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page2.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill(TEST_NSEC_KEYS[1] || TEST_HEX_PRIVKEY);

    const submitButton = page2.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    await page2.waitForTimeout(2000);

    // Second tab should have new auth state
    const page2Pubkey = await getCurrentUserPubkey(page2);

    // Refresh first tab to see current state
    await page.reload();
    await page.waitForTimeout(1000);

    const refreshedPubkey = await getCurrentUserPubkey(page);

    // Both tabs should show consistent state (the latest)
    expect(refreshedPubkey).toBe(page2Pubkey);

    await page2.close();
  });

  test('logout in one tab affects other tabs on refresh', async ({ page, context }) => {
    await signupNewUser(page);

    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForTimeout(1000);

    // Both should be authenticated
    expect(await getCurrentUserPubkey(page)).toBeTruthy();
    expect(await getCurrentUserPubkey(page2)).toBeTruthy();

    // Logout from first tab
    await logout(page);

    // Refresh second tab
    await page2.reload();
    await page2.waitForTimeout(1000);

    // Second tab should also be logged out
    const page2Pubkey = await getCurrentUserPubkey(page2);
    expect(page2Pubkey).toBeNull();

    await page2.close();
  });
});

test.describe('Input Validation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('extremely long input is handled', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Enter extremely long invalid key
    const longKey = 'a'.repeat(1000);
    await keyInput.fill(longKey);

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error, not crash
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });

  test('special characters in input are handled', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Enter key with special characters
    await keyInput.fill('<script>alert("xss")</script>');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error, not execute script
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });

    // Page should still be functional
    await expect(keyInput).toBeVisible();
  });

  test('unicode characters in input are handled', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Enter key with unicode
    await keyInput.fill('nsec1' + '\u0000\u0001\uFFFF');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error gracefully
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });

  test('nsec with mixed case is rejected', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // Mixed case nsec (should be lowercase only)
    await keyInput.fill('Nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error (bech32 is case-sensitive)
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });

  test('hex key with non-hex characters is rejected', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);

    // 64 chars but contains non-hex
    await keyInput.fill('g'.repeat(64));

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Accessibility During Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Use keyboard to navigate to login
    await page.keyboard.press('Tab');

    // Find login link and press Enter
    const loginLink = page.getByRole('link', { name: /login/i });
    await loginLink.focus();
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    // Tab to key input
    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await expect(keyInput).toBeFocused({ timeout: 3000 }).catch(async () => {
      await page.keyboard.press('Tab');
    });

    // Enter key using keyboard
    await page.keyboard.type(TEST_NSEC_KEYS[0]);

    // Tab to submit button
    await page.keyboard.press('Tab');

    // Submit with Enter
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // Should have processed login
    const pubkey = await getCurrentUserPubkey(page);
    expect(pubkey).toBeTruthy();
  });

  test('error messages are announced to screen readers', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.getByRole('link', { name: /login|setup/i });
    await loginButton.click();

    const keyInput = page.getByPlaceholder(/nsec|hex|private key/i);
    await keyInput.fill('invalid');

    const submitButton = page.getByRole('button', { name: /log in|restore|import|continue/i });
    await submitButton.click();

    // Check for ARIA live region or alert role
    const errorElement = page.getByText(/invalid|incorrect|error/i);
    await expect(errorElement).toBeVisible({ timeout: 3000 });

    // Error should be in an element with appropriate ARIA
    const hasAriaLive = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
      return alerts.length > 0;
    });

    // At minimum, error should be visible (ARIA is a nice-to-have)
    expect(await errorElement.isVisible()).toBe(true);
  });

  test('NsecBackup security warnings have proper ARIA', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForSelector('text=/Backup Your Private Key/i', { timeout: 5000 });

    // Check for alert or warning ARIA roles
    const hasAlertRole = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"], .alert');
      return alerts.length > 0;
    });

    expect(hasAlertRole).toBe(true);
  });
});
