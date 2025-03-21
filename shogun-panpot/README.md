# SHOGUN PANPOT - Decentralized P2P Chat Suite

This project is a suite of decentralized peer-to-peer (P2P) chat applications with multiple implementations. It includes three distinct applications, each with a different approach to P2P communication and encryption technology.

## Available Implementations

### 1. PAN POT v3 - GunDB Implementation

The main application that uses **GunDB** for P2P communication with end-to-end encryption. This implementation leverages the latest shogun-core v3 and is the most modern and complete version of the suite.

Key features:

- Advanced and responsive user interface
- End-to-end message encryption
- Group chat in private rooms
- Private messages between users
- QR code generation for easy sharing
- Local data persistence through IndexedDB
- Based on WebRTC technology

### 2. PAN POT v2 - Encrypted Message Board (Bugoff Implementation)

Version that uses **[Bugoff](https://github.com/draeder/bugoff/tree/main)**, an extension of Bugout with support for end-to-end encryption.

Key features:

- Server-client architecture
- Based on WebTorrent
- Message encryption via SEA (Security, Encryption, Authorization)
- Secure key management
- Decentralized communication
- Message board-focused interface

### 3. PAN POT v1 - Standard Message Board (Bugout Implementation)

Basic version that uses **[Bugout](https://github.com/chr15m/bugout)** without encryption, ideal for testing and demonstrations.

Key features:

- Simple and lightweight implementation
- Clear text communication
- Server-client architecture
- Based on WebTorrent
- Minimal UI for quick demos

## Getting Started

1. Clone the repository:

   ```
   git clone https://github.com/shogun/shogun-panpot.git
   cd shogun-panpot
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Start the tracker server (required for all implementations):

   ```
   node src/v3/server.js
   ```

4. Open the main index in your browser to choose an implementation:
   ```
   http://localhost:8765
   ```

## Project Structure

```
shogun-panpot/
├── index.html                # Main page to select implementation
├── README.md                 # This file
├── src/
│   ├── v3/                   # Latest PAN POT implementation with GunDB (shogun-core v3)
│   │   ├── client.html       # Main client interface
│   │   ├── server.js         # Tracker server for GunDB
│   │   ├── shogun-core.js    # shogun-core library
│   ├── v2/                   # Encrypted implementation with Bugoff
│   │   ├── client.html
│   │   └── server.html
│   │   └── bugoff.js         # Bugoff library
│   │   └── bugout.js         # Bugout library
│   ├── v1/                   # Basic implementation with Bugout
│   │   ├── client.html
│   │   ├── server.html
│   │   └── bugout.min.js     # Bugout library
│   └── shogun.svg            # Project logo
```

## Differences Between Implementations

### Core Technology

- **PAN POT v3**: Uses GunDB, a decentralized real-time graph database with WebRTC and the latest shogun-core (https://github.com/shogun-dev/shogun-core)
- **PAN POT v2**: Uses [Bugoff](https://github.com/draeder/bugoff/tree/main), a Bugout extension with encryption
- **PAN POT v1**: Uses [Bugout](https://github.com/chr15m/bugout) for P2P communication via WebTorrent

### Encryption Approach

- **PAN POT v3**: End-to-end encryption via Gun SEA, with room keys and full support for private messages
- **PAN POT v2**: Encryption through SEA, with key exchange between peers
- **PAN POT v1**: No encryption, messages in clear text

### User Interface

- **PAN POT v3**: Modern UI with full support for user management, rooms, and private messages
- **PAN POT v2**: Basic UI focused on message board functionality
- **PAN POT v1**: Minimal UI for demos and testing

## Use Cases

- **Secure Communication**: Use PAN POT v3 for encrypted chats with a complete interface
- **Simple Demos or Tests**: Use PAN POT v1 for quick demonstrations
- **Technology Comparison**: Use all implementations to compare different approaches to P2P communication
- **Private Group Discussions**: Use PAN POT v3 for secure group chat rooms
- **Educational Purposes**: Compare different P2P technologies and encryption methods

## Common Limitations

- Connection stability depends on the network quality of participants
- Some networks might block WebRTC or WebTorrent connections
- The number of participants can affect performance
- Browser compatibility may vary depending on the implementation
- Not all implementations provide the same level of security

## External Dependencies

This project relies on the following external libraries:

- [GunDB](https://gun.eco/) - Decentralized graph database
- [Bugout](https://github.com/chr15m/bugout) - P2P networking over WebTorrent
- [Bugoff](https://github.com/draeder/bugoff/tree/main) - Encrypted extension for Bugout
- [shogun-core](https://github.com/shogun-dev/shogun-core) - Shared core library for all implementations

## Security Considerations

- The PAN POT v3 and v2 implementations provide end-to-end encryption
- Users should still exercise caution when sharing sensitive information
- PAN POT v1 does not encrypt messages and should not be used for sensitive communications
- P2P connections may expose IP addresses of participants

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.
