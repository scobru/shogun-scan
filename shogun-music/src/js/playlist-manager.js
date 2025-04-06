/**
 * Gestore centralizzato delle playlist
 * Gestisce tutte le operazioni relative alle playlist in un unico punto
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
      // Tenta di caricare le playlist da localStorage
      const stored = localStorage.getItem('local_playlists');
      let storedPlaylists = [];
      
      if (stored) {
        try {
          storedPlaylists = JSON.parse(stored);
          console.log(`Trovate ${storedPlaylists.length} playlist in localStorage`);
        } catch (e) {
          console.error("Errore nel parsing delle playlist da localStorage:", e);
        }
      }
      
      // Carica le playlist usando l'API se disponibile
      if (window.shogunMusicAPI) {
        console.log("Caricamento playlist tramite API...");
        const apiPlaylists = await window.shogunMusicAPI.loadPlaylists();
        console.log(`API ha restituito ${apiPlaylists.length} playlist`);
        
        // Unisci le playlist da API e localStorage
        const mergedPlaylists = this._mergePlaylists(apiPlaylists, storedPlaylists);
        this.playlists = mergedPlaylists;
      } else {
        // Usa solo quelle da localStorage
        this.playlists = storedPlaylists;
        console.log("API non disponibile, usate solo playlist da localStorage");
      }
      
      // Normalizza tutti gli ID per consistenza
      this.playlists = this._normalizePlaylists(this.playlists);
      
      console.log(`PlaylistManager inizializzato con ${this.playlists.length} playlist`);
      this.initialized = true;
      
      // Salva subito le playlist normalizzate
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      
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
   * Unisce playlist da diverse fonti, mantenendo la più recente in caso di ID duplicati
   * @private
   */
  _mergePlaylists(listA = [], listB = []) {
    console.log("Unione playlist da diverse fonti...");
    
    // Usa una Map per evitare duplicati e mantenere le versioni più recenti
    const playlistMap = new Map();
    
    // Aggiungi le playlist della prima lista
    if (Array.isArray(listA)) {
      listA.forEach(p => {
        if (p && p.id) {
          const id = String(p.id);
          playlistMap.set(id, p);
        }
      });
    }
    
    // Aggiungi/aggiorna con le playlist della seconda lista
    if (Array.isArray(listB)) {
      listB.forEach(p => {
        if (p && p.id) {
          const id = String(p.id);
          // Se la playlist esiste già, scegli la più recente
          const existing = playlistMap.get(id);
          if (!existing || !existing.updatedAt || 
              (p.updatedAt && p.updatedAt > existing.updatedAt)) {
            playlistMap.set(id, p);
          }
        }
      });
    }
    
    // Converti la Map in array
    return Array.from(playlistMap.values());
  }
  
  /**
   * Normalizza le playlist per garantire consistenza
   * @private
   */
  _normalizePlaylists(playlists) {
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
          // Copia per evitare riferimenti
          const normalizedTrack = {...track};
          
          // Assicura che l'ID della traccia sia una stringa
          if (normalizedTrack.id && typeof normalizedTrack.id !== 'string') {
            normalizedTrack.id = String(normalizedTrack.id);
          }
          
          return normalizedTrack;
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
      
      // Aggiungi al array locale
      this.playlists.push(newPlaylist);
      
      // Salva usando l'API se disponibile
      if (window.shogunMusicAPI) {
        await window.shogunMusicAPI.savePlaylists(this.playlists);
      }
      
      // Backup in localStorage
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      
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
      if (window.shogunMusicAPI) {
        await window.shogunMusicAPI.savePlaylists(this.playlists);
      }
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nell'aggiunta traccia:", error);
      throw error;
    }
  }
  
  /**
   * Rimuove una traccia da una playlist
   * @param {string} playlistId ID della playlist
   * @param {string} trackId ID della traccia
   * @returns {Promise<boolean>} True se rimossa con successo
   */
  async removeTrackFromPlaylist(playlistId, trackId) {
    try {
      const playlist = this.playlists.find(p => p.id === playlistId);
      if (!playlist) {
        throw new Error(`Playlist ${playlistId} non trovata`);
      }
      
      const initialLength = playlist.tracks.length;
      playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
      
      if (playlist.tracks.length === initialLength) {
        return false;
      }
      
      playlist.updatedAt = Date.now();
      
      // Salva le modifiche
      if (window.shogunMusicAPI) {
        await window.shogunMusicAPI.savePlaylists(this.playlists);
      }
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nella rimozione traccia:", error);
      throw error;
    }
  }
  
  /**
   * Elimina una playlist
   * @param {string} playlistId ID della playlist
   * @returns {Promise<boolean>} True se eliminata con successo
   */
  async deletePlaylist(playlistId) {
    try {
      const index = this.playlists.findIndex(p => p.id === playlistId);
      if (index === -1) {
        throw new Error(`Playlist ${playlistId} non trovata`);
      }
      
      this.playlists.splice(index, 1);
      
      // Salva le modifiche
      if (window.shogunMusicAPI) {
        await window.shogunMusicAPI.savePlaylists(this.playlists);
      }
      localStorage.setItem('local_playlists', JSON.stringify(this.playlists));
      
      // Aggiorna UI
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error("Errore nell'eliminazione playlist:", error);
      throw error;
    }
  }
  
  /**
   * Aggiorna tutti gli elementi UI relativi alle playlist
   */
  updateUI() {
    // Aggiorna il menu a tendina per l'aggiunta tracce
    this.updatePlaylistDropdowns();
    
    // Aggiorna la lista playlist nel sidebar
    this.updatePlaylistSidebar();
    
    // Aggiorna la vista principale delle playlist
    if (typeof window.displayPlaylists === 'function') {
      window.displayPlaylists(this.playlists);
    }
  }
  
  /**
   * Aggiorna tutti i menu a tendina delle playlist
   */
  updatePlaylistDropdowns() {
    // Trova tutti i select per le playlist
    const dropdowns = document.querySelectorAll('.playlist-select');
    
    dropdowns.forEach(dropdown => {
      // Salva la selezione corrente
      const currentValue = dropdown.value;
      
      // Svuota il dropdown
      dropdown.innerHTML = '';
      
      // Aggiungi l'opzione default
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleziona una playlist...';
      dropdown.appendChild(defaultOption);
      
      // Aggiungi tutte le playlist
      this.playlists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.name;
        dropdown.appendChild(option);
      });
      
      // Ripristina la selezione se possibile
      if (currentValue && this.playlists.some(p => p.id === currentValue)) {
        dropdown.value = currentValue;
      }
    });
  }
  
  /**
   * Aggiorna la sidebar delle playlist
   */
  updatePlaylistSidebar() {
    const sidebar = document.getElementById('playlistsSidebar');
    if (!sidebar) return;
    
    let html = '';
    
    // Aggiungi il pulsante per creare una nuova playlist
    html += `
      <div class="playlist-header">
        <h3>Le tue playlist</h3>
        <button id="createPlaylistBtn" class="playlist-small-button">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;
    
    this.playlists.forEach(playlist => {
      html += `
        <div class="playlist-item" data-id="${playlist.id}">
          <span class="playlist-name">${playlist.name}</span>
          <span class="playlist-count">${playlist.tracks?.length || 0}</span>
        </div>
      `;
    });
    
    if (this.playlists.length === 0) {
      html += '<div class="empty-message">Nessuna playlist</div>';
    }
    
    sidebar.innerHTML = html;
    
    // Aggiungi event listeners per selezionare playlist
    sidebar.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const playlistId = item.dataset.id;
        if (typeof window.selectPlaylist === 'function') {
          window.selectPlaylist(playlistId);
        } else if (typeof window.displayPlaylistTracks === 'function') {
          window.displayPlaylistTracks(playlistId);
        }
      });
    });
    
    // Aggiungi event listener per creare nuova playlist
    const createBtn = sidebar.querySelector('#createPlaylistBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const playlistName = prompt("Nome della nuova playlist:");
        if (playlistName && playlistName.trim()) {
          this.createPlaylist(playlistName.trim())
            .then(newPlaylist => {
              console.log(`Playlist "${playlistName}" creata con successo:`, newPlaylist);
              // Aggiorna la UI e seleziona la nuova playlist
              this.updateUI();
              setTimeout(() => {
                if (newPlaylist && newPlaylist.id) {
                  if (typeof window.selectPlaylist === 'function') {
                    window.selectPlaylist(newPlaylist.id);
                  } else if (typeof window.displayPlaylistTracks === 'function') {
                    window.displayPlaylistTracks(newPlaylist.id);
                  }
                }
              }, 100);
            })
            .catch(err => console.error(`Errore nella creazione della playlist:`, err));
        }
      });
    }
  }
  
  /**
   * Ottiene tutte le playlist
   * @returns {Array} Array delle playlist
   */
  getPlaylists() {
    return [...this.playlists];
  }
  
  /**
   * Trova una playlist per ID
   * @param {string} playlistId ID della playlist
   * @returns {Object|null} Playlist trovata o null
   */
  findPlaylistById(playlistId) {
    return this.playlists.find(p => p.id === playlistId) || null;
  }
}

// Crea l'istanza singleton
window.PlaylistManager = new PlaylistManagerSingleton();

// Esporta per moduli ES6
export default window.PlaylistManager; 