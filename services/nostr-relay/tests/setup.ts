/**
 * Test setup and utilities
 *
 * Integration tests connect to a running relay instance.
 * Set RELAY_WS_URL environment variable to configure the relay endpoint.
 */

export const TEST_RELAY_CONFIG = {
  host: process.env.RELAY_HOST || 'localhost',
  port: parseInt(process.env.RELAY_PORT || '8080'),
  wsUrl: process.env.RELAY_WS_URL || 'ws://localhost:8080',
};

export function globalSetup(): void {
  // Integration tests connect to external relay - no local setup needed
}

export function globalTeardown(): void {
  // Integration tests connect to external relay - no local cleanup needed
}
