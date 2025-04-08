import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { ApiService } from '../services/ApiService';
import { PlayerService } from '../services/PlayerService';
import { AppState, Track, Playlist, Favorites, PlayerState } from '../types';
import { FALLBACK_CONFIG } from '../config';
import { sdk, gun } from '../services/ShogunConnector';
import { Login } from '../components/Login';

// Create services
const apiService = new ApiService();
const playerService = new PlayerService();

// Initial state
const initialState: AppState = {
  tracks: [],
  favorites: {
    songs: [],
    artists: [],
    albums: []
  },
  playlists: [],
  playerState: playerService.getState(),
  activeTab: 'songs',
  isLoading: true,
  serverStatus: null,
  error: null,
  isAuthenticated: false,
  userPub: null
};

// Create context
interface AppContextProps {
  state: AppState;
  setActiveTab: (tab: 'songs' | 'favorites' | 'playlists' | 'admin') => void;
  playTrack: (track: Track, playlist?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  toggleShuffleMode: () => void;
  toggleFavorite: (id: string, type: keyof Favorites, name?: string) => Promise<boolean>;
  isFavorite: (id: string, type: keyof Favorites) => boolean;
  createPlaylist: (name: string, tracks?: Track[]) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<Playlist>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  retryConnection: () => Promise<boolean>;
  validateToken: (token: string) => Promise<boolean>;
  uploadTrack: (formData: FormData, token: string) => Promise<{ success: boolean; message?: string; track?: Track }>;
  deleteTrack: (trackId: string, token: string) => Promise<boolean>;
  logout: () => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const lastRefreshRef = useRef<number>(0);
  const dataLoadPromiseRef = useRef<Promise<void> | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (sdk) {
        const isLoggedIn = sdk.isLoggedIn();
        if (isLoggedIn) {
          const user = gun?.user();
          if (user && user.is) {
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              userPub: user.is.pub
            }));
            await loadAllData();
          }
        }
      }
    };

    checkAuth();
  }, []);

  // Function to load all data
  const loadAllData = async (): Promise<void> => {
    // Se un caricamento è già in corso, attendiamo che termini
    if (dataLoadPromiseRef.current && isLoadingRef.current) {
      console.log('A data load is already in progress, reusing the promise');
      return dataLoadPromiseRef.current;
    }
    
    // Imposta lo stato di caricamento
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    isLoadingRef.current = true;
    
    // Crea una nuova promise
    const loadPromise = new Promise<void>(async (resolve) => {
      try {
        console.log('Loading all data...');
        
        // Check server status first - ma solo se non è ancora stato determinato
        const serverStatus = apiService.getServerStatus() !== null 
          ? apiService.getServerStatus() 
          : await apiService.retryServerConnection();
        
        setState(prev => ({ ...prev, serverStatus }));
        
        // Se il server non è disponibile, non tentiamo di caricare dati
        if (serverStatus === false) {
          console.log('Server non disponibile, utilizzo dati locali');
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: 'Server non disponibile. Utilizzando dati locali.'
          }));
          resolve();
          return;
        }
        
        // Load tracks
        console.log('Fetching tracks...');
        const tracks = await apiService.getTracks();
        setState(prev => ({ ...prev, tracks }));

        // Load favorites
        console.log('Fetching favorites...');
        const favorites = await apiService.getFavorites();
        setState(prev => ({ ...prev, favorites }));

        // Load playlists
        console.log('Fetching playlists...');
        const playlists = await apiService.getPlaylists();
        setState(prev => ({ 
          ...prev, 
          playlists,
          isLoading: false,
          serverStatus: apiService.getServerStatus(),
          error: null
        }));
        
        lastRefreshRef.current = Date.now();
        console.log('Data load complete');
      } catch (error) {
        console.error('Error loading data:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          serverStatus: apiService.getServerStatus(),
          error: error instanceof Error ? error.message : 'Failed to load data'
        }));
      } finally {
        isLoadingRef.current = false;
        resolve();
      }
    });
    
    dataLoadPromiseRef.current = loadPromise;
    return loadPromise;
  };

  // Logout function
  const logout = () => {
    if (sdk) {
      sdk.logout();
    }
    if (gun) {
      gun.user().leave();
    }
    setState(initialState);
  };

  // Refresh data on command, ma con un rate limiter per evitare troppe chiamate
  const refreshData = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastRefreshRef.current < FALLBACK_CONFIG.refreshCooldown) {
      console.log(`Refresh richiesto troppo frequentemente, ignoro. Attendi ${Math.ceil((FALLBACK_CONFIG.refreshCooldown - (now - lastRefreshRef.current)) / 1000)} secondi.`);
      return;
    }
    
    return loadAllData();
  };

  // Retry server connection
  const retryConnection = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      console.log('Attempting to reconnect to server...');
      const success = await apiService.retryServerConnection();
      setState(prev => ({ 
        ...prev, 
        serverStatus: success,
        isLoading: false,
        error: success ? null : 'Server non disponibile'
      }));
      
      if (success) {
        // If connection is now available, reload all data
        await loadAllData();
      }
      
      return success;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        serverStatus: false,
        isLoading: false,
        error: 'Impossibile connettersi al server'
      }));
      return false;
    }
  };

  // Load initial data
  useEffect(() => {
    console.log('AppProvider mounted, loading initial data');
    
    // Initialize Gun service if not already initialized
    if (sdk && !state.isAuthenticated) {
      const isLoggedIn = sdk.isLoggedIn();
      if (isLoggedIn) {
        const user = gun?.user();
        if (user && user.is) {
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            userPub: user.is.pub
          }));
          loadAllData();
        }
      }
    }
    
    // Cleanup on unmount
    return () => {
      console.log('AppProvider unmounting');
      // Cancella eventuali promesse di caricamento pendenti
      dataLoadPromiseRef.current = null;
    };
  }, []);

  // Listen for player state changes
  useEffect(() => {
    const handlePlayerStateChange = (playerState: PlayerState) => {
      setState(prev => ({ ...prev, playerState }));
    };

    playerService.addStateChangeListener(handlePlayerStateChange);

    return () => {
      playerService.removeStateChangeListener(handlePlayerStateChange);
    };
  }, []);

  // Set active tab
  const setActiveTab = (tab: 'songs' | 'favorites' | 'playlists' | 'admin') => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  // Player functions
  const playTrack = (track: Track, playlist?: Track[]) => {
    const tracksToPlay = playlist || state.tracks;
    playerService.playTrack(track, tracksToPlay);
  };

  const togglePlayPause = () => {
    playerService.togglePlayPause();
  };

  const playNext = () => {
    playerService.playNext();
  };

  const playPrevious = () => {
    playerService.playPrevious();
  };

  const seekTo = (time: number) => {
    playerService.seekTo(time);
  };

  const setVolume = (volume: number) => {
    playerService.setVolume(volume);
  };

  const setRepeatMode = (mode: 'none' | 'all' | 'one') => {
    playerService.setRepeatMode(mode);
  };

  const toggleShuffleMode = () => {
    playerService.toggleShuffleMode();
  };

  // Favorites functions
  const toggleFavorite = async (id: string, type: keyof Favorites, name?: string): Promise<boolean> => {
    const result = await apiService.toggleFavorite(id, type, name);
    
    // Update state
    const favorites = await apiService.getFavorites();
    setState(prev => ({ ...prev, favorites }));
    
    return result;
  };

  const isFavorite = (id: string, type: keyof Favorites): boolean => {
    return apiService.isFavorite(id, type);
  };

  // Playlist functions
  const createPlaylist = async (name: string, tracks: Track[] = []): Promise<Playlist> => {
    const playlist = await apiService.createPlaylist(name, tracks);
    
    // Update state
    const playlists = await apiService.getPlaylists();
    setState(prev => ({ ...prev, playlists }));
    
    return playlist;
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track): Promise<Playlist> => {
    const playlist = await apiService.addTrackToPlaylist(playlistId, track);
    
    // Update state
    const playlists = await apiService.getPlaylists();
    setState(prev => ({ ...prev, playlists }));
    
    return playlist;
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string): Promise<Playlist> => {
    const playlist = await apiService.removeTrackFromPlaylist(playlistId, trackId);
    
    // Update state
    const playlists = await apiService.getPlaylists();
    setState(prev => ({ ...prev, playlists }));
    
    return playlist;
  };

  const deletePlaylist = async (playlistId: string): Promise<boolean> => {
    const result = await apiService.deletePlaylist(playlistId);
    
    // Update state
    const playlists = await apiService.getPlaylists();
    setState(prev => ({ ...prev, playlists }));
    
    return result;
  };

  // Admin functions
  const validateToken = async (token: string): Promise<boolean> => {
    return await apiService.validateToken(token);
  };

  const uploadTrack = async (formData: FormData, token: string): Promise<{ success: boolean; message?: string; track?: Track }> => {
    const result = await apiService.uploadTrack(formData, token);
    
    // If successful, refresh tracks
    if (result.success) {
      const tracks = await apiService.getTracks();
      setState(prev => ({ ...prev, tracks }));
    }
    
    return result;
  };

  const deleteTrack = async (trackId: string, token: string): Promise<boolean> => {
    const success = await apiService.deleteTrack(trackId, token);
    
    // If successful, refresh tracks
    if (success) {
      const tracks = await apiService.getTracks();
      setState(prev => ({ ...prev, tracks }));
    }
    
    return success;
  };

  const value: AppContextProps = {
    state,
    setActiveTab,
    playTrack,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
    setRepeatMode,
    toggleShuffleMode,
    toggleFavorite,
    isFavorite,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    refreshData,
    retryConnection,
    validateToken,
    uploadTrack,
    deleteTrack,
    logout
  };

  // Render login if not authenticated
  if (!state.isAuthenticated) {
    return <Login />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use the app context
export const useApp = (): AppContextProps => {
  const context = useContext(AppContext);
  
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  
  return context;
}; 