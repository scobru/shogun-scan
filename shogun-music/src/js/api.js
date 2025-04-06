/**
 * ShogunMusic API
 * Gestisce tutte le interazioni con GunDB per il player musicale
 */
class ShogunMusicAPI {
  /**
   * Inizializza l'API con un'istanza GunDB
   * @param {Object} gunInstance - Istanza di Gun.js
   */
  constructor(gunInstance) {
    if (!gunInstance) {
      throw new Error('ShogunMusicAPI richiede un\'istanza Gun valida');
    }
    
    this.gun = gunInstance;
    
    // Accedi all'utente direttamente da shogun se disponibile
    if (window.shogun && window.shogun.user) {
      this.user = window.shogun.user;
      console.log("Usando direttamente l'utente da shogun.user");
    } else {
      // Fallback al metodo tradizionale
      console.warn("shogun.user non disponibile, usando gun.user()");
      this.user = this.gun.user();
    }
    
    // Configura Gun.js con il token di sicurezza necessario
    this.setupGunToken();
    
    this.clientId = this._generateClientId();
    this.eventListeners = {};
    
    // Salva l'istanza globalmente per accesso facile
    window.shogunMusicAPI = this;
    
    console.log("ShogunMusicAPI inizializzata con Gun.js", this.clientId);
  }
  
  /**
   * Configura il token di sicurezza per Gun.js
   * @private
   */
  setupGunToken() {
    // Imposta un token di sicurezza per le richieste Gun.js
    // Questo token deve corrispondere a quello configurato nel server
    const SECURITY_TOKEN = "thisIsTheTokenForReals";
    
    if (this.gun && this.gun.opt) {
      // Aggiungi il token di sicurezza alle opzioni di Gun
      try {
        // Aggiungi header per inviare il token nelle richieste
        this.gun.on('out', function(msg) {
          msg.headers = msg.headers || {};
          msg.headers.token = SECURITY_TOKEN;
          return msg;
        });
        
        console.log("Token di sicurezza Gun.js configurato");
      } catch (error) {
        console.warn("Errore nella configurazione token Gun.js:", error);
      }
    } else {
      console.warn("Impossibile configurare token Gun.js: istanza incompleta");
    }
  }
  
  /**
   * Verifica lo stato di autenticazione dell'utente
   * @returns {boolean} - true se l'utente è autenticato
   */
  isAuthenticated() {
    // Usa l'utente da this.user invece di gun.user()
    return this.user && this.user.is ? true : false;
  }
  
  /**
   * Ottiene l'utente corrente
   * @returns {Object|null} - Utente Gun.js o null se non autenticato
   */
  getCurrentUser() {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.user;
  }
  
  /**
   * Genera un ID cliente unico per questo dispositivo
   * @returns {string} - ID unico
   * @private
   */
  _generateClientId() {
    // Riusa l'ID esistente se presente
    if (window.uniqueClientId) {
      return window.uniqueClientId;
    }
    
    // Genera un nuovo ID e salvalo globalmente
    const id = 'client_' + Math.random().toString(36).substring(2, 15) + 
              Math.random().toString(36).substring(2, 15);
    window.uniqueClientId = id;
    
    console.log("Generato nuovo clientId:", id);
    return id;
  }
  
  /**
   * Converte un array in un oggetto per GunDB
   * @param {Array} arr - Array da convertire
   * @returns {Object} - Oggetto per GunDB
   * @private
   */
  _arrayToGunObject(arr) {
    if (!arr || !Array.isArray(arr)) return {};
    
    const obj = {};
    arr.forEach((item, index) => {
      obj[index] = item;
    });
    return obj;
  }
  
  /**
   * Converte un oggetto GunDB in array
   * @param {Object} gunObj - Oggetto GunDB
   * @returns {Array} - Array di elementi
   * @private
   */
  _gunObjectToArray(gunObj) {
    if (!gunObj) return [];
    
    const result = [];
    
    // Debug: log completo per diagnosi
    console.log("Oggetto GunDB originale ricevuto:", gunObj);
    
    try {
      // Gestione speciale per dati potenzialmente non caricati completamente (riferimenti GunDB)
      const hasReferences = Object.keys(gunObj).some(key => {
        return key !== '_' && key !== '#' && 
              (gunObj[key] && gunObj[key]['#'] && typeof gunObj[key]['#'] === 'string');
      });
      
      // Se ci sono riferimenti, proviamo a processarli
      if (hasReferences) {
        console.log("Trovati riferimenti Gun.js, elaborazione...");
        
        // Processa ogni chiave dell'oggetto
        Object.keys(gunObj).forEach(key => {
          // Salta le proprietà speciali di Gun
          if (key === '_' || key === '#') return;
          
          const item = gunObj[key];
          
          // Se è un riferimento, caricalo
          if (item && typeof item === 'object' && item['#']) {
            console.log(`Caricamento riferimento per chiave ${key}:`, item['#']);
            
            // Estrai informazioni dal riferimento per costruire un oggetto temporaneo
            const refParts = item['#'].split('/');
            if (refParts.length >= 2) {
              // L'ultimo segmento è tipicamente l'ID
              const id = refParts[refParts.length - 1];
              
              // Costruisci un oggetto con l'ID come dato temporaneo
              const tempObj = {
                id: id,
                key: key,
                ref: item['#'],
                timestamp: Date.now()
              };
              
              // Aggiungi al risultato
              result.push(tempObj);
              console.log(`Aggiunto oggetto temporaneo da riferimento:`, tempObj);
            }
          } else if (item && typeof item === 'object') {
            // Se l'oggetto è vuoto o contiene solo proprietà Gun, saltiamo
            const itemKeys = Object.keys(item).filter(k => k !== '_' && k !== '#');
            if (itemKeys.length === 0) return;
            
            // Se ha un ID, aggiungi direttamente
            if (item.id) {
              result.push(item);
            } 
            // Supporto per formato alternativo dove l'ID è nella chiave
            else {
              // Copia l'oggetto per evitare riferimenti a Gun.js
              const cleanItem = {...item};
              
              // Rimuovi proprietà Gun speciali
              delete cleanItem['_'];
              delete cleanItem['#'];
              
              // Aggiungi l'ID se manca
              if (!cleanItem.id && !isNaN(parseInt(key))) {
                cleanItem.id = key;
              }
              
              result.push(cleanItem);
            }
          } else if (item !== null && item !== undefined) {
            // Gestisce il caso di valori semplici (stringhe, numeri, ecc.)
            result.push({
              id: key,
              value: item,
              // Per retrocompatibilità
              name: typeof item === 'string' ? item : key
            });
          }
        });
      } else {
        // Processo standard per oggetti già caricati
        Object.keys(gunObj).forEach(key => {
          // Ignora proprietà speciali di GunDB
          if (key === '_' || key === '#') return;
          
          const item = gunObj[key];
          
          if (item && typeof item === 'object') {
            // Se l'oggetto è vuoto o contiene solo proprietà Gun, saltiamo
            const itemKeys = Object.keys(item).filter(k => k !== '_' && k !== '#');
            if (itemKeys.length === 0) return;
            
            // Se ha un ID, aggiungi direttamente
            if (item.id) {
              result.push(item);
            } 
            // Supporto per formato alternativo dove l'ID è nella chiave
            else {
              // Copia l'oggetto per evitare riferimenti a Gun.js
              const cleanItem = {...item};
              
              // Rimuovi proprietà Gun speciali
              delete cleanItem['_'];
              delete cleanItem['#'];
              
              // Aggiungi l'ID se manca
              if (!cleanItem.id && !isNaN(parseInt(key))) {
                cleanItem.id = key;
              }
              
              result.push(cleanItem);
            }
          } else if (item !== null && item !== undefined) {
            // Gestisce il caso di valori semplici (stringhe, numeri, ecc.)
            result.push({
              id: key,
              value: item,
              // Per retrocompatibilità
              name: typeof item === 'string' ? item : key
            });
          }
        });
      }
      
    } catch (error) {
      console.error("Errore durante la conversione Gun -> Array:", error);
    }
    
    // Debug: log del risultato per verifica
    console.log(`Convertiti ${result.length} elementi in array:`, result);
    
    return result;
  }
  
  /**
   * Emette un evento di cambiamento tramite GunDB
   * @param {string} eventType - Tipo di evento
   * @param {Object} data - Dati evento
   * @private
   */
  _emitEvent(eventType, data) {
    if (!this.gun) return;
    
    const eventData = {
      ...data,
      emitter: this.clientId,
      timestamp: Date.now()
    };
    
    this.gun.get('app_events').get(eventType).put(eventData);
    console.log(`Evento ${eventType} emesso:`, eventData);
  }
  
  /* ------------ GESTIONE PREFERITI ------------ */
  
  /**
   * Carica i preferiti dell'utente
   * @returns {Promise<Object>} - Oggetto con i preferiti
   */
  loadFavorites() {
    return new Promise((resolve, reject) => {
      // Sistema di retry per attendere l'autenticazione
      const checkAuthAndLoad = (attempts = 0, maxAttempts = 5) => {
        if (this.isAuthenticated()) {
          console.log("Utente autenticato, caricamento preferiti...");
          // Continua con il caricamento come prima
          
          console.log("Caricamento preferiti da GunDB...");
          
          // Imposta un timeout per evitare attese infinite
          const timeout = setTimeout(() => {
            console.warn("Timeout nel caricamento preferiti da GunDB");
            // Fallback ai preferiti locali
            const localFavorites = this._getLocalFavorites();
            window.userFavorites = localFavorites;
            resolve(localFavorites);
          }, 10000);
          
          // Nuovo metodo di caricamento usando JSON
          this.user.get("favorites").once((data) => {
            // Se abbiamo ricevuto dati validi
            if (data && typeof data === 'string') {
              try {
                // Prova a parsificare la stringa JSON
                const parsedFavorites = JSON.parse(data);
                console.log("Preferiti caricati da GunDB:", parsedFavorites);
                
                // Assicurati che tutte le proprietà necessarie esistano
                if (!parsedFavorites.songs) parsedFavorites.songs = [];
                if (!parsedFavorites.artists) parsedFavorites.artists = [];
                if (!parsedFavorites.albums) parsedFavorites.albums = [];
                
                // Aggiorna riferimento globale e risolvi la promessa
                window.userFavorites = parsedFavorites;
                clearTimeout(timeout);
                
                // Stampa debug delle informazioni
                console.log("Caricamento preferiti completato:", {
                  songs: parsedFavorites.songs.length,
                  artists: parsedFavorites.artists.length,
                  albums: parsedFavorites.albums.length
                });
                
                // Log degli ID per debug
                if (parsedFavorites.songs.length > 0) {
                  console.log("ID dei brani preferiti:", parsedFavorites.songs.map(item => item.id));
                }
                
                // Aggiorna tutte le icone preferiti
                this._updateAllFavoriteIcons();
                
                resolve(parsedFavorites);
              } catch (e) {
                console.error("Errore nel parsing dei preferiti:", e);
                
                // Fallback ai dati locali
                clearTimeout(timeout);
                const localFavorites = this._getLocalFavorites();
                window.userFavorites = localFavorites;
                
                // Aggiorna icone con i dati di fallback
                this._updateAllFavoriteIcons();
                
                resolve(localFavorites);
              }
            } 
            // Se il dato non è una stringa (potrebbe essere un formato legacy)
            else if (data && typeof data === 'object') {
              console.warn("Formato preferiti legacy rilevato, tentativo di migrazione...");
              
              try {
                // Tenta di estrarre i dati dal formato legacy
                this.user.get("favorites").get("songs").once((songsData) => {
                  if (songsData) {
                    favorites.songs = this._gunObjectToArray(songsData);
                  }
                  
                  this.user.get("favorites").get("artists").once((artistsData) => {
                    if (artistsData) {
                      favorites.artists = this._gunObjectToArray(artistsData);
                    }
                    
                    this.user.get("favorites").get("albums").once((albumsData) => {
                      if (albumsData) {
                        favorites.albums = this._gunObjectToArray(albumsData);
                      }
                      
                      // Salva nel nuovo formato
                      this.saveFavorites(favorites, false)
                        .then(() => {
                          console.log("Migrazione preferiti completata");
                          window.userFavorites = favorites;
                          clearTimeout(timeout);
                          
                          // Aggiorna icone
                          this._updateAllFavoriteIcons();
                          
                          resolve(favorites);
                        })
                        .catch(err => {
                          console.error("Errore nella migrazione preferiti:", err);
                          window.userFavorites = favorites;
                          clearTimeout(timeout);
                          
                          // Aggiorna icone comunque
                          this._updateAllFavoriteIcons();
                          
                          resolve(favorites);
                        });
                    });
                  });
                });
              } catch (e) {
                console.error("Errore nella migrazione dei preferiti:", e);
                
                clearTimeout(timeout);
                const localFavorites = this._getLocalFavorites();
                window.userFavorites = localFavorites;
                
                // Aggiorna icone con i dati di fallback
                this._updateAllFavoriteIcons();
                
                resolve(localFavorites);
              }
            } 
            // Nessun dato trovato
            else {
              console.log("Nessun dato preferiti trovato in GunDB");
              
              clearTimeout(timeout);
              const localFavorites = this._getLocalFavorites();
              window.userFavorites = localFavorites;
              
              // Aggiorna icone con i dati di fallback
              this._updateAllFavoriteIcons();
              
              resolve(localFavorites);
            }
          });
          
        } else if (attempts < maxAttempts) {
          console.log(`Attesa autenticazione Gun.js (tentativo ${attempts+1}/${maxAttempts})...`);
          setTimeout(() => checkAuthAndLoad(attempts + 1, maxAttempts), 500);
        } else {
          console.warn("Timeout autenticazione, caricamento preferiti fallito");
          const localFavorites = this._getLocalFavorites();
          window.userFavorites = localFavorites;
          
          // Aggiorna icone con i dati di fallback
          this._updateAllFavoriteIcons();
          
          resolve(localFavorites);
        }
      };
      
      // Inizia il processo di verifica e caricamento
      checkAuthAndLoad();
    });
  }
  
  /**
   * Salva i preferiti dell'utente
   * @param {Object} favorites - Oggetto con i preferiti {songs, artists, albums}
   * @param {boolean} emitEvent - Se emettere un evento
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  saveFavorites(favorites, emitEvent = true) {
    return new Promise((resolve, reject) => {
      // Verifica rigorosa dell'autenticazione
      if (!this.user || !this.user.is) {
        console.error("Impossibile salvare preferiti: utente non autenticato");
        reject(new Error("Utente non autenticato"));
        return;
      }
      
      // Verifica che i dati siano validi
      if (!favorites || typeof favorites !== 'object') {
        console.error("Formato preferiti non valido");
        reject(new Error("Formato preferiti non valido"));
        return;
      }
      
      try {
        // Assicurati che le proprietà necessarie esistano
        if (!favorites.songs) favorites.songs = [];
        if (!favorites.artists) favorites.artists = [];
        if (!favorites.albums) favorites.albums = [];
        
        // SOLUZIONE: Converti tutto l'oggetto in una stringa JSON
        // Questo evita i problemi con gli array in GunDB
        const stringifiedFavorites = JSON.stringify(favorites);
        
        console.log("Salvando preferiti in GunDB:", {
          songs: favorites.songs.length,
          artists: favorites.artists.length,
          albums: favorites.albums.length
        });
        
        // Verifica autenticazione prima di ogni scrittura
        const user = this.user;
        
        // Tenta di riautenticare se necessario
        if (user && user.is && user.is.pub) {
          console.log("Utente autenticato:", user.is.pub.substring(0, 10) + "...");
        } else {
          console.warn("Stato autenticazione incerto, potrebbe causare errori di salvataggio");
        }
        
        // Salva l'intero oggetto come stringa JSON
        this.user.get("favorites").put(stringifiedFavorites, (ack) => {
          if (ack.err) {
            console.error("Errore nel salvataggio preferiti:", ack.err);
            reject(new Error(`Errore salvataggio: ${ack.err}`));
          } else {
            console.log("Preferiti salvati con successo in GunDB");
            
            // Aggiorniamo il riferimento globale
            window.userFavorites = favorites;
            
            // Emettiamo l'evento una sola volta per tutti i tipi di preferiti
            if (emitEvent) {
              this._emitEvent('favorites_updated', { type: 'all' });
            }
            
            resolve(true);
          }
        });
        
      } catch (e) {
        console.error("Errore durante il salvataggio preferiti:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Aggiunge o rimuove un elemento dai preferiti
   * @param {string} id - ID dell'elemento
   * @param {string} type - Tipo di elemento (songs, artists, albums)
   * @param {string} name - Nome dell'elemento
   * @returns {Promise<boolean>} - true se aggiunto, false se rimosso
   */
  toggleFavorite(id, type, name) {
    return new Promise(async (resolve, reject) => {
      console.log(`Toggling favorite: ${type} ${id} (${name})`);
      
      try {
        // Verifica autenticazione in modo esplicito
        if (!this.isAuthenticated()) {
          console.error("Impossibile modificare preferiti: utente non autenticato");
          
          // Implementazione fallback usando localStorage
          console.warn("Utilizzando localStorage come fallback per i preferiti");
          const localFavorites = this._getLocalFavorites();
          
          // Toggle nel sistema locale
          const typeArray = localFavorites[type] || [];
          const index = typeArray.findIndex(item => 
            (item.id === id) || (String(item.id) === String(id)) || 
            (typeof item === 'string' && String(item) === String(id))
          );
          
          let isNowFavorite;
          if (index !== -1) {
            // Rimuovi
            typeArray.splice(index, 1);
            isNowFavorite = false;
          } else {
            // Aggiungi
            typeArray.push({
              id: String(id),
              name: name || id,
              timestamp: Date.now()
            });
            isNowFavorite = true;
          }
          
          // Salva in localStorage
          localFavorites[type] = typeArray;
          this._saveLocalFavorites(localFavorites);
          
          // Aggiorna UI
          this._updateAllFavoriteIcons();
          
          // Segnala problema ma restituisci comunque un risultato
          resolve(isNowFavorite);
          return;
        }
        
        // Carica i preferiti correnti (per assicurarsi che siano aggiornati)
        const favorites = await this.loadFavorites();
        
        // Assicurati che l'array del tipo richiesto esista
        if (!Array.isArray(favorites[type])) {
          favorites[type] = [];
        }
        
        // Converti l'ID in stringa per confronti uniformi
        const stringId = String(id);
        
        // Verifica se l'elemento è già tra i preferiti (cerca tutte le occorrenze)
        const indexes = [];
        favorites[type].forEach((item, idx) => {
          const itemId = typeof item === 'object' ? String(item.id) : String(item);
          if (itemId === stringId) {
            indexes.push(idx);
          }
        });
        
        // Debug di controllo
        console.log(`Verifica preferito esistente - ID: ${stringId}, Trovate ${indexes.length} occorrenze`);
        if (indexes.length > 0) {
          console.log(`Prima occorrenza all'indice: ${indexes[0]}, elemento:`, favorites[type][indexes[0]]);
        }
        
        let isNowFavorite = false;
        
        // IMPORTANTE: Rimuovi TUTTE le occorrenze per evitare duplicati
        if (indexes.length > 0) {
          // Rimuovi tutte le occorrenze in ordine inverso per non alterare gli indici
          indexes.sort((a, b) => b - a).forEach(index => {
            favorites[type].splice(index, 1);
          });
          console.log(`${type} rimosso dai preferiti (${indexes.length} occorrenze): ${id}`);
          isNowFavorite = false;
        } else {
          // Aggiungi ai preferiti con più metadati
          favorites[type].push({
            id: stringId,
            name: name || id,
            timestamp: Date.now()
          });
          console.log(`${type} aggiunto ai preferiti: ${id} ${name}`);
          isNowFavorite = true;
        }
        
        // Debug: mostra i preferiti dopo la modifica
        console.log(`Preferiti dopo modifica (${type}):`, favorites[type].map(item => typeof item === 'object' ? item.id : item));
        
        try {
          // Tenta di salvare in GunDB
          await this.saveFavorites(favorites, true);
          console.log("Preferiti salvati con successo in GunDB");
        } catch (saveError) {
          // Se fallisce il salvataggio in GunDB, salva localmente
          console.error("Errore nel salvataggio in GunDB:", saveError);
          console.warn("Salvando preferiti in localStorage come fallback");
          
          // Salva in localStorage come fallback
          this._saveLocalFavorites(favorites);
          
          // Imposta i preferiti globalmente comunque
          window.userFavorites = favorites;
        }
        
        // Aggiorna TUTTE le icone nell'interfaccia
        this._updateAllFavoriteIcons();
        
        // Comunica il nuovo stato
        resolve(isNowFavorite);
        
      } catch (error) {
        console.error(`Errore nella gestione dei preferiti: ${error.message}`, error);
        
        // In caso di errore, tenta comunque di aggiornare UI 
        // per evitare che l'interfaccia rimanga in uno stato inconsistente
        try {
          this._updateAllFavoriteIcons();
        } catch (e) {
          console.error("Impossibile aggiornare UI dopo errore:", e);
        }
        
        reject(error);
      }
    });
  }
  
  /**
   * Ottiene i preferiti dal localStorage
   * @returns {Object} Oggetto preferiti
   * @private
   */
  _getLocalFavorites() {
    try {
      const savedFavorites = localStorage.getItem('shogun_favorites');
      if (savedFavorites) {
        return JSON.parse(savedFavorites);
      }
    } catch (e) {
      console.error("Errore nel recupero preferiti da localStorage:", e);
    }
    return { songs: [], artists: [], albums: [] };
  }
  
  /**
   * Salva i preferiti in localStorage
   * @param {Object} favorites Oggetto preferiti
   * @private
   */
  _saveLocalFavorites(favorites) {
    try {
      localStorage.setItem('shogun_favorites', JSON.stringify(favorites));
      console.log("Preferiti salvati in localStorage");
      
      // Aggiorna lo stato globale
      window.userFavorites = favorites;
      
      return true;
    } catch (e) {
      console.error("Errore nel salvataggio preferiti in localStorage:", e);
      return false;
    }
  }
  
  /**
   * Verifica se un elemento è tra i preferiti
   * @param {string} id - ID dell'elemento
   * @param {string} type - Tipo di elemento (songs, artists, albums)
   * @returns {Promise<boolean>} - true se è preferito
   */
  isFavorite(id, type) {
    return new Promise(async (resolve) => {
      try {
        const favorites = await this.loadFavorites();
        // Converti in stringa per confronti uniformi
        const stringId = String(id);
        const isFav = favorites[type]?.some(item => 
          typeof item === 'object' ? String(item.id) === stringId : String(item) === stringId
        ) || false;
        
        resolve(isFav);
      } catch (e) {
        console.error("Errore nella verifica preferito:", e);
        resolve(false);
      }
    });
  }
  
  /* ------------ GESTIONE PLAYLIST ------------ */
  
  /**
   * Carica le playlist dell'utente
   * @returns {Promise<Array>} - Array di playlist
   */
  loadPlaylists() {
    return new Promise((resolve, reject) => {
      if (!this.isAuthenticated()) {
        console.warn("Impossibile caricare playlist: utente non autenticato");
        resolve([]);
        return;
      }
      
      console.log("Caricamento playlist da GunDB...");
      
      // Imposta un timeout per evitare attese infinite
      const timeout = setTimeout(() => {
        console.warn("Timeout nel caricamento playlist da GunDB");
        resolve([]);
      }, 5000);
      
      // Usa this.user invece di this.gun.user()
      this.user.get('playlists').once((data) => {
        clearTimeout(timeout);
        console.log("Dati playlist ricevuti:", data);
        
        let playlists = [];
        
        // Controlla se i dati sono in formato JSON stringificato
        if (data && typeof data === 'string') {
          try {
            // Prova a parsificare il JSON
            playlists = JSON.parse(data);
            console.log(`Caricate ${playlists.length} playlist dal formato JSON`);
          } catch (e) {
            console.error("Errore nel parsing JSON delle playlist:", e);
            // Fallback a un array vuoto
            playlists = [];
          }
        } 
        // Verifica il formato legacy (oggetto GunDB)
        else if (data && typeof data === 'object') {
          console.warn("Formato playlist legacy rilevato, migrazione in corso...");
          
          try {
            // Converti da formato legacy
            playlists = this._gunObjectToArray(data);
            console.log(`Convertite ${playlists.length} playlist dal formato legacy`);
            
            // Salva immediatamente nel nuovo formato per migrazione
            if (playlists.length > 0) {
              this.savePlaylists(playlists, false)
                .then(() => console.log("Migrazione playlist completata"))
                .catch(err => console.error("Errore nella migrazione playlist:", err));
            }
          } catch (e) {
            console.error("Errore nella conversione playlist dal formato legacy:", e);
            playlists = [];
          }
        } else {
          console.log("Nessuna playlist trovata");
          playlists = [];
        }
        
        // Assicurati che sia un array
        if (!Array.isArray(playlists)) {
          console.warn("Formato playlist non valido, inizializzazione array vuoto");
          playlists = [];
        }
        
        // Aggiorna lo stato globale (per retrocompatibilità)
        window.userPlaylists = playlists;
        
        resolve(playlists);
      });
    });
  }
  
  /**
   * Salva le playlist dell'utente
   * @param {Array} playlists - Array di playlist
   * @param {boolean} emitEvent - Se emettere un evento
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  savePlaylists(playlists, emitEvent = true) {
    return new Promise((resolve, reject) => {
      if (!this.isAuthenticated()) {
        console.warn("Impossibile salvare playlist: utente non autenticato");
        resolve(false);
        return;
      }
      
      try {
        // Verifica che playlists sia un array
        if (!Array.isArray(playlists)) {
          console.warn("Formato playlist non valido, conversione ad array vuoto");
          playlists = [];
        }
        
        // Converti l'array in JSON per GunDB
        const playlistsJSON = JSON.stringify(playlists);
        
        // Usa this.user invece di this.gun.user()
        this.user.get("playlists").put(playlistsJSON, (ack) => {
          if (ack.err) {
            console.error("Errore nel salvataggio playlist:", ack.err);
            reject(ack.err);
          } else {
            console.log("Playlist salvate:", playlists?.length || 0);
            
            // Salva i metadati delle playlist
            this.user.get("playlists_meta").put({
              lastUpdated: Date.now(),
              version: 2 // Versione 2 indica formato JSON
            });
            
            // Emetti un evento se richiesto
            if (emitEvent) {
              this._emitEvent('playlists_updated', { count: playlists?.length || 0 });
            }
            
            // Aggiorna lo stato globale (per retrocompatibilità)
            window.userPlaylists = playlists;
            
            resolve(true);
          }
        });
      } catch (e) {
        console.error("Errore durante il salvataggio playlist:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Crea una nuova playlist
   * @param {string} name - Nome della playlist
   * @param {Array} tracks - Array di tracce (opzionale)
   * @returns {Promise<Object>} - Nuova playlist creata
   */
  createPlaylist(name, tracks = []) {
    return new Promise(async (resolve, reject) => {
      try {
        // Carica le playlist correnti
        const playlists = await this.loadPlaylists();
        
        // Verifica se esiste già una playlist con lo stesso nome
        const existingPlaylist = playlists.find(p => p.name === name);
        if (existingPlaylist) {
          console.warn(`Playlist con nome "${name}" già esistente, uso quella`);
          resolve(existingPlaylist);
          return;
        }
        
        // Crea la nuova playlist con ID univoco basato sul timestamp
        const newPlaylist = {
          id: 'playlist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          name: name,
          tracks: tracks.map(track => {
            // Assicura che ogni traccia abbia un ID come stringa
            return {
              ...track,
              id: String(track.id)
            };
          }),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // Aggiungi la nuova playlist all'array
        playlists.push(newPlaylist);
        
        // Salva le playlist aggiornate
        await this.savePlaylists(playlists, true);
        
        console.log(`Playlist "${name}" creata con ${tracks.length} tracce`);
        resolve(newPlaylist);
      } catch (e) {
        console.error("Errore nella creazione playlist:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Aggiunge una traccia a una playlist
   * @param {string} playlistId - ID della playlist
   * @param {Object} track - Traccia da aggiungere
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  addTrackToPlaylist(playlistId, track) {
    return new Promise(async (resolve, reject) => {
      try {
        // Carica le playlist correnti
        const playlists = await this.loadPlaylists();
        
        // Trova la playlist
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
          throw new Error(`Playlist con ID ${playlistId} non trovata`);
        }
        
        // Normalizza l'ID della traccia come stringa
        const normalizedTrackId = String(track.id);
        
        // Verifica se la traccia è già presente (cerca tutte le occorrenze)
        const existingTrackIndexes = [];
        playlists[playlistIndex].tracks.forEach((t, idx) => {
          if (String(t.id) === normalizedTrackId) {
            existingTrackIndexes.push(idx);
          }
        });
        
        // Se ci sono tracce duplicate, rimuovi tutte tranne la prima
        if (existingTrackIndexes.length > 1) {
          console.warn(`Trovate ${existingTrackIndexes.length} occorrenze duplicate della traccia ${normalizedTrackId} nella playlist, rimozione duplicati...`);
          // Rimuovi le occorrenze in ordine inverso per non interferire con gli indici
          existingTrackIndexes.sort((a, b) => b - a).slice(1).forEach(idx => {
            playlists[playlistIndex].tracks.splice(idx, 1);
          });
        }
        
        // Se la traccia esiste già, non fare nulla
        if (existingTrackIndexes.length > 0) {
          console.log(`Traccia ${normalizedTrackId} già presente nella playlist`);
          resolve(false);
          return;
        }
        
        // Prepara la traccia da aggiungere con ID normalizzato
        const trackToAdd = {
          ...track,
          id: normalizedTrackId,
          addedAt: Date.now()
        };
        
        // Aggiungi la traccia
        playlists[playlistIndex].tracks.push(trackToAdd);
        playlists[playlistIndex].updatedAt = Date.now();
        
        // Salva le playlist aggiornate
        await this.savePlaylists(playlists, true);
        
        console.log(`Traccia ${normalizedTrackId} aggiunta alla playlist ${playlistId}`);
        resolve(true);
      } catch (e) {
        console.error("Errore nell'aggiunta traccia alla playlist:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Rimuove una traccia da una playlist
   * @param {string} playlistId - ID della playlist
   * @param {string} trackId - ID della traccia
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  removeTrackFromPlaylist(playlistId, trackId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Carica le playlist correnti
        const playlists = await this.loadPlaylists();
        
        // Trova la playlist
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
          throw new Error(`Playlist con ID ${playlistId} non trovata`);
        }
        
        // Normalizza l'ID della traccia come stringa
        const normalizedTrackId = String(trackId);
        
        // Trova tutte le occorrenze della traccia
        const trackIndexes = [];
        playlists[playlistIndex].tracks.forEach((track, idx) => {
          if (String(track.id) === normalizedTrackId) {
            trackIndexes.push(idx);
          }
        });
        
        // Se non ci sono occorrenze, non c'è niente da rimuovere
        if (trackIndexes.length === 0) {
          console.log(`Traccia ${normalizedTrackId} non trovata nella playlist ${playlistId}`);
          resolve(false);
          return;
        }
        
        // Rimuovi tutte le occorrenze della traccia (in ordine inverso per non interferire con gli indici)
        trackIndexes.sort((a, b) => b - a).forEach(idx => {
          playlists[playlistIndex].tracks.splice(idx, 1);
        });
        
        // Aggiorna il timestamp
        playlists[playlistIndex].updatedAt = Date.now();
        
        // Salva le playlist aggiornate
        await this.savePlaylists(playlists, true);
        
        console.log(`Traccia ${normalizedTrackId} rimossa dalla playlist ${playlistId} (${trackIndexes.length} occorrenze)`);
        resolve(true);
      } catch (e) {
        console.error("Errore nella rimozione traccia dalla playlist:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Elimina una playlist
   * @param {string} playlistId - ID della playlist da eliminare
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  deletePlaylist(playlistId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Carica le playlist correnti
        const playlists = await this.loadPlaylists();
        
        // Trova l'indice della playlist
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
          throw new Error(`Playlist con ID ${playlistId} non trovata`);
        }
        
        // Rimuovi la playlist
        const deletedPlaylist = playlists.splice(playlistIndex, 1)[0];
        
        // Salva le playlist aggiornate
        await this.savePlaylists(playlists, true);
        
        console.log(`Playlist "${deletedPlaylist.name}" (${playlistId}) eliminata`);
        resolve(true);
      } catch (e) {
        console.error("Errore nell'eliminazione della playlist:", e);
        reject(e);
      }
    });
  }
  
  /* ------------ GESTIONE TRACCE LOCALI ------------ */
  
  /**
   * Carica le tracce locali
   * @returns {Promise<Array>} - Array di tracce
   */
  loadLocalTracks() {
    return new Promise((resolve, reject) => {
      console.log("Caricamento tracce locali da GunDB...");
      
      this.gun.get('local_tracks').once((data) => {
        if (data) {
          const tracks = [];
          let trackCount = 0;
          
          // Converti l'oggetto GunDB in array
          Object.keys(data).forEach(key => {
            if (key !== '_' && data[key]) {
              tracks.push(data[key]);
              trackCount++;
            }
          });
          
          if (trackCount > 0) {
            console.log(`Caricate ${trackCount} tracce locali`);
            window.tracks = tracks;
            resolve(tracks);
          } else {
            console.log("Nessuna traccia locale trovata");
            resolve([]);
          }
        } else {
          console.log("Nessun dato tracce trovato");
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Salva le tracce locali
   * @param {Array} tracks - Array di tracce
   * @returns {Promise<boolean>} - Esito dell'operazione
   */
  saveLocalTracks(tracks) {
    return new Promise((resolve, reject) => {
      try {
        if (!tracks || !Array.isArray(tracks)) {
          throw new Error("Formato tracce non valido");
        }
        
        // Crea una versione semplificata dei dati
        const tracksObj = {};
        
        tracks.forEach(track => {
          tracksObj[track.id] = {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            audio_path: track.audio_path,
            artwork: track.artwork,
            duration: track.duration
          };
        });
        
        // Salva in GunDB
        this.gun.get('local_tracks').put(tracksObj, (ack) => {
          if (ack.err) {
            console.error("Errore nel salvare le tracce:", ack.err);
            reject(ack.err);
          } else {
            console.log(`${tracks.length} tracce salvate in GunDB`);
            resolve(true);
          }
        });
      } catch (e) {
        console.error("Errore durante il salvataggio tracce:", e);
        reject(e);
      }
    });
  }
  
  /**
   * Trova una traccia nel database locale
   * @param {string} trackId - ID della traccia
   * @returns {Promise<Object|null>} - Traccia trovata o null
   */
  findLocalTrack(trackId) {
    return new Promise((resolve) => {
      this.gun.get('local_tracks').get(trackId).once((data) => {
        if (data) {
          console.log("Traccia trovata:", data);
          resolve(data);
        } else {
          console.log("Traccia non trovata:", trackId);
          resolve(null);
        }
      });
    });
  }
  
  /* ------------ EVENTI IN TEMPO REALE ------------ */
  
  /**
   * Aggiunge un listener per gli eventi in tempo reale
   * @param {string} eventType - Tipo di evento ('favorites_updated', 'playlists_updated', ecc.)
   * @param {Function} callback - Funzione da eseguire quando si verifica l'evento
   * @returns {string} - ID del listener
   */
  addEventListener(eventType, callback) {
    if (!this.gun) {
      console.error("Gun non disponibile, impossibile aggiungere listener");
      return null;
    }
    
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
      
      // Registra il listener con Gun
      this.gun.get('app_events').get(eventType).on((data) => {
        // Ignora gli eventi inviati da questo client
        if (data && data.emitter === this.clientId) {
          console.log(`Ignorato evento ${eventType} inviato da questo client`);
          return;
        }
        
        console.log(`Evento ${eventType} ricevuto:`, data);
        
        // Notifica tutti i listener
        this.eventListeners[eventType].forEach(listener => {
          try {
            listener.callback(data);
          } catch (e) {
            console.error(`Errore nell'esecuzione del listener per ${eventType}:`, e);
          }
        });
      });
    }
    
    // Genera un ID unico per questo listener
    const listenerId = Math.random().toString(36).substring(2, 15);
    
    // Aggiungi il listener all'array
    this.eventListeners[eventType].push({
      id: listenerId,
      callback: callback
    });
    
    console.log(`Listener ${listenerId} aggiunto per l'evento ${eventType}`);
    return listenerId;
  }
  
  /**
   * Rimuove un listener per gli eventi
   * @param {string} eventType - Tipo di evento
   * @param {string} listenerId - ID del listener da rimuovere
   * @returns {boolean} - true se rimosso con successo
   */
  removeEventListener(eventType, listenerId) {
    if (!this.eventListeners[eventType]) {
      return false;
    }
    
    const originalLength = this.eventListeners[eventType].length;
    this.eventListeners[eventType] = this.eventListeners[eventType].filter(
      listener => listener.id !== listenerId
    );
    
    return this.eventListeners[eventType].length < originalLength;
  }
  
  /**
   * Inizializza tutti i listener per gli eventi in tempo reale
   */
  initEventListeners() {
    if (!this.gun) {
      console.warn("Gun.js non disponibile, impossibile inizializzare event listeners");
      return;
    }
    
    // Ascoltatore per aggiornamenti in tempo reale dei preferiti
    this.gun.get('app_events').get('favorites_updated').on((data) => {
      if (!data) return;
      
      // Ignora gli eventi emessi da questo client
      if (data.emitter === this.clientId) {
        console.log("Ignorato evento favorites_updated inviato da questo client");
        return;
      }
      
      console.log("Evento favorites_updated ricevuto:", data);
      
      // Ricarica i preferiti quando arriva un evento
      this.loadFavorites()
        .then(() => console.log("Preferiti aggiornati in seguito a evento remoto"))
        .catch(err => console.error("Errore nell'aggiornamento preferiti da evento:", err));
    });
    
    // Ascoltatore per aggiornamenti in tempo reale delle playlist
    this.gun.get('app_events').get('playlists_updated').on((data) => {
      if (!data) return;
      
      // Ignora gli eventi emessi da questo client
      if (data.emitter === this.clientId) {
        console.log("Ignorato evento playlists_updated inviato da questo client");
        return;
      }
      
      console.log("Evento playlists_updated ricevuto:", data);
      
      // Ricarica le playlist quando arriva un evento
      this.loadPlaylists()
        .then(() => console.log("Playlist aggiornate in seguito a evento remoto"))
        .catch(err => console.error("Errore nell'aggiornamento playlist da evento:", err));
    });
    
    // NUOVO: Ascoltatore per eventi di autenticazione
    if (this.gun) {
      this.gun.on('auth', user => {
        console.log("Autenticazione Gun.js completata:", user);
        // Ricarica i preferiti quando l'autenticazione è sicuramente completata
        this.loadFavorites().then(() => {
          console.log("Preferiti ricaricati dopo autenticazione completa");
        });
      });
    }
    
    // Ascoltatore per messaggi privati (per feature future)
    this.gun.get('app_events').get('message').on((data) => {
      if (!data || data.recipient !== this.clientId) return;
      
      console.log("Messaggio privato ricevuto:", data);
    });
    
    console.log("Event listeners inizializzati");
  }
  
  /**
   * Aggiorna tutte le icone dei preferiti nell'interfaccia
   * @private
   */
  _updateAllFavoriteIcons() {
    console.log("Aggiornamento di tutte le icone preferiti...");
    
    try {
      // Aggiorna le icone tramite FavoritesManager se disponibile
      if (window.FavoritesManager && typeof window.FavoritesManager.updateAllFavoriteButtons === 'function') {
        window.FavoritesManager.updateAllFavoriteButtons();
        return true;
      }
      
      // Fallback: aggiorna direttamente tutte le icone se FavoritesManager non è disponibile
      if (!window.userFavorites) return false;
      
      // Funzione helper per verificare se un elemento è tra i preferiti
      const isFavorite = (id, type) => {
        if (!window.userFavorites[type]) return false;
        return window.userFavorites[type].some(item => 
          (typeof item === 'object' ? String(item.id) === String(id) : String(item) === String(id))
        );
      };
      
      // Aggiorna tutte le icone dei brani
      document.querySelectorAll('.favorite-btn[data-type="songs"]').forEach(btn => {
        const id = btn.getAttribute('data-id');
        const fav = isFavorite(id, 'songs');
        btn.setAttribute('data-favorite', fav ? 'true' : 'false');
        btn.innerHTML = fav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
      });
      
      // Aggiorna tutte le icone degli artisti
      document.querySelectorAll('.favorite-btn[data-type="artists"]').forEach(btn => {
        const id = btn.getAttribute('data-id');
        const fav = isFavorite(id, 'artists');
        btn.setAttribute('data-favorite', fav ? 'true' : 'false');
        btn.innerHTML = fav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
      });
      
      // Aggiorna tutte le icone degli album
      document.querySelectorAll('.favorite-btn[data-type="albums"]').forEach(btn => {
        const id = btn.getAttribute('data-id');
        const fav = isFavorite(id, 'albums');
        btn.setAttribute('data-favorite', fav ? 'true' : 'false');
        btn.innerHTML = fav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
      });
      
      return true;
    } catch (e) {
      console.error("Errore nell'aggiornamento delle icone preferiti:", e);
      return false;
    }
  }
}

// Esporta la classe API
export default ShogunMusicAPI;
