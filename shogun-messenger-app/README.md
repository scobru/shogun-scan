# Shogun Messenger

A decentralized messaging application built with SolidJS and IPFS, featuring end-to-end encryption and a modern user interface.

## Features

- [x] Authentication
  - Username/Password login
  - MetaMask integration
  - WebAuthn support
- [x] Profile Management
  - [x] Basic Profile
  - [ ] Profile Image
- [x] Appearance Settings
  - Light/Dark mode
  - Customizable UI
- [x] Friend System
  - [x] Friend Requests
    - [x] Accept Friend Request
    - [x] Reject Friend Request
  - [x] Friend List
- [x] Messaging
  - [x] Text Messaging
  - [x] Voice Recordings
  - [ ] File Sharing
- [x] End-To-End Encrypted Messaging
- [ ] Group Messaging

## Tech Stack

- **Frontend Framework**: SolidJS
- **Routing**: @solidjs/router
- **Styling**: TailwindCSS
- **Decentralized Storage**: IPFS
- **Authentication**: Shogun Protocol
- **State Management**: SolidJS Signals
- **PWA Support**: Service Workers

## Project Structure

```
src/
├── assets/         # Static assets
├── components/     # Reusable UI components
├── contexts/       # React contexts
├── hooks/          # Custom hooks
├── lib/           # Library code
├── pages/         # Page components
├── providers/     # App providers
└── utils/         # Utility functions
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Development

The application follows a component-based architecture with the following key features:

- Responsive design with mobile-first approach
- Modular component structure
- Context-based state management
- Custom hooks for reusable logic
- Service worker for offline capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
