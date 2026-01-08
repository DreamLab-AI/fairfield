/**
 * Subscription Manager
 * Manages Nostr relay subscriptions with auto-cleanup, reconnection, and lifecycle management.
 * Provides a high-level interface for subscription handling.
 */

import type { NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { subscribe, isConnected, connectionState } from './relay';
import { writable, derived, get, type Writable, type Readable } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

/**
 * Subscription state
 */
export type SubscriptionState =
  | 'idle'
  | 'active'
  | 'paused'
  | 'reconnecting'
  | 'closed'
  | 'error';

/**
 * Subscription metadata
 */
export interface SubscriptionMeta {
  id: string;
  filters: NDKFilter[];
  state: SubscriptionState;
  createdAt: number;
  lastEventAt: number | null;
  eventCount: number;
  eoseReceived: boolean;
  reconnectAttempts: number;
  error: string | null;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Subscription ID (auto-generated if not provided) */
  id?: string;
  /** Close subscription after EOSE */
  closeOnEose?: boolean;
  /** Enable auto-reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Subscription timeout in ms (default: none) */
  timeout?: number;
  /** Group with other subscriptions */
  groupable?: boolean;
}

/**
 * Subscription event handlers
 */
export interface SubscriptionHandlers<T = NDKEvent> {
  onEvent: (event: T) => void;
  onEose?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

// Import NDKEvent type
import type { NDKEvent } from '@nostr-dev-kit/ndk';

// ============================================================================
// Subscription Wrapper
// ============================================================================

class ManagedSubscription {
  readonly id: string;
  readonly filters: NDKFilter[];
  private ndkSub: NDKSubscription | null = null;
  private handlers: SubscriptionHandlers;
  private options: Required<SubscriptionOptions>;
  private meta: SubscriptionMeta;
  private metaStore: Writable<SubscriptionMeta>;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscriptionTimeout: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeConnection: (() => void) | null = null;

  constructor(
    filters: NDKFilter | NDKFilter[],
    handlers: SubscriptionHandlers,
    options: SubscriptionOptions = {}
  ) {
    this.id = options.id ?? this.generateId();
    this.filters = Array.isArray(filters) ? filters : [filters];
    this.handlers = handlers;
    this.options = {
      id: this.id,
      closeOnEose: options.closeOnEose ?? false,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      timeout: options.timeout ?? 0,
      groupable: options.groupable ?? true
    };

    this.meta = {
      id: this.id,
      filters: this.filters,
      state: 'idle',
      createdAt: Date.now(),
      lastEventAt: null,
      eventCount: 0,
      eoseReceived: false,
      reconnectAttempts: 0,
      error: null
    };

    this.metaStore = writable(this.meta);
  }

  /**
   * Start the subscription
   */
  start(): void {
    if (this.meta.state === 'active') {
      console.warn(`[SubManager] Subscription ${this.id} already active`);
      return;
    }

    if (!isConnected()) {
      this.updateMeta({ state: 'error', error: 'Not connected to relay' });
      this.scheduleReconnect();
      return;
    }

    try {
      this.ndkSub = subscribe(this.filters, {
        closeOnEose: this.options.closeOnEose,
        groupable: this.options.groupable,
        subId: this.id
      });

      this.setupEventHandlers();
      this.updateMeta({ state: 'active', error: null, reconnectAttempts: 0 });

      // Setup timeout if specified
      if (this.options.timeout > 0) {
        this.subscriptionTimeout = setTimeout(() => {
          console.warn(`[SubManager] Subscription ${this.id} timed out`);
          this.close();
        }, this.options.timeout);
      }

      // Watch for connection changes
      this.unsubscribeConnection = connectionState.subscribe((status) => {
        if (status.state === 'disconnected' || status.state === 'error') {
          if (this.meta.state === 'active' && this.options.autoReconnect) {
            this.updateMeta({ state: 'reconnecting' });
            this.scheduleReconnect();
          }
        } else if (status.state === 'connected' || status.state === 'authenticated') {
          if (this.meta.state === 'reconnecting') {
            this.restart();
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateMeta({ state: 'error', error: errorMessage });
      this.handlers.onError?.(error instanceof Error ? error : new Error(errorMessage));
      this.scheduleReconnect();
    }
  }

  /**
   * Pause the subscription
   */
  pause(): void {
    if (this.meta.state !== 'active') return;

    this.ndkSub?.stop();
    this.updateMeta({ state: 'paused' });
  }

  /**
   * Resume a paused subscription
   */
  resume(): void {
    if (this.meta.state !== 'paused') return;

    this.start();
  }

  /**
   * Restart the subscription
   */
  restart(): void {
    this.stop();
    this.start();
  }

  /**
   * Stop the subscription (can be restarted)
   */
  stop(): void {
    this.clearTimeouts();
    this.ndkSub?.stop();
    this.ndkSub = null;
    this.updateMeta({ state: 'idle' });
  }

  /**
   * Close the subscription permanently
   */
  close(): void {
    this.clearTimeouts();
    this.unsubscribeConnection?.();
    this.ndkSub?.stop();
    this.ndkSub = null;
    this.updateMeta({ state: 'closed' });
    this.handlers.onClose?.();
  }

  /**
   * Get subscription metadata store
   */
  getMeta(): Readable<SubscriptionMeta> {
    return { subscribe: this.metaStore.subscribe };
  }

  /**
   * Get current metadata
   */
  getMetaSync(): SubscriptionMeta {
    return this.meta;
  }

  private setupEventHandlers(): void {
    if (!this.ndkSub) return;

    this.ndkSub.on('event', (event: NDKEvent) => {
      this.updateMeta({
        lastEventAt: Date.now(),
        eventCount: this.meta.eventCount + 1
      });
      this.handlers.onEvent(event);
    });

    this.ndkSub.on('eose', () => {
      this.updateMeta({ eoseReceived: true });
      this.handlers.onEose?.();

      if (this.options.closeOnEose) {
        this.close();
      }
    });

    this.ndkSub.on('close', () => {
      if (this.meta.state === 'active' && this.options.autoReconnect) {
        this.updateMeta({ state: 'reconnecting' });
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.options.autoReconnect) return;
    if (this.meta.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.updateMeta({
        state: 'error',
        error: `Max reconnection attempts (${this.options.maxReconnectAttempts}) exceeded`
      });
      return;
    }

    const delay = this.options.reconnectDelay * Math.pow(2, this.meta.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      this.updateMeta({ reconnectAttempts: this.meta.reconnectAttempts + 1 });
      this.start();
    }, delay);
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.subscriptionTimeout) {
      clearTimeout(this.subscriptionTimeout);
      this.subscriptionTimeout = null;
    }
  }

  private updateMeta(updates: Partial<SubscriptionMeta>): void {
    this.meta = { ...this.meta, ...updates };
    this.metaStore.set(this.meta);
  }

  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// ============================================================================
// Subscription Manager
// ============================================================================

class SubscriptionManager {
  private subscriptions: Map<string, ManagedSubscription> = new Map();
  private statsStore: Writable<SubscriptionManagerStats>;

  constructor() {
    this.statsStore = writable(this.calculateStats());
  }

  /**
   * Create and start a new subscription
   */
  create(
    filters: NDKFilter | NDKFilter[],
    handlers: SubscriptionHandlers,
    options?: SubscriptionOptions
  ): ManagedSubscription {
    const sub = new ManagedSubscription(filters, handlers, options);

    // Remove any existing subscription with same ID
    if (this.subscriptions.has(sub.id)) {
      this.subscriptions.get(sub.id)?.close();
    }

    this.subscriptions.set(sub.id, sub);
    sub.start();
    this.updateStats();

    return sub;
  }

  /**
   * Get subscription by ID
   */
  get(id: string): ManagedSubscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Close subscription by ID
   */
  close(id: string): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;

    sub.close();
    this.subscriptions.delete(id);
    this.updateStats();
    return true;
  }

  /**
   * Close all subscriptions
   */
  closeAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.close();
    }
    this.subscriptions.clear();
    this.updateStats();
  }

  /**
   * Pause all subscriptions
   */
  pauseAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.pause();
    }
    this.updateStats();
  }

  /**
   * Resume all paused subscriptions
   */
  resumeAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.resume();
    }
    this.updateStats();
  }

  /**
   * Get all subscription IDs
   */
  getIds(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get count of subscriptions by state
   */
  getCountByState(state: SubscriptionState): number {
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.getMetaSync().state === state) count++;
    }
    return count;
  }

  /**
   * Get manager statistics
   */
  getStats(): Readable<SubscriptionManagerStats> {
    return { subscribe: this.statsStore.subscribe };
  }

  /**
   * Cleanup idle or error subscriptions
   */
  cleanup(): number {
    let cleaned = 0;
    for (const [id, sub] of this.subscriptions) {
      const state = sub.getMetaSync().state;
      if (state === 'closed' || state === 'error') {
        sub.close();
        this.subscriptions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.updateStats();
    }
    return cleaned;
  }

  private calculateStats(): SubscriptionManagerStats {
    const stats: SubscriptionManagerStats = {
      total: this.subscriptions.size,
      active: 0,
      paused: 0,
      reconnecting: 0,
      error: 0,
      totalEvents: 0
    };

    for (const sub of this.subscriptions.values()) {
      const meta = sub.getMetaSync();
      stats.totalEvents += meta.eventCount;

      switch (meta.state) {
        case 'active':
          stats.active++;
          break;
        case 'paused':
          stats.paused++;
          break;
        case 'reconnecting':
          stats.reconnecting++;
          break;
        case 'error':
          stats.error++;
          break;
      }
    }

    return stats;
  }

  private updateStats(): void {
    this.statsStore.set(this.calculateStats());
  }
}

/**
 * Manager statistics
 */
export interface SubscriptionManagerStats {
  total: number;
  active: number;
  paused: number;
  reconnecting: number;
  error: number;
  totalEvents: number;
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

const subscriptionManagerInstance = new SubscriptionManager();

/**
 * Create a new managed subscription
 */
export function createSubscription(
  filters: NDKFilter | NDKFilter[],
  handlers: SubscriptionHandlers,
  options?: SubscriptionOptions
): ManagedSubscription {
  return subscriptionManagerInstance.create(filters, handlers, options);
}

/**
 * Get subscription by ID
 */
export function getSubscription(id: string): ManagedSubscription | undefined {
  return subscriptionManagerInstance.get(id);
}

/**
 * Close subscription by ID
 */
export function closeSubscription(id: string): boolean {
  return subscriptionManagerInstance.close(id);
}

/**
 * Close all subscriptions
 */
export function closeAllSubscriptions(): void {
  subscriptionManagerInstance.closeAll();
}

/**
 * Pause all subscriptions
 */
export function pauseAllSubscriptions(): void {
  subscriptionManagerInstance.pauseAll();
}

/**
 * Resume all subscriptions
 */
export function resumeAllSubscriptions(): void {
  subscriptionManagerInstance.resumeAll();
}

/**
 * Get subscription manager statistics
 */
export function getSubscriptionStats(): Readable<SubscriptionManagerStats> {
  return subscriptionManagerInstance.getStats();
}

/**
 * Cleanup stale subscriptions
 */
export function cleanupSubscriptions(): number {
  return subscriptionManagerInstance.cleanup();
}

/**
 * Export manager instance for advanced usage
 */
export const subscriptionManager = subscriptionManagerInstance;

export default subscriptionManagerInstance;

// ============================================================================
// Convenience Subscription Factories
// ============================================================================

/**
 * Create a one-shot subscription that closes after EOSE
 */
export function createOneShotSubscription(
  filters: NDKFilter | NDKFilter[],
  handlers: SubscriptionHandlers,
  options?: Omit<SubscriptionOptions, 'closeOnEose'>
): ManagedSubscription {
  return createSubscription(filters, handlers, {
    ...options,
    closeOnEose: true,
    autoReconnect: false
  });
}

/**
 * Create a persistent subscription with auto-reconnection
 */
export function createPersistentSubscription(
  filters: NDKFilter | NDKFilter[],
  handlers: SubscriptionHandlers,
  options?: SubscriptionOptions
): ManagedSubscription {
  return createSubscription(filters, handlers, {
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 2000,
    ...options,
    closeOnEose: false
  });
}

/**
 * Create a timed subscription that closes after a timeout
 */
export function createTimedSubscription(
  filters: NDKFilter | NDKFilter[],
  handlers: SubscriptionHandlers,
  timeoutMs: number,
  options?: Omit<SubscriptionOptions, 'timeout'>
): ManagedSubscription {
  return createSubscription(filters, handlers, {
    ...options,
    timeout: timeoutMs,
    autoReconnect: false
  });
}
