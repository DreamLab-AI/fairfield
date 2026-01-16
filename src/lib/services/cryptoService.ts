/**
 * CryptoService - Wrapper for Web Worker crypto operations
 *
 * Provides a promise-based API for crypto operations that run in a Web Worker
 * to prevent blocking the main thread during intensive encryption/decryption.
 */

import type { CryptoWorkerRequest, CryptoWorkerResponse } from '$lib/workers/crypto.worker';

type PendingRequest = {
  resolve: (value: string | Uint8Array) => void;
  reject: (error: Error) => void;
};

class CryptoService {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private isReady = false;
  private readyPromise: Promise<void>;
  private readyResolve: (() => void) | null = null;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined') {
      // SSR environment - worker not available
      return;
    }

    try {
      this.worker = new Worker(
        new URL('../workers/crypto.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent<CryptoWorkerResponse | { type: string }>) => {
        const data = e.data;

        // Handle ready signal
        if ('type' in data && data.type === 'ready') {
          this.isReady = true;
          this.readyResolve?.();
          return;
        }

        // Handle response
        const response = data as CryptoWorkerResponse;
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);

          if (response.success && response.result !== undefined) {
            pending.resolve(response.result);
          } else {
            pending.reject(new Error(response.error || 'Unknown worker error'));
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('Crypto worker error:', error);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error('Worker error: ' + error.message));
          this.pendingRequests.delete(id);
        }
      };
    } catch (error) {
      console.error('Failed to initialize crypto worker:', error);
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.isReady) {
      await this.readyPromise;
    }
  }

  private generateRequestId(): string {
    return `crypto-${++this.requestId}-${Date.now()}`;
  }

  private async sendRequest(request: Omit<CryptoWorkerRequest, 'id'>): Promise<string | Uint8Array> {
    await this.ensureReady();

    if (!this.worker) {
      throw new Error('Crypto worker not available');
    }

    const id = this.generateRequestId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const fullRequest: CryptoWorkerRequest = { ...request, id };
      this.worker!.postMessage(fullRequest);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Crypto operation timed out'));
        }
      }, 30000);
    });
  }

  /**
   * NIP-04 encrypt - REMOVED
   *
   * NIP-04 was removed on 2025-12-01. Use encrypt44() instead.
   */
  async encrypt(_privkey: string, _pubkey: string, _content: string): Promise<never> {
    throw new Error(
      'NIP-04 encryption was removed on 2025-12-01. ' +
      'Use encrypt44() with a conversation key from getConversationKey().'
    );
  }

  /**
   * NIP-04 decrypt - REMOVED
   *
   * NIP-04 was removed on 2025-12-01. Use decrypt44() instead.
   */
  async decrypt(_privkey: string, _pubkey: string, _ciphertext: string): Promise<never> {
    throw new Error(
      'NIP-04 decryption was removed on 2025-12-01. ' +
      'Use decrypt44() with a conversation key from getConversationKey().'
    );
  }

  /**
   * NIP-44 encrypt (recommended for new implementations)
   */
  async encrypt44(conversationKey: Uint8Array, content: string): Promise<string> {
    const result = await this.sendRequest({
      type: 'encrypt44',
      payload: { conversationKey, content }
    });
    return result as string;
  }

  /**
   * NIP-44 decrypt (recommended for new implementations)
   */
  async decrypt44(conversationKey: Uint8Array, ciphertext: string): Promise<string> {
    const result = await this.sendRequest({
      type: 'decrypt44',
      payload: { conversationKey, ciphertext }
    });
    return result as string;
  }

  /**
   * Get NIP-44 conversation key for a key pair
   */
  async getConversationKey(privkey: string, pubkey: string): Promise<Uint8Array> {
    const result = await this.sendRequest({
      type: 'getConversationKey',
      payload: { privkey, pubkey }
    });
    return result as Uint8Array;
  }

  /**
   * Check if worker is available and ready
   */
  get available(): boolean {
    return this.worker !== null && this.isReady;
  }

  /**
   * Get number of pending requests
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Terminate the worker and cleanup
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error('Worker terminated'));
        this.pendingRequests.delete(id);
      }

      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const cryptoService = new CryptoService();

// Export types
export type { CryptoWorkerRequest, CryptoWorkerResponse };
