# GunDB Documentation

## Overview

The `GunDB` class provides an optimized interface for interacting with Gun, a decentralized database. It includes advanced authentication integration and simplifies common operations.

## Class: GunDB

### Constructor

- `constructor(options: GunDBOptions = {})`
  - Initializes a new instance of GunDB with the specified options.
  - `options` (optional): Configuration options for GunDB, including peers, localStorage, radisk, multicast, and axe.

### Methods

- `onAuth(callback: (user: any) => void): () => void`
  - Adds a listener for authentication events.
  - `callback`: Function to call when the user authenticates.
  - Returns a function to remove the listener.

- `getGun(): IGunInstance<any>`
  - Retrieves the underlying Gun instance.
  - Returns the Gun instance.

- `getUser(): any`
  - Retrieves the current user.
  - Returns the Gun user or null if not authenticated.

- `setCertificate(certificate: string): void`
  - Sets a certificate for the current user.
  - `certificate`: The certificate to use.

- `getCertificate(): string | null`
  - Retrieves the current user's certificate.
  - Returns the certificate or null if not available.

- `isUsernameAvailable(username: string): Promise<boolean>`
  - Checks if a username is available.
  - `username`: The username to check.
  - Returns a promise that resolves to true if the username is available, false otherwise.

- `signUp(username: string, password: string): Promise<any>`
  - Registers a new user.
  - `username`: The username to register.
  - `password`: The password to use.
  - Returns a promise that resolves with the user's public key.

- `login(username: string, password: string): Promise<any>`
  - Authenticates a user.
  - `username`: The username to authenticate.
  - `password`: The password to use.
  - Returns a promise that resolves with the authentication result.

- `logout(): void`
  - Logs out the current user.

- `isLoggedIn(): boolean`
  - Checks if a user is currently authenticated.
  - Returns true if a user is authenticated, false otherwise.

- `getCurrentUser(): any`
  - Retrieves the currently authenticated user.
  - Returns the current user or null if not authenticated.

- `saveUserData(path: string, data: any): Promise<any>`
  - Saves data to the user's node.
  - `path`: The path to save the data.
  - `data`: The data to save.
  - Returns a promise that resolves with the saved data.

- `getUserData(path: string): Promise<any>`
  - Retrieves data from the user's node.
  - `path`: The path to retrieve the data from.
  - Returns a promise that resolves with the retrieved data.

- `savePublicData(node: string, key: string, data: any): Promise<any>`
  - Saves data to a public node.
  - `node`: The node to save the data.
  - `key`: The key to save the data.
  - `data`: The data to save.
  - Returns a promise that resolves with the saved data.

- `getPublicData(node: string, key: string): Promise<any>`
  - Retrieves data from a public node.
  - `node`: The node to retrieve the data from.
  - `key`: The key to retrieve the data.
  - Returns a promise that resolves with the retrieved data.

- `generateKeyPair(): Promise<any>`
  - Generates a new SEA key pair.
  - Returns a promise that resolves with the generated key pair.
