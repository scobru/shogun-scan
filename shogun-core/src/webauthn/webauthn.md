# WebAuthn Documentation

## Overview

The `Webauthn` class provides methods for handling WebAuthn authentication, including creating accounts, authenticating users, and managing credentials. It ensures secure and user-friendly authentication using public key cryptography.

## Class: Webauthn

### Constructor

- `constructor()`
  - Initializes a new instance of the Webauthn class and sets the relying party ID (rpId).

### Methods

- `validateUsername(username: string): void`
  - Validates the provided username.
  - `username`: The username to validate.
  - Throws an error if the username is invalid.

- `createAccount(username: string, credentials: WebAuthnCredentials | null, isNewDevice = false, deviceName?: string): Promise<CredentialResult>`
  - Creates a new WebAuthn account.
  - `username`: The username for the new account.
  - `credentials`: Existing WebAuthn credentials, if any.
  - `isNewDevice`: Indicates if this is a new device.
  - `deviceName`: Optional name for the device.
  - Returns a promise that resolves to a `CredentialResult` object.

- `generateCredentials(username: string, existingCreds: WebAuthnCredentials | null, isNewDevice = false, deviceName?: string): Promise<CredentialResult>`
  - Generates WebAuthn credentials for the user.
  - `username`: The username for which to generate credentials.
  - `existingCreds`: Existing WebAuthn credentials, if any.
  - `isNewDevice`: Indicates if this is a new device.
  - `deviceName`: Optional name for the device.
  - Returns a promise that resolves to a `CredentialResult` object.

- `removeDevice(username: string, credentialId: string, credentials: WebAuthnCredentials): Promise<{ success: boolean; updatedCredentials?: WebAuthnCredentials }>`
  - Removes a device from the user's WebAuthn credentials.
  - `username`: The username associated with the credentials.
  - `credentialId`: The ID of the credential to remove.
  - `credentials`: The user's WebAuthn credentials.
  - Returns a promise that resolves to an object indicating success and optionally the updated credentials.

- `authenticateUser(username: string, salt: string | null): Promise<CredentialResult>`
  - Authenticates a user using WebAuthn.
  - `username`: The username to authenticate.
  - `salt`: The salt associated with the user's credentials.
  - Returns a promise that resolves to a `CredentialResult` object.

- `isSupported(): boolean`
  - Checks if WebAuthn is supported by the browser.
  - Returns `true` if WebAuthn is supported, `false` otherwise.

- `sign(data: any): Promise<any>`
  - Signs data using WebAuthn.
  - `data`: The data to sign.
  - Returns a promise that resolves to the signature.

## Interfaces

### DeviceInfo

- `deviceId: string`
  - The unique ID of the device.
- `timestamp: number`
  - The timestamp when the device was registered.
- `name: string`
  - The name of the device.
- `platform: string`
  - The platform of the device.

### WebAuthnCredentials

- `salt: string`
  - The salt used for generating credentials.
- `timestamp: number`
  - The timestamp when the credentials were created.
- `credentials: Record<string, DeviceInfo>`
  - A record of device information indexed by credential ID.

### CredentialResult

- `success: boolean`
  - Indicates if the operation was successful.
- `username?: string`
  - The username associated with the credentials.
- `password?: string`
  - The generated password.
- `credentialId?: string`
  - The ID of the credential.
- `deviceInfo?: DeviceInfo`
  - Information about the device.
- `error?: string`
  - An error message, if any.
- `webAuthnCredentials?: WebAuthnCredentials`
  - The updated WebAuthn credentials.

## Usage

To use the Webauthn class, instantiate it and call its methods as needed. For example:
