import React, { useState } from 'react';
import { Track } from '../types';
import { useApp } from '../contexts/AppContext';

interface TrackItemProps {
  track: Track;
  index: number;
  onClick: () => void;
  showPlaylistOptions?: boolean;
}

const TrackItem: React.FC<TrackItemProps> = ({ 
  track, 
  index, 
  onClick, 
  showPlaylistOptions = false 
}) => {
  const { 
    state, 
    toggleFavorite, 
    isFavorite, 
    addTrackToPlaylist, 
    removeTrackFromPlaylist 
  } = useApp();
  
  const [showMenu, setShowMenu] = useState(false);
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle favorite toggle
  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track.id, 'songs');
  };

  // Handle menu toggle
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Handle adding track to playlist
  const handleAddToPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    addTrackToPlaylist(playlistId, track)
      .then(() => {
        setShowMenu(false);
      })
      .catch(error => {
        console.error('Error adding track to playlist:', error);
      });
  };

  // Handle removing track from playlist
  const handleRemoveFromPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    removeTrackFromPlaylist(playlistId, track.id)
      .then(() => {
        setShowMenu(false);
      })
      .catch(error => {
        console.error('Error removing track from playlist:', error);
      });
  };

  const isCurrentTrack = state.playerState.currentTrack?.id === track.id;
  const isPlaying = isCurrentTrack && state.playerState.isPlaying;
  const isFav = isFavorite(track.id, 'songs');

  return (
    <div 
      className={`track-item ${isCurrentTrack ? 'current-track' : ''} ${isPlaying ? 'playing' : ''}`}
      onClick={onClick}
    >
      <div className="track-number">
        {isPlaying ? 
          <i className="fas fa-volume-up"></i> : 
          index
        }
      </div>
      
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        {track.artwork_path && (
          <img src={track.artwork_path} alt={track.title} className="track-artwork" />
        )}
      </div>
      
      <div className="track-artist">{track.artist}</div>
      <div className="track-album">{track.album}</div>
      <div className="track-duration">{formatDuration(track.duration)}</div>
      
      <div className="track-actions">
        <button 
          className={`favorite-btn ${isFav ? 'favorited' : ''}`}
          onClick={handleFavoriteToggle}
          title={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          {isFav ? <i className="fas fa-heart"></i> : <i className="far fa-heart"></i>}
        </button>
        
        <button 
          className="track-menu-btn"
          onClick={handleMenuToggle}
          title="Opzioni"
        >
          <i className="fas fa-ellipsis-v"></i>
        </button>
        
        {showMenu && (
          <div className="track-menu">
            <div className="track-menu-header">
              <span>{track.title}</span>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="track-menu-body">
              {/* Add to playlist section */}
              <div className="track-menu-section">
                <h4>Aggiungi a Playlist</h4>
                {state.playlists.length === 0 ? (
                  <p>Nessuna playlist disponibile</p>
                ) : (
                  <ul>
                    {state.playlists.map(playlist => (
                      <li key={playlist.id}>
                        <button onClick={(e) => handleAddToPlaylist(e, playlist.id)}>
                          {playlist.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Remove from playlist section - only shown if in playlist view */}
              {showPlaylistOptions && (
                <div className="track-menu-section">
                  <h4>Rimuovi da Playlist</h4>
                  <ul>
                    {state.playlists
                      .filter(playlist => playlist.tracks.some(t => t.id === track.id))
                      .map(playlist => (
                        <li key={playlist.id}>
                          <button onClick={(e) => handleRemoveFromPlaylist(e, playlist.id)}>
                            {playlist.name}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackItem; 