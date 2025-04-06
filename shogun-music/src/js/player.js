/**
 * ShogunMusic - Player
 * Sistema per la riproduzione audio e gestione dell'interfaccia
 */

// Importa la classe API con gestione fallback
let ShogunMusicAPI;
try {
  // Tentativo di import ES6 standard
  import('./api.js').then(module => {
    ShogunMusicAPI = module.default;
    console.log("API importata con successo come modulo ES6");
    
    // Inizializza se shogun è già disponibile
    if (typeof window.shogun !== 'undefined' && window.shogun.gun && !window.shogunMusicAPI) {
      console.log("Shogun già disponibile, inizializzo API...");
      setTimeout(forceInitializeAPI, 100);
    }
  }).catch(err => {
    console.error("Errore nell'importazione ES6 dell'API:", err);
  });
} catch (e) {
  console.warn("Import ES6 non supportato, utilizzo approccio alternativo");
}

// Variabile globale per tenere traccia se siamo in modalità fallback
window.usingFallbackFavorites = false;

// Forza l'inizializzazione dell'API e del FavoritesManager quando Gun.js è disponibile
function forceInitializeAPI() {
  console.log("Tentativo di inizializzazione forzata di API e FavoritesManager...");
  
  if (typeof window.shogun !== 'undefined') {
    try {
      // Verifica se la classe ShogunMusicAPI è disponibile
      if (typeof ShogunMusicAPI === 'undefined') {
        console.warn("Classe ShogunMusicAPI non ancora disponibile tramite import");
        
        // Tenta di usare una versione globale se disponibile
        if (typeof window.ShogunMusicAPI === 'function') {
          console.log("Utilizzo versione globale di ShogunMusicAPI");
          ShogunMusicAPI = window.ShogunMusicAPI;
        } else {
          // Se ancora non disponibile, pianifica un nuovo tentativo
          console.warn("ShogunMusicAPI non disponibile, riprovo tra 500ms");
          setTimeout(forceInitializeAPI, 500);
          return;
        }
      }
      
      // Verifica se Gun.js e l'utente sono disponibili
      const hasGun = window.shogun.gun ? true : false;
      const hasUser = window.shogun.user ? true : false;
      
      console.log(`Stato dipendenze: Gun.js ${hasGun ? '✓' : '✗'}, User ${hasUser ? '✓' : '✗'}`);
      
      // Crea l'API se non esiste
      if (!window.shogunMusicAPI) {
        console.log("Creazione forzata dell'API...");
        window.shogunMusicAPI = new ShogunMusicAPI(window.shogun.gun);
        window.shogunMusicAPI.initEventListeners();
      }
      
      // Crea FavoritesManager se non esiste
      if (!window.FavoritesManager || typeof window.FavoritesManager.toggleFavorite !== 'function') {
        console.log("Creazione forzata di FavoritesManager...");
        
        // Definisce il FavoritesManager che utilizzerà l'API
        window.FavoritesManager = {
          toggleFavorite: function(id, type, name) {
            // Aggiorna subito l'UI per feedback immediato
            const isCurrentlyFavorite = this.isFavorite(id, type);
            this.updateFavoriteButtons(id, type, !isCurrentlyFavorite);
            
            // Esegui l'operazione tramite API
            return window.shogunMusicAPI.toggleFavorite(id, type, name)
              .then(isNowFavorite => {
                console.log(`Toggle ${type} completato:`, id, isNowFavorite ? 'aggiunto' : 'rimosso');
                
                // Aggiorna i contatori nel menu
                if (typeof updateFavoriteCounts === 'function') {
                  updateFavoriteCounts();
                }
                
                // Aggiorna la vista preferiti se attiva
                if (document.querySelector('.content-tab[data-tab="favorites"].active')) {
                  if (typeof updateFavoritesDisplay === 'function') {
                    updateFavoritesDisplay();
                  }
                }
                
                return isNowFavorite;
              })
              .catch(err => {
                console.error("Errore nel toggle dei preferiti:", err);
                // Ripristina lo stato precedente in caso di errore
                this.updateFavoriteButtons(id, type, isCurrentlyFavorite);
                return isCurrentlyFavorite;
              });
          },
          
          isFavorite: function(id, type) {
            // Versione sincrona per retrocompatibilità
            if (!window.userFavorites || !window.userFavorites[type]) {
              return false;
            }
            
            return window.userFavorites[type].some(item => 
              typeof item === 'object' ? item.id === id : item === id
            );
          },
          
          updateFavoriteButtons: function(id, type, isFavorite) {
            document.querySelectorAll(`.favorite-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
              btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
              btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            });
          },
          
          updateAllFavoriteButtons: function() {
            if (!window.userFavorites) return;
            
            // Aggiorna i pulsanti per i brani
            document.querySelectorAll('.favorite-btn[data-type="songs"]').forEach(btn => {
              const trackId = btn.getAttribute('data-id');
              const isFavorite = this.isFavorite(trackId, 'songs');
              
              btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
              btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            });
            
            // Aggiorna i pulsanti per gli artisti
            document.querySelectorAll('.favorite-btn[data-type="artists"]').forEach(btn => {
              const artistId = btn.getAttribute('data-id');
              const isFavorite = this.isFavorite(artistId, 'artists');
              
              btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
              btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            });
            
            // Aggiorna i pulsanti per gli album
            document.querySelectorAll('.favorite-btn[data-type="albums"]').forEach(btn => {
              const albumId = btn.getAttribute('data-id');
              const isFavorite = this.isFavorite(albumId, 'albums');
              
              btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
              btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            });
          },
          
          saveUserFavoritesToGun: function(forceSync = false) {
            if (window.userFavorites && window.shogunMusicAPI) {
              console.log("Salvataggio forzato dei preferiti in GunDB...");
              window.shogunMusicAPI.saveFavorites(window.userFavorites, forceSync)
                .then(() => console.log("Preferiti salvati in GunDB con successo"))
                .catch(err => console.error("Errore nel salvataggio preferiti in GunDB:", err));
              return true;
            }
            return false;
          },
          
          loadUserFavoritesFromGun: function() {
            if (!window.shogunMusicAPI) {
              console.error("API non disponibile per caricare i preferiti");
              return Promise.reject(new Error("API non disponibile"));
            }
            
            console.log("Caricamento forzato dei preferiti da GunDB...");
            return window.shogunMusicAPI.loadFavorites()
              .then(favorites => {
                console.log("Preferiti caricati con successo da GunDB", favorites);
                // Aggiorna UI
                this.updateAllFavoriteButtons();
                return favorites;
              });
          },
          
          // Funzioni di supporto
          initRealtimeEventListeners: function() {
            // Delegato all'API
            return window.shogunMusicAPI && window.shogunMusicAPI.initEventListeners();
          },
          
          generateUniqueClientId: function() {
            return window.shogunMusicAPI ? window.shogunMusicAPI.clientId : null;
          }
        };
        
        // Carica subito i preferiti
        window.FavoritesManager.loadUserFavoritesFromGun()
          .then(() => {
            console.log("Preferiti caricati con successo all'inizializzazione forzata");
            window.usingFallbackFavorites = false;
            
            // Nascondi eventuali messaggi di errore
            const errorBanners = document.querySelectorAll('.error-banner');
            errorBanners.forEach(banner => {
              banner.style.display = 'none';
            });
            
            if (document.getElementById('errorNotification')) {
              document.getElementById('errorNotification').style.display = 'none';
            }
          })
          .catch(err => console.error("Errore nel caricamento iniziale dei preferiti:", err));
      }
      
      console.log("Inizializzazione forzata completata");
      return true;
    } catch (error) {
      console.error("Errore nell'inizializzazione forzata:", error);
      return false;
    }
  } else {
    console.warn("Shogun non disponibile per inizializzazione forzata");
    return false;
  }
}

// Verifica lo stato di Gun.js e forza l'inizializzazione quando possibile
function checkGunAndInitialize() {
  console.log("Verifica disponibilità Shogun...");
  
  if (typeof window.shogun !== 'undefined') {
    const hasGun = window.shogun.gun ? true : false;
    const hasUser = window.shogun.user ? true : false;
    
    console.log(`Disponibilità componenti: Gun.js: ${hasGun ? '✓' : '✗'}, User: ${hasUser ? '✓' : '✗'}`);
    
    // Verifica l'autenticazione
    const isAuthenticated = hasUser && window.shogun.user.is;
    console.log("Stato autenticazione:", isAuthenticated ? "Autenticato" : "Non autenticato");
    
    if (hasGun) {
      if (isAuthenticated) {
        // Forza l'inizializzazione
        return forceInitializeAPI();
      } else {
        console.warn("Utente Shogun non autenticato, attendo autenticazione...");
        return false;
      }
    } else {
      console.warn("Gun.js non disponibile in Shogun, attendo...");
      return false;
    }
  } else {
    console.warn("Shogun non ancora disponibile, attendo...");
    return false;
  }
}

// Aggiungi funzione toggleFavorite globale per compatibilità con l'interfaccia
window.toggleFavorite = function(id, type, name) {
  // Forza l'inizializzazione se necessario
  if (!window.FavoritesManager || typeof window.FavoritesManager.toggleFavorite !== 'function') {
    checkGunAndInitialize();
  }
  
  // Controlla se FavoritesManager esiste
  if (window.FavoritesManager && typeof window.FavoritesManager.toggleFavorite === 'function') {
    console.log(`Usando FavoritesManager standard per toggle di ${type} ${id}`);
    return window.FavoritesManager.toggleFavorite(id, type, name);
  } else {
    console.warn(`FavoritesManager non disponibile, usando sistema di fallback per ${type} ${id}`);
    
    // Inizializza sistema di preferiti di fallback se non esiste
    if (!window.fallbackFavorites) {
      window.fallbackFavorites = {
        songs: [],
        artists: [],
        albums: []
      };
      window.usingFallbackFavorites = true;
    }
    
    // Assicurati che l'array per questo tipo esista
    if (!window.fallbackFavorites[type]) {
      window.fallbackFavorites[type] = [];
    }
    
    // Cerca se l'elemento è già presente
    const isAlreadyFavorite = window.fallbackFavorites[type].some(item => 
      (item.id === id) || (typeof item === 'string' && item === id)
    );
    
    // Aggiorna subito l'interfaccia
    const favoriteButtons = document.querySelectorAll(`.favorite-btn[data-id="${id}"][data-type="${type}"]`);
    
    // Toggle stato
    if (isAlreadyFavorite) {
      // Rimuovi dai preferiti
      window.fallbackFavorites[type] = window.fallbackFavorites[type].filter(item => 
        (typeof item === 'object' ? item.id !== id : item !== id)
      );
      
      // Aggiorna i pulsanti
      favoriteButtons.forEach(btn => {
        btn.setAttribute('data-favorite', 'false');
        btn.innerHTML = '<i class="far fa-heart"></i>';
      });
    } else {
      // Aggiungi ai preferiti
      window.fallbackFavorites[type].push({
        id: id,
        name: name,
        timestamp: Date.now()
      });
      
      // Aggiorna i pulsanti
      favoriteButtons.forEach(btn => {
        btn.setAttribute('data-favorite', 'true');
        btn.innerHTML = '<i class="fas fa-heart"></i>';
      });
    }
    
    // Copia nei preferiti standard per compatibilità
    window.userFavorites = window.fallbackFavorites;
    
    // Gestisci eventuali funzioni di aggiornamento UI
    if (typeof updateFavoriteCounts === 'function') {
      updateFavoriteCounts();
    }
    
    // Aggiorna la visualizzazione preferiti se attiva
    if (document.querySelector('.content-tab[data-tab="favorites"].active')) {
      if (typeof updateFavoritesDisplay === 'function') {
        updateFavoritesDisplay();
      }
    }
    
    // Mostra messaggio di errore solo la prima volta
    if (!window.shownFallbackWarning) {
      const errorNotification = document.getElementById('errorNotification');
      if (errorNotification) {
        errorNotification.textContent = "Si è verificato un errore nell'inizializzazione del sistema dei preferiti. Ricarica la pagina o contatta il supporto se il problema persiste.";
        errorNotification.style.display = 'block';
        window.shownFallbackWarning = true;
      }
    }
    
    return !isAlreadyFavorite;
  }
};

// Funzione di diagnostica per verificare lo stato delle dipendenze
function debugShogunDependencies() {
  console.group("Diagnostica Shogun Music Player");
  
  // Verifica Shogun Core
  if (typeof window.shogun === 'undefined') {
    console.error("❌ Shogun Core non disponibile");
  } else {
    console.log("✅ Shogun Core disponibile:", window.shogun);
    
    // Verifica Gun.js
    if (window.shogun.gun) {
      console.log("✅ Gun.js disponibile:", window.shogun.gun);
      
      // Verifica stato utente
      if (window.shogun.gun.user().is) {
        console.log("✅ Utente autenticato:", window.shogun.gun.user()._.alias || window.shogun.gun.user().is.pub);
      } else {
        console.warn("⚠️ Utente non autenticato");
      }
    } else {
      console.error("❌ Gun.js non disponibile in Shogun Core");
    }
  }
  
  // Verifica API
  if (typeof window.shogunMusicAPI === 'undefined') {
    console.error("❌ ShogunMusicAPI non disponibile");
  } else {
    console.log("✅ ShogunMusicAPI disponibile");
  }
  
  // Verifica inizializzazione FavoritesManager
  if (typeof window.FavoritesManager === 'undefined') {
    console.error("❌ FavoritesManager non disponibile");
  } else {
    console.log("✅ FavoritesManager disponibile");
  }
  
  // Verifica WaveSurfer
  if (typeof WaveSurfer === 'undefined') {
    console.error("❌ WaveSurfer non disponibile");
  } else {
    console.log("✅ WaveSurfer disponibile:", WaveSurfer.VERSION);
  }
  
  // Verifica FontAwesome
  const hasFontAwesome = !!document.querySelector('link[href*="font-awesome"]');
  console.log(hasFontAwesome ? "✅ FontAwesome caricato" : "❌ FontAwesome non rilevato");
  
  // Verifica script urls
  const scripts = document.querySelectorAll('script');
  console.group("Script caricati:");
  scripts.forEach(script => {
    if (script.src) {
      console.log(script.src);
    }
  });
  console.groupEnd();
  
  console.groupEnd();
}

// Avvia la diagnostica al caricamento della pagina
document.addEventListener("DOMContentLoaded", function() {
  // Ritardo la diagnostica per dare tempo a tutto di caricarsi
  setTimeout(debugShogunDependencies, 2000);
});

// Esponi la funzione di diagnostica globalmente
window.debugShogunDependencies = debugShogunDependencies;

// Funzione per diagnosticare GunDB
function debugGunDBState() {
  console.group("Diagnostica Gun.js");
  
  if (!window.shogun || !window.shogun.gun) {
    console.error("Gun.js non disponibile, impossibile eseguire diagnostica");
    console.groupEnd();
    return;
  }
  
  try {
    // Informazioni sull'utente
    const gunUser = window.shogun.gun.user();
    const isUserAuthenticated = gunUser.is;
    
    console.log("Stato autenticazione:", isUserAuthenticated ? "Autenticato" : "Non autenticato");
    
    if (isUserAuthenticated) {
      let userAlias = "Sconosciuto";
      
      if (gunUser._ && gunUser._.alias) {
        userAlias = gunUser._.alias;
      } else if (gunUser.is && gunUser.is.alias) {
        userAlias = gunUser.is.alias;
      } else if (gunUser.is && gunUser.is.pub) {
        userAlias = `ID: ${gunUser.is.pub.substring(0, 10)}...`;
      }
      
      console.log("Utente:", userAlias);
      console.log("Chiave pubblica:", gunUser.is.pub);
      
      // Verifica se ci sono dati utente
      window.shogun.gun.user().once((data) => {
        console.log("Dati utente:", data);
      });
    }
    
    // Verifica relay
    if (window.shogun.gun._.opt && window.shogun.gun._.opt.peers) {
      console.log("Relay configurati:", Object.keys(window.shogun.gun._.opt.peers));
    } else {
      console.warn("Nessun relay configurato");
    }
    
  } catch (e) {
    console.error("Errore durante la diagnostica Gun.js:", e);
  }
  
  console.groupEnd();
}

window.debugGunDBState = debugGunDBState;

// Inizializzazione del player e della gestione preferiti
(function() {
  // Variabile globale per tenere traccia dell'API
  let apiInstance = null;
  
  // Inizializza l'API quando Shogun e Gun sono disponibili
  function initAPI() {
    if (typeof window.shogun === 'undefined' || !window.shogun.gun) {
      console.warn("Shogun non ancora disponibile, riprovo tra 100ms...");
      setTimeout(initAPI, 100);
      return;
    }
    
    console.log("Inizializzazione ShogunMusicAPI...");
    
    try {
      // Crea una nuova istanza dell'API con l'istanza Gun di Shogun
      apiInstance = new ShogunMusicAPI(window.shogun.gun);
      
      // Inizializza gli event listeners
      apiInstance.initEventListeners();
      
      // Inizializza FavoritesManager con la nuova API
      initFavoritesManager(apiInstance);
      
      // Inizializza PlaylistManager con la nuova API
      initPlaylistManager(apiInstance);
      
      // Inizializza LocalTracksManager con la nuova API
      initLocalTracksManager(apiInstance);
      
      console.log("API inizializzata correttamente");
    } catch (error) {
      console.error("Errore durante l'inizializzazione dell'API:", error);
    }
  }
  
  function initFavoritesManager(api) {
    console.log("Inizializzazione FavoritesManager con API...");
    
    // Definisce il FavoritesManager che utilizzerà l'API
    window.FavoritesManager = {
      toggleFavorite: function(id, type, name) {
        // Aggiorna subito l'UI per feedback immediato
        const isCurrentlyFavorite = this.isFavorite(id, type);
        this.updateFavoriteButtons(id, type, !isCurrentlyFavorite);
        
        // Esegui l'operazione tramite API
        api.toggleFavorite(id, type, name)
          .then(isNowFavorite => {
            console.log(`Toggle ${type} completato:`, id, isNowFavorite ? 'aggiunto' : 'rimosso');
            
            // Aggiorna i contatori nel menu
            if (typeof updateFavoriteCounts === 'function') {
              updateFavoriteCounts();
            }
            
            // Aggiorna la vista preferiti se attiva
            if (document.querySelector('.content-tab[data-tab="favorites"].active')) {
              if (typeof updateFavoritesDisplay === 'function') {
                updateFavoritesDisplay();
              }
            }
          })
          .catch(err => {
            console.error("Errore nel toggle dei preferiti:", err);
            // Ripristina lo stato precedente in caso di errore
            this.updateFavoriteButtons(id, type, isCurrentlyFavorite);
          });
        
        // Ritorna il nuovo stato previsto per feedback immediato all'utente
        return !isCurrentlyFavorite;
      },
      
      isFavorite: function(id, type) {
        // Versione sincrona per retrocompatibilità
        if (!window.userFavorites || !window.userFavorites[type]) {
          return false;
        }
        
        return window.userFavorites[type].some(item => item.id === id);
      },
      
      updateFavoriteButtons: function(id, type, isFavorite) {
        document.querySelectorAll(`.favorite-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
          btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
          btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
      },
      
      updateAllFavoriteButtons: function() {
        if (!window.userFavorites) return;
        
        // Aggiorna i pulsanti per i brani
        document.querySelectorAll('.favorite-btn[data-type="songs"]').forEach(btn => {
          const trackId = btn.getAttribute('data-id');
          const isFavorite = this.isFavorite(trackId, 'songs');
          
          btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
          btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
        
        // Aggiorna i pulsanti per gli artisti
        document.querySelectorAll('.favorite-btn[data-type="artists"]').forEach(btn => {
          const artistId = btn.getAttribute('data-id');
          const isFavorite = this.isFavorite(artistId, 'artists');
          
          btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
          btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
        
        // Aggiorna i pulsanti per gli album
        document.querySelectorAll('.favorite-btn[data-type="albums"]').forEach(btn => {
          const albumId = btn.getAttribute('data-id');
          const isFavorite = this.isFavorite(albumId, 'albums');
          
          btn.setAttribute('data-favorite', isFavorite ? 'true' : 'false');
          btn.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        });
      },
      
      // Per retrocompatibilità, deleghiamo questi metodi all'API
      saveUserFavoritesToGun: function(forceSync = false) {
        if (window.userFavorites) {
          api.saveFavorites(window.userFavorites, forceSync)
            .then(() => console.log("Preferiti salvati via API"))
            .catch(err => console.error("Errore nel salvataggio preferiti:", err));
        }
      },
      
      loadUserFavoritesFromGun: function() {
        return api.loadFavorites()
          .then(favorites => {
            console.log("Preferiti caricati via API");
            
            // Aggiorna UI
            this.updateAllFavoriteButtons();
            
            return true;
          });
      },
      
      // Funzioni di supporto per retrocompatibilità
      initRealtimeEventListeners: function() {
        // Già gestito dall'API
        console.log("Eventi in tempo reale già inizializzati dall'API");
      },
      
      generateUniqueClientId: function() {
        return api.clientId;
      }
    };
    
    // Carica i preferiti e aggiorna l'interfaccia
    api.loadFavorites()
      .then(favorites => {
        console.log("Preferiti caricati all'avvio");
        window.FavoritesManager.updateAllFavoriteButtons();
        
        if (typeof updateFavoriteCounts === 'function') {
          updateFavoriteCounts();
        }
      })
      .catch(err => console.error("Errore nel caricamento preferiti:", err));
    
    console.log("FavoritesManager inizializzato con ShogunMusicAPI");
  }
  
  // Funzione per gestire le playlist
  function initPlaylistManager(api) {
    window.PlaylistManager = {
      createPlaylist: function(name, tracks = []) {
        return api.createPlaylist(name, tracks)
          .then(newPlaylist => {
            console.log("Playlist creata:", newPlaylist);
            
            // Forza aggiornamento UI immediatamente
            window.refreshPlaylistDisplay();
            
            return newPlaylist;
          });
      },
      
      addTrackToPlaylist: function(playlistId, track) {
        return api.addTrackToPlaylist(playlistId, track)
          .then(result => {
            // Aggiorna UI dopo aggiunta
            window.refreshPlaylistDisplay();
            return result;
          });
      },
      
      removeTrackFromPlaylist: function(playlistId, trackId) {
        return api.removeTrackFromPlaylist(playlistId, trackId)
          .then(result => {
            // Aggiorna UI dopo rimozione
            window.refreshPlaylistDisplay();
            return result;
          });
      },
      
      deletePlaylist: function(playlistId) {
        return api.deletePlaylist(playlistId)
          .then(result => {
            // Aggiorna UI dopo eliminazione
            window.refreshPlaylistDisplay();
            return result;
          });
      },
      
      loadPlaylists: function() {
        return api.loadPlaylists();
      }
    };
    
    console.log("PlaylistManager inizializzato con ShogunMusicAPI");
  }
  
  // Funzione per gestire le tracce locali
  function initLocalTracksManager(api) {
    window.LocalTracksManager = {
      loadLocalTracks: function() {
        return api.loadLocalTracks();
      },
      
      saveLocalTracks: function(tracks) {
        return api.saveLocalTracks(tracks);
      },
      
      findTrack: function(trackId) {
        return api.findLocalTrack(trackId);
      }
    };
    
    console.log("LocalTracksManager inizializzato con ShogunMusicAPI");
  }
  
  // Inizializza tutte le funzionalità quando il documento è pronto
  document.addEventListener("DOMContentLoaded", function() {
    // Inizializza l'API
    initAPI();
  });
})();

// Verifica aggiuntiva all'avvio della pagina
document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM caricato, inizializzazione player...");
  
  // Controllo se PlaylistManager è già stato inizializzato
  if (window.PlaylistManager) {
    console.log("PlaylistManager già disponibile all'avvio");
    // Assicuriamo che le playlist siano caricate
    if (typeof window.PlaylistManager.initialize === 'function') {
      window.PlaylistManager.initialize().then(() => {
        console.log("PlaylistManager inizializzato dall'esterno");
      });
    } else if (typeof window.PlaylistManager.loadPlaylists === 'function') {
      window.PlaylistManager.loadPlaylists().then(playlists => {
        console.log(`Caricate ${playlists.length} playlist all'avvio`);
        // Aggiorna window.userPlaylists per compatibilità
        window.userPlaylists = playlists;
      });
    }
  } else {
    console.warn("PlaylistManager non disponibile all'avvio, si tenterà di inizializzarlo dopo");
    // Il PlaylistManager sarà inizializzato da playlist-manager.js o dal fallback in player.html
  }
  
  // Verifica il localStorage e correggi eventuali problemi di formato
  if (typeof window.fixPlaylistsStorage === 'function') {
    console.log("Esecuzione manutenzione playlist storage...");
    window.fixPlaylistsStorage();
  } else {
    console.warn("Funzione fixPlaylistsStorage non disponibile");
    
    // Implementazione minimale di fallback
    try {
      const localData = localStorage.getItem('local_playlists');
      if (localData) {
        const playlists = JSON.parse(localData);
        if (Array.isArray(playlists)) {
          console.log(`Trovate ${playlists.length} playlist in localStorage`);
          window.userPlaylists = playlists;
        }
      }
    } catch (e) {
      console.error("Errore nel leggere playlist da localStorage:", e);
    }
  }
  
  // Mostra le playlist nell'UI dopo l'inizializzazione
  setTimeout(() => {
    if (typeof window.displayPlaylists === 'function') {
      console.log("Visualizzazione playlist nell'UI...");
      window.displayPlaylists();
    }
  }, 1000);
});

// Aggiungi sistema di recupero automatico per FavoritesManager
// Verifica periodicamente e tenta di riparare se necessario
(function setupAutoRecovery() {
  let recoveryAttempts = 0;
  const MAX_RECOVERY_ATTEMPTS = 3;
  
  function attemptRecovery() {
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      console.warn("Numero massimo di tentativi di recupero FavoritesManager raggiunto");
      return;
    }
    
    if (!window.FavoritesManager || typeof window.FavoritesManager.toggleFavorite !== 'function') {
      console.log(`Tentativo di recupero FavoritesManager #${recoveryAttempts + 1}...`);
      recoveryAttempts++;
      
      if (window.shogun && window.shogun.gun) {
        try {
          forceInitializeAPI();
          
          if (window.FavoritesManager && typeof window.FavoritesManager.toggleFavorite === 'function') {
            console.log("Recupero FavoritesManager riuscito");
            
            // Nascondi eventuali errori visibili
            if (document.getElementById('errorNotification')) {
              document.getElementById('errorNotification').style.display = 'none';
            }
            
            document.querySelectorAll('.error-banner').forEach(banner => {
              banner.style.display = 'none';
            });
          }
        } catch(e) {
          console.error("Errore nel recupero FavoritesManager:", e);
        }
      }
    }
  }
  
  // Esegui il primo tentativo dopo 3 secondi
  setTimeout(attemptRecovery, 3000);
  
  // Secondo tentativo dopo 6 secondi
  setTimeout(attemptRecovery, 6000);
  
  // Terzo tentativo dopo 10 secondi
  setTimeout(attemptRecovery, 10000);
  
  // Anche quando la pagina torna in primo piano
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!window.FavoritesManager || typeof window.FavoritesManager.toggleFavorite !== 'function')) {
      recoveryAttempts = 0; // Reset del contatore per nuovi tentativi
      attemptRecovery();
    }
  });
})();

// Crea un elemento per le notifiche di errore se non esiste
document.addEventListener("DOMContentLoaded", function() {
  if (!document.getElementById('errorNotification')) {
    const errorNotification = document.createElement('div');
    errorNotification.id = 'errorNotification';
    errorNotification.className = 'error-notification';
    errorNotification.style.display = 'none';
    errorNotification.style.position = 'fixed';
    errorNotification.style.bottom = '20px';
    errorNotification.style.right = '20px';
    errorNotification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    errorNotification.style.color = 'white';
    errorNotification.style.padding = '10px 15px';
    errorNotification.style.borderRadius = '5px';
    errorNotification.style.zIndex = '9999';
    errorNotification.style.maxWidth = '80%';
    errorNotification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    document.body.appendChild(errorNotification);
    
    // Aggiungi anche un pulsante di chiusura
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.float = 'right';
    closeButton.style.fontSize = '20px';
    closeButton.style.marginLeft = '10px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = function() {
      errorNotification.style.display = 'none';
    };
    errorNotification.prepend(closeButton);
  }
});

// Funzione per gestire i banner di errore nella pagina
function setupErrorBanners() {
  // Cerca tutti i banner di errore nella pagina
  const redBackgroundElements = Array.from(document.querySelectorAll('div'))
    .filter(el => {
      const style = window.getComputedStyle(el);
      return style.backgroundColor === 'rgb(244, 67, 54)' || // #f44336
             style.backgroundColor === 'rgba(220, 53, 69, 0.9)' || // Bootstrap danger
             el.innerText.includes('Errore:');
    });
  
  console.log(`Trovati ${redBackgroundElements.length} possibili banner di errore`);
  
  // Aggiungi la classe error-banner a tutti i banner trovati
  redBackgroundElements.forEach((el, index) => {
    el.classList.add('error-banner');
    el.id = el.id || `error-banner-${index}`;
    console.log(`Aggiunta classe error-banner a: ${el.id}`);
    
    // Aggiungi un pulsante per chiudere il banner se non esiste già
    if (!el.querySelector('.close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.position = 'absolute';
      closeBtn.style.right = '15px';
      closeBtn.style.top = '50%';
      closeBtn.style.transform = 'translateY(-50%)';
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.color = 'white';
      closeBtn.style.fontSize = '20px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.onclick = function() {
        this.parentElement.style.display = 'none';
      };
      
      // Assicurati che il parent abbia position: relative per posizionare correttamente il pulsante
      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      
      el.appendChild(closeBtn);
    }
    
    // Aggiungi un pulsante per ricaricare la pagina se non esiste già
    if (!el.querySelector('.reload-btn') && !el.querySelector('#reloadBtn')) {
      const reloadBtn = document.createElement('button');
      reloadBtn.id = 'reloadBtn';
      reloadBtn.className = 'reload-btn';
      reloadBtn.innerText = 'Ricarica';
      reloadBtn.style.marginLeft = '15px';
      reloadBtn.style.padding = '5px 10px';
      reloadBtn.style.backgroundColor = '#4CAF50';
      reloadBtn.style.color = 'white';
      reloadBtn.style.border = 'none';
      reloadBtn.style.borderRadius = '4px';
      reloadBtn.style.cursor = 'pointer';
      reloadBtn.onclick = function() {
        window.location.reload();
      };
      
      // Trova il punto dove inserire il pulsante (dopo il testo)
      const textNodes = Array.from(el.childNodes).filter(node => node.nodeType === 3); // Solo nodi di testo
      if (textNodes.length > 0) {
        const lastTextNode = textNodes[textNodes.length - 1];
        el.insertBefore(reloadBtn, lastTextNode.nextSibling);
      } else {
        // Se non ci sono nodi di testo, aggiungi alla fine
        el.appendChild(reloadBtn);
      }
    }
  });
  
  return redBackgroundElements;
}

// Salva i preferiti in localStorage come backup
function saveFavoritesToLocalStorage() {
  if (window.userFavorites) {
    try {
      localStorage.setItem('shogun_favorites', JSON.stringify(window.userFavorites));
      console.log("Preferiti salvati in localStorage come backup");
      return true;
    } catch (e) {
      console.error("Errore nel salvataggio preferiti in localStorage:", e);
      return false;
    }
  }
  return false;
}

// Carica i preferiti da localStorage
function loadFavoritesFromLocalStorage() {
  try {
    const savedFavorites = localStorage.getItem('shogun_favorites');
    if (savedFavorites) {
      const parsedFavorites = JSON.parse(savedFavorites);
      console.log("Preferiti caricati da localStorage (backup)");
      return parsedFavorites;
    }
  } catch (e) {
    console.error("Errore nel caricamento preferiti da localStorage:", e);
  }
  return { songs: [], artists: [], albums: [] };
}

// Configura l'ascolto degli eventi di autenticazione Shogun
function setupGunAuthListeners() {
  if (typeof window.shogun !== 'undefined') {
    console.log("Configurazione listener di autenticazione Shogun...");
    
    // Crea un event listener
    if (typeof window.shogun.addEventListener === 'function') {
      window.shogun.addEventListener('auth', user => {
        console.log("Evento autenticazione Shogun rilevato:", user);
        // Tenta l'inizializzazione quando l'utente viene autenticato
        setTimeout(checkGunAndInitialize, 100);
      });
      console.log("EventListener per 'auth' configurato");
      return true;
    } 
    // Fallback all'approccio Gun.js diretto se disponibile
    else if (window.shogun.gun) {
      console.log("Fallback a Gun.js per eventi di autenticazione");
      window.shogun.gun.on('auth', user => {
        console.log("Evento autenticazione Gun.js rilevato:", user);
        // Tenta l'inizializzazione quando l'utente viene autenticato
        setTimeout(checkGunAndInitialize, 100);
      });
      return true;
    }
    
    console.warn("Nessun metodo di autenticazione disponibile");
    return false;
  }
  
  console.warn("Shogun non disponibile per configurare listener di autenticazione");
  return false;
}

// Modifica il saveUserFavoritesToGun per salvare anche in localStorage
function extendFavoritesManager() {
  if (window.FavoritesManager) {
    const originalSaveMethod = window.FavoritesManager.saveUserFavoritesToGun;
    window.FavoritesManager.saveUserFavoritesToGun = function(forceSync = false) {
      // Chiama il metodo originale
      const result = originalSaveMethod.call(this, forceSync);
      
      // Salva anche in localStorage come backup
      saveFavoritesToLocalStorage();
      
      return result;
    };
    
    // Aggiungi un metodo per ripristinare da localStorage se GunDB fallisce
    window.FavoritesManager.restoreFromLocalStorageIfNeeded = function() {
      if (!window.userFavorites || 
          !window.userFavorites.songs || window.userFavorites.songs.length === 0) {
        console.log("Ripristino preferiti da localStorage...");
        window.userFavorites = loadFavoritesFromLocalStorage();
        this.updateAllFavoriteButtons();
        return true;
      }
      return false;
    };
    
    console.log("FavoritesManager esteso con funzionalità di backup localStorage");
    return true;
  }
  return false;
}

// Esegui questa funzione al caricamento del documento
document.addEventListener("DOMContentLoaded", function() {
  // Ritardo la configurazione dei banner per assicurarsi che siano stati caricati
  setTimeout(setupErrorBanners, 1000);
  
  // Configura listener di autenticazione Gun.js
  setTimeout(setupGunAuthListeners, 1000);
  
  // Tenta di inizializzare il sistema appena possibile
  setTimeout(checkGunAndInitialize, 500);
  
  // Estendi FavoritesManager con backup localStorage
  setTimeout(() => {
    if (window.FavoritesManager) {
      extendFavoritesManager();
      // Tenta di ripristinare da localStorage se necessario
      window.FavoritesManager.restoreFromLocalStorageIfNeeded();
    }
  }, 2000);
  
  // Configura un timer per tentare l'inizializzazione periodicamente
  const initInterval = setInterval(() => {
    if (window.FavoritesManager && typeof window.FavoritesManager.toggleFavorite === 'function') {
      console.log("FavoritesManager già inizializzato, interrompo i tentativi periodici");
      clearInterval(initInterval);
      return;
    }
    
    console.log("Tentativo periodico di inizializzazione...");
    const success = checkGunAndInitialize();
    
    if (success) {
      console.log("Inizializzazione periodica riuscita, interrompo i tentativi");
      clearInterval(initInterval);
    }
  }, 3000); // Prova ogni 3 secondi
  
  // Controlla anche quando la finestra diventa visibile
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!window.FavoritesManager || typeof window.FavoritesManager.toggleFavorite !== 'function')) {
      console.log("Pagina tornata in primo piano, tento inizializzazione...");
      checkGunAndInitialize();
    }
  });
});

// Aggiungi funzione di supporto per trovare una playlist per ID con gestione stringhe
window.findPlaylistById = function(playlistId) {
  if (!playlistId) {
    console.error("findPlaylistById: ID non fornito");
    return null;
  }
  
  // Normalizza l'ID come stringa
  const normalizedId = String(playlistId);
  console.log(`findPlaylistById: Ricerca playlist con ID normalizzato: ${normalizedId}`);
  
  // Controlla prima le playlist in memoria
  if (window.userPlaylists && Array.isArray(window.userPlaylists)) {
    console.log(`findPlaylistById: Controllo in memoria (${window.userPlaylists.length} playlist)...`);
    console.log("Playlist in memoria:", window.userPlaylists);
    
    const playlist = window.userPlaylists.find(p => {
      const match = String(p.id) === normalizedId || p.id === playlistId;
      if (match) {
        console.log("findPlaylistById: Playlist trovata in memoria:", p);
      }
      return match;
    });
    
    if (playlist) return playlist;
  } else {
    console.warn("findPlaylistById: Nessuna playlist in memoria");
  }
  
  // Controlla in localStorage come fallback
  try {
    console.log("findPlaylistById: Controllo in localStorage...");
    const localPlaylists = localStorage.getItem('local_playlists');
    if (localPlaylists) {
      const parsed = JSON.parse(localPlaylists);
      console.log(`findPlaylistById: Trovate ${parsed.length} playlist in localStorage`);
      
      if (Array.isArray(parsed)) {
        const playlist = parsed.find(p => {
          const match = String(p.id) === normalizedId || p.id === playlistId;
          if (match) {
            console.log("findPlaylistById: Playlist trovata in localStorage:", p);
          }
          return match;
        });
        
        if (playlist) {
          // Aggiorna anche la memoria
          if (!window.userPlaylists) {
            window.userPlaylists = parsed;
          } else if (!window.userPlaylists.some(p => String(p.id) === String(playlist.id))) {
            window.userPlaylists.push(playlist);
          }
          return playlist;
        }
      }
    } else {
      console.warn("findPlaylistById: Nessuna playlist in localStorage");
    }
  } catch (e) {
    console.error("findPlaylistById: Errore nella ricerca playlist in localStorage:", e);
  }
  
  console.error(`findPlaylistById: Playlist ${playlistId} non trovata in nessuna sorgente`);
  return null;
};

// Aggiungi una funzione per aggiornare il display delle playlist
window.refreshPlaylistDisplay = function() {
  console.log("Aggiornamento visualizzazione playlist");
  
  // Forza il caricamento delle playlist da localStorage
  if (window.PlaylistManager && typeof window.PlaylistManager.loadPlaylists === 'function') {
    window.PlaylistManager.loadPlaylists()
      .then(playlists => {
        console.log(`Playlist ricaricate: ${playlists.length}`);
        
        // Aggiorna memoria locale per accesso diretto
        window.userPlaylists = playlists;
        
        // Aggiorna la visualizzazione se esiste la funzione
        if (typeof window.displayPlaylists === 'function') {
          window.displayPlaylists(playlists);
        }
        
        // Forza aggiornamento tracce se necessario
        const activePlaylistId = document.querySelector('.playlist-tab.active')?.dataset?.id;
        if (activePlaylistId && typeof window.displayPlaylistTracks === 'function') {
          window.displayPlaylistTracks(activePlaylistId);
        }
      })
      .catch(err => console.error("Errore nell'aggiornamento playlist:", err));
  }
};
