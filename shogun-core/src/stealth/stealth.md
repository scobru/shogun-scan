# Stealth Documentation

## Overview

The `Stealth` class handles the logic for stealth addresses using Gun and SEA. It provides methods for creating stealth accounts, generating stealth addresses, and opening stealth addresses by deriving private keys.

## Class: Stealth

### Constructor

- `constructor()`
  - Initializes a new instance of the Stealth class.

### Methods

- `formatPublicKey(publicKey: string | null): string | null`
  - Removes the tilde (~) from the beginning of the public key if present.
  - `publicKey`: The public key to format.
  - Returns the formatted public key or null if invalid.

- `createAccount(): Promise<StealthKeyPair>`
  - Creates a new stealth account by generating a key pair.
  - Returns a promise that resolves to a `StealthKeyPair` object containing the generated keys.

- `generateStealthAddress(recipientPublicKey: string): Promise<StealthAddressResult>`
  - Generates a stealth address for the recipient's public key.
  - `recipientPublicKey`: The public key of the recipient.
  - Returns a promise that resolves to a `StealthAddressResult` object containing the stealth address and ephemeral public key.

- `openStealthAddress(stealthAddress: string, ephemeralPublicKey: string, pair: StealthKeyPair): Promise<ethers.Wallet>`
  - Opens a stealth address by deriving the private key.
  - `stealthAddress`: The stealth address to open.
  - `ephemeralPublicKey`: The ephemeral public key used in the address generation.
  - `pair`: The stealth key pair of the user.
  - Returns a promise that resolves to an `ethers.Wallet` object.

- `getPublicKey(publicKey: string): Promise<string | null>`
  - Retrieves the public key from an address.
  - `publicKey`: The public key to retrieve.
  - Returns a promise that resolves to the formatted public key or null if invalid.

- `prepareStealthKeysForSaving(stealthKeyPair: StealthKeyPair): StealthKeyPair`
  - Prepares the stealth keys for saving by validating the parameters.
  - `stealthKeyPair`: The stealth key pair to validate.
  - Returns the validated `StealthKeyPair` object.

- `deriveWalletFromSecret(secret: string): ethers.Wallet`
  - Derives a wallet from the shared secret.
  - `secret`: The shared secret to use for derivation.
  - Returns an `ethers.Wallet` object.

- `saveStealthHistory(address: string, data: any): void`
  - Saves the stealth data to localStorage.
  - `address`: The address to save the data for.
  - `data`: The data to save.

## Interfaces

### StealthData

- `recipientPublicKey: string`
  - The public key of the recipient.
- `ephemeralKeyPair: any`
  - The ephemeral key pair used in the address generation.
- `timestamp: number`
  - The timestamp of the data.
- `method?: string`
  - The method used for generating the address.
- `sharedSecret?: string`
  - The shared secret used for deriving the private key.

### StealthKeyPair

- `pub: string`
  - The public key.
- `priv: string`
  - The private key.
- `epub: string`
  - The ephemeral public key.
- `epriv: string`
  - The ephemeral private key.

### StealthAddressResult

- `stealthAddress: string`
  - The generated stealth address.
- `ephemeralPublicKey: string`
  - The ephemeral public key used in the address generation.
- `recipientPublicKey: string`
  - The public key of the recipient.

## Usage

To use the Stealth class, instantiate it and call its methods as needed. For example:
