# Shogun Relay Module

A server-side component designed to facilitate real-time communication and data exchange within the Shogun ecosystem. This relay server enables seamless interaction between different Shogun applications while maintaining the decentralized and privacy-focused nature of the platform.

## Overview

Shogun Relay serves as a critical infrastructure component that:

- Provides a persistent connection point for Shogun applications
- Facilitates peer discovery and synchronization
- Enables real-time data propagation across the network
- Serves as a fallback when direct peer-to-peer connections are not possible
- Maintains a decentralized architecture without compromising on privacy

## Features

- **Express Server**: Robust HTTP server built on Express.js framework
- **GunDB Integration**: Leverages GunDB for decentralized data storage and synchronization
- **WebSocket Support**: Implements WebSocket protocol for real-time, bidirectional communication
- **CORS Configuration**: Properly configured cross-origin resource sharing for web application security
- **Data Persistence**: Optional local storage of relayed data with configurable retention
- **Status Dashboard**: Built-in web interface for monitoring server status and connectivity
- **Message Board**: Simple interactive demonstration of real-time capabilities
- **Peer Tracking**: Monitoring of connected peers with statistics
- **Scalable Architecture**: Designed to handle multiple concurrent connections

## Technical Architecture

Shogun Relay is built with a modular architecture:

```
shogun-relay/
├── index.js            # Main server application
├── package.json        # Dependencies and scripts
├── .env                # Configuration environment variables
└── radata/             # GunDB data storage directory
```

### Key Components

1. **HTTP Server**: Handles standard HTTP requests and serves the status dashboard
2. **WebSocket Server**: Manages persistent connections for real-time data transfer
3. **GunDB Instance**: Provides the decentralized database functionality
4. **Express Middleware**: Processes requests, handles CORS, and manages routing
5. **Status Dashboard**: Browser-based UI for monitoring server health

## Integration with Shogun Ecosystem

The Relay Module integrates with other Shogun components:

- **Shogun Wallet**: Provides connection points for wallet synchronization
- **Shogun Messenger**: Enables real-time message delivery
- **Shogun Task App**: Facilitates task list synchronization across devices
- **Shogun Core**: Leverages core protocol definitions and security measures

## Server Configuration

The server can be configured through environment variables:

- `PORT`: The port number to run the server on (default: 8765)
- `GUN_WEB_PATH`: Path for Gun WebSocket connections (default: "/gun")
- `PEERS`: Comma-separated list of other Gun peers to connect to
- `RADISK_ENABLED`: Enable/disable persistent storage (default: true)

## Getting Started

### Prerequisites

- Node.js 16 or later
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/shogun-relay.git
   cd shogun-relay
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

3. Configure environment variables (optional)
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

4. Start the server
   ```bash
   npm start
   # or
   yarn start
   ```

5. Navigate to `http://localhost:8765` to view the status dashboard

## Development

For development purposes, you can use the watch mode:

```bash
npm run dev
# or
yarn dev
```

### API Endpoints

- **GET /** - Serves the status dashboard HTML
- **POST /message** - Endpoint for saving messages to the shared database
  - Required parameters: `name`, `message`
  - Optional parameters: `email`

### WebSocket Interface

The WebSocket server is available at `ws://localhost:8765/gun` and follows the GunDB protocol for data synchronization.

## Security Considerations

- The server includes basic CORS protection
- No authentication is required for the demonstration dashboard
- For production use, consider implementing additional security measures:
  - TLS/SSL encryption
  - API key authentication
  - Rate limiting
  - IP filtering

## Performance Optimization

For high-traffic deployments, consider:

- Increasing Node.js memory allocation
- Using a process manager like PM2
- Implementing a load balancer for multiple relay instances
- Configuring radisk settings for optimal I/O performance

## Contributing

Contributions to Shogun Relay are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The Express.js team for their excellent web framework
- GunDB team for the decentralized database technology
- The Shogun ecosystem developers and community

