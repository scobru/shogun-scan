import React, { useState } from 'react';
import { Track } from '../types';
import { useApp } from '../contexts/AppContext';
import TrackItem from './TrackItem';

interface TrackListProps {
  tracks: Track[];
  showPlaylistOptions?: boolean;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, showPlaylistOptions = false }) => {
  const { playTrack, refreshData, state } = useApp();
  const [filterText, setFilterText] = useState('');

  // Filter tracks based on search text
  const filteredTracks = tracks.filter(track => {
    const searchText = filterText.toLowerCase();
    return (
      track.title.toLowerCase().includes(searchText) ||
      track.artist.toLowerCase().includes(searchText) ||
      track.album.toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="track-list-container">
      <div className="track-list-controls">
        <div className="track-list-search">
          <input
            type="text"
            placeholder="Cerca brani, artisti o album..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="track-search-input"
          />
        </div>
        <button 
          className="refresh-button"
          onClick={refreshData}
          disabled={state.isLoading}
          title="Aggiorna la lista dei brani"
        >
          <i className={`fas fa-sync-alt ${state.isLoading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="track-list-empty">
          {filterText ? 'Nessun risultato trovato' : 'Nessun brano disponibile'}
        </div>
      ) : (
        <div className="track-list">
          <div className="track-list-header">
            <div className="track-number">#</div>
            <div className="track-info">Titolo</div>
            <div className="track-artist">Artista</div>
            <div className="track-album">Album</div>
            <div className="track-duration">Durata</div>
            <div className="track-actions"></div>
          </div>

          <div className="track-list-body">
            {filteredTracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                index={index + 1}
                onClick={() => playTrack(track, filteredTracks)}
                showPlaylistOptions={showPlaylistOptions}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackList; 