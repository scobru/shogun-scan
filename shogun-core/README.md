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

## Utilizzo in ambiente browser

Shogun Core può essere utilizzato direttamente nei browser web moderni. Questo rende possibile creare applicazioni decentralizzate che funzionano interamente dal browser del client.

### Installazione

Puoi includere Shogun Core in due modi:

#### 1. Utilizzando tag script

```html
<script src="path/to/shogun-core.js"></script>
```

#### 2. Utilizzando npm/yarn in un progetto frontend

```bash
npm install shogun-core
# oppure
yarn add shogun-core
```

E poi importarlo nelle tue applicazioni:

```javascript
// ESM
import { ShogunCore, initShogunBrowser } from 'shogun-core';

// CommonJS
const { ShogunCore, initShogunBrowser } = require('shogun-core');
```

### Esempi di utilizzo nel browser

```javascript
// Inizializza Shogun con configurazione ottimizzata per browser
const shogun = initShogunBrowser({
  peers: ['https://your-gun-relay.com/gun'],
  websocket: true, // Usa WebSocket per la comunicazione
  // Configurazione WebAuthn per autenticazione biometrica/device
  webauthn: {
    enabled: true,
    rpName: 'La Tua App',
    rpId: window.location.hostname
  }
});

// Registrazione
async function signup() {
  try {
    const result = await shogun.signUp('username', 'password');
    console.log('Registrazione completata:', result);
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
  }
}

// Login
async function login() {
  try {
    const result = await shogun.login('username', 'password');
    console.log('Login completato:', result);
  } catch (error) {
    console.error('Errore durante il login:', error);
  }
}

// Creazione di un wallet
async function createWallet() {
  if (!shogun.isLoggedIn()) {
    console.error('Devi effettuare il login prima!');
    return;
  }
  
  try {
    const wallet = await shogun.createWallet();
    console.log('Wallet creato:', wallet);
  } catch (error) {
    console.error('Errore durante la creazione del wallet:', error);
  }
}
```

Per un esempio completo, consulta il file [examples/browser-example.html](examples/browser-example.html).

### Note sulla compatibilità

La versione browser di Shogun Core:

- Supporta tutti i browser moderni (Chrome, Firefox, Safari, Edge)
- Include polyfill necessari per funzionalità node.js utilizzate da GunDB
- Ottimizza automaticamente le impostazioni per l'ambiente browser
- Fornisce supporto per WebAuthn quando disponibile nel browser

