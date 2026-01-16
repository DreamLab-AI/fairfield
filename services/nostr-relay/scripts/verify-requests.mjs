#!/usr/bin/env node
import WebSocket from 'ws';

const RELAY_URL = process.env.RELAY_URL || 'wss://nostr-relay-617806532906.us-central1.run.app';
const ADMIN_PUBKEY = process.env.ADMIN_PUBKEY;
if (!ADMIN_PUBKEY) {
  console.error('ERROR: ADMIN_PUBKEY environment variable is required');
  console.error('Usage: ADMIN_PUBKEY=<hex-pubkey> node verify-requests.mjs');
  process.exit(1);
}

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  console.log('Connected to relay, querying kind:9022 events...');
  const subscriptionId = 'verify-requests';
  const filter = {
    kinds: [9022],
    '#p': [ADMIN_PUBKEY],
    limit: 10
  };
  ws.send(JSON.stringify(['REQ', subscriptionId, filter]));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg[0] === 'EVENT') {
    const event = msg[2];
    const section = event.tags.find(t => t[0] === 'section')?.[1] || 'unknown';
    console.log(`\nRequest from ${event.pubkey.substring(0, 16)}...`);
    console.log(`  Section: ${section}`);
    console.log(`  Message: ${event.content.substring(0, 80)}...`);
  } else if (msg[0] === 'EOSE') {
    console.log('\n--- End of stored events ---');
    ws.close();
  }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => process.exit(0));
