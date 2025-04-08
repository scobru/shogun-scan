import { Track, Playlist, Favorites } from '../types';
import fallbackTracks from '../data/fallbackTracks';
import { SERVER_CONFIG, FALLBACK_CONFIG, buildApiUrl, logger } from '../config';

/**
 * Gets the API server URL from the meta tag
 * @returns API base URL to use
 */
const getApiBaseUrl = (): string => {
  if (typeof document === 'undefined') {
    return '/api'; // Server-side rendering fallback
  }
  
  // In production, use the direct URL
  const directUrl =  'http://localhost:3001';
  return `${directUrl.endsWith('/') ? directUrl.slice(0, -1) : directUrl}/api`;
};

export class ApiService {
  private baseUrl: string = SERVER_CONFIG.apiBasePath;
  private isServerAvailable: boolean | null = null;
  private _lastCheck: number | null = null;

  /**
   * Checks if the server is available
   * @returns A promise that resolves to true if the server is available, false otherwise
   */
  private async checkServerAvailability(): Promise<boolean> {
    // Se abbiamo già verificato lo stato del server nei secondi specificati in configurazione, utilizziamo il valore memorizzato
    if (this.isServerAvailable !== null && this._lastCheck && 
        (Date.now() - this._lastCheck) < FALLBACK_CONFIG.serverStatusCacheTime) {
      logger.info(`Using cached server status: ${this.isServerAvailable ? 'available' : 'unavailable'}`);
      return this.isServerAvailable;
    }
    
    logger.info(`Checking server availability using direct URL - env API URL: ${SERVER_CONFIG.apiUrl}`);
    
    try {
      // Set a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.requestTimeout.healthcheck);
      
      // Use the healthcheck endpoint from configuration with FULL URL
      const fullApiUrl = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${SERVER_CONFIG.endpoints.healthcheck}`;
      logger.info(`Making healthcheck request to: ${fullApiUrl}`);
      
      const response = await fetch(fullApiUrl, {
        method: 'GET',
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // If the response is ok, the server is available
      this.isServerAvailable = response.ok;
      this._lastCheck = Date.now();
      logger.info(`Server healthcheck response status: ${response.status} ${response.statusText}`);
      logger.info(`Server is ${this.isServerAvailable ? 'available' : 'unavailable'}`);
      
      return this.isServerAvailable;
    } catch (error: unknown) {
      // If there's an error, the server is unavailable
      this.isServerAvailable = false;
      this._lastCheck = Date.now();
      
      if (error instanceof Error) {
        logger.error(`Error checking server availability: ${error.message}`);
        if (error.name === 'AbortError') {
          logger.error('Request timed out during healthcheck');
        }
      } else {
        logger.error('Unknown error checking server availability');
      }
      
      return false;
    }
  }

  /**
   * Returns the current server status
   * @returns The current server status (true if available, false if unavailable, null if unknown)
   */
  public getServerStatus(): boolean | null {
    return this.isServerAvailable;
  }

  /**
   * Retries the server connection
   * @returns A promise that resolves to true if the server is available, false otherwise
   */
  public async retryServerConnection(): Promise<boolean> {
    // Quando si richiede esplicitamente un retry, invalidiamo la cache
    this._lastCheck = null;
    return await this.checkServerAvailability();
  }

  /**
   * Gets all tracks from the API
   * @returns A promise that resolves to an array of tracks
   */
  public async getTracks(): Promise<Track[]> {
    // First check if the server is available
    if (this.isServerAvailable === null) {
      await this.checkServerAvailability();
    }
    
    // If the server is unavailable, return fallback tracks
    if (this.isServerAvailable === false) {
      logger.info('Server unavailable, using fallback tracks');
      return fallbackTracks;
    }
    
    try {
      // Set a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.requestTimeout.default);
      
      // Make the request using FULL URL to ensure correct server
      const fullApiUrl = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${SERVER_CONFIG.endpoints.tracks}`;
      logger.info(`Fetching tracks from URL: ${fullApiUrl}`);
      
      const response = await fetch(fullApiUrl, {
        method: 'GET',
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // If the response is not ok, throw an error
      if (!response.ok) {
        throw new Error(`Error fetching tracks: ${response.statusText}`);
      }
      
      // Parse the response
      const data = await response.json();
      logger.info(`Received ${Array.isArray(data) ? data.length : 'unknown'} tracks from server`);
      
      // Check if the data is in the expected format
      if (Array.isArray(data) && data.length > 0 && 'id' in data[0]) {
        // Convert audio_path and artwork_path to audioUrl and coverUrl
        const tracks = data.map((track: any) => {
          const baseUrl = track.originUrl || SERVER_CONFIG.apiUrl;
          
          // Add audioUrl if audio_path exists
          if (track.audio_path && !track.audioUrl) {
            if (track.audio_path.startsWith('http')) {
              track.audioUrl = track.audio_path;
            } else {
              track.audioUrl = `${baseUrl}${track.audio_path}`;
            }
          }
          
          // Add coverUrl if artwork_path exists
          if (track.artwork_path && !track.coverUrl) {
            if (track.artwork_path.startsWith('http')) {
              track.coverUrl = track.artwork_path;
            } else {
              track.coverUrl = `${baseUrl}${track.artwork_path}`;
            }
          }
          
          // Add duration if missing
          if (!track.duration) {
            track.duration = 180; // Default to 3 minutes
          }
          
          return track;
        });
        
        logger.info(`Converted ${tracks.length} tracks with full URLs`);
        return tracks as Track[];
      } else {
        logger.warn('Data not in expected format, using fallback tracks');
        return fallbackTracks;
      }
    } catch (fetchError: unknown) {
      // If there's an error, log it and return fallback tracks
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logger.error('Request timed out, using fallback tracks');
      } else if (fetchError instanceof Error) {
        logger.error(`Error fetching tracks: ${fetchError.message}`);
      } else {
        logger.error('Unknown error fetching tracks');
      }
      
      logger.info('Using fallback tracks due to error');
      return fallbackTracks;
    }
  }

  /**
   * Validates a token with the server
   * @param token The token to validate
   * @returns A promise that resolves to true if the token is valid, false otherwise
   */
  public async validateToken(token: string): Promise<boolean> {
    try {
      // Se il token corrisponde a quello di sviluppo, validarlo immediatamente
      if (process.env.NODE_ENV === 'development' && token === SERVER_CONFIG.devToken) {
        logger.info('Development token validated locally');
        return true;
      }
      
      // Verifica connessione al server
      if (this.isServerAvailable === null) {
        await this.checkServerAvailability();
      }
      
      if (this.isServerAvailable === false) {
        logger.error('Server unavailable for token validation');
        return false;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.requestTimeout.default);
      
      // Use full URL for token validation
      const fullApiUrl = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${SERVER_CONFIG.endpoints.adminValidate}`;
      logger.info(`Validating token at: ${fullApiUrl}`);
      
      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: token }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return data.success === true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error validating token:', error);
      return false;
    }
  }

  /**
   * Uploads a track to the server
   * @param formData The form data containing the track details and files
   * @param token The authentication token
   * @returns A promise that resolves to an object with the upload result
   */
  public async uploadTrack(formData: FormData, token: string): Promise<{ success: boolean; message?: string; track?: Track }> {
    try {
      // Check server availability
      if (this.isServerAvailable === null) {
        await this.checkServerAvailability();
      }
      
      if (this.isServerAvailable === false) {
        return { success: false, message: 'Server non disponibile per il caricamento' };
      }
      
      // Set a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.requestTimeout.upload);
      
      logger.info('Starting track upload...');
      
      // Make the request using FULL URL (not just the endpoint path)
      const fullApiUrl = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${SERVER_CONFIG.endpoints.upload}`;
      logger.info(`Uploading to URL: ${fullApiUrl}`);
      
      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        logger.error(`Upload failed: ${errorData.message || response.statusText}`);
        return { success: false, message: errorData.message || 'Caricamento fallito' };
      }
      
      const data = await response.json();
      logger.info('Track uploaded successfully');
      return { success: true, track: data.track || data };
    } catch (error) {
      let errorMessage = 'Errore sconosciuto durante il caricamento';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.name === 'AbortError') {
          errorMessage = 'Il caricamento ha impiegato troppo tempo';
        }
      }
      
      logger.error(`Upload error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Deletes a track from the server
   * @param trackId The ID of the track to delete
   * @param token The authentication token
   * @returns A promise that resolves to true if the track was deleted, false otherwise
   */
  public async deleteTrack(trackId: string, token: string): Promise<boolean> {
    try {
      // Check server availability
      if (this.isServerAvailable === null) {
        await this.checkServerAvailability();
      }
      
      if (this.isServerAvailable === false) {
        logger.error('Server unavailable for deleting track');
        return false;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.requestTimeout.default);
      
      logger.info(`Deleting track: ${trackId}`);
      
      // Use full URL for delete operation
      const fullApiUrl = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${SERVER_CONFIG.endpoints.deleteTrack}/${trackId}`;
      logger.info(`Deleting track at: ${fullApiUrl}`);
      
      const response = await fetch(fullApiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        logger.info(`Track ${trackId} deleted successfully`);
      } else {
        logger.error(`Failed to delete track ${trackId}: ${response.statusText}`);
      }
      
      return response.ok;
    } catch (error) {
      logger.error('Error deleting track:', error);
      return false;
    }
  }

  // Favorites API
  public async getFavorites(): Promise<Favorites> {
    try {
      // First try to get favorites from GunDB
      const favorites = await this.getGunFavorites();
      if (favorites) {
        return favorites;
      }

      // If Gun fails, try localStorage as fallback
      const localFavorites = this.getLocalFavorites();
      if (localFavorites) {
        // Save to Gun for future use
        this.saveGunFavorites(localFavorites).catch(err => 
          logger.error('Error migrating local favorites to GunDB:', err)
        );
        return localFavorites;
      }

      // Fallback to empty favorites
      return {
        songs: [],
        artists: [],
        albums: []
      };
    } catch (error) {
      logger.error('Error loading favorites:', error);
      return {
        songs: [],
        artists: [],
        albums: []
      };
    }
  }

  public async saveFavorites(favorites: Favorites): Promise<boolean> {
    try {
      // First save to GunDB
      const gunSaved = await this.saveGunFavorites(favorites);
      
      // Also save to localStorage as backup
      this.saveLocalFavorites(favorites);
      
      return gunSaved;
    } catch (error) {
      logger.error('Error saving favorites:', error);
      // Try to save to localStorage as fallback
      try {
        this.saveLocalFavorites(favorites);
        return true;
      } catch (localError) {
        logger.error('Error saving to localStorage:', localError);
        return false;
      }
    }
  }

  public async toggleFavorite(id: string, type: keyof Favorites, name?: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      
      // For type safety, we need to handle each type differently
      if (type === 'songs') {
        const index = favorites.songs.findIndex(item => item.id === id);
        if (index === -1) {
          // Add the track to favorites
          const tracks = await this.getTracks();
          const track = tracks.find(track => track.id === id);
          if (track) {
            favorites.songs.push(track);
          }
        } else {
          // Remove the track from favorites
          favorites.songs.splice(index, 1);
        }
      } else if (type === 'artists' || type === 'albums') {
        const index = favorites[type].findIndex(item => item.id === id);
        if (index === -1 && name) {
          // Add the artist/album to favorites
          favorites[type].push({ id, name });
        } else if (index !== -1) {
          // Remove the artist/album from favorites
          favorites[type].splice(index, 1);
        }
      }
      
      await this.saveFavorites(favorites);
      
      // Return true if the item is now a favorite, false if it was removed
      if (type === 'songs') {
        return favorites.songs.some(item => item.id === id);
      } else if (type === 'artists') {
        return favorites.artists.some(item => item.id === id);
      } else {
        return favorites.albums.some(item => item.id === id);
      }
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      return false;
    }
  }

  public isFavorite(id: string, type: keyof Favorites): boolean {
    try {
      const favorites = this.getLocalFavorites();
      if (!favorites || !favorites[type]) {
        return false;
      }
      
      return favorites[type].some(item => 
        typeof item === 'object' ? item.id === id : item === id
      );
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      return false;
    }
  }

  // Playlists API
  public async getPlaylists(): Promise<Playlist[]> {
    try {
      const localData = localStorage.getItem('local_playlists');
      if (localData) {
        const parsedData = JSON.parse(localData);
        if (Array.isArray(parsedData)) {
          return this.normalizePlaylists(parsedData);
        }
      }
      
      return [];
    } catch (error) {
      logger.error('Error loading playlists:', error);
      return [];
    }
  }

  public async savePlaylists(playlists: Playlist[]): Promise<boolean> {
    try {
      const normalizedPlaylists = this.normalizePlaylists(playlists);
      localStorage.setItem('local_playlists', JSON.stringify(normalizedPlaylists));
      return true;
    } catch (error) {
      logger.error('Error saving playlists:', error);
      return false;
    }
  }

  public async createPlaylist(name: string, tracks: Track[] = []): Promise<Playlist> {
    try {
      const playlists = await this.getPlaylists();
      
      const newPlaylist: Playlist = {
        id: `playlist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name,
        tracks,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      playlists.push(newPlaylist);
      await this.savePlaylists(playlists);
      
      return newPlaylist;
    } catch (error) {
      logger.error('Error creating playlist:', error);
      throw error;
    }
  }

  public async addTrackToPlaylist(playlistId: string, track: Track): Promise<Playlist> {
    try {
      const playlists = await this.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) {
        throw new Error(`Playlist with id ${playlistId} not found`);
      }
      
      const playlist = playlists[playlistIndex];
      
      // Check if track already exists in playlist
      if (!playlist.tracks.some(t => t.id === track.id)) {
        playlist.tracks.push(track);
        playlist.updatedAt = Date.now();
        
        await this.savePlaylists(playlists);
      }
      
      return playlist;
    } catch (error) {
      logger.error('Error adding track to playlist:', error);
      throw error;
    }
  }

  public async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist> {
    try {
      const playlists = await this.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) {
        throw new Error(`Playlist with id ${playlistId} not found`);
      }
      
      const playlist = playlists[playlistIndex];
      const trackIndex = playlist.tracks.findIndex(t => t.id === trackId);
      
      if (trackIndex !== -1) {
        playlist.tracks.splice(trackIndex, 1);
        playlist.updatedAt = Date.now();
        
        await this.savePlaylists(playlists);
      }
      
      return playlist;
    } catch (error) {
      logger.error('Error removing track from playlist:', error);
      throw error;
    }
  }

  public async deletePlaylist(playlistId: string): Promise<boolean> {
    try {
      const playlists = await this.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex !== -1) {
        playlists.splice(playlistIndex, 1);
        await this.savePlaylists(playlists);
      }
      
      return true;
    } catch (error) {
      logger.error('Error deleting playlist:', error);
      return false;
    }
  }

  private normalizePlaylists(playlists: any[]): Playlist[] {
    if (!Array.isArray(playlists)) {
      return [];
    }
    
    return playlists.map(playlist => {
      // Ensure ID is valid
      if (!playlist.id) {
        playlist.id = `playlist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      } else if (typeof playlist.id !== 'string') {
        playlist.id = String(playlist.id);
      }
      
      // Ensure tracks is an array
      if (!Array.isArray(playlist.tracks)) {
        playlist.tracks = [];
      }
      
      // Add timestamps if missing
      if (!playlist.createdAt) playlist.createdAt = Date.now();
      if (!playlist.updatedAt) playlist.updatedAt = Date.now();
      
      return playlist;
    });
  }

  // Local Storage Helpers
  private getLocalFavorites(): Favorites | null {
    try {
      const localData = localStorage.getItem('user_favorites');
      if (localData) {
        return JSON.parse(localData);
      }
      return null;
    } catch (error) {
      logger.error('Error getting local favorites:', error);
      return null;
    }
  }

  private saveLocalFavorites(favorites: Favorites): void {
    try {
      localStorage.setItem('user_favorites', JSON.stringify(favorites));
    } catch (error) {
      logger.error('Error saving local favorites:', error);
    }
  }

  // GunDB Helpers
  private async getGunFavorites(): Promise<Favorites | null> {
    return new Promise((resolve) => {
      try {
        // Check if Gun is available
        if (!window.gun) {
          logger.error('Gun not available for loading favorites');
          resolve(null);
          return;
        }

        logger.info('Loading favorites from GunDB...');
        
        // Set a timeout to avoid infinite waits
        const timeout = setTimeout(() => {
          logger.warn('Timeout loading favorites from GunDB');
          resolve(null);
        }, SERVER_CONFIG.requestTimeout.default);

        // Use a user object or the public gun instance for favorites
        const gunRef = window.gun.get('user_favorites');
        
        gunRef.once((data: any) => {
          clearTimeout(timeout);
          
          if (data && typeof data === 'string') {
            try {
              // Parse the JSON string stored in Gun
              const parsedFavorites = JSON.parse(data);
              logger.info('Favorites loaded from GunDB');
              
              // Ensure all required properties exist
              if (!parsedFavorites.songs) parsedFavorites.songs = [];
              if (!parsedFavorites.artists) parsedFavorites.artists = [];
              if (!parsedFavorites.albums) parsedFavorites.albums = [];
              
              resolve(parsedFavorites);
            } catch (parseError) {
              logger.error('Error parsing favorites from GunDB:', parseError);
              resolve(null);
            }
          } else {
            logger.info('No favorites found in GunDB');
            resolve(null);
          }
        });
      } catch (error) {
        logger.error('Error getting favorites from GunDB:', error);
        resolve(null);
      }
    });
  }

  private async saveGunFavorites(favorites: Favorites): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Gun is available
        if (!window.gun) {
          logger.error('Gun not available for saving favorites');
          reject(new Error('Gun not available'));
          return;
        }

        // Ensure required properties exist
        if (!favorites.songs) favorites.songs = [];
        if (!favorites.artists) favorites.artists = [];
        if (!favorites.albums) favorites.albums = [];
        
        // Convert to JSON string to avoid GunDB array issues
        const stringifiedFavorites = JSON.stringify(favorites);
        
        logger.info(`Saving favorites to GunDB: ${favorites.songs.length} songs, ${favorites.artists.length} artists, ${favorites.albums.length} albums`);
        
        // Save to Gun
        window.gun.get('user_favorites').put(stringifiedFavorites, (ack: any) => {
          if (ack.err) {
            logger.error('Error saving favorites to GunDB:', ack.err);
            reject(new Error(`Save error: ${ack.err}`));
          } else {
            logger.info('Favorites saved successfully to GunDB');
            resolve(true);
          }
        });
      } catch (error) {
        logger.error('Error saving favorites to GunDB:', error);
        reject(error);
      }
    });
  }
}

// Add the Gun typing to Window interface
declare global {
  interface Window {
    gun: any;
  }
}

// Export a singleton instance
export default new ApiService(); 