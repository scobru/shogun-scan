# @shogun/stealth-address

Stealth Address plugin for Shogun Core - Provides privacy-focused stealth address functionality for enhanced transaction privacy.

## Features

- **Stealth Address Generation**: Create stealth addresses for enhanced privacy
- **Key Management**: Secure generation and storage of viewing and spending keys
- **Address Opening**: Derive private keys from stealth addresses
- **Privacy Protection**: Enhanced transaction privacy through stealth addresses
- **GunDB Integration**: Secure storage of encrypted stealth keys

## Installation

```bash
npm install @shogun/stealth-address
# or
yarn add @shogun/stealth-address
```

## Usage

```typescript
import { ShogunCore } from 'shogun-core';
import { StealthPlugin } from '@shogun/stealth-address';

// Initialize Shogun Core
const core = new ShogunCore({
  // Core configuration - no stealth config needed here
  gunInstance: new Gun(options),
  scope: "your-app",
  peers: ["http://localhost:8000/gun"]
});

// Register the stealth plugin
const stealthPlugin = new StealthPlugin();
core.register(stealthPlugin);

// Get the plugin after registration
const stealth = core.getPlugin('stealth');

// Generate stealth keys for the current user
await stealth.generateAndSaveKeys();

// Get stealth keys
const keys = await stealth.getStealthKeys();
console.log('Viewing key:', keys.viewingKey);
console.log('Spending key:', keys.spendingKey);

// Generate a stealth address for a recipient
const stealthResult = await stealth.generateStealthAddress(
  recipientViewingKey,
  recipientSpendingKey
);

console.log('Stealth address:', stealthResult.stealthAddress);
console.log('Ephemeral public key:', stealthResult.ephemeralPublicKey);
console.log('Recipient public key:', stealthResult.recipientPublicKey);

// Open a stealth address (recipient side)
const wallet = await stealth.openStealthAddress(
  stealthResult.stealthAddress,
  stealthResult.encryptedRandomNumber,
  stealthResult.ephemeralPublicKey
);

console.log('Derived wallet address:', wallet.address);
```

## API Reference

### StealthPlugin

The plugin is registered with the name `"stealth"` and provides the following methods:

#### Methods

- `generateAndSaveKeys(pair?: EphemeralKeyPair)`: Generate and save viewing/spending keys to GunDB
- `getStealthKeys()`: Retrieve user's encrypted stealth keys from GunDB
- `generateStealthAddress(viewingKey: string, spendingKey: string)`: Generate stealth address for recipient
- `openStealthAddress(address: string, encryptedNumber: string, ephemeralKey: string)`: Derive private key from stealth address
- `createAccount()`: Create ephemeral key pair for stealth operations

#### Return Types

```typescript
interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  encryptedRandomNumber: string;
  recipientPublicKey: string;
}

interface StealthKeys {
  spendingKey: string;
  viewingKey: string;
}
```

### Stealth Address Flow

1. **Key Generation**: Each user generates a viewing key and spending key pair using `generateAndSaveKeys()`
2. **Address Generation**: Sender uses recipient's public keys to generate a stealth address with `generateStealthAddress()`
3. **Transaction**: Sender sends funds to the generated stealth address
4. **Address Opening**: Recipient uses `openStealthAddress()` with their private keys to derive the stealth address private key
5. **Fund Access**: Recipient can now access funds sent to the stealth address using the derived private key

## Integration with Shogun Core

This plugin integrates seamlessly with Shogun Core's plugin system:

```typescript
// Check if plugin is available
if (core.hasPlugin('stealth')) {
  const stealthPlugin = core.getPlugin('stealth');
  // Use stealth functionality
}

// Plugin category
const privacyPlugins = core.getPluginsByCategory('privacy');
```

## Security Considerations

- **Key Storage**: Stealth keys are encrypted using Gun.js SEA and stored in GunDB
- **Privacy**: Stealth addresses provide transaction privacy by breaking the link between sender and recipient
- **Key Management**: Proper key management is crucial for stealth address functionality
- **Authentication**: User must be authenticated with Gun.js before using stealth functionality

## Dependencies

- `shogun-core`: ^1.1.4 (peer dependency)
- `ethers`: ^6.13.5
- `gun`: ^0.2020.1240

## Migration from Core

This plugin was previously part of `shogun-core` but has been extracted as a separate package for better modularity. If you were using stealth functionality from the core:

**Before (old core integration):**
```typescript
const core = new ShogunCore({
  stealthAddress: { enabled: true }
});
const stealth = core.getPlugin('stealth-address');
```

**After (external plugin):**
```typescript
import { StealthPlugin } from '@shogun/stealth-address';

const core = new ShogunCore(config);
core.register(new StealthPlugin());
const stealth = core.getPlugin('stealth');
```

## License

MIT 