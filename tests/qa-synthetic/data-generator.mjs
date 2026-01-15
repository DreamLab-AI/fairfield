/**
 * Nostr BBS Synthetic Data Generator
 * Creates properly signed Nostr events for comprehensive QA testing
 *
 * Test Users:
 * - Super Admin: The original admin mnemonic
 * - Area Admin 1: Moderator for meditation/wellness channels
 * - Area Admin 2: Moderator for community/events channels
 * - User 1: Active community member
 * - User 2: New user testing registration flow
 */

import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { wordlist } from '@scure/bip39/wordlists/english';
import { mnemonicToSeedSync, generateMnemonic } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import 'websocket-polyfill';
const WebSocket = globalThis.WebSocket;

// Relay configuration
const RELAY_URL = 'wss://nostr-relay-617806532906.us-central1.run.app';

// Test user mnemonics (deterministic for reproducibility)
const TEST_USERS = {
  superAdmin: {
    name: 'Super Admin',
    mnemonic: 'glimpse marble confirm army sleep imitate lake balance home panic view brand',
    role: 'super_admin',
    displayName: 'System Administrator',
    about: 'BBS System Administrator - Managing the community'
  },
  areaAdmin1: {
    name: 'Area Admin 1',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    role: 'area_admin',
    displayName: 'Meditation Guide',
    about: 'Moderator for meditation and wellness channels'
  },
  areaAdmin2: {
    name: 'Area Admin 2',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    role: 'area_admin',
    displayName: 'Community Manager',
    about: 'Moderator for community events and discussions'
  },
  user1: {
    name: 'User 1',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    role: 'user',
    displayName: 'Alice Nostr',
    about: 'Active community member interested in meditation and wellness'
  },
  user2: {
    name: 'User 2',
    mnemonic: 'void come effort suffer camp survey warrior heavy shoot primary clutch crush',
    role: 'user',
    displayName: 'Bob Builder',
    about: 'New to the community, exploring Nostr'
  }
};

// Channel definitions
const CHANNELS = [
  {
    id: 'meditation-circle',
    name: 'Meditation Circle',
    about: 'Daily meditation practices and mindfulness discussions',
    picture: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=200',
    isPrivate: false,
    moderators: ['areaAdmin1']
  },
  {
    id: 'community-events',
    name: 'Community Events',
    about: 'Upcoming events, meetups, and community gatherings',
    picture: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200',
    isPrivate: false,
    moderators: ['areaAdmin2']
  },
  {
    id: 'wellness-corner',
    name: 'Wellness Corner',
    about: 'Health tips, yoga, and holistic wellness discussions',
    picture: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200',
    isPrivate: false,
    moderators: ['areaAdmin1']
  },
  {
    id: 'tech-talk',
    name: 'Tech Talk',
    about: 'Nostr development, decentralization, and technology',
    picture: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200',
    isPrivate: false,
    moderators: ['areaAdmin2']
  },
  {
    id: 'private-sanctuary',
    name: 'Private Sanctuary',
    about: 'Members-only space for deep discussions',
    picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    isPrivate: true,
    moderators: ['areaAdmin1', 'areaAdmin2']
  }
];

// Sample messages with URLs for link preview testing
const SAMPLE_MESSAGES = [
  {
    channel: 'meditation-circle',
    author: 'user1',
    content: 'Just finished a wonderful 20-minute meditation session. Feeling so peaceful! 🧘‍♀️'
  },
  {
    channel: 'meditation-circle',
    author: 'areaAdmin1',
    content: 'Welcome everyone! Check out this great guide on mindfulness: https://www.mindful.org/meditation/mindfulness-getting-started/'
  },
  {
    channel: 'meditation-circle',
    author: 'user2',
    content: 'New here! Can someone recommend a good meditation app?'
  },
  {
    channel: 'meditation-circle',
    author: 'user1',
    content: 'I love using Insight Timer! Here is their website: https://insighttimer.com/'
  },
  {
    channel: 'community-events',
    author: 'areaAdmin2',
    content: 'Reminder: Community meetup this Saturday at 3 PM! Check the calendar for details.'
  },
  {
    channel: 'community-events',
    author: 'superAdmin',
    content: 'Great turnout at last week event! Here are some photos: https://nostr.build/i/sample.jpg'
  },
  {
    channel: 'wellness-corner',
    author: 'areaAdmin1',
    content: 'Today yoga tip: Start your morning with 5 minutes of sun salutations. Video guide: https://www.youtube.com/watch?v=example'
  },
  {
    channel: 'wellness-corner',
    author: 'user1',
    content: 'Has anyone tried the new plant-based diet? Looking for recipes!'
  },
  {
    channel: 'tech-talk',
    author: 'areaAdmin2',
    content: 'Interesting article on Nostr protocol: https://github.com/nostr-protocol/nips'
  },
  {
    channel: 'tech-talk',
    author: 'user2',
    content: 'Just discovered this BBS! The decentralization aspect is fascinating.'
  },
  {
    channel: 'tech-talk',
    author: 'superAdmin',
    content: 'We have updated to support NIP-52 calendar events. Check out the new Events page!'
  }
];

// Calendar events
const CALENDAR_EVENTS = [
  {
    title: 'Morning Meditation Session',
    description: 'Join us for a guided morning meditation to start your day with clarity and peace.',
    channel: 'meditation-circle',
    author: 'areaAdmin1',
    startTime: getNextWeekday(1, 7, 0), // Next Monday 7:00 AM
    endTime: getNextWeekday(1, 8, 0),   // Next Monday 8:00 AM
    location: 'Online - Zoom',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400'
  },
  {
    title: 'Community Potluck Dinner',
    description: 'Bring a dish to share! Great opportunity to meet fellow community members.',
    channel: 'community-events',
    author: 'areaAdmin2',
    startTime: getNextWeekday(6, 18, 0), // Next Saturday 6:00 PM
    endTime: getNextWeekday(6, 21, 0),   // Next Saturday 9:00 PM
    location: 'Community Center, 123 Main St',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'
  },
  {
    title: 'Yoga Workshop: Sun Salutations',
    description: 'Learn the proper form for sun salutations with our certified yoga instructor.',
    channel: 'wellness-corner',
    author: 'areaAdmin1',
    startTime: getNextWeekday(3, 10, 0), // Next Wednesday 10:00 AM
    endTime: getNextWeekday(3, 11, 30),  // Next Wednesday 11:30 AM
    location: 'Wellness Studio, Room B',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400'
  },
  {
    title: 'Nostr Development Meetup',
    description: 'Discuss the latest NIPs and share your Nostr projects.',
    channel: 'tech-talk',
    author: 'superAdmin',
    startTime: getNextWeekday(4, 19, 0), // Next Thursday 7:00 PM
    endTime: getNextWeekday(4, 21, 0),   // Next Thursday 9:00 PM
    location: 'Online - Jitsi',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'
  },
  {
    title: 'Weekend Retreat Planning',
    description: 'Help us plan the upcoming weekend retreat. All ideas welcome!',
    channel: 'private-sanctuary',
    author: 'areaAdmin1',
    startTime: getNextWeekday(5, 15, 0), // Next Friday 3:00 PM
    endTime: getNextWeekday(5, 16, 0),   // Next Friday 4:00 PM
    location: 'Private Meeting Room',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
  }
];

// Helper function to get next weekday timestamp
function getNextWeekday(targetDay, hour, minute) {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) daysUntilTarget += 7;

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(hour, minute, 0, 0);

  return Math.floor(targetDate.getTime() / 1000);
}

// Derive keypair from mnemonic using BIP32/BIP39
function deriveKeypair(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const hdkey = HDKey.fromMasterSeed(seed);
  const derived = hdkey.derive("m/44'/1237'/0'/0/0");
  const secretKey = derived.privateKey;
  const pubkey = getPublicKey(secretKey);

  return {
    secretKey,
    pubkey,
    npub: nip19.npubEncode(pubkey),
    nsec: nip19.nsecEncode(secretKey)
  };
}

// Initialize all test users with their keypairs
function initializeUsers() {
  const users = {};
  for (const [key, user] of Object.entries(TEST_USERS)) {
    const keypair = deriveKeypair(user.mnemonic);
    users[key] = {
      ...user,
      ...keypair
    };
    console.log(`Initialized ${user.name}: ${keypair.npub.substring(0, 20)}...`);
  }
  return users;
}

// Create a signed Nostr event
function createEvent(secretKey, kind, content, tags = []) {
  const event = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content
  };
  return finalizeEvent(event, secretKey);
}

// Create profile event (kind 0)
function createProfileEvent(user) {
  const profile = {
    name: user.displayName,
    about: user.about,
    picture: `https://robohash.org/${user.pubkey}?set=set4`,
    nip05: `${user.displayName.toLowerCase().replace(' ', '')}@nostr-bbs.example`
  };
  return createEvent(user.secretKey, 0, JSON.stringify(profile), []);
}

// Create channel (kind 40 for channel creation)
function createChannelEvent(user, channel) {
  const metadata = {
    name: channel.name,
    about: channel.about,
    picture: channel.picture
  };
  return createEvent(user.secretKey, 40, JSON.stringify(metadata), []);
}

// Create channel message (kind 42 for channel message - NIP-28)
function createChannelMessage(user, channelId, content, replyTo = null) {
  const tags = [
    ['e', channelId, RELAY_URL, 'root']
  ];
  if (replyTo) {
    tags.push(['e', replyTo, RELAY_URL, 'reply']);
  }
  return createEvent(user.secretKey, 42, content, tags);
}

// Create NIP-52 calendar event (kind 31923)
function createCalendarEvent(user, eventData, channelId) {
  const identifier = `${eventData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const tags = [
    ['d', identifier],
    ['title', eventData.title],
    ['start', eventData.startTime.toString()],
    ['end', eventData.endTime.toString()],
    ['location', eventData.location],
    ['h', channelId], // Link to channel (NIP-29 style)
    ['image', eventData.image],
    ['t', 'event'],
    ['t', 'community']
  ];

  return createEvent(user.secretKey, 31923, eventData.description, tags);
}

// Create RSVP event (kind 31925)
function createRSVPEvent(user, calendarEventId, status = 'accepted') {
  const tags = [
    ['e', calendarEventId],
    ['status', status], // accepted, declined, tentative
    ['d', `rsvp-${calendarEventId}`]
  ];
  return createEvent(user.secretKey, 31925, '', tags);
}

// WebSocket-based relay publisher (browser-style API)
class RelayPublisher {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.messageQueue = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to relay: ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to relay');
        this.connected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg[0] === 'OK') {
            console.log(`  Event ${msg[1].substring(0, 8)}... ${msg[2] ? 'accepted' : 'rejected'}: ${msg[3] || 'OK'}`);
          } else if (msg[0] === 'NOTICE') {
            console.log(`  Notice: ${msg[1]}`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err.message || 'Connection failed');
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log('Disconnected from relay');
        this.connected = false;
      };

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async publish(event) {
    if (!this.connected) {
      throw new Error('Not connected to relay');
    }

    const message = JSON.stringify(['EVENT', event]);
    this.ws.send(message);

    // Small delay to avoid overwhelming the relay
    await new Promise(r => setTimeout(r, 100));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main data generation and publishing function
async function generateAndPublish() {
  console.log('=== Nostr BBS Synthetic Data Generator ===\n');

  // Initialize users
  console.log('1. Initializing test users...');
  const users = initializeUsers();
  console.log('');

  // Connect to relay
  console.log('2. Connecting to relay...');
  const publisher = new RelayPublisher(RELAY_URL);

  try {
    await publisher.connect();
  } catch (err) {
    console.error('Failed to connect to relay:', err.message);
    console.log('\nAttempting with alternative relay...');
    // Try local relay or fallback
    return { users, channels: {}, events: [], messages: [], success: false };
  }

  console.log('');

  // Publish user profiles
  console.log('3. Publishing user profiles...');
  for (const [key, user] of Object.entries(users)) {
    const profileEvent = createProfileEvent(user);
    await publisher.publish(profileEvent);
    users[key].profileEventId = profileEvent.id;
  }
  console.log('');

  // Publish channels
  console.log('4. Creating channels...');
  const channelEvents = {};
  for (const channel of CHANNELS) {
    const channelEvent = createChannelEvent(users.superAdmin, channel);
    await publisher.publish(channelEvent);
    channelEvents[channel.id] = channelEvent.id;
    console.log(`  Created channel: ${channel.name} (${channelEvent.id.substring(0, 8)}...)`);
  }
  console.log('');

  // Publish messages
  console.log('5. Publishing channel messages...');
  const publishedMessages = [];
  for (const msg of SAMPLE_MESSAGES) {
    const channelId = channelEvents[msg.channel];
    if (channelId) {
      const messageEvent = createChannelMessage(users[msg.author], channelId, msg.content);
      await publisher.publish(messageEvent);
      publishedMessages.push({
        ...msg,
        eventId: messageEvent.id
      });
    }
  }
  console.log(`  Published ${publishedMessages.length} messages`);
  console.log('');

  // Publish calendar events
  console.log('6. Creating calendar events...');
  const publishedCalendarEvents = [];
  for (const calEvent of CALENDAR_EVENTS) {
    const channelId = channelEvents[calEvent.channel];
    if (channelId) {
      const event = createCalendarEvent(users[calEvent.author], calEvent, channelId);
      await publisher.publish(event);
      publishedCalendarEvents.push({
        ...calEvent,
        eventId: event.id
      });
      console.log(`  Created event: ${calEvent.title}`);
    }
  }
  console.log('');

  // Create some RSVPs
  console.log('7. Creating RSVPs...');
  if (publishedCalendarEvents.length > 0) {
    // User1 RSVPs to first event
    const rsvp1 = createRSVPEvent(users.user1, publishedCalendarEvents[0].eventId, 'accepted');
    await publisher.publish(rsvp1);
    console.log(`  User1 RSVP to: ${publishedCalendarEvents[0].title}`);

    // User2 RSVPs to second event
    if (publishedCalendarEvents.length > 1) {
      const rsvp2 = createRSVPEvent(users.user2, publishedCalendarEvents[1].eventId, 'tentative');
      await publisher.publish(rsvp2);
      console.log(`  User2 RSVP to: ${publishedCalendarEvents[1].title}`);
    }
  }
  console.log('');

  // Close connection
  publisher.close();

  // Output summary
  console.log('=== Generation Complete ===');
  console.log(`Users: ${Object.keys(users).length}`);
  console.log(`Channels: ${Object.keys(channelEvents).length}`);
  console.log(`Messages: ${publishedMessages.length}`);
  console.log(`Calendar Events: ${publishedCalendarEvents.length}`);

  // Save user info for testing
  const testConfig = {
    users: Object.fromEntries(
      Object.entries(users).map(([key, user]) => [
        key,
        {
          name: user.name,
          mnemonic: user.mnemonic,
          pubkey: user.pubkey,
          npub: user.npub,
          role: user.role
        }
      ])
    ),
    channels: channelEvents,
    calendarEvents: publishedCalendarEvents.map(e => ({
      title: e.title,
      eventId: e.eventId
    })),
    relay: RELAY_URL
  };

  return testConfig;
}

// Export for use by test scripts
export {
  generateAndPublish,
  TEST_USERS,
  CHANNELS,
  deriveKeypair,
  createEvent,
  createChannelMessage,
  createCalendarEvent,
  RELAY_URL
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAndPublish()
    .then(config => {
      console.log('\nTest configuration:');
      console.log(JSON.stringify(config, null, 2));
    })
    .catch(err => {
      console.error('Generation failed:', err);
      process.exit(1);
    });
}
