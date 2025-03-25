# Shogun Messenger

A modern, decentralized messaging application built with SolidJS and IPFS, featuring end-to-end encryption, Web3 integration, and a sleek user interface. Shogun Messenger is part of the Shogun ecosystem, designed to provide secure and private communications using blockchain technology.

## About Shogun Messenger

Shogun Messenger leverages the Shogun Protocol and decentralized technologies to offer a unique messaging experience:

- **Privacy-First**: Your messages are encrypted end-to-end and stored on IPFS
- **Web3 Integration**: Connect using MetaMask or traditional username/password
- **No Central Servers**: Decentralized architecture means no central point of failure
- **Modern Interface**: Sleek, responsive design built with SolidJS and TailwindCSS
- **Open Source**: Community-driven development and transparency

## Features

- [x] Authentication
  - Username/Password login
  - MetaMask integration
  - WebAuthn support for secure biometric/hardware authentication
- [x] Profile Management
  - [x] Basic Profile with customizable settings
  - [ ] Profile Image (coming soon)
- [x] Appearance Settings
  - Light/Dark mode toggle
  - Customizable UI themes and preferences
- [x] Friend System
  - [x] Friend Requests
    - [x] Accept Friend Request with certificate verification
    - [x] Reject Friend Request
  - [x] Friend List management
- [x] Messaging
  - [x] Real-time Text Messaging with delivery confirmation
  - [x] Voice Recordings with encrypted storage
  - [ ] File Sharing (in development)
- [x] End-To-End Encrypted Messaging using ShogunD3 protocol
- [x] Progressive Web App capabilities
- [ ] Group Messaging (coming soon)

## Tech Stack

- **Frontend Framework**: [SolidJS](https://www.solidjs.com/) - A declarative, efficient and flexible JavaScript library for building user interfaces
- **Routing**: [@solidjs/router](https://github.com/solidjs/solid-router) - Flexible routing for SolidJS applications
- **Styling**: [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework for rapid UI development
- **Decentralized Storage**: [IPFS](https://ipfs.io/) - The InterPlanetary File System for distributed content storage
- **Authentication**: [Shogun Protocol](https://github.com/scobru/shogun-core) - Web3 authentication and identity management
- **State Management**: SolidJS Signals for reactive state management
- **Messaging Protocol**: [ShogunD3](https://github.com/noctisatrae/shogun-d3) - Decentralized messaging library
- **PWA Support**: Service Workers for offline capabilities and improved performance

## Integration with Shogun Ecosystem

Shogun Messenger integrates with other Shogun components:

- **Shogun Core**: Provides core authentication and cryptographic functions
- **Shogun Protocol**: Web3 identity and certificate management

## Project Structure

```
src/
├── assets/         # Static assets (images, icons, etc.)
├── components/     # Reusable UI components
│   ├── buttons/    # Button components
│   ├── content/    # Content display components
│   ├── modals/     # Modal dialog components
│   ├── navbar/     # Navigation components
│   ├── profile/    # User profile components
│   ├── sidebar/    # Sidebar navigation components
│   └── tabs/       # Tab interface components
├── contexts/       # SolidJS context providers
├── hooks/          # Custom hooks for shared logic
├── lib/            # Library code and utilities
├── pages/          # Page components organized by features
│   ├── authentication/ # Login/signup pages
│   ├── chat/       # Chat interface pages
│   ├── profile/    # Profile management pages
│   ├── settings/   # Application settings pages
│   ├── tabs/       # Tab content pages
│   └── welcome/    # Welcome/onboarding pages
├── providers/      # Application-wide providers
└── utils/          # Utility functions and helpers
```

## Getting Started

### Prerequisites

- Node.js 14 or later
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/shogun-messenger-app.git
   cd shogun-messenger-app
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

4. Open your browser and navigate to `http://localhost:3000`

## Development

The application follows a component-based architecture with these key characteristics:

- **Responsive Design**: Mobile-first approach ensures usability across all devices
- **Modular Structure**: Components are organized by feature and function
- **Context-based State**: Global state is managed through SolidJS context providers
- **Custom Hooks**: Reusable logic is extracted into custom hooks
- **Service Workers**: PWA capabilities for offline access and improved performance

### Key Workflows

- **Authentication Flow**: Users can authenticate via username/password, MetaMask, or WebAuthn
- **Messaging Flow**: End-to-end encrypted messages through ShogunD3 protocol
- **Friend Management**: Certificate-based friend request and verification system

## Deployment

The application can be deployed to various platforms:

- **Vercel**: Configuration included in `vercel.json`
- **Firebase**: Configuration in `firebase.json`
- **IPFS**: Can be deployed to IPFS for fully decentralized hosting

## Contributing

Contributions to Shogun Messenger are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The SolidJS team for the excellent framework
- IPFS for decentralized storage capabilities
- Shogun ecosystem developers for the protocol and core libraries
