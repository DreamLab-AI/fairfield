export class Whitelist {
  private allowedPubkeys: Set<string>;
  private devModeEnabled: boolean;

  constructor() {
    this.allowedPubkeys = new Set();
    // SECURITY: Dev mode must be explicitly enabled via environment variable
    // Default is secure (deny all when whitelist empty)
    this.devModeEnabled = process.env.RELAY_DEV_MODE === 'true';
    this.loadWhitelist();
  }

  private loadWhitelist(): void {
    const whitelistEnv = process.env.WHITELIST_PUBKEYS || '';
    const pubkeys = whitelistEnv.split(',').map(pk => pk.trim()).filter(pk => pk.length > 0);

    for (const pubkey of pubkeys) {
      this.allowedPubkeys.add(pubkey);
    }

    if (this.devModeEnabled && this.allowedPubkeys.size === 0) {
      console.warn('[Whitelist] WARNING: Dev mode enabled with empty whitelist - all pubkeys allowed');
    }
  }

  isAllowed(pubkey: string): boolean {
    // SECURITY FIX: Only allow all if EXPLICITLY in dev mode
    // Empty whitelist now means "deny all" by default (secure default)
    if (this.allowedPubkeys.size === 0) {
      // Only allow all in explicitly enabled dev mode
      if (this.devModeEnabled) {
        return true;
      }
      // Secure default: empty whitelist = deny all (require database whitelist)
      return false;
    }

    return this.allowedPubkeys.has(pubkey);
  }

  add(pubkey: string): void {
    this.allowedPubkeys.add(pubkey);
  }

  remove(pubkey: string): void {
    this.allowedPubkeys.delete(pubkey);
  }

  list(): string[] {
    return Array.from(this.allowedPubkeys);
  }
}
