/**
 * Manual Security Test Script
 * Run with: npm run dev (and test manually) or review code logic
 *
 * This script validates the SQL injection fixes in db.ts
 */

import { Database, NostrEvent } from '../db';
import * as path from 'path';

async function runSecurityTests() {
  console.log('Starting manual security validation...\n');

  const db = new Database();
  await db.init();

  // Insert test data
  const testEvents: NostrEvent[] = [
    {
      id: 'test1',
      pubkey: 'pubkey1',
      created_at: Date.now(),
      kind: 1,
      tags: [['e', 'ref1'], ['p', 'user1']],
      content: 'Test event 1',
      sig: 'sig1'
    },
    {
      id: 'test2',
      pubkey: 'pubkey2',
      created_at: Date.now(),
      kind: 1,
      tags: [['test', 'value%with%percent']],
      content: 'Test event 2',
      sig: 'sig2'
    },
    {
      id: 'test3',
      pubkey: 'pubkey3',
      created_at: Date.now(),
      kind: 1,
      tags: [['test', 'value_with_underscore']],
      content: 'Test event 3',
      sig: 'sig3'
    }
  ];

  console.log('Inserting test events...');
  for (const event of testEvents) {
    await db.saveEvent(event);
  }
  console.log('Test events inserted.\n');

  // Test 1: SQL Injection in tag name
  console.log('Test 1: SQL Injection in tag name');
  console.log('Filter: { "#e\\"; DROP TABLE events; --": ["ref1"] }');
  const result1 = await db.queryEvents([{ '#e"; DROP TABLE events; --': ['ref1'] }]);
  console.log(`Result: ${result1.length} events (expected: 0)`);
  console.log(`Status: ${result1.length === 0 ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 2: SQL Injection in tag value
  console.log('Test 2: SQL Injection in tag value');
  console.log('Filter: { "#test": ["\\"; DROP TABLE events; --"] }');
  const result2 = await db.queryEvents([{ '#test': ['"; DROP TABLE events; --'] }]);
  console.log(`Result: ${result2.length} events`);
  console.log(`Status: No error thrown - ✓ PASS\n`);

  // Test 3: % wildcard escaping
  console.log('Test 3: % wildcard escaping');
  console.log('Filter: { "#test": ["value%with%percent"] }');
  const result3 = await db.queryEvents([{ '#test': ['value%with%percent'] }]);
  console.log(`Result: ${result3.length} events (expected: 1)`);
  console.log(`Status: ${result3.length === 1 && result3[0].id === 'test2' ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 4: _ wildcard escaping
  console.log('Test 4: _ wildcard escaping');
  console.log('Filter: { "#test": ["value_with_underscore"] }');
  const result4 = await db.queryEvents([{ '#test': ['value_with_underscore'] }]);
  console.log(`Result: ${result4.length} events (expected: 1)`);
  console.log(`Status: ${result4.length === 1 && result4[0].id === 'test3' ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 5: Valid tag query still works
  console.log('Test 5: Valid tag query');
  console.log('Filter: { "#e": ["ref1"] }');
  const result5 = await db.queryEvents([{ '#e': ['ref1'] }]);
  console.log(`Result: ${result5.length} events (expected: 1)`);
  console.log(`Status: ${result5.length === 1 && result5[0].id === 'test1' ? '✓ PASS' : '✗ FAIL'}\n`);

  // Verify database integrity
  console.log('Test 6: Database integrity check');
  const allEvents = await db.queryEvents([{ kinds: [1] }]);
  console.log(`Result: ${allEvents.length} events (expected: >= 3)`);
  console.log(`Status: ${allEvents.length >= 3 ? '✓ PASS' : '✗ FAIL'}\n`);

  await db.close();
  console.log('Security validation complete.');
}

// Run tests if executed directly
if (require.main === module) {
  runSecurityTests().catch(console.error);
}

export { runSecurityTests };
