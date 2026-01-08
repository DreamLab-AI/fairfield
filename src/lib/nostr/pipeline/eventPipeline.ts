/**
 * Event Pipeline
 * Handles event processing with deduplication, batching, and validation.
 * Provides a clean interface for processing Nostr events efficiently.
 */

import type { Event } from '$lib/types/nostr';
import { verifyEventSignature } from '../events';

// ============================================================================
// Types
// ============================================================================

/**
 * Pipeline stage that processes events
 */
export type PipelineStage<T = Event> = (event: T) => T | null | Promise<T | null>;

/**
 * Batch processor callback
 */
export type BatchProcessor<T = Event> = (events: T[]) => void | Promise<void>;

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Enable deduplication (default: true) */
  deduplicate?: boolean;
  /** Maximum events to cache for deduplication */
  dedupeMaxSize?: number;
  /** Deduplication cache TTL in ms (default: 5 minutes) */
  dedupeTTL?: number;
  /** Enable signature verification (default: true) */
  verifySignatures?: boolean;
  /** Enable batching (default: false) */
  enableBatching?: boolean;
  /** Batch size (default: 50) */
  batchSize?: number;
  /** Batch timeout in ms (default: 100) */
  batchTimeout?: number;
  /** Maximum concurrent processing (default: 10) */
  concurrency?: number;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  processed: number;
  deduplicated: number;
  invalidSignatures: number;
  errors: number;
  batchesProcessed: number;
  avgProcessingTime: number;
}

// ============================================================================
// Deduplication Cache
// ============================================================================

interface CacheEntry {
  timestamp: number;
}

class DeduplicationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttl: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize: number = 10000, ttlMs: number = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
    this.startCleanup();
  }

  /**
   * Check if event ID exists in cache
   */
  has(eventId: string): boolean {
    const entry = this.cache.get(eventId);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * Add event ID to cache
   */
  add(eventId: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(eventId, { timestamp: Date.now() });
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  private evictOldest(): void {
    const now = Date.now();
    let oldestKey: string | null = null;
    let oldestTime = now;

    // First pass: remove expired entries
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      } else if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    // If still at capacity, remove oldest
    if (this.cache.size >= this.maxSize && oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }
}

// ============================================================================
// Batch Processor
// ============================================================================

class BatchCollector<T> {
  private batch: T[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchSize: number;
  private readonly batchTimeout: number;
  private readonly processor: BatchProcessor<T>;

  constructor(
    processor: BatchProcessor<T>,
    batchSize: number = 50,
    batchTimeout: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  /**
   * Add item to batch
   */
  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }

  /**
   * Force flush current batch
   */
  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.batch.length === 0) return;

    const toProcess = this.batch;
    this.batch = [];

    // Process asynchronously to not block
    Promise.resolve(this.processor(toProcess)).catch((error) => {
      console.error('[EventPipeline] Batch processing error:', error);
    });
  }

  /**
   * Get pending batch size
   */
  get pendingSize(): number {
    return this.batch.length;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.batch = [];
  }
}

// ============================================================================
// Event Pipeline
// ============================================================================

export class EventPipeline {
  private readonly config: Required<PipelineConfig>;
  private readonly dedupeCache: DeduplicationCache;
  private readonly stages: PipelineStage[] = [];
  private batchCollector: BatchCollector<Event> | null = null;
  private stats: PipelineStats = {
    processed: 0,
    deduplicated: 0,
    invalidSignatures: 0,
    errors: 0,
    batchesProcessed: 0,
    avgProcessingTime: 0
  };
  private processingTimes: number[] = [];
  private readonly maxTimeSamples = 100;

  constructor(config: PipelineConfig = {}) {
    this.config = {
      deduplicate: config.deduplicate ?? true,
      dedupeMaxSize: config.dedupeMaxSize ?? 10000,
      dedupeTTL: config.dedupeTTL ?? 300000,
      verifySignatures: config.verifySignatures ?? true,
      enableBatching: config.enableBatching ?? false,
      batchSize: config.batchSize ?? 50,
      batchTimeout: config.batchTimeout ?? 100,
      concurrency: config.concurrency ?? 10
    };

    this.dedupeCache = new DeduplicationCache(
      this.config.dedupeMaxSize,
      this.config.dedupeTTL
    );
  }

  /**
   * Add a processing stage to the pipeline
   */
  addStage(stage: PipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  /**
   * Enable batching with a processor
   */
  enableBatching(processor: BatchProcessor<Event>): this {
    this.batchCollector = new BatchCollector(
      async (events) => {
        await processor(events);
        this.stats.batchesProcessed++;
      },
      this.config.batchSize,
      this.config.batchTimeout
    );
    return this;
  }

  /**
   * Process a single event through the pipeline
   * Returns processed event or null if filtered
   */
  async process(event: Event): Promise<Event | null> {
    const startTime = performance.now();

    try {
      // Deduplication check
      if (this.config.deduplicate) {
        if (this.dedupeCache.has(event.id)) {
          this.stats.deduplicated++;
          return null;
        }
        this.dedupeCache.add(event.id);
      }

      // Signature verification
      if (this.config.verifySignatures) {
        // Cast to NostrEvent for verification (compatible interface)
        const isValid = verifyEventSignature(event as Parameters<typeof verifyEventSignature>[0]);
        if (!isValid) {
          this.stats.invalidSignatures++;
          return null;
        }
      }

      // Run through pipeline stages
      let processedEvent: Event | null = event;
      for (const stage of this.stages) {
        if (!processedEvent) break;
        processedEvent = await stage(processedEvent);
      }

      if (!processedEvent) {
        return null;
      }

      // Add to batch if batching enabled
      if (this.batchCollector) {
        this.batchCollector.add(processedEvent);
      }

      this.stats.processed++;
      this.recordProcessingTime(performance.now() - startTime);

      return processedEvent;
    } catch (error) {
      this.stats.errors++;
      console.error('[EventPipeline] Processing error:', error);
      return null;
    }
  }

  /**
   * Process multiple events
   */
  async processMany(events: Event[]): Promise<Event[]> {
    const results: Event[] = [];

    // Process in batches respecting concurrency limit
    for (let i = 0; i < events.length; i += this.config.concurrency) {
      const batch = events.slice(i, i + this.config.concurrency);
      const processed = await Promise.all(batch.map((e) => this.process(e)));

      for (const event of processed) {
        if (event) results.push(event);
      }
    }

    return results;
  }

  /**
   * Flush any pending batches
   */
  flush(): void {
    this.batchCollector?.flush();
  }

  /**
   * Get pipeline statistics
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      processed: 0,
      deduplicated: 0,
      invalidSignatures: 0,
      errors: 0,
      batchesProcessed: 0,
      avgProcessingTime: 0
    };
    this.processingTimes = [];
  }

  /**
   * Get deduplication cache size
   */
  getCacheSize(): number {
    return this.dedupeCache.size;
  }

  /**
   * Clear deduplication cache
   */
  clearCache(): void {
    this.dedupeCache.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.dedupeCache.destroy();
    this.batchCollector?.destroy();
    this.stages.length = 0;
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    if (this.processingTimes.length > this.maxTimeSamples) {
      this.processingTimes.shift();
    }
    this.stats.avgProcessingTime =
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }
}

// ============================================================================
// Pipeline Stage Factories
// ============================================================================

/**
 * Create a filtering stage based on event kind
 */
export function filterByKind(kinds: number[]): PipelineStage {
  const kindSet = new Set(kinds);
  return (event) => (kindSet.has(event.kind) ? event : null);
}

/**
 * Create a filtering stage based on author pubkey
 */
export function filterByAuthor(pubkeys: string[]): PipelineStage {
  const pubkeySet = new Set(pubkeys);
  return (event) => (pubkeySet.has(event.pubkey) ? event : null);
}

/**
 * Create a filtering stage based on time range
 */
export function filterByTimeRange(since?: number, until?: number): PipelineStage {
  return (event) => {
    if (since && event.created_at < since) return null;
    if (until && event.created_at > until) return null;
    return event;
  };
}

/**
 * Create a filtering stage based on tag presence
 */
export function filterByTag(tagName: string, values?: string[]): PipelineStage {
  const valueSet = values ? new Set(values) : null;
  return (event) => {
    const hasTag = event.tags.some((tag) => {
      if (tag[0] !== tagName) return false;
      if (!valueSet) return true;
      return valueSet.has(tag[1]);
    });
    return hasTag ? event : null;
  };
}

/**
 * Create a transformation stage that modifies event content
 */
export function transformContent(
  transformer: (content: string) => string
): PipelineStage {
  return (event) => ({
    ...event,
    content: transformer(event.content)
  });
}

/**
 * Create a logging stage for debugging
 */
export function logEvent(prefix: string = ''): PipelineStage {
  return (event) => {
    console.log(`[EventPipeline]${prefix ? ' ' + prefix : ''} Event:`, {
      id: event.id.slice(0, 8),
      kind: event.kind,
      pubkey: event.pubkey.slice(0, 8),
      created_at: new Date(event.created_at * 1000).toISOString()
    });
    return event;
  };
}

// ============================================================================
// Default Pipeline Factory
// ============================================================================

/**
 * Create a default event pipeline with common stages
 */
export function createDefaultPipeline(config?: PipelineConfig): EventPipeline {
  return new EventPipeline({
    deduplicate: true,
    verifySignatures: true,
    dedupeMaxSize: 10000,
    dedupeTTL: 300000,
    ...config
  });
}

/**
 * Create a channel message pipeline
 */
export function createChannelPipeline(
  channelId: string,
  config?: PipelineConfig
): EventPipeline {
  return new EventPipeline(config)
    .addStage(filterByKind([9])) // Channel messages
    .addStage(filterByTag('e', [channelId]));
}

/**
 * Create a DM pipeline for a specific user
 */
export function createDMPipeline(
  userPubkey: string,
  config?: PipelineConfig
): EventPipeline {
  return new EventPipeline(config)
    .addStage(filterByKind([4])) // Encrypted DMs
    .addStage((event) => {
      // Filter events where user is sender or recipient
      const isRecipient = event.tags.some(
        (tag) => tag[0] === 'p' && tag[1] === userPubkey
      );
      const isSender = event.pubkey === userPubkey;
      return isRecipient || isSender ? event : null;
    });
}
