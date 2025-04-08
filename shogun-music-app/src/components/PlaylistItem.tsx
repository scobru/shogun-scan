import React, { useState } from 'react';
import { Playlist } from '../types';
import { useApp } from '../contexts/AppContext';
import TrackList from './TrackList';

interface PlaylistItemProps {
  playlist: Playlist;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist }) => {
  const { deletePlaylist, playTrack } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Format date from timestamp
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Handle play playlist
  const handlePlayPlaylist = () => {
    if (playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  // Handle delete playlist
  const handleDeletePlaylist = async () => {
    if (confirmDelete) {
      try {
        await deletePlaylist(playlist.id);
        setConfirmDelete(false);
      } catch (error) {
        console.error('Error deleting playlist:', error);
      }
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div className="playlist-item">
      <div className="playlist-item-header">
        <div className="playlist-info">
          <h3 className="playlist-name">{playlist.name}</h3>
          <div className="playlist-meta">
            <span className="playlist-count">{playlist.tracks.length} brani</span>
            <span className="playlist-date">Creata il {formatDate(playlist.createdAt)}</span>
          </div>
        </div>
        
        <div className="playlist-actions">
          <button 
            className="playlist-play-btn"
            onClick={handlePlayPlaylist}
            disabled={playlist.tracks.length === 0}
            title="Riproduci playlist"
          >
            <i className="fas fa-play"></i>
          </button>
          
          <button 
            className="playlist-expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Nascondi brani' : 'Mostra brani'}
          >
            <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}></i>
          </button>
          
          <button 
            className={`playlist-delete-btn ${confirmDelete ? 'confirm' : ''}`}
            onClick={handleDeletePlaylist}
            title={confirmDelete ? 'Conferma eliminazione' : 'Elimina playlist'}
          >
            <i className="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="playlist-tracks">
          {playlist.tracks.length === 0 ? (
            <div className="playlist-empty-tracks">
              Nessun brano in questa playlist
            </div>
          ) : (
            <TrackList tracks={playlist.tracks} showPlaylistOptions={true} />
          )}
        </div>
      )}
    </div>
  );
};

export default PlaylistItem; 