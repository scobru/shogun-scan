/**
 * Shogun Music - Playlist Display Functions
 * Funzioni per visualizzare e gestire le playlist nell'interfaccia
 */

/**
 * Visualizza le tracce di una playlist specifica
 * @param {string} playlistId - ID della playlist da visualizzare
 */
window.displayPlaylistTracks = function(playlistId) {
  console.log(`Visualizzazione tracce della playlist: ${playlistId}`);
  
  if (!playlistId) {
    console.error("ID playlist mancante per la visualizzazione tracce");
    return;
  }
  
  // Debug dettagliato delle strutture dati
  console.log(`----- DEBUG PLAYLIST ID: ${playlistId} -----`);
  console.log("Tipo di playlistId:", typeof playlistId);
  
  // Debug delle playlist in memoria
  console.log("window.userPlaylists:", window.userPlaylists);
  
  // Debug del localStorage diretto
  try {
    const localData = localStorage.getItem('local_playlists');
    console.log("localStorage 'local_playlists':", localData);
    
    if (localData) {
      const parsed = JSON.parse(localData);
      console.log("Parsed localStorage:", parsed);
      
      if (Array.isArray(parsed)) {
        console.log(`Trovate ${parsed.length} playlist in localStorage`);
        
        // Controlla esplicitamente ogni playlist
        parsed.forEach((p, i) => {
          console.log(`Playlist #${i}:`, p);
          if (p.id) {
            console.log(`  ID: ${p.id} (${typeof p.id})`);
            console.log(`  Match esatto: ${p.id === playlistId}`);
            console.log(`  Match come stringa: ${String(p.id) === String(playlistId)}`);
          }
        });
        
        // Verifica corrispondenza diretta
        const directMatch = parsed.find(p => p.id === playlistId);
        if (directMatch) {
          console.log("TROVATA corrispondenza diretta in localStorage:", directMatch);
        }
        
        // Verifica corrispondenza dopo normalizzazione a stringa
        const stringMatch = parsed.find(p => String(p.id) === String(playlistId));
        if (stringMatch) {
          console.log("TROVATA corrispondenza con normalizzazione in localStorage:", stringMatch);
        }
      }
    }
  } catch (e) {
    console.error("Errore nella lettura/parsing di localStorage:", e);
  }
  console.log("----------------------------------");
  
  // Trova la playlist - con tentativo diretto da localStorage se necessario
  let playlist = null;
  
  // 1. Prova tramite funzione helper
  if (window.findPlaylistById) {
    playlist = window.findPlaylistById(playlistId);
    if (playlist) {
      console.log(`Playlist trovata tramite findPlaylistById: ${playlist.name}`);
    }
  }
  
  // 2. Se non trovata, tenta la lettura diretta da localStorage
  if (!playlist) {
    try {
      const localData = localStorage.getItem('local_playlists');
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          // Cerca exact match
          playlist = parsed.find(p => p.id === playlistId);
          
          // Se non trovata, cerca match normalizzato
          if (!playlist) {
            playlist = parsed.find(p => String(p.id) === String(playlistId));
            if (playlist) {
              console.log("Playlist trovata in localStorage con normalizzazione");
            }
          } else {
            console.log("Playlist trovata in localStorage con match esatto");
          }
          
          // Se ancora non trovata, cerca match parziale
          if (!playlist) {
            playlist = parsed.find(p => p.id && p.id.includes(playlistId) || 
                                    playlistId.includes(p.id));
            if (playlist) {
              console.log("Playlist trovata in localStorage con match parziale");
            }
          }
        }
      }
    } catch (e) {
      console.error("Errore nel tentativo di lettura diretta da localStorage:", e);
    }
  }
  
  // Se ancora non trovata, mostra messaggio e tenta recupero
  if (!playlist) {
    console.error(`Playlist non trovata: ${playlistId}`);
    
    // Crea uno snapshot delle playlist attuali per diagnosi
    const snapshot = {
      userPlaylists: window.userPlaylists || [],
      playlistManager: window.PlaylistManager ? window.PlaylistManager.playlists || [] : [],
    };
    console.log("Snapshot delle strutture dati al momento dell'errore:", snapshot);
    
    // Mostra messaggio "playlist non trovata" nell'interfaccia
    const playlistContainer = document.getElementById('playlistTracksContainer');
    if (playlistContainer) {
      playlistContainer.innerHTML = `
        <div class="empty-message">
          <p>Playlist non trovata: ${playlistId}</p>
          <div style="margin-top: 10px;">
            <button onclick="window.fixPlaylistsStorage(); setTimeout(() => window.displayPlaylistTracks('${playlistId}'), 500);" 
                    style="padding: 8px 16px; background: #333; border: none; color: white; cursor: pointer;">
              Tenta riparazione
            </button>
          </div>
        </div>`;
    }
    
    // Tentativo di recupero: forza ricaricamento delle playlist
    console.log("Tentativo di recupero playlist...");
    
    // Prima prova a ricaricare da localStorage
    if (window.PlaylistManager && typeof window.PlaylistManager.loadPlaylists === 'function') {
      window.PlaylistManager.loadPlaylists()
        .then(playlists => {
          console.log("Playlists ricaricate per il display:", playlists.length, playlists);
          
          // Cerca di nuovo la playlist
          const reloadedPlaylist = playlists.find(p => 
            String(p.id) === String(playlistId)
          );
          
          if (reloadedPlaylist) {
            console.log("Playlist trovata dopo ricaricamento:", reloadedPlaylist);
            displayPlaylistTracksInternal(reloadedPlaylist);
          } else {
            console.log("Playlist non trovata dopo ricaricamento");
            
            // Ultimo tentativo: riparazione storage
            if (window.fixPlaylistsStorage) {
              console.log("Tentativo riparazione storage...");
              const repairedPlaylists = window.fixPlaylistsStorage();
              
              const repairedPlaylist = repairedPlaylists.find(p => 
                String(p.id) === String(playlistId)
              );
              
              if (repairedPlaylist) {
                console.log("Playlist recuperata dopo riparazione:", repairedPlaylist);
                displayPlaylistTracksInternal(repairedPlaylist);
              } else {
                console.log("Playlist non trovata neanche dopo riparazione");
                
                // Mostra tutte le playlist disponibili come ultima risorsa
                const availablePlaylists = repairedPlaylists.map(p => 
                  `${p.name} (ID: ${p.id})`
                ).join('<br>');
                
                const playlistContainer = document.getElementById('playlistTracksContainer');
                if (playlistContainer) {
                  playlistContainer.innerHTML = `
                    <div class="empty-message">
                      <p>Playlist non trovata anche dopo riparazione.</p>
                      <p>ID richiesto: ${playlistId}</p>
                      <p>Playlist disponibili:</p>
                      <div style="text-align: left; margin-top: 10px;">
                        ${availablePlaylists || 'Nessuna playlist disponibile'}
                      </div>
                    </div>`;
                }
              }
            }
          }
        })
        .catch(err => console.error("Errore nel ricaricamento playlist:", err));
    }
    
    return;
  }
  
  // Funzione interna per mostrare le tracce
  displayPlaylistTracksInternal(playlist);
};

/**
 * Funzione interna per visualizzare le tracce di una playlist
 * @param {Object} playlist - Oggetto playlist 
 */
function displayPlaylistTracksInternal(playlist) {
  const playlistContainer = document.getElementById('playlistTracksContainer');
  
  if (!playlistContainer) {
    console.error("Container playlist non trovato nell'interfaccia");
    return;
  }
  
  // Imposta il titolo della playlist
  const playlistTitle = document.getElementById('currentPlaylistTitle');
  if (playlistTitle) {
    playlistTitle.textContent = playlist.name;
  }
  
  // Verifica che le tracce esistano
  if (!Array.isArray(playlist.tracks) || playlist.tracks.length === 0) {
    playlistContainer.innerHTML = '<div class="empty-message">Questa playlist è vuota</div>';
    return;
  }
  
  // Costruisci la lista delle tracce
  let html = '<div class="playlist-tracks">';
  
  playlist.tracks.forEach((track, index) => {
    // Normalizza l'oggetto traccia
    const trackObj = typeof track === 'string' ? 
      findTrackById(track) : track;
    
    if (!trackObj || !trackObj.id) {
      console.warn(`Traccia non valida nella playlist: ${JSON.stringify(track)}`);
      return;
    }
    
    const trackId = trackObj.id;
    const title = trackObj.title || 'Titolo sconosciuto';
    const artist = trackObj.artist || 'Artista sconosciuto';
    const duration = trackObj.duration || 0;
    const formattedDuration = formatDuration(duration);
    
    html += `
      <div class="track-item" data-id="${trackId}">
        <div class="track-number">${index + 1}</div>
        <div class="track-info">
          <div class="track-title">${title}</div>
          <div class="track-artist">${artist}</div>
        </div>
        <div class="track-duration">${formattedDuration}</div>
        <div class="track-actions">
          <button class="play-btn" onclick="playTrack('${trackId}')">
            <i class="fas fa-play"></i>
          </button>
          <button class="favorite-btn" 
            data-id="${trackId}" 
            data-type="songs" 
            onclick="toggleFavorite('${trackId}', 'songs', '${title}')">
            <i class="far fa-heart"></i>
          </button>
          <button class="remove-btn" onclick="removeTrackFromPlaylist('${playlist.id}', '${trackId}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  playlistContainer.innerHTML = html;
  
  // Aggiorna lo stato dei pulsanti preferiti
  updateFavoriteButtonsInContainer(playlistContainer);
}

/**
 * Trova una traccia per ID in tutte le sorgenti disponibili
 * @param {string} trackId - ID della traccia da trovare
 * @returns {Object|null} - Oggetto traccia o null
 */
function findTrackById(trackId) {
  if (!trackId) return null;
  
  console.log("Cercando traccia con ID:", trackId);
  console.log("Stato variabili tracce globali:");
  console.log("- window.tracks:", window.tracks ? "disponibile" : "non disponibile");
  console.log("- window.allTracks:", window.allTracks ? `disponibile (${window.allTracks.length} tracce)` : "non disponibile");
  console.log("- inMemoryDB:", window.inMemoryDB ? `disponibile (${Object.keys(window.inMemoryDB).length} tracce)` : "non disponibile");
  
  // Normalizza ID come stringa
  const normalizedId = String(trackId);
  
  // Cerca in tutte le sorgenti possibili
  let track = null;
  
  // 1. Cerca in window.tracks
  if (window.tracks && Array.isArray(window.tracks)) {
    track = window.tracks.find(t => String(t.id) === normalizedId);
    if (track) return track;
  }
  
  // 2. Cerca in window.allTracks
  if (window.allTracks && Array.isArray(window.allTracks)) {
    track = window.allTracks.find(t => String(t.id) === normalizedId);
    if (track) return track;
  }
  
  // 3. Cerca in inMemoryDB
  if (window.inMemoryDB && typeof window.inMemoryDB === 'object') {
    if (window.inMemoryDB[normalizedId]) {
      console.log("Traccia trovata in inMemoryDB:", window.inMemoryDB[normalizedId]);
      return window.inMemoryDB[normalizedId];
    }
    
    // Cerca anche con chiavi non normalizzate
    for (const key in window.inMemoryDB) {
      if (String(key) === normalizedId) {
        console.log("Traccia trovata in inMemoryDB con chiave diversa:", window.inMemoryDB[key]);
        return window.inMemoryDB[key];
      }
    }
  }
  
  // 4. Cerca utilizzando funzioni di API se disponibili
  if (window.shogunMusicAPI && typeof window.shogunMusicAPI.findLocalTrack === 'function') {
    track = window.shogunMusicAPI.findLocalTrack(trackId);
    if (track) return track;
  }
  
  // 5. Fallback: crea un oggetto traccia minimo
  console.warn(`Traccia ${trackId} non trovata in nessuna sorgente`);
  return {
    id: trackId,
    title: 'Traccia sconosciuta',
    artist: 'Artista sconosciuto',
    album: 'Album sconosciuto',
    duration: 0
  };
}

/**
 * Aggiorna lo stato dei pulsanti preferiti in un container
 * @param {HTMLElement} container - Elemento contenitore 
 */
function updateFavoriteButtonsInContainer(container) {
  if (!container) return;
  
  // Trova tutti i pulsanti preferiti nel container
  const favoriteButtons = container.querySelectorAll('.favorite-btn[data-id][data-type]');
  
  favoriteButtons.forEach(btn => {
    const id = btn.getAttribute('data-id');
    const type = btn.getAttribute('data-type');
    
    // Controlla se è tra i preferiti
    let isFavorite = false;
    
    if (window.FavoritesManager && typeof window.FavoritesManager.isFavorite === 'function') {
      isFavorite = window.FavoritesManager.isFavorite(id, type);
    } else if (window.userFavorites && window.userFavorites[type]) {
      isFavorite = window.userFavorites[type].some(item => 
        typeof item === 'object' ? item.id === id : item === id
      );
    }
    
    // Aggiorna lo stato visivo
    btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
    btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
  });
}

/**
 * Formatta la durata in secondi nel formato MM:SS
 * @param {number} seconds - Durata in secondi
 * @returns {string} - Durata formattata
 */
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Rimuove una traccia da una playlist
 * @param {string} playlistId - ID della playlist
 * @param {string} trackId - ID della traccia
 */
window.removeTrackFromPlaylist = function(playlistId, trackId) {
  if (!playlistId || !trackId) {
    console.error("ID playlist o traccia mancanti per la rimozione");
    return;
  }
  
  console.log(`Rimozione traccia ${trackId} dalla playlist ${playlistId}`);
  
  // Usa PlaylistManager se disponibile
  if (window.PlaylistManager && typeof window.PlaylistManager.removeTrackFromPlaylist === 'function') {
    window.PlaylistManager.removeTrackFromPlaylist(playlistId, trackId)
      .then(success => {
        if (success) {
          console.log(`Traccia ${trackId} rimossa con successo`);
          // Aggiorna la visualizzazione
          window.displayPlaylistTracks(playlistId);
        } else {
          console.error(`Errore nella rimozione della traccia ${trackId}`);
        }
      })
      .catch(err => console.error(`Errore nella rimozione della traccia: ${err}`));
  } else {
    console.error("PlaylistManager non disponibile per rimuovere la traccia");
  }
};

/**
 * Visualizza tutte le playlist disponibili
 * @param {Array} playlists - Array di playlist (opzionale)
 */
window.displayPlaylists = function(playlists) {
  console.log(`Visualizzazione di ${playlists ? playlists.length : 'tutte le'} playlist:`, playlists);
  
  // Se non è fornito l'array, carica le playlist
  if (!playlists) {
    if (window.PlaylistManager && typeof window.PlaylistManager.loadPlaylists === 'function') {
      window.PlaylistManager.loadPlaylists()
        .then(loadedPlaylists => {
          displayPlaylistsInternal(loadedPlaylists);
        })
        .catch(err => {
          console.error("Errore nel caricamento playlist:", err);
          displayPlaylistsInternal([]);
        });
    } else if (window.userPlaylists) {
      displayPlaylistsInternal(window.userPlaylists);
    } else {
      console.error("Nessuna fonte di playlist disponibile");
      displayPlaylistsInternal([]);
    }
  } else {
    displayPlaylistsInternal(playlists);
  }
};

/**
 * Funzione interna per visualizzare le playlist
 * @param {Array} playlists - Array di playlist
 */
function displayPlaylistsInternal(playlists) {
  // Aggiorna variabile globale
  window.userPlaylists = playlists;
  
  // Aggiorna la lista nel menu laterale
  const sidebarList = document.getElementById('playlistsSidebar');
  if (sidebarList) {
    let html = '';
    
    playlists.forEach(playlist => {
      html += `
        <div class="playlist-item" data-id="${playlist.id}">
          <span class="playlist-name">${playlist.name}</span>
          <span class="playlist-count">${playlist.tracks?.length || 0}</span>
        </div>
      `;
    });
    
    if (html === '') {
      html = '<div class="empty-message">Nessuna playlist</div>';
    }
    
    sidebarList.innerHTML = html;
    
    // Aggiungi event listener per selezione playlist
    const playlistItems = sidebarList.querySelectorAll('.playlist-item');
    playlistItems.forEach(item => {
      item.addEventListener('click', function() {
        const playlistId = this.getAttribute('data-id');
        // Seleziona questa playlist
        selectPlaylist(playlistId);
      });
    });
  }
  
  // Aggiorna la visualizzazione nella tab playlist
  const playlistsTab = document.getElementById('playlistsList');
  if (playlistsTab) {
    let html = '';
    
    playlists.forEach(playlist => {
      const trackCount = playlist.tracks?.length || 0;
      
      html += `
        <div class="playlist-card" data-id="${playlist.id}">
          <div class="playlist-header">
            <h3 class="playlist-title">${playlist.name}</h3>
            <div class="playlist-actions">
              <button class="play-btn" onclick="playPlaylist('${playlist.id}')">
                <i class="fas fa-play"></i>
              </button>
              <button class="delete-btn" onclick="deletePlaylist('${playlist.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="playlist-info">
            <span class="playlist-count">${trackCount} brani</span>
          </div>
        </div>
      `;
    });
    
    if (html === '') {
      html = '<div class="empty-message">Nessuna playlist creata</div>';
    }
    
    playlistsTab.innerHTML = html;
    
    // Aggiungi event listener per aprire una playlist
    const playlistCards = playlistsTab.querySelectorAll('.playlist-card');
    playlistCards.forEach(card => {
      card.addEventListener('click', function(e) {
        // Non triggerare se il click è su un pulsante
        if (e.target.closest('button')) return;
        
        const playlistId = this.getAttribute('data-id');
        selectPlaylist(playlistId);
      });
    });
  }
}

/**
 * Seleziona una playlist e visualizza le sue tracce
 * @param {string} playlistId - ID della playlist
 */
function selectPlaylist(playlistId) {
  console.log(`Selezionata playlist: ${playlistId}`);
  
  // Aggiorna UI per mostrare la playlist selezionata
  document.querySelectorAll('.playlist-item').forEach(item => {
    item.classList.remove('active');
  });
  
  document.querySelectorAll(`.playlist-item[data-id="${playlistId}"]`).forEach(item => {
    item.classList.add('active');
  });
  
  // Mostra la tab corretta se necessario
  showPlaylistTab();
  
  // Visualizza le tracce della playlist
  window.displayPlaylistTracks(playlistId);
}

/**
 * Mostra la tab playlist nel contenuto principale
 */
function showPlaylistTab() {
  // Nascondi tutte le tab
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  
  // Mostra la tab playlist
  const playlistTab = document.querySelector('.content-tab[data-tab="playlists"]');
  if (playlistTab) {
    playlistTab.classList.add('active');
    playlistTab.style.display = 'block';
  }
  
  // Aggiorna la tab attiva nel menu
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  document.querySelector('.nav-item[data-tab="playlists"]')?.classList.add('active');
}

/**
 * Elimina una playlist
 * @param {string} playlistId - ID della playlist
 */
window.deletePlaylist = function(playlistId) {
  if (!playlistId) {
    console.error("ID playlist mancante per l'eliminazione");
    return;
  }
  
  if (!confirm("Sei sicuro di voler eliminare questa playlist?")) {
    return;
  }
  
  console.log(`Eliminazione playlist: ${playlistId}`);
  
  if (window.PlaylistManager && typeof window.PlaylistManager.deletePlaylist === 'function') {
    window.PlaylistManager.deletePlaylist(playlistId)
      .then(success => {
        if (success) {
          console.log(`Playlist ${playlistId} eliminata con successo`);
          // Aggiorna la visualizzazione
          window.displayPlaylists();
        } else {
          console.error(`Errore nell'eliminazione della playlist ${playlistId}`);
        }
      })
      .catch(err => console.error(`Errore nell'eliminazione della playlist: ${err}`));
  } else {
    console.error("PlaylistManager non disponibile per eliminare la playlist");
  }
};

/**
 * Trova una playlist per ID in tutte le fonti disponibili
 * @param {string} playlistId - ID della playlist da trovare
 * @returns {Object|null} Playlist trovata o null
 */
window.findPlaylistById = function(playlistId) {
  if (!playlistId) {
    console.error("ID playlist non fornito per la ricerca");
    return null;
  }

  console.log(`Ricerca playlist con ID: ${playlistId}`);
  
  // Normalizza l'ID come stringa per confronti coerenti
  const normalizedId = String(playlistId);
  
  // 1. Verifica in window.userPlaylists (globale)
  if (window.userPlaylists && Array.isArray(window.userPlaylists)) {
    console.log(`Cercando in window.userPlaylists (${window.userPlaylists.length} playlist)`);
    
    // Log dettagliato di tutte le playlist disponibili
    window.userPlaylists.forEach((p, index) => {
      console.log(`Playlist #${index}: id=${p.id}, nome=${p.name}, tracce=${p.tracks?.length || 0}`);
    });
    
    // Prima cerca con uguaglianza stretta
    const playlist = window.userPlaylists.find(p => p.id === normalizedId);
    if (playlist) {
      console.log(`Playlist trovata in window.userPlaylists con match esatto: ${playlist.name}`);
      return playlist;
    }
    
    // Poi cerca con confronto dopo normalizzazione a stringa
    const playlistByString = window.userPlaylists.find(p => String(p.id) === normalizedId);
    if (playlistByString) {
      console.log(`Playlist trovata in window.userPlaylists con match normalizzato: ${playlistByString.name}`);
      return playlistByString;
    }
  } else {
    console.log("window.userPlaylists non disponibile o non è un array");
  }
  
  // 2. Verifica in PlaylistManager se disponibile
  if (window.PlaylistManager) {
    console.log("Cercando in PlaylistManager");
    
    // Se ha un metodo findPlaylistById, usalo
    if (typeof window.PlaylistManager.findPlaylistById === 'function') {
      const playlist = window.PlaylistManager.findPlaylistById(playlistId);
      if (playlist) {
        console.log(`Playlist trovata da PlaylistManager: ${playlist.name}`);
        return playlist;
      }
    }
    
    // Altrimenti, se ha una proprietà playlists, cerca lì
    if (window.PlaylistManager.playlists && Array.isArray(window.PlaylistManager.playlists)) {
      console.log(`Cercando in PlaylistManager.playlists (${window.PlaylistManager.playlists.length} playlist)`);
      
      // Log dettagliato di tutte le playlist in PlaylistManager
      window.PlaylistManager.playlists.forEach((p, index) => {
        console.log(`PlaylistManager #${index}: id=${p.id}, nome=${p.name}, tracce=${p.tracks?.length || 0}`);
      });
      
      // Prima cerca con uguaglianza stretta
      const playlist = window.PlaylistManager.playlists.find(p => p.id === normalizedId);
      if (playlist) {
        console.log(`Playlist trovata in PlaylistManager.playlists con match esatto: ${playlist.name}`);
        return playlist;
      }
      
      // Poi cerca con confronto dopo normalizzazione a stringa
      const playlistByString = window.PlaylistManager.playlists.find(p => String(p.id) === normalizedId);
      if (playlistByString) {
        console.log(`Playlist trovata in PlaylistManager.playlists con match normalizzato: ${playlistByString.name}`);
        return playlistByString;
      }
    }
  } else {
    console.log("PlaylistManager non disponibile");
  }
  
  // 3. Ultimo tentativo: leggi direttamente da localStorage
  try {
    console.log("Cercando direttamente in localStorage");
    const localData = localStorage.getItem('local_playlists');
    if (localData) {
      const playlists = JSON.parse(localData);
      
      if (Array.isArray(playlists)) {
        console.log(`Trovate ${playlists.length} playlist in localStorage`);
        
        // Log dettagliato di tutte le playlist in localStorage
        playlists.forEach((p, index) => {
          console.log(`localStorage #${index}: id=${p.id}, nome=${p.name}, tracce=${p.tracks?.length || 0}`);
        });
        
        // Prima cerca con uguaglianza stretta
        const playlist = playlists.find(p => p.id === normalizedId);
        if (playlist) {
          console.log(`Playlist trovata in localStorage con match esatto: ${playlist.name}`);
          return playlist;
        }
        
        // Poi cerca con confronto dopo normalizzazione a stringa
        const playlistByString = playlists.find(p => String(p.id) === normalizedId);
        if (playlistByString) {
          console.log(`Playlist trovata in localStorage con match normalizzato: ${playlistByString.name}`);
          return playlistByString;
        }
      }
    } else {
      console.log("Nessuna playlist trovata in localStorage");
    }
  } catch (e) {
    console.error("Errore nel leggere playlist da localStorage:", e);
  }
  
  console.error(`Playlist con ID ${playlistId} non trovata in nessuna fonte`);
  return null;
};

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', function() {
  // Carica e visualizza le playlist
  setTimeout(() => {
    window.displayPlaylists();
  }, 1000);
}); 