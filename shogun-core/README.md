# Shogun SDK Documentation

## Overview

Welcome to the Shogun SDK! This powerful and user-friendly SDK is designed to simplify decentralized authentication and wallet management. With support for various authentication methods including standard username/password, MetaMask, and WebAuthn, Shogun SDK integrates seamlessly with GunDB for decentralized user authentication. Whether you're building a new application or enhancing an existing one, Shogun SDK provides the tools you need to manage user authentication and crypto wallets efficiently.

## Key Features

- **Multi-layer Authentication**: Supports username/password, MetaMask, and WebAuthn.
- **Wallet Management**: Easily manage crypto wallets, mnemonics, and keys.
- **GunDB Integration**: Decentralized user authentication with GunDB.
- **Stealth Addresses**: Create and manage stealth addresses for enhanced privacy.
- **Storage Solutions**: Simple key-value storage with support for localStorage.

## Getting Started

To get started with Shogun SDK, follow these simple steps:

1. **Installation**: Install the SDK via npm or yarn.
   ```bash
   npm install @shogun/shogun-core
   # or
   yarn add @shogun/shogun-core
   ```

2. **Initialization**: Initialize the SDK with your configuration.
   ```typescript
   import { ShogunSDK } from '@shogun/shogun-core';

   const config = {
     // Your configuration here
   };

   const shogun = new ShogunSDK(config);
   ```

3. **Authentication**: Use the provided methods to authenticate users.
   ```typescript
   // Username/Password
   const loginResult = await shogun.login('username', 'password');

   // MetaMask
   const metaMaskLoginResult = await shogun.loginWithMetaMask('ethereumAddress');

   // WebAuthn
   const webAuthnLoginResult = await shogun.loginWithWebAuthn('username');
   ```

4. **Wallet Management**: Manage wallets, mnemonics, and keys.
   ```typescript
   // Export mnemonic
   const mnemonic = await shogun.exportMnemonic('password');

   // Import mnemonic
   const importResult = await shogun.importMnemonic('mnemonicData', 'password');
   ```

## Detailed Documentation

### ShogunSDK

#### Methods

- `constructor(config: ShogunSDKConfig)`: Initializes the Shogun SDK with the provided configuration.
- `isLoggedIn(): boolean`: Checks if the user is logged in.
- `logout(): void`: Logs out the current user.
- `login(username: string, password: string): Promise<AuthResult>`: Logs in a user with the provided username and password.
- `signUp(username: string, password: string, passwordConfirmation?: string): Promise<SignUpResult>`: Registers a new user with the provided username and password.
- `isWebAuthnSupported(): boolean`: Checks if WebAuthn is supported by the browser.
- `loginWithWebAuthn(username: string): Promise<AuthResult>`: Logs in a user with WebAuthn.
- `signUpWithWebAuthn(username: string): Promise<AuthResult>`: Registers a new user with WebAuthn.
- `loginWithMetaMask(address: string): Promise<AuthResult>`: Logs in a user with MetaMask.
- `signUpWithMetaMask(address: string): Promise<AuthResult>`: Registers a new user with MetaMask.
- `signMessage(wallet: ethers.Wallet, message: string | Uint8Array): Promise<string>`: Signs a message with the provided wallet.
- `verifySignature(message: string | Uint8Array, signature: string): string`: Verifies a signature.
- `signTransaction(wallet: ethers.Wallet, toAddress: string, value: string): Promise<string>`: Signs a transaction with the provided wallet.
- `exportMnemonic(password?: string): Promise<string>`: Exports the user's mnemonic.
- `exportWalletKeys(password?: string): Promise<string>`: Exports the private keys of all wallets.
- `exportGunPair(password?: string): Promise<string>`: Exports the user's Gun pair.
- `exportAllUserData(password: string): Promise<string>`: Exports all user data in a single file.
- `importMnemonic(mnemonicData: string, password?: string): Promise<boolean>`: Imports a mnemonic.

### MetaMask

- `connectMetaMask(): Promise<ConnectionResult>`: Connects to MetaMask and retrieves the user's Ethereum address.
- `isMetaMaskAvailable(): boolean`: Checks if MetaMask is available in the browser.
- `generateCredentials(address: string): Promise<MetaMaskCredentials>`: Generates authentication credentials for the given Ethereum address.

