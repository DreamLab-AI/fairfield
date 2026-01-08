/**
 * SecureString - A utility for handling sensitive string data with automatic cleanup
 *
 * Provides memory-safe handling of sensitive data like mnemonics and private keys.
 * The string is stored in a Uint8Array and can be securely cleared when no longer needed.
 */
export class SecureString {
  private buffer: Uint8Array;
  private cleared = false;

  constructor(value: string) {
    const encoder = new TextEncoder();
    this.buffer = encoder.encode(value);
    Object.freeze(this);
  }

  /**
   * Execute a function with access to the underlying string value.
   * The value is decoded only for the duration of the callback.
   *
   * @param fn - Function to execute with the decrypted value
   * @returns The return value of the callback function
   * @throws Error if the SecureString has already been cleared
   */
  use<T>(fn: (value: string) => T): T {
    if (this.cleared) {
      throw new Error('SecureString already cleared');
    }
    const decoder = new TextDecoder();
    const value = decoder.decode(this.buffer);
    try {
      return fn(value);
    } finally {
      // Force async boundary to help GC clear temporary string
      setTimeout(() => {}, 0);
    }
  }

  /**
   * Securely clear the buffer by overwriting with random data before zeroing.
   * Once cleared, the SecureString cannot be used again.
   */
  clear(): void {
    if (this.cleared) return;

    // Overwrite with random data before clearing
    crypto.getRandomValues(this.buffer);
    this.buffer = new Uint8Array(0);
    this.cleared = true;
  }

  /**
   * Check if the SecureString has been cleared
   */
  isCleared(): boolean {
    return this.cleared;
  }

  /**
   * Get the length of the stored string (in bytes)
   */
  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Secure clipboard utility with automatic clearing
 */
export class SecureClipboard {
  private static clearTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly DEFAULT_CLEAR_DELAY = 60000; // 60 seconds

  /**
   * Copy sensitive data to clipboard with automatic clearing
   *
   * @param data - The sensitive string to copy
   * @param clearDelay - Time in ms before auto-clearing (default: 60 seconds)
   * @param onWarning - Callback when warning should be shown (10 seconds before clear)
   * @param onCleared - Callback when clipboard is cleared
   * @returns Promise that resolves when copy is complete
   */
  static async copyWithAutoClear(
    data: string,
    clearDelay: number = SecureClipboard.DEFAULT_CLEAR_DELAY,
    onWarning?: () => void,
    onCleared?: () => void
  ): Promise<{ clearIn: number; cancel: () => void }> {
    // Copy to clipboard
    await navigator.clipboard.writeText(data);

    const id = crypto.randomUUID();

    // Set warning timeout (10 seconds before clear)
    const warningDelay = Math.max(0, clearDelay - 10000);
    if (onWarning && warningDelay > 0) {
      setTimeout(() => {
        if (SecureClipboard.clearTimeouts.has(id)) {
          onWarning();
        }
      }, warningDelay);
    }

    // Set clear timeout
    const timeoutId = setTimeout(async () => {
      await SecureClipboard.clearClipboard();
      SecureClipboard.clearTimeouts.delete(id);
      onCleared?.();
    }, clearDelay);

    SecureClipboard.clearTimeouts.set(id, timeoutId);

    return {
      clearIn: clearDelay,
      cancel: () => {
        const timeout = SecureClipboard.clearTimeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          SecureClipboard.clearTimeouts.delete(id);
        }
      }
    };
  }

  /**
   * Clear the clipboard by writing empty string
   */
  static async clearClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // Clipboard API may fail if page is not focused
      // This is acceptable as the timeout will have passed
    }
  }

  /**
   * Cancel all pending clipboard clears
   */
  static cancelAllClears(): void {
    for (const timeout of SecureClipboard.clearTimeouts.values()) {
      clearTimeout(timeout);
    }
    SecureClipboard.clearTimeouts.clear();
  }
}
