import { writable, get, derived } from 'svelte/store';
import { db, type DBMessage, type DBUser } from '$lib/db';
import type { Event, Filter, Sub } from '$lib/types/nostr';
import { currentPubkey } from './user';
import { toast } from './toast';
import { indexNewMessage, removeDeletedMessage } from '$lib/utils/searchIndex';
import { ndk, publishEvent, subscribe as ndkSubscribe } from '$lib/nostr/relay';
import { NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk';
import { getPublicKey, getEventHash, signEvent } from '$lib/utils/nostr-crypto';
import { NIP04_MIGRATION } from '$lib/config/migrations';

/**
 * Message author information
 */
export interface MessageAuthor {
  pubkey: string;
  name?: string;
  avatar?: string;
}

/**
 * Message interface for the application
 */
export interface Message {
  id: string;
  channelId: string;
  pubkey: string;
  content: string;
  created_at: number;
  encrypted: boolean;
  deleted: boolean;
  author: MessageAuthor;
}

/**
 * Message store state
 */
export interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  currentChannelId: string | null;
  hasMore: boolean;
  lastFetchTime: number | null;
}

/**
 * NDK subscription tracking
 */
interface SubscriptionInfo {
  subId: string;
  subscription: NDKSubscription;
}

/**
 * Initial message state
 */
const initialState: MessageState = {
  messages: [],
  loading: false,
  error: null,
  currentChannelId: null,
  hasMore: true,
  lastFetchTime: null
};

/**
 * Create the message store
 */
function createMessageStore() {
  const { subscribe, set, update } = writable<MessageState>(initialState);

  // Active NDK subscriptions by channel
  const channelSubscriptions = new Map<string, SubscriptionInfo[]>();

  /**
   * Convert DB message to app message
   */
  async function dbMessageToMessage(dbMsg: DBMessage): Promise<Message> {
    const author = await db.getUser(dbMsg.pubkey);

    return {
      id: dbMsg.id,
      channelId: dbMsg.channelId,
      pubkey: dbMsg.pubkey,
      content: dbMsg.content,
      created_at: dbMsg.created_at,
      encrypted: dbMsg.encrypted,
      deleted: dbMsg.deleted,
      author: {
        pubkey: dbMsg.pubkey,
        name: author?.name || author?.displayName || undefined,
        avatar: author?.avatar || undefined
      }
    };
  }

  /**
   * NIP-04 decryption - REMOVED
   *
   * NIP-04 was removed on 2025-12-01. All encrypted messages should use NIP-44.
   * This function returns a placeholder message for any legacy encrypted content.
   */
  function handleLegacyEncryptedMessage(): string {
    console.warn('[REMOVED] NIP-04 decryption removed as of', NIP04_MIGRATION.REMOVE_DATE);
    return '[Legacy NIP-04 encrypted message - encryption method no longer supported]';
  }

  /**
   * NIP-04 encryption - REMOVED
   *
   * NIP-04 encryption was removed on 2025-12-01.
   * Use NIP-44 via gift wrap (kind 1059) for encrypted messages.
   */
  function encryptMessage(): never {
    throw new Error(
      'NIP-04 encryption was removed on 2025-12-01. ' +
      'Use NIP-44 encryption (kind 1059 gift wrap) for encrypted messages.'
    );
  }

  /**
   * Create NDK event from message data
   */
  function createNDKEvent(
    content: string,
    kind: number,
    tags: string[][]
  ): NDKEvent {
    const ndkInstance = ndk();
    if (!ndkInstance) {
      throw new Error('NDK not initialized');
    }

    const event = new NDKEvent(ndkInstance);
    event.kind = kind;
    event.content = content;
    event.tags = tags;
    event.created_at = Math.floor(Date.now() / 1000);

    return event;
  }

  /**
   * Convert NDK event to legacy Event format
   */
  function ndkEventToEvent(ndkEvent: NDKEvent): Event {
    return {
      id: ndkEvent.id,
      pubkey: ndkEvent.pubkey,
      created_at: ndkEvent.created_at || Math.floor(Date.now() / 1000),
      kind: ndkEvent.kind || 0,
      tags: ndkEvent.tags,
      content: ndkEvent.content,
      sig: ndkEvent.sig || ''
    };
  }

  /**
   * Convert legacy Filter to NDK filter
   */
  function filterToNDKFilter(filter: Filter): NDKFilter {
    return {
      kinds: filter.kinds,
      authors: filter.authors,
      '#e': filter['#e'],
      '#p': filter['#p'],
      since: filter.since,
      until: filter.until,
      limit: filter.limit
    };
  }

  return {
    subscribe,

    /**
     * Fetch messages from relay and cache
     */
    async fetchMessages(
      relayUrl: string,
      channelId: string,
      userPrivkey: string | null,
      limit: number = 50
    ): Promise<void> {
      update(state => ({ ...state, loading: true, error: null, currentChannelId: channelId }));

      try {
        // First, load from cache
        const cachedMessages = await db.getChannelMessagesWithAuthors(channelId);
        const appMessages = await Promise.all(
          cachedMessages.map(msg => dbMessageToMessage(msg))
        );

        update(state => ({
          ...state,
          messages: appMessages,
          loading: true
        }));

        // Get channel info to check if encrypted
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        // Then fetch from relay
        const since = cachedMessages.length > 0
          ? Math.max(...cachedMessages.map(m => m.created_at))
          : 0;

        const filter: NDKFilter = {
          kinds: [9], // NIP-29 channel message
          '#e': [channelId],
          since,
          limit
        };

        const subscription = ndkSubscribe(filter, { closeOnEose: false });

        subscription.on('event', async (ndkEvent: NDKEvent) => {
          const event = ndkEventToEvent(ndkEvent);
          // Check if already deleted
          const isDeleted = await db.isMessageDeleted(event.id);
          if (isDeleted) return;

          // Handle encrypted content
          let content = event.content;
          if (isEncrypted) {
            // NIP-04 removed - show placeholder for legacy encrypted content
            content = handleLegacyEncryptedMessage();
          }

          // Cache message
          const dbMsg: DBMessage = {
            id: event.id,
            channelId,
            pubkey: event.pubkey,
            content,
            created_at: event.created_at,
            encrypted: isEncrypted,
            deleted: false,
            kind: event.kind,
            tags: event.tags,
            sig: event.sig
          };

          await db.messages.put(dbMsg);

          // Index for search (async, don't block)
          indexNewMessage(dbMsg).catch(err =>
            console.error('Failed to index message for search:', err)
          );

          // Update store
          const appMsg = await dbMessageToMessage(dbMsg);

          update(state => {
            const exists = state.messages.some(m => m.id === appMsg.id);
            if (!exists) {
              return {
                ...state,
                messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
              };
            }
            return state;
          });
        });

        update(state => ({
          ...state,
          loading: false,
          lastFetchTime: Date.now()
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch messages';
        console.error('fetchMessages error:', error);

        // Notify user of connection issues
        toast.error(`Connection error: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg,
          loading: false
        }));
      }
    },

    /**
     * Send a message to a channel
     */
    async sendMessage(
      content: string,
      channelId: string,
      relayUrl: string,
      userPrivkey: string,
      isEncrypted: boolean = false,
      memberPubkeys: string[] = []
    ): Promise<void> {
      try {
        let finalContent = content;

        // NIP-04 encryption removed - reject encrypted message requests
        if (isEncrypted) {
          throw new Error(
            'NIP-04 encrypted messages are no longer supported. ' +
            'Use NIP-44 gift wrap (kind 1059) for encrypted direct messages.'
          );
        }

        // Create tags
        const tags: string[][] = [
          ['e', channelId, relayUrl, 'root']
        ];

        // Create and publish NDK event
        const ndkEvent = createNDKEvent(finalContent, 9, tags);
        await publishEvent(ndkEvent);

        // Get the signed event data
        const event = ndkEventToEvent(ndkEvent);

        // Cache locally
        const dbMsg: DBMessage = {
          id: event.id,
          channelId,
          pubkey: event.pubkey,
          content,
          created_at: event.created_at,
          encrypted: isEncrypted,
          deleted: false,
          kind: event.kind,
          tags: event.tags,
          sig: event.sig
        };

        await db.messages.put(dbMsg);

        // Index for search (async, don't block)
        indexNewMessage(dbMsg).catch(err =>
          console.error('Failed to index message for search:', err)
        );

        // Update store
        const appMsg = await dbMessageToMessage(dbMsg);

        update(state => ({
          ...state,
          messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to send message';
        console.error('sendMessage error:', error);

        // Notify user of send failure
        toast.error(`Failed to send: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));

        throw error;
      }
    },

    /**
     * Delete a message (NIP-09 deletion)
     */
    async deleteMessage(
      messageId: string,
      channelId: string,
      relayUrl: string,
      userPrivkey: string
    ): Promise<void> {
      try {
        // Create deletion event
        const tags: string[][] = [
          ['e', messageId],
          ['k', '9']
        ];

        const ndkEvent = createNDKEvent('', 5, tags);
        await publishEvent(ndkEvent);

        const event = ndkEventToEvent(ndkEvent);

        // Mark as deleted in cache
        await db.addDeletion({
          id: event.id,
          deletedEventId: messageId,
          channelId,
          deleterPubkey: event.pubkey,
          created_at: event.created_at,
          kind: 5
        });

        // Remove from search index (async, don't block)
        removeDeletedMessage(messageId).catch(err =>
          console.error('Failed to remove deleted message from search:', err)
        );

        // Update store
        update(state => ({
          ...state,
          messages: state.messages.map(m =>
            m.id === messageId ? { ...m, deleted: true } : m
          )
        }));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete message';
        console.error('deleteMessage error:', error);

        // Notify user of deletion failure
        toast.error(`Failed to delete: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));

        throw error;
      }
    },

    /**
     * Subscribe to real-time channel updates
     */
    async subscribeToChannel(
      channelId: string,
      relayUrl: string,
      userPrivkey: string | null
    ): Promise<void> {
      try {
        // Get channel info
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        // Subscribe to new messages
        const messageFilter: NDKFilter = {
          kinds: [9],
          '#e': [channelId],
          since: Math.floor(Date.now() / 1000)
        };

        // Subscribe to deletions
        const deletionFilter: NDKFilter = {
          kinds: [5, 9005 as any], // NIP-09 and NIP-29 deletions
          '#e': [channelId],
          since: Math.floor(Date.now() / 1000)
        };

        const subId1 = `msg_${channelId}_${Date.now()}`;
        const subscription1 = ndkSubscribe(messageFilter, {
          closeOnEose: false,
          subId: subId1
        });

        subscription1.on('event', async (ndkEvent: NDKEvent) => {
          const event = ndkEventToEvent(ndkEvent);
          // Handle new message
          let content = event.content;
          if (isEncrypted) {
            // NIP-04 removed - show placeholder for legacy encrypted content
            content = handleLegacyEncryptedMessage();
          }

          const dbMsg: DBMessage = {
            id: event.id,
            channelId,
            pubkey: event.pubkey,
            content,
            created_at: event.created_at,
            encrypted: isEncrypted,
            deleted: false,
            kind: event.kind,
            tags: event.tags,
            sig: event.sig
          };

          await db.messages.put(dbMsg);

          // Index for search (async, don't block)
          indexNewMessage(dbMsg).catch(err =>
            console.error('Failed to index message for search:', err)
          );

          const appMsg = await dbMessageToMessage(dbMsg);

          update(state => {
            const exists = state.messages.some(m => m.id === appMsg.id);
            if (!exists && state.currentChannelId === channelId) {
              return {
                ...state,
                messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
              };
            }
            return state;
          });
        });

        const subId2 = `del_${channelId}_${Date.now()}`;
        const subscription2 = ndkSubscribe(deletionFilter, {
          closeOnEose: false,
          subId: subId2
        });

        subscription2.on('event', async (ndkEvent: NDKEvent) => {
          const event = ndkEventToEvent(ndkEvent);
          // Handle deletion
          const deletedId = event.tags.find(t => t[0] === 'e')?.[1];

          if (deletedId) {
            await db.addDeletion({
              id: event.id,
              deletedEventId: deletedId,
              channelId,
              deleterPubkey: event.pubkey,
              created_at: event.created_at,
              kind: event.kind
            });

            // Remove from search index (async, don't block)
            removeDeletedMessage(deletedId).catch(err =>
              console.error('Failed to remove deleted message from search:', err)
            );

            update(state => ({
              ...state,
              messages: state.messages.map(m =>
                m.id === deletedId ? { ...m, deleted: true } : m
              )
            }));
          }
        });

        // Track subscriptions
        const subs = channelSubscriptions.get(channelId) || [];
        channelSubscriptions.set(channelId, [
          ...subs,
          { subId: subId1, subscription: subscription1 },
          { subId: subId2, subscription: subscription2 }
        ]);

      } catch (error) {
        console.error('subscribeToChannel error:', error);

        const errorMsg = error instanceof Error ? error.message : 'Failed to subscribe to channel';
        // Notify user of subscription failure
        toast.error(`Channel subscription failed: ${errorMsg}`);

        update(state => ({
          ...state,
          error: errorMsg
        }));
      }
    },

    /**
     * Unsubscribe from channel updates
     */
    unsubscribeFromChannel(channelId: string, relayUrl: string): void {
      const subs = channelSubscriptions.get(channelId);

      if (subs) {
        subs.forEach(({ subscription }) => {
          subscription.stop();
        });

        channelSubscriptions.delete(channelId);
      }
    },

    /**
     * Fetch older messages (pagination)
     */
    async fetchOlderMessages(
      relayUrl: string,
      channelId: string,
      userPrivkey: string | null,
      limit: number = 50
    ): Promise<boolean> {
      const currentState = get({ subscribe });

      // Get oldest message timestamp
      const oldestMessage = currentState.messages
        .filter(m => m.channelId === channelId)
        .reduce((oldest, m) => m.created_at < oldest.created_at ? m : oldest, { created_at: Infinity } as Message);

      if (oldestMessage.created_at === Infinity) {
        return false; // No messages to paginate from
      }

      update(state => ({ ...state, loading: true, error: null }));

      try {
        const channel = await db.getChannel(channelId);
        const isEncrypted = channel?.isEncrypted || false;

        const filter: NDKFilter = {
          kinds: [9],
          '#e': [channelId],
          until: oldestMessage.created_at - 1,
          limit
        };

        let foundMessages = 0;

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => resolve(), 5000);

          const subscription = ndkSubscribe(filter, { closeOnEose: true });

          subscription.on('event', async (ndkEvent: NDKEvent) => {
            const event = ndkEventToEvent(ndkEvent);
            const isDeleted = await db.isMessageDeleted(event.id);
            if (isDeleted) return;

            let content = event.content;
            if (isEncrypted) {
              // NIP-04 removed - show placeholder for legacy encrypted content
              content = handleLegacyEncryptedMessage();
            }

            const dbMsg: DBMessage = {
              id: event.id,
              channelId,
              pubkey: event.pubkey,
              content,
              created_at: event.created_at,
              encrypted: isEncrypted,
              deleted: false,
              kind: event.kind,
              tags: event.tags,
              sig: event.sig
            };

            await db.messages.put(dbMsg);

            const appMsg = await dbMessageToMessage(dbMsg);

            update(state => {
              const exists = state.messages.some(m => m.id === appMsg.id);
              if (!exists) {
                foundMessages++;
                return {
                  ...state,
                  messages: [...state.messages, appMsg].sort((a, b) => a.created_at - b.created_at)
                };
              }
              return state;
            });
          });

          subscription.on('eose', () => {
            clearTimeout(timeout);
            resolve();
          });

          subscription.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        update(state => ({
          ...state,
          loading: false,
          hasMore: foundMessages >= limit * 0.5 // Assume more if we got at least half of requested
        }));

        return foundMessages > 0;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch older messages';
        console.error('fetchOlderMessages error:', error);

        update(state => ({
          ...state,
          error: errorMsg,
          loading: false,
          hasMore: false
        }));

        return false;
      }
    },

    /**
     * Clear error
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Clear all messages
     */
    clear(): void {
      set(initialState);
    },

    /**
     * Disconnect all subscriptions
     */
    disconnectAll(): void {
      channelSubscriptions.forEach(subs => {
        subs.forEach(({ subscription }) => {
          subscription.stop();
        });
      });

      channelSubscriptions.clear();
    }
  };
}

export const messageStore = createMessageStore();

/**
 * Derived store for non-deleted messages
 */
export const activeMessages = derived(
  messageStore,
  $messages => $messages.messages.filter(m => !m.deleted)
);

/**
 * Derived store for message count
 */
export const messageCount = derived(
  activeMessages,
  $messages => $messages.length
);

/**
 * Auto-cleanup on page unload
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    messageStore.disconnectAll();
  });
}
