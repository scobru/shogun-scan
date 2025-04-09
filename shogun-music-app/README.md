# Shogun Music Protocol Documentation

## Overview
Shogun Music Protocol is a decentralized protocol for music content distribution and metadata synchronization. Inspired by Audius, it enables peer-to-peer sharing of audio content while maintaining metadata consistency across a network of relay nodes.

## Protocol Architecture
The protocol is composed of three primary layers:
- **Storage Layer** - Manages physical file storage and retrieval
- **Metadata Layer** - Handles synchronization of song information across the network  
- **Identity Layer** - Manages user authentication and permissions

## Communication Protocols

### Storage Protocol
The Storage Protocol handles raw file data (MP3s and artwork) through HTTP-based communications.

#### Key Endpoints:
| Endpoint | Method | Auth Required | Description |
|----------|--------|--------------|-------------|
| /upload | POST | Yes | Upload audio or image files |
| /verify-file | GET | No | Check if a file exists by URL |
| /uploads/{filename} | GET | No | Access stored files (supports HTTP Range Requests) |
| /relays | GET | Yes | List registered metadata relays |
| /relays/add | POST | Yes | Register a new metadata relay |

#### File Upload Flow:
1. Client authenticates with token in the Authorization header
2. Client sends file as multipart/form-data
3. Server stores file and generates a public URL
4. Server notifies all registered metadata relays
5. Server returns file URL and notification status

### Metadata Protocol
The Metadata Protocol leverages GunDB for decentralized, peer-to-peer synchronization of song metadata.

#### Key Endpoints:
| Endpoint | Method | Auth Required | Description |
|----------|--------|--------------|-------------|
| /gun | WebSocket | No | Primary GunDB peer connection |
| /peers | GET | Yes | List connected GunDB peers |
| /peers/add | POST | Yes | Add a new GunDB peer |
| /file-uploaded | POST | Yes | Receive file notifications from storage relays |
| /api/search | GET | No | Search metadata with filters |

#### Metadata Sync Flow:
1. Client saves song metadata to the GunDB node
2. Metadata is automatically propagated to peer relays
3. Other clients receive updates in real-time through GunDB subscriptions

### Identity Protocol
The Identity Protocol manages user authentication and data ownership using GunDB's SEA (Security, Encryption, Authorization).

#### Authentication Flow:
- User Registration: `Gun.user().create(username, password, callback)`
- User Login: `Gun.user().auth(username, password, callback)`
- User Logout: `Gun.user().leave()`

#### Data Ownership:
- Public Data: Stored at `gun.get('music-protocol').get('songs')`
- User-Specific Data: Stored at `user.get('profile')` or similar paths

## Content Streaming
The protocol supports efficient audio streaming through standard HTTP Range Requests:
1. Client requests metadata containing fileUrl
2. Client initiates streaming by setting `<audio src="fileUrl">`
3. Browser automatically uses HTTP Range Requests to fetch only needed portions of the file
4. Storage relay serves ranges via Express static file serving

## Security Considerations

### Authentication Mechanisms:
- API Authentication: Simple token-based authentication for service-to-service communication
- User Authentication: GunDB SEA for end-user authentication

### Data Integrity:
- Files are validated when uploaded
- Metadata relay can verify file availability with storage relay

## Protocol Extension
The protocol can be extended through:
- Additional Relay Types: Specialized relays can be added for specific functions
- Custom Metadata Schemas: The metadata structure can be extended for new use cases
- Enhanced Permission Systems: More granular permissions can be implemented

## Network Topology
The Shogun network operates as a mesh of interconnected relays:
- Storage Relays: Host the actual files (MP3s, artwork)
- Metadata Relays: Sync and distribute metadata
- Identity Services: Manage user authentication

Each relay type can have multiple instances for redundancy and improved performance.

## Resilience Features
- Peer Discovery: Relays can dynamically discover and connect to each other
- Content Verification: Metadata relays can verify content availability
- Distributed State: No single point of failure for metadata

## Implementation Reference
The reference implementation consists of:
- Storage Relay: Express.js + Multer
- Metadata Relay: Express.js + GunDB
- Client: HTML5 + JavaScript with GunDB client library