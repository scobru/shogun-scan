import React, { createContext, useState } from 'react';

// Crea il contesto
export const PlaylistContext = createContext();

/**
 * Provider del contesto per le playlist
 * Versione temporanea semplificata
 */
export const PlaylistProvider = ({ children }) => {
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // Valori del contesto
  const value = {
    playlists,
    setPlaylists,
    activePlaylist,
    setActivePlaylist,
    favorites,
    setFavorites,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
}; 