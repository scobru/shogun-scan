# Shogun Music

A modern, React-based music player application that allows users to create playlists, mark favorite songs, and enjoy their music collection.

## Features

- **Music Player**: Play, pause, skip, and control volume
- **Playlist Management**: Create, view, and edit playlists
- **Favorites**: Save and access your favorite tracks
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- React 18
- React Router 6
- Context API for state management
- CSS for styling (no external UI libraries)
- FontAwesome for icons

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shogun-music.git
   cd shogun-music
   ```

2. Install dependencies:
   ```bash
   npm install
   # or with yarn
   yarn install
   ```

3. Start the development server:
   ```bash
   npm start
   # or with yarn
   yarn start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  ├── components/         # Reusable components
  │   ├── common/         # Shared components like Header, Sidebar
  │   ├── Player/         # Music player components
  │   └── Playlist/       # Playlist-related components
  ├── contexts/           # React Context providers
  ├── hooks/              # Custom React hooks
  ├── services/           # API and utility services
  ├── views/              # Page components
  ├── App.jsx             # Main App component
  ├── index.js            # Entry point
  └── index.css           # Global styles
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Original Shogun Music project for inspiration
- All contributors and users who provide feedback 