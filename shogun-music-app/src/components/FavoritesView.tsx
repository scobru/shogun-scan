import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import TrackList from './TrackList';

const FavoritesView: React.FC = () => {
  const { state } = useApp();
  const [activeSection, setActiveSection] = useState<'songs' | 'artists' | 'albums'>('songs');

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h2>I tuoi Preferiti</h2>
        <div className="favorites-tabs">
          <button 
            className={`favorites-tab ${activeSection === 'songs' ? 'active' : ''}`}
            onClick={() => setActiveSection('songs')}
          >
            Brani ({state.favorites.songs.length})
          </button>
          <button 
            className={`favorites-tab ${activeSection === 'artists' ? 'active' : ''}`}
            onClick={() => setActiveSection('artists')}
          >
            Artisti ({state.favorites.artists.length})
          </button>
          <button 
            className={`favorites-tab ${activeSection === 'albums' ? 'active' : ''}`}
            onClick={() => setActiveSection('albums')}
          >
            Album ({state.favorites.albums.length})
          </button>
        </div>
      </div>

      <div className="favorites-content">
        {activeSection === 'songs' && (
          <div className="favorites-songs">
            {state.favorites.songs.length === 0 ? (
              <div className="favorites-empty">
                Non hai ancora brani preferiti
              </div>
            ) : (
              <TrackList tracks={state.favorites.songs} />
            )}
          </div>
        )}

        {activeSection === 'artists' && (
          <div className="favorites-artists">
            {state.favorites.artists.length === 0 ? (
              <div className="favorites-empty">
                Non hai ancora artisti preferiti
              </div>
            ) : (
              <div className="artist-grid">
                {state.favorites.artists.map(artist => (
                  <div key={artist.id} className="artist-card">
                    <div className="artist-image">
                      <i className="fas fa-user-circle"></i>
                    </div>
                    <div className="artist-name">{artist.name}</div>
                    <div className="artist-actions">
                      <button className="artist-play-btn">
                        <i className="fas fa-play"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'albums' && (
          <div className="favorites-albums">
            {state.favorites.albums.length === 0 ? (
              <div className="favorites-empty">
                Non hai ancora album preferiti
              </div>
            ) : (
              <div className="album-grid">
                {state.favorites.albums.map(album => (
                  <div key={album.id} className="album-card">
                    <div className="album-image">
                      <i className="fas fa-compact-disc"></i>
                    </div>
                    <div className="album-name">{album.name}</div>
                    <div className="album-actions">
                      <button className="album-play-btn">
                        <i className="fas fa-play"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesView; 