# Shogun Music App

A React-based music player application with features for playing tracks, creating playlists, and managing favorites.

## Features

- Music player with play, pause, skip, and volume controls
- Track library with search and filter capabilities
- Favorites management
- Playlist creation and management
- Robust error handling and offline fallback capabilities
- API server status monitoring and connection retry
- Admin panel for track management and uploads

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/shogun-music-app.git
   cd shogun-music-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

## API Server

The app connects to an API server for retrieving music data. The server URL is configured in `public/index.html` with the `api-server` meta tag.

### Running with the API Server

1. Start the API server (follow the API server's documentation)
2. Ensure the API server is running on the URL specified in the meta tag (default: http://localhost:3001)
3. The app uses a proxy for development to avoid CORS issues

### Testing API Connectivity

The app includes a utility for testing API connectivity:

1. Open the browser console
2. Run the following command: `testAPIConnection()`
3. Check the console output for connectivity status

## Admin Panel

The admin panel provides functionality for uploading and managing tracks. It requires token authentication.

### Accessing the Admin Panel

1. Click on the "Admin" tab in the navigation menu
2. Enter your authentication token
   - For development, use `shogun-dev-token`
   - For production, use the actual token configured in the server (default: `thisIsTheTokenForReals2`)

### Uploading Tracks

The admin panel allows you to upload new tracks to the server:

1. Fill in the required track information (title, artist, album)
2. Upload artwork (optional) and audio file (required)
3. The uploaded files will be named `audioFile` and `artworkFile` in the form submission
4. Click "Upload Track" to add the track to the library

### Token Authentication

The admin panel uses token-based authentication to secure the upload functionality. The authentication happens via the `/api/admin/validate` endpoint, which expects a JSON payload with a `password` field. For security reasons, the token is stored in localStorage only after successful validation.

## Offline Mode

The app includes fallback data for when the API server is unavailable:

- The system automatically detects server unavailability
- A banner appears to inform users of connectivity issues
- Fallback tracks are used to ensure the app remains functional
- A retry button allows users to attempt reconnection

## Development

### Project Structure

- `/src/components` - React components
- `/src/contexts` - React contexts for state management
- `/src/services` - API and service classes
- `/src/utils` - Utility functions
- `/src/types` - TypeScript interface definitions
- `/src/data` - Fallback data for offline mode

### Testing

Run tests with the following command:

```
npm test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
