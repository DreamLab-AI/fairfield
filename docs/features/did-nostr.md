# did:nostr W3C DID Implementation

This document describes the W3C-compliant Decentralized Identifier (DID) implementation for Nostr in Fairfield.

## Overview

The `did:nostr` method enables Nostr public keys to function as W3C DIDs, providing:
- Interoperability with DID-based identity systems
- W3C DID Document generation
- Multikey encoding per the W3C specification
- Integration with Solid Protocol WebID

## DID Format

```
did:nostr:<64-character-hex-pubkey>
```

Example:
```
did:nostr:7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e
```

## Implementation

### Location

`src/lib/nostr/did.ts`

### Exported Functions

| Function | Description |
|----------|-------------|
| `pubkeyToDID(pubkey)` | Convert hex pubkey to did:nostr format |
| `didToPubkey(did)` | Extract hex pubkey from did:nostr |
| `isValidNostrDID(did)` | Validate did:nostr format |
| `npubToDID(npub)` | Convert bech32 npub to did:nostr |
| `didToNpub(did)` | Convert did:nostr to bech32 npub |
| `encodeMultikey(pubkey)` | Encode pubkey as W3C Multikey |
| `decodeMultikey(multikey)` | Decode Multikey to hex pubkey |
| `generateDIDDocument(pubkey)` | Generate W3C DID Document |
| `resolveDID(did)` | Resolve DID to DID Resolution Result |
| `createAuthenticationDIDDocument(pubkey)` | Create auth-focused DID Document |
| `verifyDIDDocument(document)` | Verify DID Document structure |

## Multikey Encoding

Per the W3C Multikey specification, secp256k1 public keys are encoded as:

```
z + base58btc(0xe7 0x01 + 32-byte-pubkey)
```

- `z` prefix indicates base58btc encoding
- `0xe7 0x01` is the secp256k1-pub multicodec prefix
- Followed by the raw 32-byte public key

### Example

```typescript
import { encodeMultikey, decodeMultikey } from '$lib/nostr/did';

const pubkey = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
const multikey = encodeMultikey(pubkey);
// Result: z6Mk...

const decoded = decodeMultikey(multikey);
// Result: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e'
```

## DID Document Structure

Generated DID Documents conform to W3C DID Core specification:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:nostr:7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e",
  "verificationMethod": [
    {
      "id": "did:nostr:7e7e...#key-0",
      "type": "Multikey",
      "controller": "did:nostr:7e7e...",
      "publicKeyMultibase": "z6Mk..."
    }
  ],
  "authentication": ["did:nostr:7e7e...#key-0"],
  "assertionMethod": ["did:nostr:7e7e...#key-0"],
  "capabilityInvocation": ["did:nostr:7e7e...#key-0"],
  "capabilityDelegation": ["did:nostr:7e7e...#key-0"]
}
```

## DID Resolution

The `resolveDID` function returns a W3C DID Resolution Result:

```typescript
import { resolveDID } from '$lib/nostr/did';

const result = await resolveDID('did:nostr:7e7e...');

// Result structure:
{
  "@context": "https://w3id.org/did-resolution/v1",
  "didDocument": { ... },
  "didResolutionMetadata": {
    "contentType": "application/did+ld+json"
  },
  "didDocumentMetadata": {}
}
```

## Integration with Solid Protocol

The did:nostr implementation bridges with Solid WebID profiles:

```typescript
import { pubkeyToDID } from '$lib/nostr/did';
import { linkNostrIdentityToWebID } from '$lib/solid';

// Link Nostr identity to Solid WebID
const did = pubkeyToDID(userPubkey);
await linkNostrIdentityToWebID(userPubkey, relays);
```

See [Solid Integration](./solid-integration.md) for details.

## Usage Examples

### Basic DID Operations

```typescript
import {
  pubkeyToDID,
  didToPubkey,
  isValidNostrDID
} from '$lib/nostr';

// Create DID from pubkey
const did = pubkeyToDID(pubkey);

// Extract pubkey from DID
const extractedPubkey = didToPubkey(did);

// Validate DID format
if (isValidNostrDID(did)) {
  // Valid did:nostr
}
```

### Generate and Verify DID Document

```typescript
import {
  generateDIDDocument,
  verifyDIDDocument
} from '$lib/nostr';

// Generate DID Document
const didDoc = generateDIDDocument(pubkey);

// Verify structure
const isValid = verifyDIDDocument(didDoc);
```

### Convert Between Formats

```typescript
import { npubToDID, didToNpub } from '$lib/nostr';

// npub to did:nostr
const did = npubToDID('npub1...');

// did:nostr to npub
const npub = didToNpub('did:nostr:...');
```

## Type Definitions

```typescript
interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod?: VerificationMethod[];
  authentication?: (string | VerificationMethod)[];
  assertionMethod?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  service?: ServiceEndpoint[];
}

interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

interface DIDResolutionResult {
  '@context': string;
  didDocument: DIDDocument | null;
  didResolutionMetadata: {
    contentType?: string;
    error?: string;
  };
  didDocumentMetadata: Record<string, unknown>;
}
```

## Standards Compliance

- **W3C DID Core 1.0**: Full compliance with DID Document structure
- **W3C Multikey**: secp256k1-pub encoding per specification
- **Multibase**: base58btc encoding with `z` prefix
- **Multicodec**: `0xe7 0x01` prefix for secp256k1 public keys

## Test Coverage

62 unit tests cover the DID implementation:
- Multikey encoding/decoding
- DID format conversion
- DID Document generation
- DID resolution
- Verification method structure
- Error handling for invalid inputs

Run tests:
```bash
npm test -- tests/unit/nostr/did.test.ts
```

## Related NIPs

- **NIP-05**: DNS-based verification (complementary)
- **NIP-19**: bech32 encoding (npub conversion)
- **NIP-46**: Nostr Connect (authentication)

## See Also

- [Authentication](./authentication.md)
- [Solid Integration](./solid-integration.md)
- [Security Audit](../security-audit-report.md)
