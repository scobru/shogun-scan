# @shogun/bip44

BIP44 HD Wallet plugin for Shogun Core - Provides hierarchical deterministic wallet functionality.

## Features

- **BIP44 Compliance**: Full support for BIP44 hierarchical deterministic wallets
- **Multi-wallet Management**: Create and manage multiple wallets from a single mnemonic
- **Secure Storage**: Encrypted storage of sensitive data using GunDB
- **Balance Caching**: Efficient balance checking with configurable TTL
- **Transaction Management**: Send transactions with automatic nonce management
- **Import/Export**: Backup and restore wallet data with password protection
- **Event System**: Real-time wallet events and transaction monitoring

## Installation

```bash
npm install @shogun/bip44
# or
yarn add @shogun/bip44
```

## Usage

```typescript
import { ShogunCore } from 'shogun-core';
import { HDWalletPlugin } from '@shogun/bip44';

// Initialize Shogun Core
const core = new ShogunCore({
  // Core configuration - no BIP44 config needed here
  gunInstance: new Gun(options),
  scope: "your-app",
  peers: ["http://localhost:8000/gun"]
});

// Register the BIP44 plugin
const walletPlugin = new HDWalletPlugin();
core.register(walletPlugin);

// Get the plugin after registration
const wallet = core.getPlugin('bip44');

// Create a new wallet
const newWallet = await wallet.createWallet();
console.log('New wallet address:', newWallet.address);

// Load existing wallets
const wallets = await wallet.loadWallets();
console.log('Loaded wallets:', wallets.length);

// Generate a new mnemonic
const mnemonic = wallet.generateNewMnemonic();
console.log('New mnemonic:', mnemonic);

// Get standard BIP44 addresses
const addresses = wallet.getStandardBIP44Addresses(mnemonic, 5);
console.log('Generated addresses:', addresses);
```

## API Reference

### HDWalletPlugin

The plugin is registered with the name `"bip44"` and provides the following methods:

#### Wallet Management

- `createWallet()`: Create a new wallet from mnemonic
- `loadWallets()`: Load all user wallets from storage
- `generateNewMnemonic()`: Generate a new 12-word mnemonic phrase
- `getStandardBIP44Addresses(mnemonic: string, count: number)`: Get standard BIP44 addresses from mnemonic

#### Cryptographic Operations

- `signMessage(wallet: ethers.Wallet, message: string | Uint8Array)`: Sign a message with wallet
- `verifySignature(message: string | Uint8Array, signature: string)`: Verify message signature
- `signTransaction(wallet: ethers.Wallet, toAddress: string, value: string)`: Sign a transaction

#### Import/Export Operations

- `exportMnemonic(password?: string)`: Export encrypted mnemonic data
- `importMnemonic(data: any, password?: string)`: Import encrypted mnemonic data
- `exportWalletKeys(password?: string)`: Export encrypted wallet keys
- `importWalletKeys(data: any, password?: string)`: Import encrypted wallet keys
- `exportGunPair(password?: string)`: Export Gun.js key pair
- `importGunPair(data: any, password?: string)`: Import Gun.js key pair
- `exportAllUserData(password?: string)`: Export all user data
- `importAllUserData(data: any, password?: string)`: Import all user data

#### Configuration

The plugin uses internal configuration with sensible defaults:

```typescript
interface WalletConfig {
  balanceCacheTTL: number;    // 30000ms (30 seconds)
  rpcUrl?: string;            // Optional RPC URL
  defaultGasLimit: number;    // 21000
  maxRetries: number;         // 3
  retryDelay: number;         // 1000ms
}
```

## Integration with Shogun Core

This plugin integrates seamlessly with Shogun Core's plugin system:

```typescript
// Check if plugin is available
if (core.hasPlugin('bip44')) {
  const walletPlugin = core.getPlugin('bip44');
  // Use wallet functionality
}

// Plugin category
const walletPlugins = core.getPluginsByCategory('wallet');
```

## Security Considerations

- **Mnemonic Security**: Mnemonics are encrypted using Gun.js SEA before storage
- **Key Management**: Private keys are never stored in plain text
- **Authentication**: User must be authenticated with Gun.js before accessing wallet functionality
- **Balance Caching**: Balances are cached with TTL to reduce RPC calls while maintaining security

## Dependencies

- `shogun-core`: ^1.1.4 (peer dependency)
- `ethers`: ^6.13.5
- `gun`: ^0.2020.1240

## Migration from Core

This plugin was previously part of `shogun-core` but has been extracted as a separate package for better modularity. If you were using BIP44 functionality from the core:

**Before (old core integration):**
```typescript
const core = new ShogunCore({
  bip44: { enabled: true }
});
const wallet = core.getPlugin('bip44');
```

**After (external plugin):**
```typescript
import { HDWalletPlugin } from '@shogun/bip44';

const core = new ShogunCore(config);
core.register(new HDWalletPlugin());
const wallet = core.getPlugin('bip44');
```

## License

MIT 