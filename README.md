# Bugoff Message Board

A secure peer-to-peer message board application built with Bugout and SEA encryption. This project demonstrates how to create a decentralized messaging system that works entirely in the browser without requiring a central server.

## Features

- **Peer-to-peer communication**: Messages are sent directly between peers using WebRTC
- **End-to-end encryption**: All messages are encrypted using SEA (Signal Elliptic-curve Alliance)
- **No central server**: The server is just another browser tab
- **Persistent identities**: Use the same cryptographic identity across sessions
- **Browser-based**: Works entirely in modern browsers

## Getting Started

### Prerequisites

- A modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)

### Running the Application

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/bugoff-messageboard.git
   cd bugoff-messageboard
   ```

2. Open the server file in your browser:
   ```
   open test/messageboard-server.html
   ```

3. In another browser tab, open the client file with the server's address (from the server page):
   ```
   open test/messageboard.html#{server-address}
   ```

Alternatively, you can try the demo at:
- Server: https://yourdomain.com/test/messageboard-server.html
- Client: https://yourdomain.com/test/messageboard.html

## How It Works

1. The server initializes with a random cryptographic identity
2. Clients connect to the server using its public address
3. When a client connects, it exchanges encryption keys with the server
4. Messages are end-to-end encrypted using these keys
5. The server broadcasts updates to all connected clients

## Project Structure

- `test/bugoff-browser.js` - The core library that handles encryption and communication
- `test/messageboard-server.html` - The server component
- `test/messageboard.html` - The client component

## Security Considerations

- All messages are encrypted using SEA encryption
- Peer identities are verified through public key exchange
- No messages are stored on a central server
- Communication is direct between peers

## Extending the Project

You can extend this project in several ways:

1. Add user authentication
2. Implement message persistence using localStorage or IndexedDB
3. Add additional UI features like user profiles
4. Implement file sharing capabilities

## Acknowledgments

This project is built upon:

- [Bugout](https://github.com/chr15m/bugout) - P2P WebRTC communication library
- [GUN/SEA](https://gun.eco/docs/SEA) - Security, Encryption, and Authorization

## License

This project is licensed under the MIT License - see the LICENSE file for details. 