# Shogun Social - Mastodon-Compatible Social Network

This is a minimal Mastodon-compatible social network built on top of the Shogun relay infrastructure. It leverages GunDB for real-time data storage and ActivityPub for federation with other Mastodon and ActivityPub-compatible networks.

## Features

- **Public & Private Posts**: Create public posts that can be viewed by anyone
- **User Following**: Follow both local and remote users using ActivityPub
- **Timeline Views**: Home, public, and profile timeline views
- **Federation**: Compatibility with the Mastodon federation network
- **Real-time Updates**: Posts appear immediately thanks to GunDB
- **Likes**: Like posts from users you follow

## Architecture

The implementation consists of:

1. **API Layer** (`/test-env/src/routes/socialRoutes.js`):
   - REST endpoints for post creation, user following, and timeline retrieval
   - ActivityPub endpoints for federation

2. **Storage Layer** (GunDB):
   - Uses GunDB to store and sync posts, follows, and likes
   - Schema designed for social content:
     - `posts`: Global collection of all posts
     - `users/{username}/posts`: User-specific posts
     - `users/{username}/following`: Users being followed
     - `users/{username}/followers`: Users following this user

3. **ActivityPub Integration**:
   - WebFinger protocol for user discovery
   - Actor objects for user profiles
   - Inbox/outbox for message exchange
   - Follow, Create, and Like activity types

4. **User Interface** (`/test-env/src/ui/activitypub/index.html`):
   - Simple web interface for creating and viewing posts
   - Follow functionality for local and remote users
   - Timeline switching

## Getting Started

### Prerequisites
- Node.js 18 or higher
- A running Shogun relay server

### Running the Server

1. Navigate to the test-env directory:
   ```
   cd test-env
   ```

2. Start the server with the social features enabled:
   ```
   node start-social.js
   ```

3. Access the web interface at:
   ```
   http://localhost:8765/activitypub
   ```

### Usage Guide

1. **Creating Posts**:
   - Enter your username in the top field
   - Type your post in the "Create Post" textarea
   - Click "Post" to publish

2. **Following Users**:
   - For local users: Enter the username (e.g., `alice`)
   - For remote users: Enter the username@domain (e.g., `bob@example.org`)
   - Click "Follow"

3. **Viewing Timelines**:
   - Home: Shows posts from you and users you follow
   - Public: Shows all public posts
   - Profile: Shows only your posts

## Federation with Mastodon

To connect with a Mastodon instance:

1. Ensure your server is publicly accessible (or use a service like ngrok for testing)
2. Configure the HOST value in config.json to your public domain
3. From Mastodon, search for username@yourdomain.com
4. Follow the user from Mastodon

## Implementation Notes

- This is a minimal implementation focused on the core functionality
- For a production system, additional security measures would be needed:
  - Proper signature verification for ActivityPub messages
  - Rate limiting
  - Spam protection
- The implementation uses the existing Shogun authentication system

## Technical Details

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/post` | POST | Create a new post |
| `/api/social/posts/:username` | GET | Get all posts for a user |
| `/api/social/follow` | POST | Follow a user |
| `/api/social/timeline/:username` | GET | Get personalized timeline |
| `/api/social/timeline/public` | GET | Get public timeline |
| `/api/social/like` | POST | Like a post |
| `/api/social/u/:username` | GET | ActivityPub user profile |
| `/api/social/.well-known/webfinger` | GET | WebFinger user discovery |
| `/api/social/inbox/:username` | POST | ActivityPub inbox |

### GunDB Schema

```
posts/
  {postId}/
    id: string
    author: string
    content: string
    timestamp: number
    type: "Note"
    visibility: "public"|"private"
    likes: number
    replies: []

users/
  {username}/
    posts/
      {postId}/...
    following/
      {targetUser}/
        username: string
        domain: string
        timestamp: number
        remote: boolean
    followers/
      {followerUsername}/
        username: string
        domain: string
        timestamp: number
    likes/
      {postId}/
        postId: string
        timestamp: number

activitypub/
  posts/
    {postId}/...
```

## Credits

This project is part of the Shogun ecosystem and leverages:
- GunDB for decentralized data storage
- ActivityPub protocol for federation
- Express.js for the API layer 