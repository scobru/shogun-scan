import { Track, PlayerState } from '../types';

export class PlayerService {
  private audio: HTMLAudioElement;
  private playerState: PlayerState;
  private stateChangeListeners: ((state: PlayerState) => void)[] = [];
  private trackEndListeners: (() => void)[] = [];

  constructor() {
    this.audio = new Audio();
    this.playerState = {
      currentTrack: null,
      isPlaying: false,
      volume: 0.7,
      currentTime: 0,
      playlist: [],
      repeatMode: 'none',
      shuffleMode: false
    };

    // Set initial volume
    this.audio.volume = this.playerState.volume;

    // Initialize event listeners
    this.initEventListeners();
  }

  private initEventListeners(): void {
    // Update current time
    this.audio.addEventListener('timeupdate', () => {
      this.playerState.currentTime = this.audio.currentTime;
      this.notifyStateChange();
    });

    // Handle track end
    this.audio.addEventListener('ended', () => {
      this.notifyTrackEnd();
    });

    // Handle errors
    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });

    // Handle play/pause state changes
    this.audio.addEventListener('play', () => {
      this.playerState.isPlaying = true;
      this.notifyStateChange();
    });

    this.audio.addEventListener('pause', () => {
      this.playerState.isPlaying = false;
      this.notifyStateChange();
    });
  }

  // Play a track
  public async playTrack(track: Track, playlistTracks: Track[] = []): Promise<void> {
    try {
      // Get the audio file path, preferably using audioUrl
      let audioSrc = track.audioUrl || track.file_path;
      
      // If no audioUrl or file_path, try to use audio_path with originUrl
      if (!audioSrc && track.audio_path) {
        const baseUrl = track.originUrl || window.location.origin;
        audioSrc = `${baseUrl}${track.audio_path}`;
      }
      
      // If still no source, try to generate one
      if (!audioSrc) {
        audioSrc = `/api/stream/${track.id}`;
      }

      console.log(`Playing track ${track.id} - ${track.title} from URL: ${audioSrc}`);
      
      // Set the audio source
      this.audio.src = audioSrc;
      
      // Update player state
      this.playerState.currentTrack = track;
      this.playerState.playlist = playlistTracks;
      
      // Play the audio
      await this.audio.play();
      
      // Update state
      this.playerState.isPlaying = true;
      this.notifyStateChange();
    } catch (error) {
      console.error('Error playing track:', error);
      this.playerState.isPlaying = false;
      this.notifyStateChange();
    }
  }

  // Play/pause toggle
  public togglePlayPause(): void {
    if (!this.playerState.currentTrack) return;

    if (this.playerState.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  }

  // Stop playback
  public stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.playerState.isPlaying = false;
    this.playerState.currentTime = 0;
    this.notifyStateChange();
  }

  // Set volume (0-1)
  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = clampedVolume;
    this.playerState.volume = clampedVolume;
    this.notifyStateChange();
  }

  // Seek to a specific time
  public seekTo(time: number): void {
    if (!this.playerState.currentTrack) return;
    
    const clampedTime = Math.max(0, Math.min(time, this.audio.duration || 0));
    this.audio.currentTime = clampedTime;
    this.playerState.currentTime = clampedTime;
    this.notifyStateChange();
  }

  // Play next track
  public playNext(): Track | null {
    if (!this.playerState.currentTrack || this.playerState.playlist.length === 0) {
      return null;
    }

    const currentIndex = this.playerState.playlist.findIndex(
      track => track.id === this.playerState.currentTrack?.id
    );

    // No track found in playlist
    if (currentIndex === -1) {
      return null;
    }

    let nextIndex: number;

    if (this.playerState.shuffleMode) {
      // Play random track (not the current one)
      nextIndex = Math.floor(Math.random() * (this.playerState.playlist.length - 1));
      if (nextIndex >= currentIndex) nextIndex++;
    } else {
      // Play next track in sequence
      nextIndex = (currentIndex + 1) % this.playerState.playlist.length;
      
      // If repeat mode is 'none' and we're at the end, stop playback
      if (!this.playerState.repeatMode && nextIndex === 0) {
        this.stop();
        return null;
      }
    }

    const nextTrack = this.playerState.playlist[nextIndex];
    this.playTrack(nextTrack, this.playerState.playlist);
    return nextTrack;
  }

  // Play previous track
  public playPrevious(): Track | null {
    if (!this.playerState.currentTrack || this.playerState.playlist.length === 0) {
      return null;
    }

    const currentIndex = this.playerState.playlist.findIndex(
      track => track.id === this.playerState.currentTrack?.id
    );

    // No track found in playlist
    if (currentIndex === -1) {
      return null;
    }

    let prevIndex: number;

    if (this.playerState.shuffleMode) {
      // Play random track (not the current one)
      prevIndex = Math.floor(Math.random() * (this.playerState.playlist.length - 1));
      if (prevIndex >= currentIndex) prevIndex++;
    } else {
      // If we're at the beginning, loop back to the end
      prevIndex = currentIndex === 0 ? 
        this.playerState.playlist.length - 1 : 
        currentIndex - 1;
      
      // If repeat mode is 'none' and we're at the beginning, restart the current track
      if (!this.playerState.repeatMode && currentIndex === 0) {
        this.seekTo(0);
        return this.playerState.currentTrack;
      }
    }

    const prevTrack = this.playerState.playlist[prevIndex];
    this.playTrack(prevTrack, this.playerState.playlist);
    return prevTrack;
  }

  // Set repeat mode
  public setRepeatMode(mode: 'none' | 'all' | 'one'): void {
    this.playerState.repeatMode = mode;
    this.notifyStateChange();
  }

  // Toggle shuffle mode
  public toggleShuffleMode(): void {
    this.playerState.shuffleMode = !this.playerState.shuffleMode;
    this.notifyStateChange();
  }

  // Get current state
  public getState(): PlayerState {
    return { ...this.playerState };
  }

  // Add state change listener
  public addStateChangeListener(callback: (state: PlayerState) => void): void {
    this.stateChangeListeners.push(callback);
  }

  // Remove state change listener
  public removeStateChangeListener(callback: (state: PlayerState) => void): void {
    this.stateChangeListeners = this.stateChangeListeners.filter(cb => cb !== callback);
  }

  // Add track end listener
  public addTrackEndListener(callback: () => void): void {
    this.trackEndListeners.push(callback);
  }

  // Remove track end listener
  public removeTrackEndListener(callback: () => void): void {
    this.trackEndListeners = this.trackEndListeners.filter(cb => cb !== callback);
  }

  // Notify all state change listeners
  private notifyStateChange(): void {
    const stateSnapshot = { ...this.playerState };
    this.stateChangeListeners.forEach(listener => {
      listener(stateSnapshot);
    });
  }

  // Notify all track end listeners
  private notifyTrackEnd(): void {
    this.trackEndListeners.forEach(listener => {
      listener();
    });

    // Handle repeat modes
    if (this.playerState.repeatMode === 'one') {
      // Repeat the current track
      this.seekTo(0);
      this.audio.play().catch(error => {
        console.error('Error replaying track:', error);
      });
    } else {
      // Play the next track
      this.playNext();
    }
  }
} 