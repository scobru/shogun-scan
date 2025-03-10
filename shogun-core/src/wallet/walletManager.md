# WalletManager Documentation

## Overview
The `WalletManager` class is responsible for managing wallet functionalities within the Shogun Wallet application. It provides methods for importing and exporting user data, handling mnemonics, wallet keys, and Gun pairs, as well as encrypting and decrypting sensitive data.

## Methods

### `importMnemonic(mnemonicData: string, password?: string): Promise<boolean>`
Imports a mnemonic phrase or encrypted JSON data containing the mnemonic. If the data is encrypted, a password is required to decrypt it.

### `exportAllUserData(password: string): Promise<string>`
Exports all user data, including mnemonic, wallets, and Gun pair, into a single encrypted JSON file. A password is required to encrypt the data.

### `loadWalletPathsFromLocalStorage(): Promise<void>`
Loads wallet paths from local storage and adds them to the wallet paths managed by Gun if they are not already present.

### `exportGunPair(password?: string): Promise<string>`
Exports the Gun pair (public and private keys) of the authenticated user. If a password is provided, the data is encrypted.

### `importWalletKeys(walletsData: string, password?: string): Promise<number>`
Imports wallet keys from a JSON string or encrypted JSON data. If the data is encrypted, a password is required to decrypt it. Returns the number of successfully imported wallets.

### `importGunPair(pairData: string, password?: string): Promise<boolean>`
Imports a Gun pair from a JSON string or encrypted JSON data. If the data is encrypted, a password is required to decrypt it.

### `importAllUserData(backupData: string, password: string, options: { importMnemonic?: boolean; importWallets?: boolean; importGunPair?: boolean; } = { importMnemonic: true, importWallets: true, importGunPair: true }): Promise<{ success: boolean; mnemonicImported?: boolean; walletsImported?: number; gunPairImported?: boolean; }>`
Imports all user data from an encrypted JSON backup file. A password is required to decrypt the data. The import options allow specifying which data to import (mnemonic, wallets, Gun pair).

### `encryptSensitiveData(text: string): Promise<string>`
Encrypts sensitive data using the user's SEA key or a key derived from the user identifier. Returns the encrypted data as a JSON string.

### `decryptSensitiveData(encryptedText: string): Promise<string | null>`
Decrypts sensitive data using the user's SEA key or a key derived from the user identifier. Returns the decrypted data as a string or null if decryption fails.

### `loadWallets(): Promise<WalletInfo[]>`
Loads wallets for the authenticated user by deriving them from the master mnemonic and saved wallet paths. If no mnemonic is found, a default wallet is created.

### `generatePrivateKeyFromString(input: string): string`
Generates a private key from a given input string using a simplified SHA-256 hash function.

### `signMessage(wallet: ethers.Wallet, message: string | Uint8Array): Promise<string>`
Signs a message using the provided wallet. Returns the signed message as a string.

## Usage
To use the `WalletManager` class, instantiate it and call the desired methods. Ensure that the user is authenticated and that the necessary dependencies (e.g., Gun, SEA, ethers) are properly configured.
