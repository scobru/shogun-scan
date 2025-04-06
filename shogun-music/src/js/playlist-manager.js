/**
 * Gestore centralizzato delle playlist
 * Gestisce tutte le operazioni relative alle playlist in un unico punto
 * Versione semplificata che utilizza direttamente Gun.js
 */

class PlaylistManagerSingleton {
  constructor() {
    if (PlaylistManagerSingleton.instance) {
      return PlaylistManagerSingleton.instance;
    }
    PlaylistManagerSingleton.instance = this;
    
    // Inizializza lo stato
    this.playlists = [];
    this.initialized = false;
    
    // Carica le playlist all'avvio
    this.initialize();
  }
  
  /**
   * Inizializza il gestore playlist
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log("Inizializzazione PlaylistManager...");
    
    try {
      // Verifica se Shogun e Gun.js sono disponibili
      if (window.shogun && window.shogun.gun) {
        console.log("Gun.js disponibile, caricamento playlist da Gun...");
        await this.loadPlaylistsFromGun();
      } else {
        console.warn("Gun.js non disponibile, usando localStorage");
        this.loadPlaylistsFromLocalStorage();
      }
      
      console.log(`PlaylistManager inizializzato con ${this.playlists.length} playlist`);
      this.initialized = true;
      
      // Aggiorna window.userPlaylists per retrocompatibilità
      window.userPlaylists = [...this.playlists];
      
      // Aggiorna l'interfaccia
      this.updateUI();
      
      return this.playlists;
    } catch (error) {
      console.error("Errore nell'inizializzazione PlaylistManager:", error);
      this.playlists = [];
      return [];
    }
  }
  
  /**
   * Carica playlist da Gun.js
   * @private
   */
  async loadPlaylistsFromGun() {
    return new Promise((resolve, reject) => {
      try {
        // Verifica che l'utente sia autenticato
        if (!window.shogun.user || !window.shogun.user.is) {
          console.warn("Utente non autenticato in Gun.js, caricamento da localStorage");
          this.loadPlaylistsFromLocalStorage();
          return resolve(this.playlists);
        }
        
        // Carica le playlist da Gun.js
        window.shogun.user.get('playlists').once((data) => {
          console.log("Dati playlist da Gun.js:", data);
          
          if (data) {
            try {
              // Se è una stringa JSON, parsifica
              if (typeof data === 'string') {
                this.playlists = JSON.parse(data);
              } 
              // Se è già un array, usa direttamente
              else if (Array.isArray(data)) {
                this.playlists = data;
              }
              // Se è un oggetto Gun.js, estrai le playlist
              else if (typeof data === 'object') {
                const extractedPlaylists = [];
                
                // Estrai le playlist dall'oggetto Gun.js
                Object.keys(data).forEach(key => {
                  // Salta le proprietà speciali di Gun.js
                  if (key === '_' || key === '#') return;
                  
                  const playlist = data[key];
                  if (playlist && typeof playlist === 'object') {
                    // Aggiungi l'ID se non presente
                    if (!playlist.id) {
                      playlist.id = key;
                    }
                    extractedPlaylists.push(playlist);
                  }
                });
                
                this.playlists = extractedPlaylists;
              }
              
              console.log(`Caricate ${this.playlists.length} playlist da Gun.js`);
            } catch (e) {
              console.error("Errore nel parsing delle playlist da Gun.js:", e);
              // Fallback a localStorage
              this.loadPlaylistsFromLocalStorage();
            }
          } else {
            console.log("Nessuna playlist trovata in Gun.js, caricamento da localStorage");
            this.loadPlaylistsFromLocalStorage();
          }
          
          // Normalizza e salva in localStorage come backup
          this.playlists = this.normalizePlaylists(this.playlists);
          this.saveToLocalStorage();
          
          resolve(this.playlists);
        });
      } catch (error) {
        console.error("Errore nel caricamento playlist da Gun.js:", error);
        // Fallback a localStorage
        this.loadPlaylistsFromLocalStorage();
        resolve(this.playlists);
      }
    });
  }
  
  /**
   * Carica playlist da localStorage
   * @private
   */
  loadPlaylistsFromLocalStorage() {
    try {
      const stored = localStorage.getItem('local_playlists');
      
      if (stored) {
        this.playlists = JSON.parse(stored);
        console.log(`Caricate ${this.playlists.length} playlist da localStorage`);
      } else {
        console.log("Nessuna playlist trovata in localStorage");
        this.playlists = [];
      }
      
      // Normalizza le playlist
      this.playlists = this.normalizePlaylists(this.playlists);
    } catch (e) {
      console.error("Errore nel caricamento playlist da localStorage:", e);
      this.playlists = [];
    }
    
    return this.playlists;
  }
  
  /**
   * Normalizza le playlist per garantire consistenza
   * @param {Array} playlists - Liste da normalizzare
   * @returns {Array} - Liste normalizzate
   */
  normalizePlaylists(playlists) {
    if (!Array.isArray(playlists)) return [];
    
    return playlists.map(playlist => {
      // Crea una copia per non modificare l'originale
      const normalized = {...playlist};
      
      // Assicura che l'ID sia una stringa
      if (normalized.id && typeof normalized.id !== 'string') {
        normalized.id = String(normalized.id);
      }
      
      // Se manca l'ID, ne genera uno nuovo
      if (!normalized.id) {
        normalized.id = `playlist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      }
      
      // Assicura che tracks sia un array
      if (!Array.isArray(normalized.tracks)) {
        normalized.tracks = [];
      }
      
      // Normalizza le tracce
      normalized.tracks = normalized.tracks.map(track => {
        if (typeof track === 'string') {
          return { id: track };
        }
        if (track && typeof track === 'object') {
          // Assicura che l'ID della traccia sia una stringa
          if (track.id && typeof track.id !== 'string') {
            track.id = String(track.id);
          }
          return track;
        }
        return null;
      }).filter(Boolean); // Rimuovi null/undefined
      
      // Aggiungi timestamp se mancanti
      if (!normalized.createdAt) normalized.createdAt = Date.now();
      if (!normalized.updatedAt) normalized.updatedAt = Date.now();
      
      return normalized;
    });
  }
  
  /**
   * Salva le playlist in Gun.js
   * @private
   */
  async saveToGun() {
    if (!window.shogun || !window.shogun.gun || !window.shogun.user || !window.shogun.user.is) {
      console.warn("Gun.js non disponibile per salvare le playlist");
      return false;
    }
    
    try {
      // Salva le playlist in Gun.js
      window.shogun.user.get('playlists').put(JSON.stringify(this.playlists), ack => {
        if (ack.err) {
          console.error("Errore nel salvataggio playlist in Gun.js:", ack.err);
          return false;
        }
        console.log("Playlist salvate in Gun.js con successo");
        return true;
      });
    } catch (error) {
      console.error("Errore nel salvataggio playlist in Gun.js:", error);
      return false;
    }
  }
  
  /**
   * Salva le playlist in localStorage
   * @private
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      console.log("Playlist salvate in localStorage");
      return true;
    } catch (e) {
      console.error("Errore nel salvataggio playlist in localStorage:", e);
      return false;
    }
  }
  
  /**
   * Crea una nuova playlist
   * @param {string} name Nome della playlist
   * @param {Array} tracks Array opzionale di tracce iniziali
   * @returns {Promise<Object>} La nuova playlist
   */
  async createPlaylist(name, tracks = []) {
    console.log(`Creazione playlist: ${name}`);
    
    try {
      // Crea la playlist
      const playlistId = `playlist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newPlaylist = {
        id: playlistId,
        name: name,
        tracks: [...tracks],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Aggiungi all'array locale
      this.playlists.push(newPlaylist);
      
      // Salva usando Gun e localStorage
      await this.saveToGun();
      this.saveToLocalStorage();
      
      // Aggiorna window.userPlaylists per retrocompatibilità 
      // e per assicurarci che sia immediatamente disponibile in tutto il sistema
      window.userPlaylists = [...this.playlists];
      console.log("Aggiornato window.userPlaylists dopo creazione:", window.userPlaylists.length);
      
      // Aggiorna UI
      this.updateUI();
      
      console.log("Playlist creata:", newPlaylist);
      return newPlaylist;
      
    } catch (error) {
      console.error("Errore nella creazione playlist:", error);
      throw error;
    }
  }
  
  /**
   * Aggiunge una traccia a una playlist
   * @param {string} playlistId ID della playlist
   * @param {Object} track Traccia da aggiungere
   * @returns {Promise<boolean>} True se aggiunta con successo
   */
  async addTrackToPlaylist(playlistId, track) {
    console.log(`Aggiunta traccia a playlist ${playlistId}:`, track);
    
    try {
      const playlist = this.playlists.find(p => p.id === playlistId);
      if (!playlist) {
        throw new Error(`Playlist ${playlistId} non trovata`);
      }
      
      // Verifica se la traccia è già presente
      if (playlist.tracks.some(t => t.id === track.id)) {
        console.log("Traccia già presente nella playlist");
        return false;
      }
      
      // Aggiungi la traccia
      playlist.tracks.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        addedAt: Date.now()
      });
      
      playlist.updatedAt = Date.now();
      
      // Salva le modifiche
      await this.saveToGun();
      this.saveToLocalStorage();
      
      // Aggiorna window.userPlaylists per retrocompatibilità
      window.userPlaylists = [...this.playlists];
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nell'aggiunta traccia:", error);
      return false;
    }
  }
  
  /**
   * Rimuove una traccia da una playlist
   * @param {string} playlistId ID della playlist
   * @param {string} trackId ID della traccia
   * @returns {Promise<boolean>} True se rimossa con successo
   */
  async removeTrackFromPlaylist(playlistId, trackId) {
    console.log(`Rimozione traccia ${trackId} da playlist ${playlistId}`);
    
    try {
      const playlist = this.playlists.find(p => p.id === playlistId);
      if (!playlist) {
        throw new Error(`Playlist ${playlistId} non trovata`);
      }
      
      // Rimuovi la traccia
      const initialLength = playlist.tracks.length;
      playlist.tracks = playlist.tracks.filter(track => 
        typeof track === 'object' ? track.id !== trackId : track !== trackId
      );
      
      // Se non è stata rimossa nessuna traccia
      if (playlist.tracks.length === initialLength) {
        console.log(`Traccia ${trackId} non trovata nella playlist ${playlistId}`);
        return false;
      }
      
      playlist.updatedAt = Date.now();
      
      // Salva le modifiche
      await this.saveToGun();
      this.saveToLocalStorage();
      
      // Aggiorna window.userPlaylists per retrocompatibilità
      window.userPlaylists = [...this.playlists];
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nella rimozione traccia:", error);
      return false;
    }
  }
  
  /**
   * Elimina una playlist
   * @param {string} playlistId ID della playlist
   * @returns {Promise<boolean>} True se eliminata con successo
   */
  async deletePlaylist(playlistId) {
    console.log(`Eliminazione playlist ${playlistId}`);
    
    try {
      // Verifica se la playlist esiste
      const playlistIndex = this.playlists.findIndex(p => p.id === playlistId);
      if (playlistIndex === -1) {
        throw new Error(`Playlist ${playlistId} non trovata`);
      }
      
      // Rimuovi la playlist
      this.playlists.splice(playlistIndex, 1);
      
      // Salva le modifiche
      await this.saveToGun();
      this.saveToLocalStorage();
      
      // Aggiorna window.userPlaylists per retrocompatibilità
      window.userPlaylists = [...this.playlists];
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nell'eliminazione playlist:", error);
      return false;
    }
  }
  
  /**
   * Aggiorna l'interfaccia utente
   */
  updateUI() {
    // Aggiorna i dropdown delle playlist
    this.updatePlaylistDropdowns();
    
    // Aggiorna la barra laterale
    this.updatePlaylistSidebar();
    
    // Aggiorna la visualizzazione corrente se necessario
    if (typeof window.displayPlaylists === 'function') {
      window.displayPlaylists();
    }
  }
  
  /**
   * Aggiorna i dropdown delle playlist
   */
  updatePlaylistDropdowns() {
    // Trova tutti i dropdown delle playlist
    const dropdowns = document.querySelectorAll('.playlist-dropdown');
    
    dropdowns.forEach(dropdown => {
      // Conserva solo i primi elementi (non dinamici)
      const staticItems = Array.from(dropdown.children).filter(item => 
        !item.classList.contains('dynamic-playlist-item')
      );
      
      // Rimuovi tutti gli elementi dinamici
      dropdown.querySelectorAll('.dynamic-playlist-item').forEach(item => item.remove());
      
      // Aggiungi le playlist 
      this.playlists.forEach(playlist => {
        const option = document.createElement('a');
        option.href = '#';
        option.classList.add('dropdown-item', 'dynamic-playlist-item');
        option.dataset.playlistId = playlist.id;
        option.textContent = playlist.name;
        
        // Aggiungi handler per l'aggiunta alla playlist
        option.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Trova la traccia associata
          const trackElement = this.closest('.track-item, .song-row, .track-row');
          if (!trackElement) return;
          
          const trackId = trackElement.dataset.id;
          const trackTitle = trackElement.querySelector('.track-title, .song-title')?.textContent || 'Brano';
          const trackArtist = trackElement.querySelector('.track-artist, .song-artist')?.textContent || 'Artista';
          
          if (trackId) {
            // Usa PlaylistManager per aggiungere la traccia
            if (window.PlaylistManager) {
              window.PlaylistManager.addTrackToPlaylist(playlist.id, {
                id: trackId,
                title: trackTitle,
                artist: trackArtist
              });
            }
          }
        });
        
        dropdown.appendChild(option);
      });
    });
  }
  
  /**
   * Aggiorna la barra laterale con le playlist
   */
  updatePlaylistSidebar() {
    // Trova il container delle playlist nella sidebar
    const playlistContainer = document.querySelector('#playlist-container');
    if (!playlistContainer) return;
    
    // Svuota il container
    playlistContainer.innerHTML = '';
    
    // Aggiungi ogni playlist
    this.playlists.forEach(playlist => {
      const playlistItem = document.createElement('div');
      playlistItem.className = 'playlist-item';
      playlistItem.dataset.id = playlist.id;
      
      playlistItem.innerHTML = `
        <i class="fas fa-music playlist-icon"></i>
        <span class="playlist-name">${playlist.name}</span>
        <span class="playlist-count">${playlist.tracks.length}</span>
      `;
      
      // Aggiungi event listener per aprire la playlist
      playlistItem.addEventListener('click', function() {
        // Deseleziona altre tab
        document.querySelectorAll('.sidebar-item.active').forEach(item => {
          item.classList.remove('active');
        });
        
        // Seleziona questa playlist
        this.classList.add('active');
        
        // Nascondi altri contenuti
        document.querySelectorAll('.content-tab').forEach(tab => {
          tab.classList.remove('active');
        });
        
        // Mostra contenuto playlist
        document.querySelector('.content-tab[data-tab="playlist"]').classList.add('active');
        
        // Visualizza tracce della playlist
        if (typeof window.displayPlaylistTracks === 'function') {
          window.displayPlaylistTracks(playlist.id);
        }
      });
      
      playlistContainer.appendChild(playlistItem);
    });
  }
  
  /**
   * Restituisce tutte le playlist
   * @returns {Array} Array di playlist
   */
  getPlaylists() {
    return [...this.playlists];
  }
  
  /**
   * Trova una playlist tramite ID
   * @param {string} playlistId ID della playlist
   * @returns {Object|null} Playlist trovata o null
   */
  findPlaylistById(playlistId) {
    if (!playlistId) return null;
    
    // Normalizza l'ID come stringa
    const normalizedId = String(playlistId);
    
    return this.playlists.find(p => String(p.id) === normalizedId);
  }
}

// Esporta il singleton
window.PlaylistManager = new PlaylistManagerSingleton();

// Inizializza quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  window.PlaylistManager.initialize()
    .then(() => console.log('PlaylistManager inizializzato da event listener'))
    .catch(err => console.error('Errore nell\'inizializzazione di PlaylistManager:', err));
}); 