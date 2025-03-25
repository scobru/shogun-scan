# Shogun Wallet

A modern, decentralized Ethereum wallet application built with React and TypeScript, featuring secure key management, stealth addresses, and Layer 2 integration. Shogun Wallet is part of the Shogun ecosystem, designed to provide secure and private cryptocurrency management using blockchain technology.

## About Shogun Wallet

Shogun Wallet leverages the Shogun Protocol and Web3 technologies to offer a unique wallet experience:

- **Security-First**: Multiple authentication methods with enhanced security measures
- **Stealth Payments**: Support for stealth address payments for increased privacy
- **Layer 2 Integration**: Support for Ethereum Layer 2 scaling solutions
- **Multiple RPC Networks**: Connect to various Ethereum networks seamlessly
- **Open Source**: Community-driven development and transparency

## Features

- [x] Authentication
  - Username/Password login with Shogun Protocol
  - MetaMask integration for existing wallet access
  - WebAuthn support for secure biometric/hardware authentication
- [x] Wallet Management
  - [x] Multiple wallet derivation and management
  - [x] HD wallet with mnemonic backup/restore
  - [x] Balance tracking across networks
- [x] Transaction Support
  - [x] Send/receive ETH and ERC-20 tokens
  - [x] Transaction history
  - [x] Gas fee optimization
- [x] Privacy Features
  - [x] Stealth address generation and management
  - [x] Ephemeral key pairs for enhanced privacy
- [x] Layer 2 Integration
  - [x] Support for popular Ethereum Layer 2 solutions
  - [x] Cross-layer transactions
- [x] Token Management
  - [x] ERC-20 token support
  - [x] Token discovery and import
- [x] Data Backup/Restore
  - [x] Encrypted backup solutions
  - [x] Import/export wallet data

## Tech Stack

- **Frontend Framework**: [React](https://reactjs.org/) - A JavaScript library for building user interfaces
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript for better development experience
- **Build Tool**: [Vite](https://vitejs.dev/) - Next generation frontend tooling
- **Ethereum Interaction**: [ethers.js](https://docs.ethers.org/) - Complete Ethereum library and wallet implementation
- **Authentication**: [Shogun Protocol](https://github.com/scobru/shogun-core) - Web3 authentication and identity management
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/) with persistent storage
- **UI Components**: Custom React components with responsive design
- **Cryptography**: Advanced encryption for secure key storage and stealth addresses

## Integration with Shogun Ecosystem

Shogun Wallet integrates with other Shogun components:

- **Shogun Core**: Provides core authentication and cryptographic functions
- **Shogun Button**: React component for simplified Shogun authentication
- **GunDB**: Decentralized database for secure data storage

## Project Structure

```
src/
├── assets/         # Static assets (images, icons, etc.)
├── components/     # Reusable UI components
│   ├── Button.tsx          # Custom button component
│   ├── MessageInput.tsx    # Message signing component
│   ├── Sidebar.tsx         # Application sidebar navigation
│   ├── ShogunLoginModal.tsx # Authentication modal
│   ├── StealthSection.tsx  # Stealth address management
│   └── TokenManager.tsx    # Token management interface
├── constants/      # Application constants and configuration
├── services/       # Service layer for external interactions
│   └── TokenService.ts     # ERC-20 token interaction service
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and helpers
└── App.tsx         # Main application component
```

## Getting Started

### Prerequisites

- Node.js 14 or later
- npm or yarn
- MetaMask extension (optional, for MetaMask integration)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/shogun-wallet-app.git
   cd shogun-wallet-app
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

3. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Development

The application follows a component-based architecture with these key characteristics:

- **Type Safety**: Comprehensive TypeScript typing for reliable development
- **Modular Structure**: Components and services organized by feature and function
- **State Management**: Redux Toolkit with persistence for robust state handling
- **Security Best Practices**: Secure key management and authentication flows
- **Responsive Design**: Mobile-friendly interface for on-the-go wallet access

### Key Workflows

- **Authentication Flow**: Users can authenticate via username/password, MetaMask, or WebAuthn
- **Wallet Creation/Import**: Generate new wallets or import existing ones via mnemonic phrases
- **Stealth Payments**: Create stealth addresses for enhanced privacy during transactions
- **Token Management**: Add, manage, and transact with ERC-20 tokens

## Security Features

- Private keys are never stored in plaintext
- Multiple authentication options for varied security needs
- Support for hardware authentication via WebAuthn
- Encrypted local storage with strong security practices
- Optional stealth address support for enhanced privacy

## Contributing

Contributions to Shogun Wallet are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The React and TypeScript teams for their excellent frameworks
- ethers.js for the comprehensive Ethereum library
- Shogun ecosystem developers for the protocol and core libraries