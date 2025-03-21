# Shogun - Ecosistema Web3 Decentralizzato

Shogun è un ecosistema completo di strumenti per lo sviluppo di applicazioni Web3 decentralizzate, che include componenti per autenticazione, messaggistica, gestione wallet, interfacce utente e molto altro.

## Componenti dell'Ecosistema

### 📦 shogun-core

Il nucleo dell'ecosistema Shogun, fornisce le funzionalità di base per autenticazione decentralizzata, storage distribuito con GunDB, gestione wallet e sicurezza. Implementa standard WebAuthn, supporta MetaMask e offre funzionalità di crittografia end-to-end.

**Tecnologie principali:** TypeScript, GunDB, ethers.js, WebAuthn, SEA.js

### 🔒 shogun-d3

Sistema di messaggistica decentralizzata che utilizza la crittografia end-to-end, ideato per la comunicazione sicura peer-to-peer direttamente nel browser. Include una demo di chat che utilizza MetaMask per l'autenticazione. Si basa su shogun-core per le funzionalità di autenticazione e gestione delle chiavi crittografiche.

**Tecnologie principali:** JavaScript, GunDB, SEA.js, MetaMask, shogun-core

### 💬 shogun-messenger-app

Applicazione di messaggistica basata su Shogun che offre un'interfaccia utente completa per la comunicazione decentralizzata tra utenti.

**Tecnologie principali:** React, TypeScript, Tailwind CSS

### 🔘 shogun-button-react

Componente React per facilitare l'integrazione dell'autenticazione Shogun nelle applicazioni. Fornisce pulsanti di login e connessione per wallet crypto.

**Tecnologie principali:** React, TypeScript

### 📝 shogun-contracts

Smart contracts Ethereum utilizzati nell'ecosistema Shogun per funzionalità blockchain.

**Tecnologie principali:** Solidity, Hardhat

### 📋 shogun-panpot

Sistema di messaggistica peer-to-peer basato su Bugout e GunDB. Fornisce una bacheca di messaggi decentralizzata e un'interfaccia client-server per la comunicazione P2P attraverso WebRTC, con funzionalità multilingua.

**Tecnologie principali:** JavaScript, HTML/CSS, Bugout, GunDB, WebRTC

### 🤝 shogun-protocol

Definizione del protocollo Shogun, inclusi gli standard per autenticazione, certificati, gestione contatti e messaggistica.

**Tecnologie principali:** JavaScript, GunDB

### 📡 shogun-relay

Server relay per la rete Shogun, facilita la comunicazione tra nodi decentralizzati utilizzando GunDB.

**Tecnologie principali:** Express, GunDB, WebSockets

### ✅ shogun-task-app

Applicazione di gestione attività basata su Shogun, dimostra l'utilizzo dell'ecosistema per applicazioni pratiche.

**Tecnologie principali:** Next.js, React, Tailwind CSS

### 💰 shogun-wallet-app

Applicazione wallet per gestire asset crypto, integrata con l'ecosistema Shogun.

**Tecnologie principali:** Vite, React, TypeScript

## Funzionalità Principali dell'Ecosistema

- **Autenticazione Decentralizzata**: WebAuthn, MetaMask, chiavi crittografiche
- **Storage Distribuito**: GunDB con sincronizzazione in tempo reale
- **Messaggistica Sicura**: Crittografia end-to-end
- **Gestione Wallet**: Compatibile con BIP-44, supporto per indirizzi stealth
- **Interfacce Utente**: Componenti React e applicazioni complete
- **Smart Contracts**: Integrazioni blockchain
- **Protocolli Aperti**: Standard per la comunicazione decentralizzata

## Iniziare con Shogun

Per iniziare a utilizzare l'ecosistema Shogun, è consigliabile familiarizzare prima con shogun-core, che fornisce le funzionalità di base utilizzate dagli altri componenti.

```bash
# Installare shogun-core
npm install shogun-core
# oppure
yarn add shogun-core
```

Poi, a seconda delle esigenze, si possono integrare gli altri componenti come shogun-button-react per l'autenticazione UI o shogun-d3 per la messaggistica.

## Casi d'Uso

- **dApp Decentralizzate**: Autenticazione utente e gestione wallet
- **Wallet Web**: Implementazione di wallet crypto direttamente nel browser
- **Social dApp**: Applicazioni social che richiedono storage decentralizzato e identità crypto
- **Applicazioni Privacy-Focused**: App che necessitano di funzionalità stealth e privacy avanzate
- **Messaggistica Sicura**: Comunicazione end-to-end crittografata

## Contribuire

I contributi sono benvenuti! Se desideri contribuire al progetto, puoi:

1. Fare un fork del repository
2. Creare un branch per la tua funzionalità
3. Inviare una Pull Request

## Licenza

MIT 