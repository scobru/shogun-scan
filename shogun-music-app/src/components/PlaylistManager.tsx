import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import PlaylistItem from './PlaylistItem';

const PlaylistManager: React.FC = () => {
  const { state, createPlaylist } = useApp();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [filterText, setFilterText] = useState('');

  // Handle create new playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      await createPlaylist(newPlaylistName);
      setNewPlaylistName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating playlist:', error);
    }
  };

  // Filter playlists based on search text
  const filteredPlaylists = state.playlists.filter(playlist => 
    playlist.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="playlist-manager">
      <div className="playlist-header">
        <h2>Le tue Playlist</h2>
        <button 
          className="create-playlist-btn"
          onClick={() => setIsCreating(true)}
        >
          <i className="fas fa-plus"></i> Nuova Playlist
        </button>
      </div>

      {isCreating && (
        <div className="create-playlist-form">
          <input
            type="text"
            placeholder="Nome playlist"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="playlist-name-input"
          />
          <div className="playlist-form-buttons">
            <button 
              className="playlist-save-btn"
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim()}
            >
              Salva
            </button>
            <button 
              className="playlist-cancel-btn"
              onClick={() => {
                setIsCreating(false);
                setNewPlaylistName('');
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="playlist-search">
        <input
          type="text"
          placeholder="Cerca playlist..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="playlist-search-input"
        />
      </div>

      {filteredPlaylists.length === 0 ? (
        <div className="playlist-empty">
          {filterText ? 'Nessun risultato trovato' : 'Nessuna playlist disponibile'}
        </div>
      ) : (
        <div className="playlist-list">
          {filteredPlaylists.map(playlist => (
            <PlaylistItem key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistManager; 