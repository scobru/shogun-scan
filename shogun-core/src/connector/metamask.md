# MetaMask Connector Module Documentation

## Overview

The `metamask.ts` module provides functionality for integrating MetaMask, a popular Ethereum wallet, into the Shogun SDK. This module facilitates user authentication, wallet connection, and various Ethereum-related operations using MetaMask.

## Key Components

### Class: `MetaMask`

This class encapsulates all MetaMask-related operations and is the main interface for interacting with MetaMask within the Shogun SDK.

#### Properties

- `AUTH_DATA_TABLE`: A string representing the table name used for storing authentication data.
- `TIMEOUT_MS`: A static readonly number defining the timeout for operations in milliseconds.
- `customProvider`: An optional `ethers.JsonRpcProvider` for custom JSON-RPC endpoints.
- `customWallet`: An optional `ethers.Wallet` for custom wallet operations.
- `MESSAGE_TO_SIGN`: A string used as a fixed message for signing operations.

#### Methods

- `validateAddress(address: string): void`
  - Validates the given Ethereum address.
  - Throws an error if the address is invalid.

- `generateSecurePassword(signature: string): string`
  - Generates a secure password from a given signature.
  - Returns a hashed version of the signature.

- `connectMetaMask(): Promise<ConnectionResult>`
  - Attempts to connect to MetaMask and retrieve the user's Ethereum address.
  - Returns a `ConnectionResult` object indicating success or failure.

- `static isMetaMaskAvailable(): boolean`
  - Checks if MetaMask is available in the browser.
  - Returns `true` if MetaMask is detected, `false` otherwise.

- `generateCredentials(address: string): Promise<MetaMaskCredentials>`
  - Generates authentication credentials for the given Ethereum address.
  - Returns a `MetaMaskCredentials` object containing a username and password.

- `setCustomProvider(rpcUrl: string, privateKey: string): void`
  - Configures a custom JSON-RPC provider and wallet.
  - Throws an error if the provided parameters are invalid.

- `getSigner(): Promise<ethers.Signer>`
  - Retrieves the active Ethereum signer, either from a custom wallet or MetaMask.
  - Returns an `ethers.Signer` object.

- `getEthereumSigner(): Promise<ethers.Signer>`
  - Retrieves the Ethereum signer from MetaMask.
  - Returns an `ethers.Signer` object.

- `verifySignature(message: string, signature: string): Promise<string>`
  - Verifies the signature of a given message.
  - Returns the address that signed the message.

## Usage

To use the MetaMask connector, instantiate the `MetaMask` class and call its methods as needed. For example:

```
