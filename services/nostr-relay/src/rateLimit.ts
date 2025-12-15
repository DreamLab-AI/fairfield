/**
 * Rate Limiter for Nostr Relay
 *
 * Implements sliding window rate limiting with:
 * - Events per second limit per IP
 * - Concurrent connections limit per IP
 * - Automatic cleanup of expired entries
 * - Thread-safe concurrent access
 */

interface RateLimitConfig {
  eventsPerSecond: number;
  maxConcurrentConnections: number;
  cleanupIntervalMs: number;
}

interface EventWindow {
  timestamps: number[];
  lastCleanup: number;
}

interface ConnectionTracker {
  count: number;
  lastAccess: number;
}

export class RateLimiter {
  private eventWindows: Map<string, EventWindow>;
  private connectionCounts: Map<string, ConnectionTracker>;
  private config: RateLimitConfig;
  private cleanupTimer: NodeJS.Timeout | null;
  private readonly WINDOW_SIZE_MS = 1000; // 1 second sliding window
  private readonly ENTRY_TTL_MS = 60000; // Keep entries for 60 seconds after last access

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      eventsPerSecond: parseInt(process.env.RATE_LIMIT_EVENTS_PER_SECOND || '10', 10),
      maxConcurrentConnections: parseInt(process.env.RATE_LIMIT_MAX_CONNECTIONS || '20', 10),
      cleanupIntervalMs: parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || '30000', 10),
      ...config,
    };

    this.eventWindows = new Map();
    this.connectionCounts = new Map();
    this.cleanupTimer = null;

    this.startCleanupTimer();
  }

  /**
   * Check if an event from the given IP is allowed
   * Uses sliding window algorithm for precise rate limiting
   */
  checkEventLimit(ip: string): boolean {
    const now = Date.now();

    // Get or create event window for this IP
    let window = this.eventWindows.get(ip);
    if (!window) {
      window = { timestamps: [], lastCleanup: now };
      this.eventWindows.set(ip, window);
    }

    // Remove timestamps outside the sliding window
    const windowStart = now - this.WINDOW_SIZE_MS;
    window.timestamps = window.timestamps.filter(ts => ts > windowStart);
    window.lastCleanup = now;

    // Check if rate limit is exceeded
    if (window.timestamps.length >= this.config.eventsPerSecond) {
      return false;
    }

    // Add current timestamp
    window.timestamps.push(now);
    return true;
  }

  /**
   * Track a new connection from the given IP
   * Returns false if connection limit is exceeded
   */
  trackConnection(ip: string): boolean {
    const now = Date.now();

    let tracker = this.connectionCounts.get(ip);
    if (!tracker) {
      tracker = { count: 0, lastAccess: now };
      this.connectionCounts.set(ip, tracker);
    }

    // Check if connection limit is exceeded
    if (tracker.count >= this.config.maxConcurrentConnections) {
      return false;
    }

    // Increment connection count
    tracker.count++;
    tracker.lastAccess = now;
    return true;
  }

  /**
   * Release a connection from the given IP
   */
  releaseConnection(ip: string): void {
    const tracker = this.connectionCounts.get(ip);
    if (tracker && tracker.count > 0) {
      tracker.count--;
      tracker.lastAccess = Date.now();

      // Remove entry if no connections remain
      if (tracker.count === 0) {
        this.connectionCounts.delete(ip);
      }
    }
  }

  /**
   * Get current connection count for an IP
   */
  getConnectionCount(ip: string): number {
    const tracker = this.connectionCounts.get(ip);
    return tracker ? tracker.count : 0;
  }

  /**
   * Get current event rate for an IP (events in last second)
   */
  getEventRate(ip: string): number {
    const window = this.eventWindows.get(ip);
    if (!window) return 0;

    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;
    return window.timestamps.filter(ts => ts > windowStart).length;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Prevent the timer from keeping the process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const expiryTime = now - this.ENTRY_TTL_MS;

    // Clean up event windows
    const eventEntries = Array.from(this.eventWindows.entries());
    for (const [ip, window] of eventEntries) {
      // Remove old timestamps
      const windowStart = now - this.WINDOW_SIZE_MS;
      window.timestamps = window.timestamps.filter(ts => ts > windowStart);

      // Remove entry if no recent activity
      if (window.lastCleanup < expiryTime && window.timestamps.length === 0) {
        this.eventWindows.delete(ip);
      }
    }

    // Clean up connection trackers
    const connectionEntries = Array.from(this.connectionCounts.entries());
    for (const [ip, tracker] of connectionEntries) {
      // Remove entry if no connections and no recent activity
      if (tracker.count === 0 && tracker.lastAccess < expiryTime) {
        this.connectionCounts.delete(ip);
      }
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    trackedIPs: number;
    activeConnections: number;
    config: RateLimitConfig;
  } {
    let totalConnections = 0;
    const trackers = Array.from(this.connectionCounts.values());
    for (const tracker of trackers) {
      totalConnections += tracker.count;
    }

    return {
      trackedIPs: this.eventWindows.size + this.connectionCounts.size,
      activeConnections: totalConnections,
      config: this.config,
    };
  }

  /**
   * Stop cleanup timer and clear all data
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.eventWindows.clear();
    this.connectionCounts.clear();
  }

  /**
   * Reset rate limits for a specific IP (for testing/admin purposes)
   */
  resetIP(ip: string): void {
    this.eventWindows.delete(ip);
    this.connectionCounts.delete(ip);
  }

  /**
   * Reset all rate limits (for testing purposes)
   */
  resetAll(): void {
    this.eventWindows.clear();
    this.connectionCounts.clear();
  }
}
