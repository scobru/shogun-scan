export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork_path?: string;
  audio_path?: string;
  file_path?: string;
  coverUrl?: string;
  audioUrl?: string;
  originUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface Favorites {
  songs: Track[];
  artists: { id: string; name: string }[];
  albums: { id: string; name: string }[];
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  playlist: Track[];
  repeatMode: 'none' | 'all' | 'one';
  shuffleMode: boolean;
}

export interface AppState {
  tracks: Track[];
  favorites: Favorites;
  playlists: Playlist[];
  playerState: PlayerState;
  activeTab: 'songs' | 'favorites' | 'playlists' | 'admin';
  isLoading: boolean;
  serverStatus: boolean | null;
  error: string | null;
  isAuthenticated: boolean;
  userPub: string | null;
} 