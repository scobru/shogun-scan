// protocol.js
(function () {
    // Token di autenticazione
    const METADATA_AUTH_TOKEN = "myMetadataToken123";
    
    // Variabili e configurazione iniziale
    let peers = ['http://localhost:8765/gun', 'http://localhost:8766/gun']; // Relay di default
    let gun = Gun({
      peers: peers,
      localStorage: false, // Abilitato per la persistenza locale
      radisk: false,      // Abilitato per miglior storage
      headers: {
        'Authorization': METADATA_AUTH_TOKEN
      }
    });
    
    // Assicurati che SEA (Security, Encryption, Authorization) sia disponibile
    if (!gun.user || !gun.SEA) {
      console.error("GUN SEA non è disponibile. L'autenticazione potrebbe non funzionare.");
    }
    
    let user = gun.user();
    let musicProtocol = gun.get('music-protocol');
    let songsRef = musicProtocol.get('songs');
    let cachedSongs = {}; // Cache locale per le canzoni
    let isInitialLoad = true;
    let renderTimeout;
    let lastUpdateTime = 0;
    let updatesSinceLastCheck = 0;
    let loopDetectionTimer = null;
    let isSyncPaused = false;
    let isUserAuthenticated = false; // Traccia lo stato di autenticazione dell'utente
  
    // Verifica se l'utente è già autenticato al caricamento
    function checkAuthState() {
      const pub = user.is && user.is.pub;
      isUserAuthenticated = !!pub;
      return isUserAuthenticated;
    }
    
    // Chiamato all'inizializzazione
    checkAuthState();
    
    // Aggiorna l'istanza di Gun (ad esempio, dopo aver aggiunto nuovi relay)
    function updateGunInstance() {
      gun = Gun({
        peers: peers,
        localStorage: true,  // Abilitato per la persistenza locale
        radisk: true,       // Abilitato per miglior storage
        retry: 2000,        // Riprova ogni 2 secondi
        multicast: false,   // Disabilitato per ridurre traffico di rete
        axe: false,         // Disabilitato per semplicità
        chunk: 1000,
        headers: {
          'Authorization': METADATA_AUTH_TOKEN
        }
      });
      
      if (!gun.user || !gun.SEA) {
        console.error("GUN SEA non è disponibile. L'autenticazione potrebbe non funzionare.");
      }
      
      user = gun.user();
      musicProtocol = gun.get('music-protocol');
      songsRef = musicProtocol.get('songs');
      
      // Verifica lo stato di autenticazione dopo aggiornamento
      checkAuthState();
      
      if (isUserAuthenticated) {
        initSongCache();
        initSongSubscription();
      }
      console.log("Gun instance aggiornata con relay:", peers);
    }
  
    // Aggiunge un nuovo relay all'array e aggiorna l'istanza Gun
    function addRelay(relayUrl) {
      relayUrl = relayUrl.trim();
      if (!relayUrl) return;
      if (!relayUrl.startsWith('http://') && !relayUrl.startsWith('https://')) {
        relayUrl = 'http://' + relayUrl;
      }
      if (peers.includes(relayUrl)) {
        alert('Questo relay è già stato aggiunto!');
        return;
      }
      peers.push(relayUrl);
      updateGunInstance();
      alert('Relay aggiunto: ' + relayUrl);
    }
  
    // Inizializza la cache locale delle canzoni
    function initSongCache() {
      // Solo se l'utente è autenticato
      if (!isUserAuthenticated) {
        console.log("Utente non autenticato. Skipping song cache initialization.");
        return;
      }
      
      songsRef.map().once((song, id) => {
        if (song && id && song.title) {
          cachedSongs[id] = song;
          console.log('Canzone aggiunta alla cache:', song.title);
        }
      });
    }
  
    // Sottoscrizione agli aggiornamenti dei brani con debounce per evitare loop
    function initSongSubscription() {
      console.log("Inizializzazione sottoscrizione brani...");
      
      // Solo se l'utente è autenticato
      if (!isUserAuthenticated) {
        console.log("Utente non autenticato. Skipping song subscription.");
        return;
      }
      
      // Renderizza subito la lista
      renderSongs();
  
      if (loopDetectionTimer) {
        clearInterval(loopDetectionTimer);
      }
      loopDetectionTimer = setInterval(() => {
        if (updatesSinceLastCheck > 10) {
          console.warn("Possibile loop di aggiornamenti:", updatesSinceLastCheck, "updates in breve tempo");
          clearTimeout(renderTimeout);
          isSyncPaused = true;
          setTimeout(() => {
            isSyncPaused = false;
            console.log("Sincronizzazione ripresa dopo pausa");
          }, 5000);
        }
        updatesSinceLastCheck = 0;
      }, 5000);
  
      // Rimuove eventuali listener precedenti per evitare duplicati
      songsRef.map().off();
  
      songsRef.map().on((song, id) => {
        if (isSyncPaused) return;
        if (!song || typeof song !== "object" || Object.keys(song).length === 0) return;
        const now = Date.now();
        if (now - lastUpdateTime < 100) {
          updatesSinceLastCheck++;
          if (updatesSinceLastCheck > 5) {
            console.warn("Troppi aggiornamenti ravvicinati, ignoro questo:", id);
            return;
          }
        }
        lastUpdateTime = now;
        updatesSinceLastCheck++;
  
        const cachedSong = cachedSongs[id];
        let hasChanged = false;
        if (!cachedSong) {
          hasChanged = true;
        } else {
          hasChanged =
            song.title !== cachedSong.title ||
            song.artist !== cachedSong.artist ||
            song.fileUrl !== cachedSong.fileUrl ||
            song.artworkUrl !== cachedSong.artworkUrl;
        }
        if (hasChanged) {
          cachedSongs[id] = song;
          clearTimeout(renderTimeout);
          renderTimeout = setTimeout(() => {
            console.log("Aggiornamento rilevato, rendering...");
            renderSongs();
          }, 500);
        }
      });
    }
  
    // Renderizza la lista dei brani nell'elemento con id "songList"
    function renderSongs() {
      const songList = document.getElementById("songList");
      if (!songList) {
        console.error("Elemento 'songList' non trovato in pagina.");
        return;
      }
      
      // Verifica stato autenticazione corrente
      checkAuthState();
      
      // Solo se l'utente è autenticato
      if (!isUserAuthenticated) {
        songList.innerHTML = '<div class="alert alert-info text-center">Effettua il login per visualizzare i brani</div>';
        return;
      }
      
      let tempHTML = "";
      Object.keys(cachedSongs).forEach((id) => {
        const song = cachedSongs[id];
        if (song && song.title && song.artist) {
          let artworkHTML = "";
          if (song.artworkUrl) {
            artworkHTML = `<img src="${song.artworkUrl}" class="artwork-img" alt="Artwork: ${song.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5OTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='" />`;
          } else {
            artworkHTML = `<div class="artwork-img" style="background-color:#ddd; display:inline-block;"></div>`;
          }
          let durationHTML = "";
          if (song.duration) {
            const minutes = Math.floor(song.duration / 60);
            const seconds = song.duration % 60;
            durationHTML = `<div class="text-muted small">${minutes}:${seconds.toString().padStart(2, "0")}</div>`;
          }
          tempHTML += `
            <li class="list-group-item d-flex align-items-center" data-song-id="${id}" onclick="Protocol.playSong('${id}')">
              ${artworkHTML}
              <div class="ms-2 flex-grow-1">
                <strong>${song.title}</strong>
                <div class="small text-muted">${song.artist}</div>
              </div>
              ${durationHTML}
            </li>`;
        }
      });
      
      if (tempHTML === "") {
        tempHTML = '<div class="alert alert-info text-center">Nessun brano trovato</div>';
      }
      
      songList.innerHTML = tempHTML;
    }
  
    // Riproduce la traccia cliccata (utilizzata inline dal markup)
    function playSong(songId) {
      if (!songId) {
        console.error("ID del brano non valido");
        return;
      }

      const song = cachedSongs[songId];
      if (!song || !song.fileUrl) {
        console.error("Brano non trovato o URL file non valido", songId);
        return;
      }

      const audioPlayer = document.getElementById("audioPlayer");
      if (!audioPlayer) {
        console.error("Elemento 'audioPlayer' non trovato in pagina.");
        return;
      }
      
      // Verifica che l'URL del file sia valido
      if (typeof song.fileUrl !== 'string' || !song.fileUrl.startsWith('http')) {
        console.error("URL del file non valido:", song.fileUrl);
        return;
      }
      
      // Rimuove eventuali classi attive da altri elementi
      document.querySelectorAll("#songList li").forEach((li) => li.classList.remove("active", "bg-light"));
      const li = document.querySelector(`#songList li[data-song-id="${songId}"]`);
      if (li) li.classList.add("active", "bg-light");
      
      // Imposta e riproduce la traccia
      audioPlayer.src = song.fileUrl;
      audioPlayer.play().catch(err => {
        console.error("Errore riproduzione:", err.message);
      });
    }
  
    // Esegue un fetch una tantum delle tracce (non real-time)
    function fetchTracks(callback) {
      // Verifica stato autenticazione corrente
      checkAuthState();
      
      // Solo se l'utente è autenticato
      if (!isUserAuthenticated) {
        if (callback) callback([]);
        return;
      }
      
      const tracks = [];
      songsRef.map().once((song, id) => {
        if (song) {
          tracks.push({ id: id, song: song });
        }
      });
      if (callback) callback(tracks);
    }
  
    // NUOVE FUNZIONALITÀ:
  
    // 1. Integrazione con Identity Service - RIMOSSA PER ORA
    /* 
    async function getAuthToken() {
      const username = localStorage.getItem('username');
      const response = await fetch('http://localhost:3002/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      localStorage.setItem('jwt_token', data.token);
      return data.token;
    }
    */
  
    // 2. Ricerca avanzata tramite Discovery Node
    async function searchTracks(query, options = {}) {
      try {
        // Verifica che l'utente sia autenticato
        if (!checkAuthState()) {
          console.error("Ricerca non possibile: utente non autenticato");
          return [];
        }
        
        console.log("Esecuzione ricerca:", query, options);
        
        // Per ora, implementiamo la ricerca localmente utilizzando la cache delle canzoni
        // invece di fare chiamate esterne al discovery node
        const results = [];
        
        // Ricerca nella cache locale
        for (const id in cachedSongs) {
          const song = cachedSongs[id];
          if (!song) continue;
          
          // Aggiungi un flag per il campo ID
          song.id = id;
          
          // Controlla se la query corrisponde a titolo, artista o album
          const matchesQuery = !query || 
            (song.title && song.title.toLowerCase().includes(query.toLowerCase())) || 
            (song.artist && song.artist.toLowerCase().includes(query.toLowerCase())) || 
            (song.album && song.album.toLowerCase().includes(query.toLowerCase()));
          
          // Controlla se corrisponde al genere specificato
          const matchesGenre = !options.genre || 
            (song.genre && song.genre.toLowerCase() === options.genre.toLowerCase());
          
          // Controlla se corrisponde all'artista specificato
          const matchesArtist = !options.artist || 
            (song.artist && song.artist.toLowerCase() === options.artist.toLowerCase());
          
          // Se corrisponde a tutti i criteri, aggiungilo ai risultati
          if (matchesQuery && matchesGenre && matchesArtist) {
            results.push(song);
          }
        }
        
        console.log("Risultati ricerca:", results.length);
        return results;
      } catch (error) {
        console.error('Errore durante la ricerca locale:', error);
        return [];
      }
    }
  
    // 3. Support per replicazione contenuti
    async function ensureContentAvailability(fileId) {
      // Funzionalità rimossa per ora
      console.log("Verifica disponibilità contenuto:", fileId);
      return true; // Assume sempre che il contenuto sia disponibile
    }
  
    // Espone le funzioni e gli oggetti utili tramite l'oggetto globale Protocol
    window.Protocol = {
      registerUser: function (username, password, callback) {
        if (!username || !password) {
          if (callback) callback("Username e password sono richiesti", null);
          return;
        }

        try {
          console.log("Tentativo di registrazione per:", username);
          user.leave(); // Ensure clean state

          user.create(username, password, function(ack) {
            // Check for errors reported by create (ack will contain error info if failed)
            if (ack && (ack.err || ack.code)) {
              const errorMsg = ack.err || ack.message || "Errore durante la creazione dell'utente";
              console.error("Errore creazione utente:", errorMsg, ack);
              if (callback) callback(errorMsg, null);
              return;
            }

            // Registration successful, now attempt immediate login
            console.log("Registrazione preliminare riuscita, tentativo di login...");
            user.auth(username, password, function(authAck) {
              // Check for login errors
              if (authAck && (authAck.err || authAck.code)) {
                const errorMsg = authAck.err || authAck.message || "Login dopo registrazione fallito";
                console.error("Errore login post-registrazione:", errorMsg, authAck);
                // Still call registration successful, but login failed
                if (callback) callback(null, "Registrazione completata, ma login fallito. Riprova il login.");
                return;
              }

              // Login successful
              console.log("Login post-registrazione riuscito.");
              isUserAuthenticated = true;
              if (callback) callback(null, "Registrazione e login completati con successo!");

              // Initialize session immediately
              cachedSongs = {};
              try {
                initSongCache();
                initSongSubscription();
                // Ensure UI update function exists and call it
                if (window.updateAuthUI && typeof window.updateAuthUI === 'function') {
                  window.updateAuthUI();
                }
              } catch (e) {
                console.error("Errore durante l'inizializzazione dopo registrazione/login:", e);
              }
            });
          });
        } catch (e) {
          console.error("Eccezione durante la registrazione:", e);
          if (callback) callback("Errore imprevisto durante la registrazione", null);
        }
      },
      
      loginUser: function (username, password, callback) {
        if (!username || !password) {
          if (callback) callback("Username e password sono richiesti", null);
          return;
        }

        // Reset flag first
        isUserAuthenticated = false;

        try {
          console.log("Tentativo di login per:", username);
          user.leave(); // Ensure clean state before auth attempt

          user.auth(username, password, function(ack) {
            // Check for errors reported by auth (ack will contain error info if failed)
            if (ack && (ack.err || ack.code)) {
              const errorMsg = ack.err || ack.message || "Username o password non validi";
              console.error("Errore login:", errorMsg, ack);
              isUserAuthenticated = false; // Ensure flag is false on error
              if (callback) callback(errorMsg, null);
              // Clean up UI if necessary
              if (window.updateAuthUI && typeof window.updateAuthUI === 'function') {
                window.updateAuthUI();
              }
              return;
            }

            // Login appears successful according to callback, double-check user state
            if (!user.is || !user.is.pub) {
               console.error("Errore post-login: stato utente Gun non valido.");
               isUserAuthenticated = false;
               if (callback) callback("Autenticazione fallita: stato utente invalido", null);
               // Clean up UI if necessary
               if (window.updateAuthUI && typeof window.updateAuthUI === 'function') {
                 window.updateAuthUI();
               }
               return;
            }

            // Login successful
            console.log("Login avvenuto con successo:", user.is.alias);
            isUserAuthenticated = true;
            if (callback) callback(null, "Login effettuato con successo!");

            // After successful login, initialize the cache and subscription immediately
            cachedSongs = {}; // Reset cache before filling
            try {
              initSongCache();
              initSongSubscription();
              // Ensure UI update function exists and call it
              if (window.updateAuthUI && typeof window.updateAuthUI === 'function') {
                window.updateAuthUI();
              }
            } catch (e) {
              console.error("Errore durante l'inizializzazione dopo login:", e);
            }
          });
        } catch (e) {
          console.error("Eccezione durante il login:", e);
          isUserAuthenticated = false; // Ensure flag is false on exception
          if (callback) callback("Errore imprevisto durante il login", null);
          // Clean up UI if necessary
          if (window.updateAuthUI && typeof window.updateAuthUI === 'function') {
             window.updateAuthUI();
          }
        }
      },
      saveSong: function (song, callback) {
        // Verifica che l'utente sia autenticato
        if (!checkAuthState()) {
          if (callback) callback("Devi effettuare il login per salvare un brano", null);
          return;
        }

        try {
          console.log("Tentativo di salvataggio brano:", song.title);

          if (!song.id) {
            // Use Gun's soul generation for potential better compatibility if needed later
            // song.id = Gun.node.soul(song) || ("song-" + Date.now()); // Or keep simple ID
             song.id = "song-" + Date.now() + Math.random().toString(16).slice(2); // Add randomness
          }
          song.timestamp = new Date().toISOString();

          console.log(`Tentativo: songsRef.set() con ID: ${song.id}`);
          console.log("Oggetto brano da salvare:", JSON.stringify(song));
          console.log("songsRef è valido?", !!songsRef);


          // Salva il brano nel nodo pubblico 'songs'
          songsRef.get(song.id).put(song, function(ack) { // Use put on the specific key
            console.log("Callback di songsRef.put() eseguita."); // Log callback execution

            if (ack && ack.err) {
              console.error("Errore restituito da Gun .put():", ack.err);
              // Provide a more specific error message if possible
              const errorMsg = typeof ack.err === 'object' ? (ack.err.message || JSON.stringify(ack.err)) : ack.err;
              if (callback) callback(`Errore durante il salvataggio: ${errorMsg}`, null);
            } else if (ack && !ack.ok) {
               console.warn("Gun .put() ha restituito ack ma non 'ok':", ack);
               // Consider this a potential issue, but might not be a full error
               if (callback) callback("Salvataggio completato ma con avviso dal DB.", null); // Treat as success with warning
               // Optionally, still update cache and UI
               cachedSongs[song.id] = song; // Update cache optimistically or after verification
               renderSongs(); // Update UI
            }
             else {
              console.log("Brano salvato con successo (ack):", ack);
              // Update local cache immediately on success
              cachedSongs[song.id] = song;
              renderSongs(); // Update UI immediately
              if (callback) callback(null, "Brano salvato con successo!");
            }
          });

          console.log("Chiamata a songsRef.put() completata (callback potrebbe essere asincrona).");

        } catch (e) {
          console.error("Eccezione durante il salvataggio:", e);
          if (callback) callback("Errore imprevisto durante il salvataggio", null);
        }
      },
      logout: function() {
        user.leave();
        isUserAuthenticated = false;
        cachedSongs = {};
        renderSongs(); // Aggiorna la UI dopo il logout
        console.log("Logout effettuato");
        return true;
      },
      isAuthenticated: function() {
        return checkAuthState(); // Verifica sempre lo stato attuale
      },
      subscribeSongs: initSongSubscription,
      fetchTracks: fetchTracks,
      renderSongs: renderSongs,
      playSong: playSong,
      addRelay: addRelay,
      updateGunInstance: updateGunInstance,
      // Accesso diretto agli oggetti interni se necessario
      getGunInstance: () => gun,
      getUser: () => user,
      getSongsRef: () => songsRef,
      // Aggiungi nuovi metodi
      searchTracks,
      ensureContentAvailability,
    };
  })();
  