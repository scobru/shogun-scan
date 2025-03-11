# Shogun SDK

## Overview

Welcome to the Shogun SDK! This powerful and user-friendly SDK is designed to simplify decentralized authentication and wallet management. With support for various authentication methods including standard username/password, MetaMask, and WebAuthn, Shogun SDK integrates seamlessly with GunDB for decentralized user authentication. Whether you're building a new application or enhancing an existing one, Shogun SDK provides the tools you need to manage user authentication and crypto wallets efficiently.

## Key Features

- **Multi-layer Authentication**: Supports username/password, MetaMask, and WebAuthn.
- **Wallet Management**: Easily manage crypto wallets, mnemonics, and keys.
- **GunDB Integration**: Decentralized user authentication with GunDB.
- **Stealth Addresses**: Create and manage stealth addresses for enhanced privacy.
- **Storage Solutions**: Simple key-value storage with support for localStorage.

## Installation

```bash
npm install shogun-core
# o
yarn add shogun-core
```

## Basic Usage Example   

```typescript
import { ShogunSDK } from 'shogun-core';

// Initialize the SDK
const shogun = new ShogunSDK({
  peers: ['https://your-gun-peer.com/gun'],
  localStorage: true
});

// Authentication with username/password
const loginResult = await shogun.login('username', 'password');

// Or with MetaMask
const metaMaskLoginResult = await shogun.loginWithMetaMask('ethereumAddress');

// Or with WebAuthn
const webAuthnLoginResult = await shogun.loginWithWebAuthn('username');
```

## Full Documentation

Shogun SDK includes a complete technical documentation generated with TSDoc:

- **Local documentation**: View the documentation by opening `./docs/index.html`
- **Main classes**: View `./docs/classes/` for details on the main classes
- **Interfaces**: View `./docs/interfaces/` for details on the interfaces

## System Requirements and Compatibility

- **Modern browsers** with support for WebAuthn (Chrome, Firefox, Edge, Safari)
- **Node.js** 14 or higher
- Compatible with **ethers.js** v6

## Contribute

Contributions are welcome! If you would like to contribute to the project, please:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Added amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

