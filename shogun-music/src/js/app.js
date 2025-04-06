/**
 * Shogun Music - App Functions
 * Functions for loading and managing tracks
 */

// Array to store all tracks
window.tracks = [];
window.allTracks = [];

/**
 * Utility di manutenzione playlist
 * Corregge ID inconsistenti e assicura persistenza
 */
window.fixPlaylistsStorage = function() {
  console.log("Avvio manutenzione playlists...");
  
  try {
    // Leggi playlists da localStorage
    const localData = localStorage.getItem('local_playlists');
    let playlists = [];
    
    if (localData) {
      try {
        playlists = JSON.parse(localData);
        console.log(`Lette ${playlists.length} playlist da localStorage`);
      } catch (e) {
        console.error("Errore parsing localStorage playlist:", e);
        playlists = [];
      }
    }
    
    if (!Array.isArray(playlists)) {
      console.warn("Formato playlist non valido, inizializzazione array");
      playlists = [];
    }
    
    // Normalizza e correggi tutti gli ID
    const normalizedPlaylists = playlists.map(playlist => {
      // Assicura che l'ID sia una stringa e in formato valido
      if (!playlist.id) {
        playlist.id = `playlist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      } else if (typeof playlist.id !== 'string') {
        playlist.id = String(playlist.id);
      }
      
      // Assicura che le tracce abbiano ID validi
      if (Array.isArray(playlist.tracks)) {
        playlist.tracks = playlist.tracks.map(track => {
          if (track && typeof track.id !== 'string') {
            track.id = String(track.id);
          }
          return track;
        });
      } else {
        playlist.tracks = [];
      }
      
      // Aggiungi timestamp se mancanti
      if (!playlist.createdAt) playlist.createdAt = Date.now();
      if (!playlist.updatedAt) playlist.updatedAt = Date.now();
      
      return playlist;
    });
    
    // Rimuovi eventuali duplicati
    const uniqueIds = new Set();
    const uniquePlaylists = normalizedPlaylists.filter(playlist => {
      if (uniqueIds.has(playlist.id)) return false;
      uniqueIds.add(playlist.id);
      return true;
    });
    
    console.log(`Normalizzate ${uniquePlaylists.length} playlist`);
    
    // Salva le playlist corrette in localStorage
    localStorage.setItem('local_playlists', JSON.stringify(uniquePlaylists));
    
    // Aggiorna la variabile globale
    window.userPlaylists = uniquePlaylists;
    
    // Aggiorna UI se possibile
    if (typeof window.refreshPlaylistDisplay === 'function') {
      window.refreshPlaylistDisplay();
    }
    
    return uniquePlaylists;
  } catch (error) {
    console.error("Errore durante la manutenzione playlist:", error);
    return [];
  }
};

// Esegui la manutenzione delle playlist al caricamento iniziale
document.addEventListener("DOMContentLoaded", function() {
  // Ritardo per garantire che tutto il resto sia caricato
  setTimeout(window.fixPlaylistsStorage, 2000);
});

/**
 * Load tracks from server API
 */
window.loadTracks = async function() {
  try {
    console.log("Caricamento di tutte le tracce dal server...");
    
    // Mostra il messaggio di caricamento
    const songsLoading = document.getElementById("songsLoading");
    if (songsLoading) {
      songsLoading.style.display = "block";
    }
    
    // Nascondi altri messaggi di errore o "vuoto"
    const songsError = document.getElementById("songsError");
    const songsEmpty = document.getElementById("songsEmpty");
    if (songsError) songsError.style.display = "none";
    if (songsEmpty) songsEmpty.style.display = "none";
    
    // URL dell'API
    const tracksURL = "http://localhost:3000/api/tracks";
    
    // Array di tracce di fallback
    const fallbackTracks = [
      {
        id: "1",
        title: "Esempio Brano 1",
        artist: "Artista Esempio",
        album: "Album Esempio",
        duration: 180,
        artwork_path: "/assets/default-artwork.jpg"
      },
      {
        id: "2",
        title: "Esempio Brano 2",
        artist: "Artista Esempio",
        album: "Album Esempio",
        duration: 210,
        artwork_path: "/assets/default-artwork.jpg"
      }
    ];
    
    let loadedTracks = [];
    
    try {
      // Carica le tracce dall'API
      const response = await fetch(tracksURL);
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data)) {
          loadedTracks = data;
        } else if (data && typeof data === 'object') {
          if (data.tracks && Array.isArray(data.tracks)) {
            loadedTracks = data.tracks;
          } else if (data.data && Array.isArray(data.data)) {
            loadedTracks = data.data;
          } else {
            const possibleTracks = Object.values(data).filter(item => 
              item && typeof item === 'object' && 'title' in item && 'artist' in item
            );
            
            if (possibleTracks.length > 0) {
              loadedTracks = possibleTracks;
            } else {
              throw new Error("Formato dei dati ricevuti non valido");
            }
          }
        } else {
          throw new Error("Formato dei dati ricevuti non valido");
        }
        
        console.log("API ha restituito " + loadedTracks.length + " elementi");
      } else {
        throw new Error(`Errore nella risposta API: ${response.status}`);
      }
    } catch (apiError) {
      console.warn("Errore nel caricamento tracce dall'API:", apiError.message);
      console.log("Utilizzo tracce di esempio");
      loadedTracks = fallbackTracks;
    }
    
    // Assegna alle variabili globali
    window.tracks = loadedTracks;
    window.allTracks = [...loadedTracks];
    
    console.log("Ricevute " + loadedTracks.length + " tracce dal server API");

    // Carica in localStorage come backup
    try {
      localStorage.setItem('cached_tracks', JSON.stringify(loadedTracks));
      console.log("Tracce salvate in localStorage");
    } catch (e) {
      console.warn("Impossibile salvare le tracce in localStorage:", e);
    }
    
    // Visualizza le tracce nell'interfaccia
    if (typeof displayTracks === 'function') {
      displayTracks(loadedTracks);
    } else {
      console.warn("Funzione displayTracks non disponibile");
    }
    
    console.log("Dati tracce inizializzati dal server");
    
    // Nascondi il messaggio di caricamento
    if (songsLoading) {
      songsLoading.style.display = "none";
    }
    
    // Se non ci sono tracce, mostra un messaggio
    if (loadedTracks.length === 0 && songsEmpty) {
      songsEmpty.style.display = "block";
    }
    
    // Esempio prima traccia per debug
    if (loadedTracks.length > 0) {
      console.log("Esempio prima traccia:", JSON.stringify(loadedTracks[0]));
    }
    if (loadedTracks.length > 1) {
      console.log("Esempio seconda traccia:", JSON.stringify(loadedTracks[1]));
    }
    
    return loadedTracks;
  } catch (error) {
    console.error("Errore durante il caricamento delle tracce:", error);
    
    // Carica dal localStorage come fallback
    try {
      const cachedTracks = localStorage.getItem('cached_tracks');
      if (cachedTracks) {
        const parsedTracks = JSON.parse(cachedTracks);
        console.log("Caricate " + parsedTracks.length + " tracce da localStorage");
        window.tracks = parsedTracks;
        window.allTracks = [...parsedTracks];
        
        if (typeof displayTracks === 'function') {
          displayTracks(parsedTracks);
        }
        
        return parsedTracks;
      }
    } catch (e) {
      console.error("Errore nel recupero tracce da localStorage:", e);
    }
    
    // Nascondi il messaggio di caricamento
    const songsLoading = document.getElementById("songsLoading");
    if (songsLoading) {
      songsLoading.style.display = "none";
    }
    
    // Mostra un messaggio di errore
    const songsError = document.getElementById("songsError");
    if (songsError) {
      songsError.style.display = "block";
      songsError.textContent = `Errore nel caricamento delle tracce: ${error.message}`;
    }
    
    return [];
  }
}; 

/**
 * Visualizza le tracce nell'interfaccia
 * @param {Array} tracks Array di tracce da visualizzare
 */
window.displayTracks = function(tracks) {
  const tracksList = document.getElementById('tracksList');
  if (!tracksList) return;
  
  let html = '';
  
  tracks.forEach(track => {
    html += `
      <div class="track-item" data-id="${track.id}">
        <div class="track-info">
          <div class="track-title">${track.title || 'Brano senza titolo'}</div>
          <div class="track-artist">${track.artist || 'Artista sconosciuto'}</div>
        </div>
        <div class="track-actions">
          <button class="play-btn" onclick="playTrack('${track.id}')">
            <i class="fas fa-play"></i>
          </button>
          <button class="favorite-btn" 
            data-id="${track.id}" 
            data-type="songs" 
            onclick="toggleFavorite('${track.id}', 'songs', '${track.title}')">
            <i class="far fa-heart"></i>
          </button>
          <div class="playlist-add-container">
            <select class="playlist-select" onchange="addTrackToSelectedPlaylist('${track.id}', this)">
              <option value="">Aggiungi a playlist...</option>
            </select>
          </div>
        </div>
      </div>
    `;
  });
  
  tracksList.innerHTML = html;
  
  // Aggiorna lo stato dei pulsanti preferiti
  if (window.FavoritesManager) {
    window.FavoritesManager.updateAllFavoriteButtons();
  }
  
  // Aggiorna i menu a tendina delle playlist
  if (window.PlaylistManager) {
    window.PlaylistManager.updateUI();
  }
};

/**
 * Aggiunge una traccia alla playlist selezionata
 * @param {string} trackId ID della traccia
 * @param {HTMLSelectElement} select Elemento select che contiene l'ID della playlist
 */
window.addTrackToSelectedPlaylist = async function(trackId, select) {
  if (!select.value) return;
  
  try {
    const playlistId = select.value;
    const track = window.tracks.find(t => t.id === trackId);
    
    if (!track) {
      console.error(`Traccia ${trackId} non trovata`);
      return;
    }
    
    // Usa il PlaylistManager per aggiungere la traccia
    await window.PlaylistManager.addTrackToPlaylist(playlistId, track);
    
    // Resetta il select
    select.value = '';
    
    // Mostra feedback
    alert('Traccia aggiunta alla playlist');
    
  } catch (error) {
    console.error("Errore nell'aggiunta della traccia alla playlist:", error);
    alert("Errore nell'aggiunta della traccia alla playlist");
  }
}; 