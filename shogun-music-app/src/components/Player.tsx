import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';

const Player: React.FC = () => {
  const { 
    state, 
    togglePlayPause, 
    playNext, 
    playPrevious, 
    seekTo, 
    setVolume,
    setRepeatMode,
    toggleShuffleMode
  } = useApp();
  
  const { playerState } = state;
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Format time in MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerState.currentTrack || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percentX = (e.clientX - rect.left) / rect.width;
    const duration = playerState.currentTrack.duration;
    seekTo(percentX * duration);
  };

  // Handle volume bar click
  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeControlRef.current) return;
    
    const rect = volumeControlRef.current.getBoundingClientRect();
    const percentY = 1 - ((e.clientY - rect.top) / rect.height);
    setVolume(Math.max(0, Math.min(1, percentY)));
  };

  // Toggle repeat mode
  const handleRepeatToggle = () => {
    const currentMode = playerState.repeatMode;
    const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one'];
    const nextModeIndex = (modes.indexOf(currentMode) + 1) % modes.length;
    setRepeatMode(modes[nextModeIndex]);
  };

  // Close volume control when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        volumeControlRef.current && 
        !volumeControlRef.current.contains(e.target as Node) &&
        !(e.target instanceof Element && e.target.classList.contains('volume-icon'))
      ) {
        setShowVolumeControl(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentProgress = playerState.currentTrack 
    ? (playerState.currentTime / playerState.currentTrack.duration) * 100 
    : 0;

  return (
    <div className="player-container">
      {/* Track Info */}
      <div className="player-track-info">
        {playerState.currentTrack ? (
          <>
            {(playerState.currentTrack.coverUrl || playerState.currentTrack.artwork_path) && (
              <img 
                src={playerState.currentTrack.coverUrl || playerState.currentTrack.artwork_path} 
                alt={playerState.currentTrack.title} 
                className="player-artwork" 
              />
            )}
            <div className="player-track-details">
              <div className="player-track-title">{playerState.currentTrack.title}</div>
              <div className="player-track-artist">{playerState.currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-track-details">
            <div className="player-track-title">Nessun brano selezionato</div>
            <div className="player-track-artist">Seleziona un brano per iniziare</div>
          </div>
        )}
      </div>

      {/* Player Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          <button 
            className={`player-shuffle-btn ${playerState.shuffleMode ? 'active' : ''}`}
            onClick={toggleShuffleMode}
            title="Riproduzione casuale"
          >
            <i className="fas fa-random"></i>
          </button>
          
          <button 
            className="player-prev-btn"
            onClick={playPrevious}
            disabled={!playerState.currentTrack}
            title="Brano precedente"
          >
            <i className="fas fa-step-backward"></i>
          </button>
          
          <button 
            className="player-play-btn"
            onClick={togglePlayPause}
            disabled={!playerState.currentTrack}
            title={playerState.isPlaying ? 'Pausa' : 'Riproduci'}
          >
            <i className={`fas ${playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <button 
            className="player-next-btn"
            onClick={playNext}
            disabled={!playerState.currentTrack}
            title="Brano successivo"
          >
            <i className="fas fa-step-forward"></i>
          </button>
          
          <button 
            className={`player-repeat-btn ${playerState.repeatMode !== 'none' ? 'active' : ''}`}
            onClick={handleRepeatToggle}
            title={
              playerState.repeatMode === 'none' ? 'Ripeti tutto' : 
              playerState.repeatMode === 'all' ? 'Ripeti uno' : 'Disattiva ripetizione'
            }
          >
            <i className={`fas ${playerState.repeatMode === 'one' ? 'fa-repeat-1' : 'fa-repeat'}`}></i>
          </button>
        </div>

        <div className="player-progress-container">
          <span className="player-time-current">
            {formatTime(playerState.currentTime)}
          </span>
          
          <div 
            className="player-progress-bar" 
            ref={progressRef}
            onClick={handleProgressClick}
          >
            <div 
              className="player-progress" 
              style={{ width: `${currentProgress}%` }}
            ></div>
          </div>
          
          <span className="player-time-total">
            {playerState.currentTrack ? formatTime(playerState.currentTrack.duration) : '0:00'}
          </span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="player-volume">
        <button 
          className="player-volume-btn"
          onClick={() => setShowVolumeControl(!showVolumeControl)}
          title="Volume"
        >
          <i className={`fas ${
            playerState.volume === 0 ? 'fa-volume-mute' :
            playerState.volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'
          } volume-icon`}></i>
        </button>
        
        {showVolumeControl && (
          <div 
            className="player-volume-control" 
            ref={volumeControlRef}
            onClick={handleVolumeClick}
          >
            <div 
              className="player-volume-level" 
              style={{ height: `${playerState.volume * 100}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player; 