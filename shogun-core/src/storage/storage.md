# Storage Documentation

## Overview

The `Storage` class provides a simple interface for storing and retrieving key-value pairs. It supports both in-memory storage using a `Map` and browser-based storage using `localStorage`.

## Class: Storage

### Constructor

- `constructor()`
  - Initializes a new instance of the `Storage` class.
  - If running in a browser environment, attempts to load data from `localStorage`.

### Methods

- `async getPair(): Promise<any>`
  - Retrieves the stored key pair asynchronously.
  - Returns a promise that resolves to the stored key pair or `null` if not found.

- `getPairSync(): any`
  - Retrieves the stored key pair synchronously.
  - Returns the stored key pair or `null` if not found.

- `async setPair(pair: any): Promise<void>`
  - Stores the provided key pair asynchronously.
  - `pair`: The key pair to store.
  - If running in a browser environment, also saves the key pair to `localStorage`.

- `clearAll(): void`
  - Clears all stored data.
  - If running in a browser environment, also clears the data from `localStorage`.

- `getItem(key: string): string | null`
  - Retrieves the value associated with the specified key.
  - `key`: The key to retrieve the value for.
  - Returns the value as a JSON string or `null` if not found.

- `setItem(key: string, value: string): void`
  - Stores the provided value under the specified key.
  - `key`: The key to store the value under.
  - `value`: The value to store, as a JSON string.
  - If running in a browser environment, also saves the value to `localStorage`.

- `removeItem(key: string): void`
  - Removes the value associated with the specified key.
  - `key`: The key to remove the value for.
  - If running in a browser environment, also removes the value from `localStorage`.

## Usage

To use the `Storage` class, instantiate it and call its methods as needed. For example:
