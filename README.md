# Shogun - Decentralized Web3 Ecosystem

Shogun is a comprehensive toolkit for developing decentralized Web3 applications, focusing on privacy, security, and user ownership of data. Built around a philosophy of true decentralization, Shogun provides developers with powerful tools to create applications that respect user privacy while delivering modern, responsive experiences.

## Why Shogun?

In today's digital landscape, users are increasingly concerned about data privacy and ownership. Traditional Web2 applications often store user data in centralized servers, creating single points of failure and potential security risks. Meanwhile, many Web3 solutions are complex to implement and offer poor user experiences.

**Shogun addresses these challenges by:**
- Providing true data decentralization using GunDB's peer-to-peer architecture
- Simplifying complex Web3 authentication and wallet management
- Offering end-to-end encryption for all user data
- Delivering components with excellent developer and user experiences
- Creating a cohesive ecosystem where components work together seamlessly

## Ecosystem Components

### 📦 shogun-core

The core of the Shogun ecosystem, providing basic functionalities for decentralized authentication, distributed storage with GunDB, wallet management, and security. It implements WebAuthn standards, supports MetaMask, and offers end-to-end encryption capabilities.

**Main technologies:** TypeScript, GunDB, ethers.js, WebAuthn, SEA.js  
**Status:** Stable  
**Repository:** [github.com/scobru/shogun-core](https://github.com/scobru/shogun-core)

### 🔒 shogun-d3

Decentralized messaging system using end-to-end encryption, designed for secure peer-to-peer communication directly in the browser. Includes a chat demo that uses MetaMask for authentication. It relies on shogun-core for authentication and cryptographic key management functionalities.

**Main technologies:** JavaScript, GunDB, SEA.js, MetaMask, shogun-core  
**Status:** Beta  
**Repository:** [github.com/noctisatrae/shogun-d3](https://github.com/noctisatrae/shogun-d3)

### 💬 shogun-messenger-app

Messaging application based on Shogun that offers a complete user interface for decentralized communication between users.

**Main technologies:** React, TypeScript, Tailwind CSS  
**Status:** Beta  
**Repository:** [github.com/scobru/shogun-messenger-app](https://github.com/scobru/shogun-messenger-app)

### 🔘 shogun-button-react

React component to facilitate Shogun authentication integration into applications. Provides login and connection buttons for crypto wallets.

**Main technologies:** React, TypeScript  
**Status:** Stable  
**Repository:** [github.com/scobru/shogun-button-react](https://github.com/scobru/shogun-button-react)

### 📝 shogun-contracts

Ethereum smart contracts used in the Shogun ecosystem for blockchain functionalities.

**Main technologies:** Solidity, Hardhat  
**Status:** Alpha  
**Repository:** [github.com/scobru/shogun-contracts](https://github.com/scobru/shogun-contracts)

### 📋 shogun-panpot

Peer-to-peer messaging system based on Bugout and GunDB. Provides a decentralized message board and a client-server interface for P2P communication via WebRTC, with multilingual functionality.

**Main technologies:** JavaScript, HTML/CSS, Bugout, GunDB, WebRTC  
**Status:** Beta  
**Repository:** [github.com/scobru/shogun-panpot](https://github.com/scobru/shogun-panpot)

### 🤝 shogun-protocol

Definition of the Shogun protocol, including standards for authentication, certificates, contact management, and messaging.

**Main technologies:** JavaScript, GunDB  
**Status:** Stable  
**Repository:** [github.com/scobru/shogun-protocol](https://github.com/scobru/shogun-protocol)

### 📡 shogun-relay

Relay server for the Shogun network, facilitating communication between decentralized nodes using GunDB.

**Main technologies:** Express, GunDB, WebSockets  
**Status:** Stable  
**Repository:** [github.com/scobru/shogun-relay](https://github.com/scobru/shogun-relay)

### ✅ shogun-task-app

Task management application based on Shogun, demonstrating the use of the ecosystem for practical applications.

**Main technologies:** Next.js, React, Tailwind CSS  
**Status:** Beta  
**Repository:** [github.com/scobru/shogun-task-app](https://github.com/scobru/shogun-task-app)

### 💰 shogun-wallet-app

Wallet application for managing crypto assets, integrated with the Shogun ecosystem.

**Main technologies:** Vite, React, TypeScript  
**Status:** Beta  
**Repository:** [github.com/scobru/shogun-wallet-app](https://github.com/scobru/shogun-wallet-app)

## How Components Work Together

The following diagram illustrates how Shogun components interact:

```
┌─────────────────┐           ┌─────────────────┐
│   shogun-core   │           │   shogun-relay  │
└────────┬────────┘           └────────┬────────┘
         │                             │
    ┌────┼────────────┬────────────────┐
    │    │            │                │ 
    ▼    ▼            ▼                ▼ 
┌────────────┐  ┌──────────┐  ┌────────────┐
│  protocol  │  │    d3    │  │   panpot   │
└────────┬───┘  └──────────┘  └────────────┘
         │                             
         │                             
         └────────────────┐            
                          │            
                          ▼            
                   ┌─────────────────┐
                   │  messenger-app  │
                   └─────────────────┘


┌─────────────────┐
│  shogun-button  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐  ┌─────────┐
│  wallet │  │  task   │
└────┬────┘  └─────────┘
     │
     ▼
┌──────────────┐
│  contracts   │
└──────────────┘
```

## Main Features of the Ecosystem

- **Decentralized Authentication**: WebAuthn, MetaMask, cryptographic keys
- **Distributed Storage**: GunDB with real-time synchronization
- **Secure Messaging**: End-to-end encryption
- **Wallet Management**: BIP-44 compatible, support for stealth addresses
- **User Interfaces**: React components and complete applications
- **Smart Contracts**: Blockchain integrations
- **Open Protocols**: Standards for decentralized communication

## Getting Started with Shogun

### Prerequisites

- Node.js 16 or later
- Basic knowledge of React and TypeScript
- Basic understanding of Web3 concepts

### Installation and Basic Setup

To start using the Shogun ecosystem, it's advisable to first familiarize yourself with shogun-core, which provides the basic functionalities used by other components.

```bash
# Install shogun-core
npm install shogun-core
# or
yarn add shogun-core
```

### Example: Creating a Simple Authentication Flow

Here's a basic example of how to integrate authentication in a React application:

1. First, install the necessary packages:

```bash
npm install shogun-core shogun-button-react
```

2. Set up a basic authentication component:

```jsx
import React from 'react';
import { ShogunCore } from 'shogun-core';
import { ShogunButton, ShogunButtonProvider } from 'shogun-button-react';

const MyAuthComponent = () => {
  const shogunConfig = {
    peers: ['https://your-relay-server.com/gun'],
    appName: 'My Awesome App',
  };
  
  const shogun = new ShogunCore(shogunConfig);
  
  return (
    <ShogunButtonProvider
      sdk={shogun}
      onLoginSuccess={(user) => console.log('User logged in:', user)}
      onError={(error) => console.error('Auth error:', error)}
    >
      <div className="auth-container">
        <h2>Welcome to My App</h2>
        <p>Please sign in to continue</p>
        <ShogunButton />
      </div>
    </ShogunButtonProvider>
  );
};

export default MyAuthComponent;
```

3. For more complex applications, consider setting up a relay server:

```bash
# Clone and set up the relay server
git clone https://github.com/scobru/shogun-relay
cd shogun-relay
npm install
npm start
```

## Complete Application Examples

For complete examples of applications built with the Shogun ecosystem:

1. **Task Management**: Check out [shogun-task-app](https://github.com/scobru/shogun-task-app)
2. **Messaging**: Explore [shogun-messenger-app](https://github.com/scobru/shogun-messenger-app)
3. **Crypto Wallet**: See [shogun-wallet-app](https://github.com/scobru/shogun-wallet-app)

## Use Cases

- **Decentralized dApps**: User authentication and wallet management
- **Web Wallets**: Implementation of crypto wallets directly in the browser
- **Social dApps**: Social applications requiring decentralized storage and crypto identities
- **Privacy-Focused Applications**: Apps needing stealth features and advanced privacy
- **Secure Messaging**: End-to-end encrypted communication
- **Collaborative Tools**: Task managers, documents, and other collaborative applications

## Roadmap

The Shogun ecosystem is continuously evolving, with several key developments planned:

- **Q3 2023**: Multi-platform support with native mobile SDKs
- **Q4 2023**: Enhanced group messaging and collaboration features
- **Q1 2024**: Advanced file sharing with decentralized storage integration
- **Q2 2024**: More comprehensive smart contract integrations
- **Q3 2024**: Enterprise features including multi-user management and advanced permissions

## Frequently Asked Questions

### General Questions

**Q: Is Shogun suitable for production applications?**  
A: Components marked as "Stable" are ready for production use. Components in "Beta" are feature-complete but may still have some issues. "Alpha" components are still in active development.

**Q: How does Shogun compare to other Web3 development frameworks?**  
A: Shogun focuses on providing a complete ecosystem with user experience as a priority, while many other frameworks focus only on blockchain interaction or specific aspects of Web3.

**Q: What is GunDB and why does Shogun use it?**  
A: GunDB is a decentralized graph database that allows real-time data synchronization without requiring a central server. Shogun uses it to provide truly decentralized data storage with offline capabilities.

### Technical Questions

**Q: How do I ensure my Shogun application's data is backed up?**  
A: Shogun provides key backup mechanisms in shogun-core. User data is synchronized across peers, but it's important to maintain proper key management for user security.

**Q: Can I use Shogun with other blockchains besides Ethereum?**  
A: For now the core is focused on Ethereum and L2s, but the ecosystem is designed to be modular and compatible with other chains in the future.

**Q: How do I deploy a Shogun application?**  
A: Shogun applications can be deployed like regular web applications. For optimal performance, we recommend also deploying a shogun-relay instance.

## Security Considerations

- Shogun prioritizes security and privacy, but proper implementation is crucial
- Always follow security best practices when building applications
- Keep all dependencies updated to the latest versions
- For production applications, consider commissioning a security audit
- User education is important, especially regarding key management

## Contributing

Contributions are welcome! If you'd like to contribute to the project, you can:

1. Fork the repository of the component you want to improve
2. Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Submit a Pull Request

Please read our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## Community

---

## License

MIT 

---

© 2023 Shogun Protocol. All Rights Reserved. 